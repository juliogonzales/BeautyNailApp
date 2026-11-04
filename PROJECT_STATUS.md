# Status — BeautyNailapp

## Concluído e VALIDADO
- Projeto Supabase `BeautyNailapp` (sa-east-1) ativo.
- Banco da Fase 1: 14 tabelas com RLS, funções de autorização, 4 RPCs, auditoria imutável, seeds de planos/especialidades/slugs.
- Teste de isolamento A×B direto no banco: **51/51 aprovados** (inclui anon, usuária sem negócio, escalada de privilégio, auditoria append-only). Detectou e corrigiu 1 falha real (leitura pública de planos).

## Implementado, mas NÃO validado (2026-11-03, branch `feature/fase-1-app`)
App Next.js da Fase 1 escrito sem acesso ao npm; **nunca foi instalado, compilado nem testado**. Qualquer erro de versão/tipo só aparece na primeira execução da CI.
- Cadastro/login por e-mail e senha, login com Google (botão pronto; falta configurar o provedor), callback PKCE, logout.
- Middleware (renova sessão, protege `/painel` e `/onboarding`, evita open redirect em `?next=`).
- Onboarding: nome, endereço (`/slug`) com checagem de disponibilidade, especialidades → RPC `create_tenant`.
- Painel: negócio, plano e features do plano (lidos do banco).
- Helper de limites (`src/lib/plan-limits.ts`): `checkLimit`, `getFeatureState`, `assertFeatureAllowed`, `describeFeature`.
- Testes Vitest (validação, rotas, limites, rate limit, erros): escritos, **não executados**.
- GitHub Actions (`.github/workflows/ci.yml`): job `app` (lint, testes, build, typecheck) e job `database` (RLS A×B, experimental, nunca executado).

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
Rodar a CI → corrigir falhas → commitar lockfile → configurar variáveis/Google/Vercel → Fase 2.

## Situação em 2026-11-03
- GitHub: repositório anexado à sessão com permissão de escrita; branch `develop` criada. A `main` fica só para produção (merge via PR).
- npm/pip: registros de pacotes inacessíveis na sessão de desenvolvimento (DNS). O app Next.js ainda não pôde ser instalado, compilado nem testado aqui.
