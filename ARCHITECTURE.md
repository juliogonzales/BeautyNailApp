# Arquitetura

## Camadas
1. **Navegador / PWA** (Next.js App Router, mobile-first). Só usa `anon/publishable key`; todo acesso a dados passa pelo RLS.
2. **Servidor Next.js** (Route Handlers / Server Actions na Vercel): validação Zod, rate limiting, sessão via cookies (`@supabase/ssr`). A `service_role` só existe aqui, em variável de ambiente sem `NEXT_PUBLIC_`, e só para tarefas administrativas (webhooks, exclusão de conta).
3. **Supabase**: Postgres (RLS em todas as tabelas), Auth (e-mail + Google), Storage, Edge Functions.

## Multi-tenancy
Cada negócio é um `tenant` (`tenants.slug` único). Pessoas se ligam por `tenant_members` (papéis: owner, admin, professional, assistant). Toda tabela de dados de negócio carrega `tenant_id`; as policies usam `private.is_tenant_member / has_tenant_role / can_manage_tenant` (security definer, schema `private` fora da Data API).

## Roteamento
`/{slug}` = página pública do tenant. Rotas reservadas ficam em `reserved_slugs` (admin, api, login…). Um middleware resolve o tenant por path hoje e por host (domínio próprio, plano Fibra+) no futuro, sem mudar as páginas.

## Fluxo de autenticação
Cadastro/login (e-mail ou Google) → trigger cria `profiles` → onboarding chama RPC `create_tenant(nome, slug, especialidades)` que cria tenant, membro dono, settings e assinatura gratuita (plano `esmalte`) em uma transação → audit_logs registra.

## Planos e limites
`features` + `plans` + `plan_features` (limite `NULL` = ilimitado). O backend consulta `tenant_feature(tenant, chave)`; contagem real vem das tabelas de dados (Fase 2+), `feature_usage` guarda contadores por período.

## Arquivos
Buckets: `public-assets` (logo, banner, portfólio publicado) e `private-files` (anamnese/fotos de cliente, URLs assinadas com checagem de tenant). Criados na Fase 2.

## Ambientes
Hoje existe apenas **desenvolvimento** (projeto BeautyNailapp). Homologação e produção: Fase 9 (branches do Supabase ou projetos separados).
