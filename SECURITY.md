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
