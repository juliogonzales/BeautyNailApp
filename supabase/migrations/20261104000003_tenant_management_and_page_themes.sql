-- Gestão de negócios (exceções por negócio, troca de plano, visão do negócio) e modelos de página pública.
-- Escrita só por RPCs security definer com papel validado; auditoria por trigger.

-- ----------------------------------------------------------------------------
-- 1. Exceções de recurso por negócio (conceder/limitar fora do plano)
-- ----------------------------------------------------------------------------
create table public.tenant_feature_overrides (
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  feature_key text not null references public.features (key) on delete cascade,
  enabled     boolean not null,
  limit_value integer check (limit_value is null or limit_value >= 0), -- NULL = ilimitado
  reason      text not null check (char_length(reason) between 3 and 300),
  expires_at  timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);
alter table public.tenant_feature_overrides enable row level security;
create index tenant_feature_overrides_feature_idx on public.tenant_feature_overrides (feature_key);
create index tenant_feature_overrides_created_by_idx on public.tenant_feature_overrides (created_by);

-- Só administradores leem (o motivo é interno). Ninguém escreve direto: só as RPCs abaixo.
create policy tenant_feature_overrides_select on public.tenant_feature_overrides for select to authenticated
  using (private.is_platform_admin(array['superadmin','support','billing']::public.platform_role[]));
grant select on public.tenant_feature_overrides to authenticated;

create trigger tenant_feature_overrides_audit after insert or update on public.tenant_feature_overrides
  for each row execute function private.audit_row_change();

-- Contadores de uso: administradores podem ler (só números, sem dado pessoal).
create policy feature_usage_admin_select on public.feature_usage for select to authenticated
  using (private.is_platform_admin(array['superadmin','support','billing']::public.platform_role[]));

-- Estado efetivo de um recurso: exceção vigente tem prioridade sobre o plano.
create function private.feature_state(p_tenant uuid, p_key text)
returns table (enabled boolean, limit_value integer)
language sql stable security definer set search_path = '' as $$
  select coalesce(o.enabled, pf.enabled, false),
         case when o.tenant_id is not null then o.limit_value else pf.limit_value end
  from (select 1) d
  left join public.tenant_feature_overrides o
    on o.tenant_id = p_tenant and o.feature_key = p_key and (o.expires_at is null or o.expires_at > now())
  left join public.subscriptions s on s.tenant_id = p_tenant and s.status <> 'canceled'
  left join public.plan_features pf on pf.plan_id = s.plan_id and pf.feature_key = p_key;
$$;
revoke all on function private.feature_state(uuid, text) from public, anon;

create or replace function public.tenant_feature(p_tenant uuid, p_key text)
returns table (enabled boolean, limit_value integer, used integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.is_tenant_member(p_tenant) or private.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select fs.enabled, fs.limit_value,
         coalesce((select fu.used from public.feature_usage fu
                   where fu.tenant_id = p_tenant and fu.feature_key = p_key and fu.period = 'lifetime'), 0)
  from private.feature_state(p_tenant, p_key) fs;
end $$;

create function public.admin_set_feature_override(
  p_tenant uuid, p_key text, p_enabled boolean, p_limit integer, p_reason text, p_expires timestamptz default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin(array['superadmin','billing']::public.platform_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant) then raise exception 'tenant_not_found'; end if;
  if not exists (select 1 from public.features where key = p_key) then raise exception 'feature_not_found'; end if;
  if p_expires is not null and p_expires <= now() then raise exception 'invalid_expiry'; end if;
  insert into public.tenant_feature_overrides (tenant_id, feature_key, enabled, limit_value, reason, expires_at, created_by)
  values (p_tenant, p_key, p_enabled, case when p_enabled then p_limit end, trim(p_reason), p_expires, (select auth.uid()))
  on conflict (tenant_id, feature_key) do update
    set enabled = excluded.enabled, limit_value = excluded.limit_value, reason = excluded.reason,
        expires_at = excluded.expires_at, created_by = excluded.created_by;
end $$;

create function public.admin_clear_feature_override(p_tenant uuid, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin(array['superadmin','billing']::public.platform_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.tenant_feature_overrides where tenant_id = p_tenant and feature_key = p_key;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_tenant, (select auth.uid()), 'admin.feature_override.clear', 'tenant_feature_overrides', p_tenant,
          jsonb_build_object('feature_key', p_key));
end $$;

-- Troca manual de plano (cortesia/suporte). Cobrança de verdade entra na Fase 8.
create function public.admin_set_tenant_plan(p_tenant uuid, p_plan uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_price integer; v_old uuid;
begin
  if not private.is_platform_admin(array['superadmin','billing']::public.platform_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;
  select price_monthly_cents into v_price from public.plans where id = p_plan and is_active;
  if not found then raise exception 'plan_not_found'; end if;
  select plan_id into v_old from public.subscriptions where tenant_id = p_tenant and status <> 'canceled';
  if not found then raise exception 'subscription_not_found'; end if;

  update public.subscriptions
     set plan_id = p_plan, status = case when v_price = 0 then 'free'::public.subscription_status else 'active'::public.subscription_status end
   where tenant_id = p_tenant and status <> 'canceled';
  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_tenant, (select auth.uid()), 'admin.tenant.set_plan', 'subscriptions', p_tenant,
          jsonb_build_object('from_plan', v_old, 'to_plan', p_plan, 'reason', left(trim(p_reason), 300)));
end $$;

-- Visão do negócio para suporte: contato da dona (para atendimento) e contagem de membros.
create function public.admin_tenant_overview(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin(array['superadmin','support']::public.platform_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'owner_name', pr.full_name,
      'owner_email', u.email,
      'members', (select count(*) from public.tenant_members m where m.tenant_id = p_tenant),
      'specialties', coalesce((select jsonb_agg(sp.name order by sp.sort_order)
                               from public.tenant_specialties ts join public.specialties sp on sp.id = ts.specialty_id
                               where ts.tenant_id = p_tenant), '[]'::jsonb)
    )
    from public.tenants t
    left join public.tenant_members om on om.tenant_id = t.id and om.role = 'owner'
    left join auth.users u on u.id = om.user_id
    left join public.profiles pr on pr.id = om.user_id
    where t.id = p_tenant
    limit 1
  );
end $$;

revoke all on function public.admin_set_feature_override(uuid, text, boolean, integer, text, timestamptz) from public, anon;
revoke all on function public.admin_clear_feature_override(uuid, text) from public, anon;
revoke all on function public.admin_set_tenant_plan(uuid, uuid, text) from public, anon;
revoke all on function public.admin_tenant_overview(uuid) from public, anon;
grant execute on function public.admin_set_feature_override(uuid, text, boolean, integer, text, timestamptz) to authenticated;
grant execute on function public.admin_clear_feature_override(uuid, text) to authenticated;
grant execute on function public.admin_set_tenant_plan(uuid, uuid, text) to authenticated;
grant execute on function public.admin_tenant_overview(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Modelos de página pública (layout, fonte, cores, blocos) gerenciados pelo admin
-- ----------------------------------------------------------------------------
create table public.page_templates (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (char_length(name) between 2 and 60),
  description text check (description is null or char_length(description) <= 200),
  config      jsonb not null check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 4096),
  is_active   boolean not null default true,
  is_default  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.page_templates enable row level security;
create unique index page_templates_one_default on public.page_templates (is_default) where is_default;
create trigger page_templates_updated_at before update on public.page_templates
  for each row execute function private.set_updated_at();
create trigger page_templates_admin_audit after insert or update or delete on public.page_templates
  for each row execute function private.audit_admin_change();

create policy page_templates_select on public.page_templates for select to authenticated
  using (is_active or private.is_platform_admin());
create policy page_templates_write on public.page_templates for all to authenticated
  using (private.is_platform_admin(array['superadmin']::public.platform_role[]))
  with check (private.is_platform_admin(array['superadmin']::public.platform_role[]));
grant select, insert, update, delete on public.page_templates to authenticated;

-- Troca do modelo padrão de forma atômica (o índice único impede dois padrões).
create function public.admin_set_default_template(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin(array['superadmin']::public.platform_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.page_templates where id = p_id and is_active) then raise exception 'template_not_found'; end if;
  update public.page_templates set is_default = false where is_default and id <> p_id;
  update public.page_templates set is_default = true where id = p_id;
end $$;
revoke all on function public.admin_set_default_template(uuid) from public, anon;
grant execute on function public.admin_set_default_template(uuid) to authenticated;

alter table public.tenant_settings
  add column template_id uuid references public.page_templates (id) on delete set null;
create index tenant_settings_template_idx on public.tenant_settings (template_id);
grant update (template_id) on public.tenant_settings to authenticated;

-- Recurso que libera escolher modelo e cores (planos pagos; o admin pode abrir exceções por negócio).
insert into public.features (key, name, description, kind, unit, sort_order) values
  ('custom_theme', 'Aparência da página pública', 'Escolher modelo e cores da página pública', 'flag', null, 55)
on conflict (key) do nothing;
insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
select p.id, 'custom_theme', (p.price_monthly_cents > 0), null from public.plans p
on conflict (plan_id, feature_key) do update set enabled = excluded.enabled;

insert into public.page_templates (slug, name, description, config, is_default, sort_order) values
  ('nude-classico', 'Nude clássico', 'Centralizado, fonte com serifa e tons de bege e marrom.',
   '{"layout":"centered","font":"serif","radius":"soft","avatar":"initial",
     "colors":{"background":"#faf7f2","surface":"#ffffff","text":"#3a3330","muted":"#6f6560","primary":"#5b4636","accent":"#b8975a"},
     "show":{"specialties":true,"whatsapp":true,"instagram":true,"location":true}}'::jsonb, true, 10),
  ('grafite-minimal', 'Grafite minimal', 'Alinhado à esquerda, fonte sem serifa e cantos retos.',
   '{"layout":"left","font":"sans","radius":"none","avatar":"initial",
     "colors":{"background":"#ffffff","surface":"#f4f2ef","text":"#2b2b2b","muted":"#5f5f5f","primary":"#2b2b2b","accent":"#b8975a"},
     "show":{"specialties":true,"whatsapp":true,"instagram":true,"location":true}}'::jsonb, false, 20),
  ('terracota-suave', 'Terracota suave', 'Em cartão, cantos arredondados e tons terrosos.',
   '{"layout":"card","font":"elegant","radius":"round","avatar":"initial",
     "colors":{"background":"#f6ede7","surface":"#fffaf6","text":"#3b2f2a","muted":"#6d5b52","primary":"#8a4f3d","accent":"#c9a27e"},
     "show":{"specialties":true,"whatsapp":true,"instagram":true,"location":true}}'::jsonb, false, 30)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Leitura pública passa a devolver o tema resolvido
--    Modelo escolhido só vale se o recurso custom_theme estiver ativo e o modelo ativo;
--    senão usa o modelo padrão. Cores próprias também exigem o recurso.
-- ----------------------------------------------------------------------------
create or replace function public.get_public_tenant(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t public.tenants;
  s public.tenant_settings;
  v_custom boolean;
  v_cfg jsonb;
begin
  select * into t from public.tenants where slug = lower(trim(coalesce(p_slug, ''))) and status = 'active';
  if not found then return null; end if;
  select * into s from public.tenant_settings where tenant_id = t.id;

  select coalesce((select fs.enabled from private.feature_state(t.id, 'custom_theme') fs), false) into v_custom;

  v_cfg := null;
  if v_custom and s.template_id is not null then
    select pt.config into v_cfg from public.page_templates pt where pt.id = s.template_id and pt.is_active;
  end if;
  if v_cfg is null then
    select pt.config into v_cfg from public.page_templates pt where pt.is_default and pt.is_active limit 1;
  end if;
  v_cfg := coalesce(v_cfg, '{}'::jsonb);

  if v_custom then
    if s.primary_color is not null then
      v_cfg := jsonb_set(v_cfg, '{colors,primary}', to_jsonb(s.primary_color), true);
    end if;
    if s.accent_color is not null then
      v_cfg := jsonb_set(v_cfg, '{colors,accent}', to_jsonb(s.accent_color), true);
    end if;
  end if;

  return jsonb_build_object(
    'slug', t.slug,
    'business_name', t.business_name,
    'city', s.city,
    'state', s.state,
    'neighborhood', case when s.address_public then s.neighborhood end,
    'address_line', case when s.address_public then s.address_line end,
    'whatsapp', s.whatsapp,
    'instagram', s.instagram,
    'primary_color', null,
    'accent_color', null,
    'theme', v_cfg,
    'specialties', coalesce((
      select jsonb_agg(sp.name order by sp.sort_order, sp.name)
      from public.tenant_specialties ts
      join public.specialties sp on sp.id = ts.specialty_id
      where ts.tenant_id = t.id and sp.is_active
    ), '[]'::jsonb)
  );
end $$;
