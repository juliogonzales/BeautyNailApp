-- Painel de acompanhamento liberado em TODOS os planos (inclusive o gratuito Esmalte).
-- A calculadora de preços (`pricing_calculator`) já estava habilitada nos 4 planos no seed.
-- Observação: ao criar um plano novo, insira também a linha de `dashboard` em plan_features.
insert into public.features (key, name, description, kind, unit, sort_order) values
  ('dashboard', 'Painel de acompanhamento', 'Painel inicial do negócio com atalhos e resumo', 'flag', null, 5)
on conflict (key) do nothing;

insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
select p.id, 'dashboard', true, null from public.plans p
on conflict (plan_id, feature_key) do nothing;

-- Novas rotas do app que não podem virar endereço de negócio (/{slug}).
insert into public.reserved_slugs (slug) values ('bem-vinda'), ('calculadora')
on conflict (slug) do nothing;
