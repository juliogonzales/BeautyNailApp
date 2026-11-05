# Schema do banco (Fase 1) — fonte da verdade: `supabase/migrations/`

| Tabela | Finalidade | Escrita pelo cliente |
|---|---|---|
| profiles | 1:1 com auth.users (nome, telefone) | próprio perfil (colunas limitadas) |
| platform_admins | admins do SaaS (superadmin/support/billing) | nunca (service_role) |
| platform_settings | configurações (nome do produto etc.), `is_public` | só superadmin |
| specialties | especialidades globais | admin (superadmin/support) |
| features / plans / plan_features | catálogo comercial configurável | admin (superadmin/billing) |
| reserved_slugs | slugs proibidos | nunca (só funções) |
| tenants | negócio (slug, nome, status, onboarding) | dono/admin: nome, slug, onboarding |
| tenant_members | vínculo usuária↔negócio e papel | dono/admin (nunca cria/remove `owner`) |
| tenant_settings | contato, endereço, marca, fuso, moeda | dono/admin |
| tenant_specialties | especialidades do negócio | dono/admin |
| subscriptions | assinatura SaaS do negócio | nunca (RPC/service_role); ids do provedor ocultos |
| feature_usage | contadores de uso | nunca |
| audit_logs | auditoria append-only (guarda **nomes** de campos alterados, nunca valores) | nunca; só via triggers e `log_audit` |

Convenções: UUID, `timestamptz`, dinheiro em centavos, `updated_at` por trigger, CPF/CNPJ só dígitos, CEP 8 dígitos.

RPCs (`authenticated` apenas): `create_tenant`, `is_slug_available`, `log_audit`, `tenant_feature`.
RPC pública (`anon` + `authenticated`): `get_public_tenant(slug)` — só campos seguros de negócios ativos.
RPCs do console (`authenticated`, papel validado dentro da função): `admin_set_tenant_status`, `admin_list_platform_admins`, `admin_grant_platform_role`, `admin_revoke_platform_role`.
Triggers (migration `20261104000002`): auditoria de configuração (`private.audit_admin_change`) e preenchimento automático de `plan_features` ao criar plano ou recurso.
`platform_settings`: chaves `welcome.benefits` e `welcome.guarantees` (públicas) alimentam a tela Bem-vinda.

Dados de referência: 4 planos (Esmalte/Gel/Fibra/Master), 21 features (inclui `dashboard`, liberado em todos os planos), 16 especialidades, ~70 slugs reservados.

Esboço das próximas fases: customers, customer_consents, customer_health_records (tabela separada), anamnesis_*, services, appointments, availability_rules, financeiro, estoque etc. — sempre com `tenant_id` + RLS + teste de isolamento.
