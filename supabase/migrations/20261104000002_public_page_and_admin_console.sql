-- Página pública do negócio (/{slug}) e base do console de administração da plataforma.
-- Tudo aqui passa por RPCs security definer ou por RLS já existente; nada de service_role no app.

-- ----------------------------------------------------------------------------
-- 1. Leitura pública do negócio: só campos seguros, só negócios ativos.
--    Endereço só aparece se a profissional marcou address_public (padrão: oculto).
--    Nunca expõe documento, e-mail, telefone pessoal, razão social ou dados de saúde.
-- ----------------------------------------------------------------------------
create function public.get_public_tenant(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', t.slug,
    'business_name', t.business_name,
    'city', s.city,
    'state', s.state,
    'neighborhood', case when s.address_public then s.neighborhood end,
    'address_line', case when s.address_public then s.address_line end,
    'whatsapp', s.whatsapp,
    'instagram', s.instagram,
    'primary_color', s.primary_color,
    'accent_color', s.accent_color,
    'specialties', coalesce((
      select jsonb_agg(sp.name order by sp.sort_order, sp.name)
      from public.tenant_specialties ts
      join public.specialties sp on sp.id = ts.specialty_id
      where ts.tenant_id = t.id and sp.is_active
    ), '[]'::jsonb)
  )
  from public.tenants t
  left join public.tenant_settings s on s.tenant_id = t.id
  where t.slug = lower(trim(coalesce(p_slug, ''))) and t.status = 'active';
$$;

revoke all on function public.get_public_tenant(text) from public;
grant execute on function public.get_public_tenant(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Auditoria das alterações administrativas (tabelas sem tenant_id)
-- ----------------------------------------------------------------------------
create function private.audit_admin_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_meta jsonb;
  v_changed text[];
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}') into v_changed
    from jsonb_object_keys(v_new) k
    where k <> 'updated_at' and (v_new -> k) is distinct from (v_old -> k);
    if coalesce(array_length(v_changed, 1), 0) = 0 then return new; end if;
    v_meta := jsonb_build_object('changed', to_jsonb(v_changed), 'old', v_old, 'new', v_new);
  else
    v_meta := jsonb_build_object('row', v_row);
  end if;
  if octet_length(v_meta::text) > 8000 then
    v_meta := jsonb_build_object('note', 'metadata truncated', 'key', coalesce(v_row ->> 'key', v_row ->> 'slug', v_row ->> 'feature_key'));
  end if;

  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (null, (select auth.uid()), 'admin.' || tg_table_name || '.' || lower(tg_op), tg_table_name,
          (v_row ->> 'id')::uuid, v_meta);
  return coalesce(new, old);
end $$;

create trigger plans_admin_audit after insert or update or delete on public.plans
  for each row execute function private.audit_admin_change();
create trigger features_admin_audit after insert or update or delete on public.features
  for each row execute function private.audit_admin_change();
create trigger plan_features_admin_audit after insert or update or delete on public.plan_features
  for each row execute function private.audit_admin_change();
create trigger specialties_admin_audit after insert or update or delete on public.specialties
  for each row execute function private.audit_admin_change();
create trigger platform_settings_admin_audit after insert or update or delete on public.platform_settings
  for each row execute function private.audit_admin_change();

-- ----------------------------------------------------------------------------
-- 3. Plano novo ganha uma linha (desligada) para cada recurso; recurso novo, para cada plano.
--    Evita "plano sem linha de recurso" (que a regra de limites trata como indisponível).
-- ----------------------------------------------------------------------------
create function private.fill_plan_features_for_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
  select new.id, f.key, false, null from public.features f
  on conflict (plan_id, feature_key) do nothing;
  return new;
end $$;

create function private.fill_plan_features_for_feature() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
  select p.id, new.key, false, null from public.plans p
  on conflict (plan_id, feature_key) do nothing;
  return new;
end $$;

create trigger plans_fill_features after insert on public.plans
  for each row execute function private.fill_plan_features_for_plan();
create trigger features_fill_plans after insert on public.features
  for each row execute function private.fill_plan_features_for_feature();

-- ----------------------------------------------------------------------------
-- 4. RPCs do console (cada uma valida o papel do admin dentro do banco)
-- ----------------------------------------------------------------------------
create function public.admin_set_tenant_status(p_tenant uuid, p_status public.tenant_status, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old public.tenant_status;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.is_platform_admin(array['superadmin','support']::public.platform_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('active','suspended') then raise exception 'invalid_status'; end if;
  select status into v_old from public.tenants where id = p_tenant;
  if not found then raise exception 'tenant_not_found'; end if;
  if v_old = 'deleted' then raise exception 'tenant_deleted'; end if;

  update public.tenants set status = p_status where id = p_tenant;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_tenant, (select auth.uid()), 'admin.tenant.set_status', 'tenants', p_tenant,
          jsonb_build_object('from', v_old, 'to', p_status, 'reason', left(coalesce(p_reason, ''), 300)));
end $$;

create function public.admin_list_platform_admins()
returns table (user_id uuid, email text, role public.platform_role, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin(array['superadmin']::public.platform_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select pa.user_id, u.email::text, pa.role, pa.created_at
    from public.platform_admins pa join auth.users u on u.id = pa.user_id
    order by pa.created_at;
end $$;

create function public.admin_grant_platform_role(p_email text, p_role public.platform_role)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not private.is_platform_admin(array['superadmin']::public.platform_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'user_not_found'; end if;

  insert into public.platform_admins (user_id, role) values (v_user, p_role)
  on conflict (user_id) do update set role = excluded.role;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (null, (select auth.uid()), 'admin.platform_admin.grant', 'platform_admins', v_user,
          jsonb_build_object('role', p_role));
end $$;

create function public.admin_revoke_platform_role(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin(array['superadmin']::public.platform_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then raise exception 'cannot_revoke_self'; end if;
  delete from public.platform_admins where user_id = p_user;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (null, (select auth.uid()), 'admin.platform_admin.revoke', 'platform_admins', p_user, '{}'::jsonb);
end $$;

revoke all on function public.admin_set_tenant_status(uuid, public.tenant_status, text) from public, anon;
revoke all on function public.admin_list_platform_admins() from public, anon;
revoke all on function public.admin_grant_platform_role(text, public.platform_role) from public, anon;
revoke all on function public.admin_revoke_platform_role(uuid) from public, anon;
grant execute on function public.admin_set_tenant_status(uuid, public.tenant_status, text) to authenticated;
grant execute on function public.admin_list_platform_admins() to authenticated;
grant execute on function public.admin_grant_platform_role(text, public.platform_role) to authenticated;
grant execute on function public.admin_revoke_platform_role(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Textos editáveis da tela "Bem-vinda" (antes fixos no código)
-- ----------------------------------------------------------------------------
insert into public.platform_settings (key, value, is_public, description) values
  ('welcome.benefits', '[
    {"title":"Painel do seu negócio","text":"Seu espaço com atalhos e o resumo do seu plano, desde o primeiro dia.","available":true},
    {"title":"Calculadora de preços","text":"Calcule quanto cobrar por serviço considerando material, tempo, custos fixos, taxa da maquininha e lucro.","available":true},
    {"title":"Página pública com o seu link","text":"Um endereço só seu para divulgar no Instagram e no WhatsApp, com QR code.","available":true},
    {"title":"Serviços e clientes","text":"Cadastro de serviços com preço e duração, e ficha de cada cliente.","available":false},
    {"title":"Agenda","text":"Horários, encaixes e histórico de atendimentos em um só lugar.","available":false},
    {"title":"Anamnese digital","text":"Ficha de saúde da cliente guardada com acesso mínimo e protegida (LGPD).","available":false},
    {"title":"Financeiro e estoque","text":"Entradas, saídas, fluxo de caixa e controle de materiais.","available":false}
  ]'::jsonb, true, 'Benefícios exibidos na tela Bem-vinda (lista de {title,text,available})'),
  ('welcome.guarantees', '[
    "Comece grátis, sem cartão de crédito.",
    "Cada negócio é isolado: ninguém vê os dados de outra profissional.",
    "Dados de saúde das clientes ficam separados, e nem a nossa equipe os acessa.",
    "Feito para usar no celular.",
    "Cresce com você: você muda de plano quando precisar."
  ]'::jsonb, true, 'Garantias exibidas na tela Bem-vinda (lista de textos)')
on conflict (key) do nothing;
