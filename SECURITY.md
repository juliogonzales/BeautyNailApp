# Segurança

## Papéis
| Papel | Pode |
|---|---|
| owner | tudo no próprio tenant (exceto trocar plano/status direto) |
| admin | administrar tenant, membros (não-owner), settings |
| professional / assistant | ler dados do tenant (escrita liberada módulo a módulo nas próximas fases) |
| platform superadmin/support/billing | ler tenants/assinaturas/auditoria; gerir catálogo. **Sem acesso a anamneses.** |

## Regras aplicadas
- RLS em 100% das tabelas; `anon` só lê planos públicos, features e `platform_settings` públicos.
- Privilégios mínimos: novas tabelas não herdam acesso de anon/authenticated; GRANTs são explícitos e por coluna onde há risco (tenants, subscriptions, tenant_settings).
- Funções de autorização em schema `private` (fora da API REST).
- Auditoria imutável (trigger bloqueia UPDATE/DELETE até para o dono do banco).
- Slug: formato validado, reservados bloqueados em criação e troca.
- `service_role` nunca no navegador.

## Alertas conhecidos do linter do Supabase (aceitos, intencionais)
- `authenticated_security_definer_function_executable` (4 RPCs): são a porta oficial de operações sensíveis; cada uma valida `auth.uid()`/pertencimento internamente e foi testada.
- `rls_enabled_no_policy` em `reserved_slugs`: intencional (negar tudo; só funções definer leem).
- `multiple_permissive_policies` em tabelas de catálogo: custo desprezível (tabelas minúsculas); revisar na Fase 8.

## Pendências
- Habilitar proteção de senha vazada / MFA para admins (painel Supabase Auth) antes de produção.
- Rate limiting nos endpoints (Fase 1, app).
- Termos de uso e política de privacidade: **rascunhos precisam de revisão de advogado**; dados de saúde (anamnese) exigem consentimento específico (LGPD art. 11).
- Backups: plano gratuito não oferece backup confiável; contratar plano Pro antes de ter clientes pagantes.

## Console de administração e página pública (2026-11-04)
- `/admin` só abre para quem está em `platform_admins`; os demais recebem 404. Permissões repetidas no banco (RLS/RPC). Mudanças administrativas são auditadas (`admin.*`).
- O console não acessa anamnese nem dados de clientes (regra CLAUDE.md §5); novas tabelas de saúde da Fase 2 **não** devem ter policy para `platform_admins`.
- A página pública usa apenas a RPC `get_public_tenant` (campos seguros). Endereço só aparece com `address_public = true`.
- Pendente: teste automatizado de banco cobrindo essas RPCs (A não vê B; anon só vê o permitido; não-admin não executa `admin_*`).

## Incidente de permissões e correção (2026-11-06)
- **O que aconteceu:** depois da mudança de permissões da API no painel do Supabase (2026-11-04), as tabelas da fundação ficaram com SELECT/INSERT/UPDATE/DELETE para `anon` e `authenticated`, e quatro funções (`create_tenant`, `log_audit`, `tenant_feature`, `is_slug_available`) voltaram a ser executáveis por `anon`. O RLS continuou barrando leituras e a maioria das escritas, mas **o dono do negócio conseguia alterar o próprio `status` e `slug`** (a trava era por coluna, que sumiu com o privilégio total).
- **Como foi achado:** o teste de isolamento antigo falhou em 11 verificações ao ser reexecutado. O próprio teste estava desatualizado (nomes de plano fixos), mas as falhas restantes eram reais.
- **Correção:** migration `20261106000003` restaura os privilégios mínimos. Depois dela: teste da fundação 54/54 e teste da Fase 2 47/47 (rodados direto no banco, 2026-11-06).
- **Prevenção:** o teste da Fase 2 confere privilégios (anon sem acesso a funções internas; colunas de escrita). Se alguém mexer em "Data API" / permissões no painel do Supabase, rode os dois testes de novo (`supabase/tests/`), que agora também estão na CI.
- **Conferido (2026-11-06):** a auditoria não registra nenhuma alteração de `status` ou `slug` em negócios desde 2026-11-04. Nada indica uso indevido da falha.
