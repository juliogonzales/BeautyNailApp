# BeautyNailapp

Plataforma SaaS multi-tenant para profissionais da beleza (nail design, barbearia, sobrancelhas, cílios, cabelo, estética…). Uma infraestrutura compartilhada; cada profissional tem o próprio negócio digital: página pública, serviços, calculadora de preços e, nas próximas fases, clientes e agenda.

Regras permanentes: [`CLAUDE.md`](CLAUDE.md) · Estado real: [`PROJECT_STATUS.md`](PROJECT_STATUS.md) · Plano: [`ROADMAP.md`](ROADMAP.md)

## O que já existe (Fase 1 + partes da Fase 2)
- Cadastro/login por e-mail (Google: botão pronto, falta configurar o provedor), onboarding com endereço `/{slug}`.
- Painel da profissional: link e QR code, perfil público, aparência (modelos), **construtor de página sem código**, catálogo de serviços, **calculadora de preços por segmento**.
- Página pública `/{slug}` com serviços, contatos e blocos escolhidos pela profissional.
- Console `/admin` (planos, recursos, especialidades, segmentos da calculadora, modelos de página, negócios, auditoria, equipe), por papel.
- Planos e limites vivem no banco (`plans`, `features`, `plan_features`), nunca no código.

## Stack
Next.js 15 (App Router) · React 19 · TypeScript estrito · Tailwind 4 · Zod · Supabase (Postgres + RLS, Auth, Storage) · Vercel · GitHub Actions · Vitest.

## Como rodar
```bash
cp .env.example .env.local   # preencha URL e chave publicável do Supabase
npm install                  # (ou npm ci, quando houver package-lock.json)
npm run dev                  # http://localhost:3000
```
Antes de considerar algo pronto: `npm run lint && npm test && npm run build && npm run typecheck`.

## Banco de dados
- Migrations em `supabase/migrations/` (ordem cronológica; aplicar com Supabase CLI ou pelo conector).
- Testes de isolamento entre negócios (RLS) em `supabase/tests/`:
  - `rls_isolation.sql` (fundação) e `rls_isolation_phase2.sql` (serviços, calculadora, blocos, página pública, console);
  - cada um roda numa transação que sempre é revertida e termina com `PASS=…, FAIL=…`;
  - uso: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/<arquivo>.sql` (o resultado vem na mensagem do erro final de propósito).
- **Nunca** ative "dar todas as permissões" na Data API do Supabase: os privilégios mínimos vêm das migrations (ver `SECURITY.md`).

## Variáveis de ambiente
Ver `.env.example`. A `SUPABASE_SERVICE_ROLE_KEY` só existe no servidor e nunca com prefixo `NEXT_PUBLIC_`.

## Documentação
`ARCHITECTURE.md` · `DATABASE_SCHEMA.md` · `SECURITY.md` · `ROADMAP.md` · `PROJECT_STATUS.md` · `CHANGELOG.md` · `docs/DECISIONS.md`

## Avisos honestos
- Os textos legais (termos, privacidade) são **rascunhos e precisam de revisão de advogado**.
- Os testes Vitest e a CI ainda não rodaram no GitHub; o que está validado por teste hoje é o isolamento no banco (ver `PROJECT_STATUS.md`).
