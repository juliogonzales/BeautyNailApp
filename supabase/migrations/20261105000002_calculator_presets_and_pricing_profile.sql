-- Calculadora por segmento: presets de materiais (editáveis no console) e perfil de preço de cada negócio.

create table public.calculator_presets (
  slug           text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  name           text not null check (char_length(name) between 2 and 60),
  description    text check (description is null or char_length(description) <= 200),
  -- Lista de {name, unit}. Só nomes: nenhum preço é inventado.
  materials      jsonb not null default '[]'::jsonb
                 check (jsonb_typeof(materials) = 'array' and octet_length(materials::text) <= 4000),
  use_commission boolean not null default false, -- abre o campo de comissão por padrão (barbearia, salão)
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.calculator_presets enable row level security;
create trigger calculator_presets_updated_at before update on public.calculator_presets
  for each row execute function private.set_updated_at();
create trigger calculator_presets_admin_audit after insert or update or delete on public.calculator_presets
  for each row execute function private.audit_admin_change();
create policy calculator_presets_select on public.calculator_presets for select to authenticated
  using (is_active or private.is_platform_admin());
create policy calculator_presets_write on public.calculator_presets for all to authenticated
  using (private.is_platform_admin(array['superadmin']::public.platform_role[]))
  with check (private.is_platform_admin(array['superadmin']::public.platform_role[]));
grant select, insert, update, delete on public.calculator_presets to authenticated;

alter table public.specialties
  add column calculator_preset text references public.calculator_presets (slug) on update cascade on delete set null;
create index specialties_calculator_preset_idx on public.specialties (calculator_preset);

-- Perfil de preço do negócio: preenchido uma vez, usado em todos os serviços.
create table public.pricing_profiles (
  tenant_id            uuid primary key references public.tenants (id) on delete cascade,
  monthly_income_cents integer not null default 0 check (monthly_income_cents between 0 and 100000000),
  days_per_week        smallint not null default 5 check (days_per_week between 1 and 7),
  hours_per_day        smallint not null default 8 check (hours_per_day between 1 and 16),
  occupancy_bp         integer not null default 7000 check (occupancy_bp between 1000 and 10000),
  fixed_costs_cents    integer not null default 0 check (fixed_costs_cents between 0 and 100000000),
  card_fee_bp          integer not null default 0 check (card_fee_bp between 0 and 5000),
  tax_bp               integer not null default 0 check (tax_bp between 0 and 5000),
  commission_bp        integer not null default 0 check (commission_bp between 0 and 9000),
  margin_bp            integer not null default 2000 check (margin_bp between 0 and 8000),
  preset_slug          text references public.calculator_presets (slug) on update cascade on delete set null,
  updated_at           timestamptz not null default now(),
  check (card_fee_bp + tax_bp + commission_bp + margin_bp < 10000)
);
alter table public.pricing_profiles enable row level security;
create index pricing_profiles_preset_idx on public.pricing_profiles (preset_slug);
create trigger pricing_profiles_updated_at before update on public.pricing_profiles
  for each row execute function private.set_updated_at();
create trigger pricing_profiles_audit after insert or update on public.pricing_profiles
  for each row execute function private.audit_row_change();
create policy pricing_profiles_select on public.pricing_profiles for select to authenticated
  using (private.is_tenant_member(tenant_id));
create policy pricing_profiles_insert on public.pricing_profiles for insert to authenticated
  with check (private.can_manage_tenant(tenant_id));
create policy pricing_profiles_update on public.pricing_profiles for update to authenticated
  using (private.can_manage_tenant(tenant_id)) with check (private.can_manage_tenant(tenant_id));
grant select, insert, update on public.pricing_profiles to authenticated;

-- Segmentos e materiais (só nomes e unidades)
insert into public.calculator_presets (slug, name, description, materials, use_commission, sort_order) values
 ('unhas', 'Unhas', 'Manicure, pedicure, alongamento e nail design.', '[
   {"name":"Base / top coat","unit":"ml"},{"name":"Esmalte ou gel de cor","unit":"ml"},{"name":"Gel ou acrigel de construção","unit":"g"},
   {"name":"Tips / molde","unit":"un"},{"name":"Lixas e blocos","unit":"un"},{"name":"Algodão / papel / luvas","unit":"un"},
   {"name":"Removedor e álcool","unit":"ml"},{"name":"Óleo de cutícula / hidratante","unit":"ml"},{"name":"Decoração (pedrarias, adesivos)","unit":"un"}]'::jsonb, false, 10),
 ('barbearia', 'Barbearia', 'Corte, barba, sobrancelha masculina e acabamentos.', '[
   {"name":"Lâmina / navalha descartável","unit":"un"},{"name":"Pomada, cera ou pasta modeladora","unit":"g"},{"name":"Talco","unit":"g"},
   {"name":"Capa ou pescoceira descartável","unit":"un"},{"name":"Álcool / antisséptico","unit":"ml"},{"name":"Loção ou balm pós-barba","unit":"ml"},
   {"name":"Óleo ou balm de barba","unit":"ml"},{"name":"Toalha (lavanderia)","unit":"un"},{"name":"Shampoo","unit":"ml"}]'::jsonb, true, 20),
 ('cabelo', 'Cabelo', 'Corte, coloração, mechas, tratamentos e tranças.', '[
   {"name":"Tintura / coloração","unit":"g"},{"name":"Oxidante","unit":"ml"},{"name":"Descolorante","unit":"g"},{"name":"Shampoo","unit":"ml"},
   {"name":"Máscara / tratamento","unit":"g"},{"name":"Finalizador","unit":"ml"},{"name":"Papel alumínio / touca","unit":"un"},
   {"name":"Luvas e capa descartáveis","unit":"un"},{"name":"Cabelo sintético ou jumbo (tranças)","unit":"un"}]'::jsonb, true, 30),
 ('sobrancelhas', 'Sobrancelhas', 'Design, henna, brow lamination e depilação de sobrancelha.', '[
   {"name":"Henna / tintura","unit":"g"},{"name":"Cera ou linha","unit":"g"},{"name":"Lâmina descartável","unit":"un"},
   {"name":"Gel / produto de lamination","unit":"ml"},{"name":"Cotonetes, gaze e luvas","unit":"un"},{"name":"Calmante / pós-procedimento","unit":"ml"}]'::jsonb, false, 40),
 ('cilios', 'Cílios', 'Extensão, lash lifting e design de cílios.', '[
   {"name":"Fios de extensão","unit":"un"},{"name":"Cola","unit":"ml"},{"name":"Removedor / primer","unit":"ml"},{"name":"Microporo e pads de gel","unit":"un"},
   {"name":"Escovinhas e microbrush","unit":"un"},{"name":"Produto de lifting","unit":"ml"},{"name":"Luvas e máscara","unit":"un"}]'::jsonb, false, 50),
 ('maquiagem', 'Maquiagem', 'Social, noivas e produções.', '[
   {"name":"Base e corretivo","unit":"ml"},{"name":"Pó e fixador","unit":"g"},{"name":"Sombras e batom (uso por cliente)","unit":"un"},
   {"name":"Cílios postiços e cola","unit":"un"},{"name":"Esponjas e pincéis descartáveis","unit":"un"},{"name":"Algodão, lenço e higienização","unit":"un"}]'::jsonb, false, 60),
 ('estetica', 'Estética', 'Limpeza de pele, peeling, drenagem e tratamentos corporais.', '[
   {"name":"Gel, creme ou ampola","unit":"ml"},{"name":"Máscara facial","unit":"g"},{"name":"Ácido / peeling","unit":"ml"},
   {"name":"Luvas, touca e lençol descartável","unit":"un"},{"name":"Gaze e algodão","unit":"un"},{"name":"Álcool e higienização","unit":"ml"}]'::jsonb, true, 70),
 ('depilacao', 'Depilação', 'Cera, linha e outras técnicas.', '[
   {"name":"Cera","unit":"g"},{"name":"Roll-on ou refil","unit":"un"},{"name":"Espátulas","unit":"un"},{"name":"Papel / faixas","unit":"un"},
   {"name":"Óleo pós-depilação / calmante","unit":"ml"},{"name":"Luvas e lençol descartável","unit":"un"}]'::jsonb, false, 80),
 ('micropigmentacao', 'Micropigmentação', 'Sobrancelhas, lábios e outros procedimentos.', '[
   {"name":"Pigmento","unit":"ml"},{"name":"Agulha / cartucho descartável","unit":"un"},{"name":"Anestésico tópico","unit":"g"},
   {"name":"Filme e barreira de proteção","unit":"un"},{"name":"Luvas, gaze e descartáveis","unit":"un"},{"name":"Pomada cicatrizante","unit":"g"}]'::jsonb, false, 90),
 ('massagem', 'Massagem', 'Relaxante, modeladora e terapêutica.', '[
   {"name":"Óleo ou creme de massagem","unit":"ml"},{"name":"Lençol descartável / lavanderia","unit":"un"},{"name":"Óleo essencial","unit":"ml"},{"name":"Toalha (lavanderia)","unit":"un"}]'::jsonb, false, 100),
 ('outros', 'Outros serviços', 'Qualquer serviço de beleza.', '[]'::jsonb, false, 110)
on conflict (slug) do nothing;

insert into public.specialties (slug, name, sort_order)
values ('barbearia', 'Barbearia', 55)
on conflict (slug) do nothing;

update public.specialties set calculator_preset = case slug
  when 'nail-design' then 'unhas' when 'manicure' then 'unhas' when 'pedicure' then 'unhas' when 'alongamento-de-unhas' then 'unhas'
  when 'barbearia' then 'barbearia'
  when 'sobrancelhas' then 'sobrancelhas'
  when 'lash-design' then 'cilios' when 'extensao-de-cilios' then 'cilios'
  when 'cabeleireira' then 'cabelo' when 'colorista' then 'cabelo' when 'trancista' then 'cabelo'
  when 'maquiadora' then 'maquiagem' when 'esteticista' then 'estetica' when 'massoterapeuta' then 'massagem'
  when 'depiladora' then 'depilacao' when 'micropigmentadora' then 'micropigmentacao' when 'outros-servicos' then 'outros'
  end
where calculator_preset is null;
