-- create_tenant escolhia o plano inicial pelo slug 'esmalte'. Renomear planos no console quebrava o cadastro.
-- Agora o plano inicial é o gratuito (preço zero), ativo, de menor ordem.
create or replace function public.create_tenant(p_business_name text, p_slug text, p_specialty_ids uuid[] default '{}'::uuid[])
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid     uuid := (select auth.uid());
  v_slug    text := lower(trim(coalesce(p_slug, '')));
  v_name    text := trim(coalesce(p_business_name, ''));
  v_plan    uuid;
  v_tenant  uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'invalid_business_name' using errcode = 'P0001'; end if;
  if (select count(*) from public.tenant_members m join public.tenants t on t.id = m.tenant_id
      where m.user_id = v_uid and m.role = 'owner' and t.status <> 'deleted') >= 3 then
    raise exception 'tenant_limit_reached' using errcode = 'P0001';
  end if;
  if not public.is_slug_available(v_slug) then raise exception 'slug_unavailable' using errcode = 'P0001'; end if;

  select id into v_plan from public.plans
   where is_active and price_monthly_cents = 0
   order by sort_order, created_at
   limit 1;
  if v_plan is null then raise exception 'default_plan_missing' using errcode = 'P0001'; end if;

  insert into public.tenants (slug, business_name, created_by) values (v_slug, v_name, v_uid) returning id into v_tenant;
  insert into public.tenant_members (tenant_id, user_id, role) values (v_tenant, v_uid, 'owner');
  insert into public.tenant_settings (tenant_id) values (v_tenant);
  insert into public.subscriptions (tenant_id, plan_id, status) values (v_tenant, v_plan, 'free');

  if p_specialty_ids is not null and array_length(p_specialty_ids, 1) > 0 then
    insert into public.tenant_specialties (tenant_id, specialty_id)
    select v_tenant, s.id from public.specialties s where s.id = any (p_specialty_ids) and s.is_active;
  end if;
  return v_tenant;
end $function$;
