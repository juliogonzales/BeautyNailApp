# Changelog
## 2026-11-02
- Projeto Supabase BeautyNailapp criado (sa-east-1).
- Migrations 0001–0004: fundação multi-tenant, dados de referência, correção de policy de planos, índices de FK.
- Teste de isolamento RLS (51 verificações) aprovado.

## 2026-11-03
- Código do app da Fase 1 (auth, onboarding, painel, helper de limites) e CI adicionados. **Ainda não validados** (CI pendente).

## 2026-11-04
- Fluxo de entrada: boas-vindas → planos → criar negócio → painel. Painel e calculadora de preços liberados no plano gratuito (migration `20261104000001`).
- Página pública `/{slug}` (RPC `get_public_tenant`), link no painel com copiar, WhatsApp e QR code, perfil público (`/painel/perfil`) e checklist de primeiros passos.
- Console `/admin`: visão geral, planos (dados + recursos/limites), recursos, especialidades, textos do sistema, negócios (suspender/reativar), auditoria e equipe. Migration `20261104000002` (aplicada no Supabase de desenvolvimento).

## 2026-11-05
- Console: busca/filtros/paginação e exportação CSV de negócios; detalhe do negócio (plano, uso, exceções de recurso, histórico); modelos de página pública; rótulos legíveis na auditoria.
- Painel: `/painel/aparencia` (escolher modelo e cores, planos pagos).
- Correção: criação de negócio e tela de planos dependiam do slug "esmalte"; agora usam o plano gratuito por preço (D-027).
- Migrations `20261104000003`, `20261104000004`, `20261105000001` (aplicadas no Supabase de desenvolvimento).


## Calculadora por segmento (2026-11-05)
- Nova calculadora guiada em 3 passos (negócio, serviço, resultado) com materiais por embalagem, comissão, imposto e diagnóstico do preço atual.
- Segmentos editáveis no admin (`/admin/calculadoras`), incluindo barbearia; especialidade escolhe o segmento.
- Migration `20261105000003`: `calculator_presets`, `pricing_profiles`.

## Calculadora simplificada (2026-11-06)
- 4 perguntas, serviços-modelo por segmento (toque para adicionar), material em um campo, resultado imediato por serviço e resumo de descobertas.
- Migration `20261106000001`: `calculator_presets.services`; editor em `/admin/calculadoras`.

## Construtor de página e calculadora → catálogo (2026-11-06)
- `/painel/pagina`: blocos editáveis, ordem, ocultar, pré-visualização; página pública renderiza os blocos.
- Calculadora: botão "Salvar no catálogo".
- Migration `20261106000002`: `tenant_settings.page_blocks`, recurso `page_blocks`, trigger de limite, `get_public_tenant` com blocos.
- Painel: removido atalho "Serviços" duplicado; novo atalho "Montar minha página".

## Testes de isolamento e correção de permissões (2026-11-06)
- Novo `supabase/tests/rls_isolation_phase2.sql` (47 verificações: serviços, perfil de preço, segmentos, blocos, página pública, funções do console, superadmin sem acesso a dados de clientes).
- Teste da fundação atualizado (sem nomes de plano fixos): 54/54.
- Migration `20261106000003`: restaura privilégios mínimos (ver SECURITY.md, incidente).
