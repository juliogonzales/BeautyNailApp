-- Restaura os privilégios mínimos das tabelas da fundação.
-- Motivo: depois da mudança de permissões da API no painel do Supabase (2026-11-04), anon e authenticated ficaram com
-- SELECT/INSERT/UPDATE/DELETE em todas as tabelas e EXECUTE em funções que a fundação restringia. O RLS continuava
-- barrando a maior parte, mas o dono do negócio conseguia alterar o próprio status/slug (a trava era por coluna).
-- Defesa em profundidade: RLS + privilégios mínimos. Idempotente: pode rodar de novo sem efeito colateral.

revoke all on table
  public.audit_logs, public.feature_usage, public.features, public.plan_features, public.plans, public.platform_admins,
  public.platform_settings, public.profiles, public.reserved_slugs, public.specialties, public.subscriptions,
  public.tenant_members, public.tenant_settings, public.tenant_specialties, public.tenants
from anon, authenticated;

-- Visitante anônimo: só o catálogo público de planos e recursos.
grant select on public.platform_settings, public.features, public.plans, public.plan_features to anon;

-- Usuária logada: leitura (o RLS limita às linhas dela) ...
grant select on public.platform_settings, public.features, public.plans, public.plan_features, public.specialties,
  public.platform_admins, public.tenants, public.tenant_members, public.tenant_settings, public.tenant_specialties,
  public.feature_usage, public.audit_logs, public.profiles to authenticated;
grant select (id, tenant_id, plan_id, status, billing_cycle, trial_ends_at, current_period_start, current_period_end,
  cancel_at_period_end, canceled_at, created_at, updated_at) on public.subscriptions to authenticated;

-- ... e escrita só nas colunas que ela pode mudar.
grant update (full_name, avatar_url, phone, whatsapp, locale) on public.profiles to authenticated;
grant update (business_name, slug, onboarding_step, onboarding_completed_at) on public.tenants to authenticated;
grant insert (tenant_id, user_id, role), update (role), delete on public.tenant_members to authenticated;
grant update (legal_name, document, phone, whatsapp, email, postal_code, state, city, neighborhood, address_line,
  address_public, instagram, primary_color, accent_color, logo_path, template_id, page_blocks) on public.tenant_settings to authenticated;
grant insert (tenant_id, specialty_id), delete on public.tenant_specialties to authenticated;
-- Configuração da plataforma: o RLS só deixa passar quem é admin.
grant insert, update, delete on public.platform_settings, public.specialties, public.features, public.plans,
  public.plan_features to authenticated;

-- Funções que a fundação já restringia a usuárias logadas.
revoke all on function public.is_slug_available(text) from public, anon;
revoke all on function public.create_tenant(text, text, uuid[]) from public, anon;
revoke all on function public.log_audit(uuid, text, text, uuid, jsonb) from public, anon;
revoke all on function public.tenant_feature(uuid, text) from public, anon;
grant execute on function public.is_slug_available(text) to authenticated;
grant execute on function public.create_tenant(text, text, uuid[]) to authenticated;
grant execute on function public.log_audit(uuid, text, text, uuid, jsonb) to authenticated;
grant execute on function public.tenant_feature(uuid, text) to authenticated;

-- Tabelas novas continuam sem privilégio por padrão (a fundação já ajusta o default; reafirmado aqui).
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
