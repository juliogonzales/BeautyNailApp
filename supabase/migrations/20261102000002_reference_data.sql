-- Dados de referência (configuráveis pelo admin; NENHUM limite fica fixo no código).
-- Valores de planos são sugestões iniciais — ver docs/DECISIONS.md (D-005).

insert into public.features (key, name, description, kind, unit, sort_order) values
  ('customers',          'Clientes',               'Quantidade de clientes cadastradas',        'limit', 'clientes', 10),
  ('services',           'Serviços',               'Quantidade de serviços cadastrados',        'limit', 'serviços', 20),
  ('portfolio_images',   'Fotos do portfólio',     'Imagens na galeria',                        'limit', 'fotos',    30),
  ('storage_mb',         'Armazenamento',          'Espaço total de arquivos',                  'limit', 'MB',       40),
  ('professionals',      'Profissionais',          'Membros que atendem (equipe)',              'limit', 'pessoas',  50),
  ('units',              'Unidades',               'Endereços/unidades do negócio',             'limit', 'unidades', 60),
  ('campaigns',          'Campanhas',              'Campanhas de marketing por mês',            'limit', 'por mês',  70),
  ('ai_credits',         'Créditos de IA',         'Uso do Beauty Copilot por mês',             'limit', 'por mês',  80),
  ('anamnesis',          'Anamnese digital',       'Fichas e formulários de saúde',             'flag',  null,      110),
  ('finance',            'Financeiro',             'Receitas, despesas e fluxo de caixa',       'flag',  null,      120),
  ('inventory',          'Estoque',                'Controle de materiais e produtos',          'flag',  null,      130),
  ('pricing_calculator', 'Calculadora de preços',  'Precificação inteligente',                  'flag',  null,      140),
  ('custom_domain',      'Domínio próprio',        'Página pública em domínio personalizado',   'flag',  null,      150),
  ('marketing',          'Marketing',              'Cupons e campanhas',                        'flag',  null,      160),
  ('loyalty',            'Fidelidade',             'Programa de pontos e recompensas',          'flag',  null,      170),
  ('packages',           'Pacotes e assinaturas',  'Pacotes e planos para clientes',            'flag',  null,      180),
  ('store',              'Loja própria',           'Venda de produtos e vales',                 'flag',  null,      190),
  ('advanced_reports',   'Relatórios avançados',   'Indicadores e relatórios completos',        'flag',  null,      200),
  ('team_commissions',   'Equipe e comissões',     'Comissões, repasses e permissões',          'flag',  null,      210),
  ('suppliers_network',  'Fornecedores e parceiros','Localizador e rede de parcerias',          'flag',  null,      220);

insert into public.plans (slug, name, description, price_monthly_cents, price_yearly_cents, trial_days, sort_order) values
  ('esmalte', 'Esmalte', 'Gratuito — comece a organizar seu trabalho',  0,      0,      0,  10),
  ('gel',     'Gel',     'Profissional — agenda, CRM e financeiro',     3990,   39900,  14, 20),
  ('fibra',   'Fibra',   'Premium — marca própria e crescimento',       7990,   79900,  14, 30),
  ('master',  'Master',  'Studio — equipe, comissões e unidades',       14990,  149900, 14, 40);

with ov (plan_slug, feature_key, enabled, limit_value) as (values
  -- Esmalte (gratuito)
  ('esmalte','customers',true,30), ('esmalte','services',true,10), ('esmalte','portfolio_images',true,20),
  ('esmalte','storage_mb',true,100), ('esmalte','professionals',true,1), ('esmalte','units',true,1),
  ('esmalte','pricing_calculator',true,null::integer),
  -- Gel
  ('gel','customers',true,300), ('gel','services',true,50), ('gel','portfolio_images',true,200),
  ('gel','storage_mb',true,1024), ('gel','professionals',true,1), ('gel','units',true,1),
  ('gel','anamnesis',true,null), ('gel','finance',true,null), ('gel','inventory',true,null),
  ('gel','pricing_calculator',true,null),
  -- Fibra
  ('fibra','customers',true,null), ('fibra','services',true,null), ('fibra','portfolio_images',true,1000),
  ('fibra','storage_mb',true,5120), ('fibra','professionals',true,3), ('fibra','units',true,1),
  ('fibra','campaigns',true,20), ('fibra','ai_credits',true,50),
  ('fibra','anamnesis',true,null), ('fibra','finance',true,null), ('fibra','inventory',true,null),
  ('fibra','pricing_calculator',true,null), ('fibra','custom_domain',true,null), ('fibra','marketing',true,null),
  ('fibra','loyalty',true,null), ('fibra','packages',true,null), ('fibra','store',true,null),
  ('fibra','advanced_reports',true,null), ('fibra','suppliers_network',true,null),
  -- Master
  ('master','customers',true,null), ('master','services',true,null), ('master','portfolio_images',true,5000),
  ('master','storage_mb',true,20480), ('master','professionals',true,15), ('master','units',true,5),
  ('master','campaigns',true,null), ('master','ai_credits',true,300),
  ('master','anamnesis',true,null), ('master','finance',true,null), ('master','inventory',true,null),
  ('master','pricing_calculator',true,null), ('master','custom_domain',true,null), ('master','marketing',true,null),
  ('master','loyalty',true,null), ('master','packages',true,null), ('master','store',true,null),
  ('master','advanced_reports',true,null), ('master','team_commissions',true,null), ('master','suppliers_network',true,null)
)
insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
select p.id, f.key, coalesce(ov.enabled, false), ov.limit_value
from public.plans p
cross join public.features f
left join ov on ov.plan_slug = p.slug and ov.feature_key = f.key;

insert into public.specialties (slug, name, sort_order) values
  ('nail-design','Nail Design',10), ('manicure','Manicure',20), ('pedicure','Pedicure',30),
  ('alongamento-de-unhas','Alongamento de unhas',40), ('sobrancelhas','Sobrancelhas',50),
  ('lash-design','Lash Design',60), ('extensao-de-cilios','Extensão de cílios',70),
  ('cabeleireira','Cabeleireira',80), ('colorista','Colorista',90), ('trancista','Trancista',100),
  ('maquiadora','Maquiadora',110), ('esteticista','Esteticista',120), ('massoterapeuta','Massoterapeuta',130),
  ('depiladora','Depiladora',140), ('micropigmentadora','Micropigmentadora',150),
  ('outros-servicos','Outros serviços de beleza',999);

insert into public.reserved_slugs (slug) values
  ('admin'),('administrador'),('api'),('app'),('auth'),('login'),('logout'),('signup'),('cadastro'),('entrar'),
  ('dashboard'),('painel'),('onboarding'),('planos'),('precos'),('pricing'),('suporte'),('support'),('ajuda'),
  ('help'),('termos'),('privacidade'),('terms'),('privacy'),('blog'),('sobre'),('about'),('contato'),('contact'),
  ('loja'),('store'),('marketplace'),('onde-comprar'),('fornecedores'),('parceiros'),('www'),('mail'),('static'),
  ('assets'),('public'),('sitemap'),('robots'),('favicon'),('manifest'),('status'),('beautyos'),('beauty-os'),
  ('root'),('system'),('null'),('undefined'),('settings'),('configuracoes'),('conta'),('account'),('billing'),
  ('checkout'),('webhooks'),('webhook'),('cliente'),('clientes'),('agenda'),('servicos'),('perfil'),('profile'),
  ('reset-password'),('recuperar-senha'),('verify'),('callback'),('docs'),('demo');

insert into public.platform_settings (key, value, is_public, description) values
  ('product.name', '"BeautyNailapp"'::jsonb, true, 'Nome do produto (configurável, nunca fixo no código)'),
  ('product.default_timezone', '"America/Sao_Paulo"'::jsonb, true, 'Fuso padrão'),
  ('product.default_locale', '"pt-BR"'::jsonb, true, 'Idioma padrão'),
  ('tenants.max_owned_per_user', '3'::jsonb, false, 'Limite de negócios por dona (referência; hoje aplicado na RPC create_tenant)');
