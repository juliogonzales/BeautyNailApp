# Changelog
## 2026-11-02
- Projeto Supabase BeautyNailapp criado (sa-east-1).
- Migrations 0001–0004: fundação multi-tenant, dados de referência, correção de policy de planos, índices de FK.
- Teste de isolamento RLS (51 verificações) aprovado.

## 2026-11-03
- Código do app da Fase 1 (auth, onboarding, painel, helper de limites) e CI adicionados. **Ainda não validados** (CI pendente).

## 2026-11-04
- Fluxo de entrada: boas-vindas → planos → criar negócio → painel. Painel e calculadora de preços liberados no plano gratuito (migration `20261104000001`).
