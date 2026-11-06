-- Construtor de página: blocos escolhidos e editados pela profissional (sem código), com limite por plano no banco.

alter table public.tenant_settings
  add column page_blocks jsonb
  check (page_blocks is null or (
    jsonb_typeof(page_blocks) = 'array' and jsonb_array_length(page_blocks) <= 30 and octet_length(page_blocks::text) <= 40000
  ));
comment on column public.tenant_settings.page_blocks is 'Blocos da página pública (null = página automática). Validado no app com Zod; só texto, sem HTML.';

grant update (page_blocks) on public.tenant_settings to authenticated;

insert into public.features (key, name, description, kind, unit, sort_order) values
  ('page_blocks', 'Blocos da página', 'Quantidade de blocos que a página pública pode ter (construtor sem código)', 'limit', 'blocos', 56)
on conflict (key) do nothing;
-- Plano gratuito (preço zero): 5 blocos. Planos pagos: sem limite. Editável no console.
update public.plan_features pf set enabled = true, limit_value = case when p.price_monthly_cents = 0 then 5 else null end
from public.plans p where p.id = pf.plan_id and pf.feature_key = 'page_blocks';

create function private.enforce_page_blocks_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_enabled boolean; v_limit integer;
begin
  if new.page_blocks is null or new.page_blocks is not distinct from old.page_blocks then return new; end if;
  select fs.enabled, fs.limit_value into v_enabled, v_limit from private.feature_state(new.tenant_id, 'page_blocks') fs;
  if not coalesce(v_enabled, false) then raise exception 'feature_disabled' using errcode = 'P0001'; end if;
  if v_limit is not null and jsonb_array_length(new.page_blocks) > v_limit then
    raise exception 'limit_reached' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger tenant_settings_page_blocks_limit before update of page_blocks on public.tenant_settings
  for each row execute function private.enforce_page_blocks_limit();

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
    'blocks', s.page_blocks,
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
