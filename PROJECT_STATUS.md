# Status — BeautyNailapp

## Concluído e VALIDADO
- Projeto Supabase `BeautyNailapp` (sa-east-1) ativo.
- Banco da Fase 1: 14 tabelas com RLS, funções de autorização, 4 RPCs, auditoria imutável, seeds de planos/especialidades/slugs.
- Teste de isolamento A×B direto no banco: **51/51 aprovados** (inclui anon, usuária sem negócio, escalada de privilégio, auditoria append-only). Detectou e corrigiu 1 falha real (leitura pública de planos).

## Implementado, mas NÃO validado (2026-11-03, branch `feature/fase-1-app`)
App Next.js da Fase 1 escrito sem acesso ao npm; **nunca foi instalado, compilado nem testado**. Qualquer erro de versão/tipo só aparece na primeira execução da CI.
- Cadastro/login por e-mail e senha, login com Google (botão pronto; falta configurar o provedor), callback PKCE, logout.
- Middleware (renova sessão, protege `/painel` e `/onboarding`, evita open redirect em `?next=`).
- Fluxo de entrada reformulado (2026-11-04): cadastro → `/bem-vinda` (benefícios) → `/planos` (só o gratuito é selecionável; pagos "Em breve") → `/onboarding` (nome, endereço `/slug` com checagem, especialidades → RPC `create_tenant`) → `/painel`.
- Painel liberado no plano gratuito (feature `dashboard`, migration `20261104000001`, **já aplicada no Supabase de desenvolvimento**): atalhos, plano e recursos, sem números inventados.
- Calculadora de preços liberada no plano gratuito (`/painel/calculadora`, sem persistência).
- **Verificado manualmente (2026-11-04, preview Vercel):** cadastro → onboarding → negócio criado no banco (dona, plano Esmalte, especialidades, auditoria). O endereço `/{slug}` dava 404 porque a página pública não existe (D-018).
- Helper de limites (`src/lib/plan-limits.ts`): `checkLimit`, `getFeatureState`, `assertFeatureAllowed`, `describeFeature`.
- Testes Vitest (validação, rotas, limites, rate limit, erros): escritos, **não executados**.
- GitHub Actions (`.github/workflows/ci.yml`): job `app` (lint, testes, build, typecheck) e job `database` (RLS A×B, experimental, nunca executado).

## Implementado em 2026-11-04 (noite), NÃO validado
- Página pública `/{slug}`, bloco "Seu link" no painel (abrir, copiar, WhatsApp, QR), `/painel/perfil`, checklist de primeiros passos.
- Console `/admin` (visão geral, planos, recursos, especialidades, textos, negócios, auditoria, equipe), com acesso por papel.
- Testes novos (`tests/public-page.test.ts`, `tests/admin.test.ts`): escritos, **não executados**.
- Migration `20261104000002` **aplicada no Supabase de desenvolvimento** (2026-11-04, depois de o conector cancelar a confirmação no app Android; funcionou pelo Chrome). Conferido por consulta: 5 RPCs, 7 triggers, 2 textos de boas-vindas, `anon` executa só `get_public_tenant` e não executa as `admin_*`; `get_public_tenant('joyvega-nails')` devolve os dados esperados.
- Falta inserir o primeiro superadmin em `platform_admins` (D-024).
- Falta teste de banco (RLS) para as novas RPCs/triggers e para a leitura pública.

## Implementado em 2026-11-05, NÃO validado por testes automáticos
- Console: negócios com busca, filtros, paginação, CSV, detalhe, troca de plano e exceções de recurso; modelos de página pública; painel `/painel/aparencia`.
- Migrations `20261104000003`, `20261104000004` e `20261105000001` aplicadas no Supabase de desenvolvimento (conferido por consulta: 3 modelos, 1 padrão, `custom_theme` só nos planos pagos, RPCs `admin_*` sem acesso anônimo).
- Bug achado e corrigido: o cadastro dependia do slug "esmalte" (D-027).
- Testes Vitest novos em `tests/theme-and-management.test.ts`: escritos, **não executados**. Continua faltando o teste de banco (RLS) das novas tabelas/RPCs.

## Em andamento / pendente
- **Primeira execução da CI e correção do que ela apontar** (próxima ação).
- Commitar `package-lock.json` e trocar `npm install` por `npm ci` no workflow.
- Teste Playwright (cadastro → onboarding → painel) e teste de isolamento A×B no nível do app.
- Documentação Fase 0: escrita. Atualizar README/ARCHITECTURE após validar o app.
- Repositório GitHub: anexado; `develop` criada; `main` só para produção (merge via PR).
- Login com Google: exige credenciais do Google Cloud (passo manual).
- Variáveis de ambiente reais (ver `.env.example`).
- Vercel: passo manual.

## Não executado via conector (limitação)
3 verificações com `DELETE` (remoção de membros/especialidades/auditoria por A em B) não rodaram pelo conector por exigirem confirmação manual; estão em `supabase/tests/rls_isolation.sql` para a CI. (Remoção já é impedida por ausência de policy/GRANT.)

## Problemas conhecidos
Ver alertas aceitos em `SECURITY.md`.

## Próxima etapa
Definir o primeiro superadmin, conferir o build da Vercel e testar página pública e console. Depois: Validar o novo fluxo no preview e rodar a CI → commitar lockfile → Google → Fase 2 (serviços, clientes, agenda, página pública).

## Situação em 2026-11-03
- GitHub: repositório anexado à sessão com permissão de escrita; branch `develop` criada. A `main` fica só para produção (merge via PR).
- npm/pip: registros de pacotes inacessíveis na sessão de desenvolvimento (DNS). O app Next.js ainda não pôde ser instalado, compilado nem testado aqui.

## Atualização 2026-11-05 — calculadora por segmento
- Implementado: calculadora guiada, perfil salvo, segmentos no admin, migration aplicada no Supabase.
- **Não validado por teste**: Vitest e build local não rodam na sessão (sem npm); validação depende da CI/Vercel. Falta teste A×B de RLS para `pricing_profiles`.
- Próximo: catálogo de serviços, construtor de página (no-code), análise de competitividade.

## Atualização 2026-11-06 — calculadora simplificada
- Implementado e migration aplicada. **Não validado por teste** (Vitest/build local indisponíveis; vale o build da Vercel). Tela não foi aberta no navegador por mim.
- Pendente: "Salvar como serviço" (liga ao catálogo), teste A×B de `pricing_profiles`.
