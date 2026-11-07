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
Cadastro/login (e-mail ou Google) → trigger cria `profiles` → onboarding chama RPC `create_tenant(nome, slug, especialidades)` que cria tenant, membro dono, settings e assinatura do plano gratuito (o de preço zero, escolhido por preço e não por nome) em uma transação → audit_logs registra.

## Planos e limites
`features` + `plans` + `plan_features` (limite `NULL` = ilimitado) e exceções por negócio em `tenant_feature_overrides` (decididas no console). O backend consulta `tenant_feature(tenant, chave)`; limites de serviços e de blocos da página são **aplicados por trigger no banco**, e o app só mostra a mensagem amigável. O plano gratuito é identificado por preço zero, nunca por nome ou slug.

## Módulos do app (`src/`)
- `app/[slug]` página pública (RPC `get_public_tenant`, só campos seguros) · `app/painel/*` área da profissional (perfil, aparência, página, serviços, calculadora) · `app/admin/*` console da plataforma (404 para quem não é admin; ações repetidas no banco).
- `lib/` regras puras e testáveis: validação Zod, dinheiro em centavos, `service-pricing` (cálculo de preço), `page-blocks` (blocos da página: só texto e links https), `theme` (modelos com contraste mínimo), `plan-limits`, `rate-limit`, `routing`.
- `components/` interface; `app/**/actions.ts` Server Actions (sessão, rate limit, Zod, banco).

## Página pública e construtor
A profissional escolhe blocos (capa, texto, serviços, diferenciais, horários, perguntas, contato, botão), ordem e textos. Ficam em `tenant_settings.page_blocks` (jsonb, ≤30 itens, ≤40 KB); sem blocos, vale a página automática. Nunca se grava HTML nem CSS da usuária. O tema (layout, fonte, cores) vem de `page_templates`; cores próprias exigem o recurso `custom_theme`.

## Calculadora de preços
Segmentos em `calculator_presets` (editáveis no console; incluem barbearia) com serviços-modelo (nome e duração, sem preço). Perfil do negócio em `pricing_profiles` (RLS por negócio). Fórmula: `preço = ceil(custo ·10000 / (10000 − descontos − margem))`; percentuais em pontos-base, dinheiro em centavos.

## Segurança em camadas
RLS em todas as tabelas **e** privilégios mínimos por coluna (migrations); funções internas em `private`; auditoria imutável; rate limit nas ações; testes de isolamento A×B no banco (`supabase/tests/`).

## Arquivos
Buckets: `public-assets` (logo, banner, portfólio publicado) e `private-files` (anamnese/fotos de cliente, URLs assinadas com checagem de tenant). Criados na Fase 2.

## Ambientes
Hoje existe apenas **desenvolvimento** (projeto BeautyNailapp). Homologação e produção: Fase 9 (branches do Supabase ou projetos separados).
