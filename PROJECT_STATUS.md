# Status — BeautyNailapp

## Concluído e VALIDADO
- Projeto Supabase `BeautyNailapp` (sa-east-1) ativo.
- Banco da Fase 1: 14 tabelas com RLS, funções de autorização, 4 RPCs, auditoria imutável, seeds de planos/especialidades/slugs.
- Teste de isolamento A×B direto no banco: **51/51 aprovados** (inclui anon, usuária sem negócio, escalada de privilégio, auditoria append-only). Detectou e corrigiu 1 falha real (leitura pública de planos).

## Em andamento / pendente
- Documentação Fase 0: escrita (este diretório).
- App Next.js (auth, onboarding, painel, helper de limites) — **não iniciado**.
- Testes Vitest/Playwright, GitHub Actions — pendentes.
- Repositório GitHub: aguardando `usuario/BeautyNailapp` para anexar e fazer commits.
- Login com Google: exige credenciais do Google Cloud (passo manual).
- Vercel: passo manual.

## Não executado via conector (limitação)
3 verificações com `DELETE` (remoção de membros/especialidades/auditoria por A em B) não rodaram pelo conector por exigirem confirmação manual; estão em `supabase/tests/rls_isolation.sql` para a CI. (Remoção já é impedida por ausência de policy/GRANT.)

## Problemas conhecidos
Ver alertas aceitos em `SECURITY.md`.

## Próxima etapa
Anexar repositório → scaffold Next.js + cliente Supabase → auth → onboarding → painel → testes.

## Bloqueios em 2026-11-03
- GitHub: o conector tem acesso só de leitura ao repositório (403 ao criar branch). Nada foi enviado ao GitHub; entrega via .zip.
- npm/pip: registros de pacotes inacessíveis na sessão de desenvolvimento (DNS). O app Next.js não pôde ser instalado, compilado nem testado aqui.
