-- Catálogo de serviços do negócio (preço em centavos, duração em minutos), com limite por plano aplicado no banco.

create table public.services (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 80),
  description      text check (description is null or char_length(description) <= 300),
  category         text check (category is null or char_length(category) between 2 and 40),
  price_cents      integer not null check (price_cents between 0 and 10000000),
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  cost_cents       integer not null default 0 check (cost_cents between 0 and 10000000), -- material por atendimento (uso interno)
  is_active        boolean not null default true,
  show_on_page     boolean not null default true,
  sort_order       integer not null default 0,
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.services enable row level security;
create unique index services_tenant_name_key on public.services (tenant_id, lower(name));
create index services_tenant_order_idx on public.services (tenant_id, sort_order, name);
create index services_created_by_idx on public.services (created_by);

create policy services_select on public.services for select to authenticated
  using (private.is_tenant_member(tenant_id));
create policy services_insert on public.services for insert to authenticated
  with check (private.can_manage_tenant(tenant_id));
create policy services_update on public.services for update to authenticated
  using (private.can_manage_tenant(tenant_id)) with check (private.can_manage_tenant(tenant_id));
create policy services_delete on public.services for delete to authenticated
  using (private.can_manage_tenant(tenant_id));

grant select, delete on public.services to authenticated;
grant insert (tenant_id, name, description, category, price_cents, duration_minutes, cost_cents, is_active, show_on_page, sort_order)
  on public.services to authenticated;
grant update (name, description, category, price_cents, duration_minutes, cost_cents, is_active, show_on_page, sort_order)
  on public.services to authenticated;

create trigger services_updated_at before update on public.services
  for each row execute function private.set_updated_at();
create trigger services_audit after insert or update or delete on public.services
  for each row execute function private.audit_row_change();

-- Limite do plano (e exceções por negócio) aplicado no banco, com trava para inserções simultâneas.
create function private.enforce_services_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_enabled boolean; v_limit integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text, 0));
  select fs.enabled, fs.limit_value into v_enabled, v_limit from private.feature_state(new.tenant_id, 'services') fs;
  if not coalesce(v_enabled, false) then raise exception 'feature_disabled' using errcode = 'P0001'; end if;
  if v_limit is not null and (select count(*) from public.services where tenant_id = new.tenant_id) >= v_limit then
    raise exception 'limit_reached' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger services_limit before insert on public.services
  for each row execute function private.enforce_services_limit();

-- Contador de uso (usado por tenant_feature e pelo console).
create function private.sync_services_usage() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  insert into public.feature_usage (tenant_id, feature_key, period, used)
  values (v_tenant, 'services', 'lifetime', (select count(*) from public.services where tenant_id = v_tenant))
  on conflict (tenant_id, feature_key, period) do update set used = excluded.used;
  return null;
end $$;
create trigger services_usage after insert or delete on public.services
  for each row execute function private.sync_services_usage();

-- Página pública passa a devolver os serviços visíveis (ativos e marcados para aparecer).
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
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', sv.name, 'description', sv.description, 'category', sv.category,
        'price_cents', sv.price_cents, 'duration_minutes', sv.duration_minutes
      ) order by sv.sort_order, sv.name)
      from (select * from public.services
             where tenant_id = t.id and is_active and show_on_page
             order by sort_order, name limit 60) sv
    ), '[]'::jsonb)
  );
end $$;
