-- Serviços-modelo por segmento da calculadora: só nome e duração típica (sugestões editáveis, sem preços).
alter table public.calculator_presets
  add column services jsonb not null default '[]'::jsonb
  check (jsonb_typeof(services) = 'array' and jsonb_array_length(services) <= 40);

update public.calculator_presets p set services = v.services::jsonb
from (values
  ('unhas', '[{"name":"Esmaltação em gel","minutes":60},{"name":"Manicure","minutes":45},{"name":"Pedicure","minutes":60},{"name":"Alongamento em gel","minutes":150},{"name":"Manutenção de alongamento","minutes":120},{"name":"Blindagem","minutes":90}]'),
  ('barbearia', '[{"name":"Corte","minutes":40},{"name":"Barba","minutes":30},{"name":"Corte + barba","minutes":60},{"name":"Sobrancelha","minutes":15},{"name":"Pigmentação","minutes":30},{"name":"Selagem","minutes":60}]'),
  ('cabelo', '[{"name":"Corte feminino","minutes":60},{"name":"Escova","minutes":45},{"name":"Coloração","minutes":120},{"name":"Mechas","minutes":240},{"name":"Hidratação","minutes":60},{"name":"Progressiva","minutes":180}]'),
  ('sobrancelhas', '[{"name":"Design","minutes":30},{"name":"Design com henna","minutes":45},{"name":"Brow lamination","minutes":60},{"name":"Micropigmentação","minutes":120}]'),
  ('cilios', '[{"name":"Extensão fio a fio","minutes":150},{"name":"Volume russo","minutes":180},{"name":"Manutenção","minutes":90},{"name":"Lash lifting","minutes":60}]'),
  ('maquiagem', '[{"name":"Maquiagem social","minutes":60},{"name":"Maquiagem de noiva","minutes":120},{"name":"Produção completa","minutes":150}]'),
  ('estetica', '[{"name":"Limpeza de pele","minutes":90},{"name":"Peeling","minutes":60},{"name":"Drenagem linfática","minutes":60},{"name":"Massagem modeladora","minutes":60}]'),
  ('depilacao', '[{"name":"Pernas","minutes":40},{"name":"Axilas","minutes":15},{"name":"Virilha","minutes":30},{"name":"Corpo completo","minutes":120}]'),
  ('micropigmentacao', '[{"name":"Sobrancelhas","minutes":150},{"name":"Lábios","minutes":150},{"name":"Retoque","minutes":90}]'),
  ('massagem', '[{"name":"Relaxante","minutes":60},{"name":"Modeladora","minutes":60},{"name":"Terapêutica","minutes":60}]')
) as v(slug, services)
where p.slug = v.slug;
