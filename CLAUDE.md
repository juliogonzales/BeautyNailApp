# BeautyNailapp — Regras permanentes do projeto

> Este arquivo é lido em toda sessão. Não repita estas regras nos prompts de fase.
> Nome do projeto e do repositório: BeautyNailapp (deve vir de configuração `platform_settings.product.name`, nunca fixo no código).

## 1. Missão
Plataforma SaaS multi-tenant para profissionais da beleza (nail design, sobrancelhas, cílios, cabelo, estética etc.). Uma infraestrutura compartilhada; cada profissional tem seu próprio negócio digital (marca, clientes, serviços, agenda, página pública). Não é só uma agenda online.

## 2. Stack (fixa)
- Front: Next.js (App Router), React, TypeScript estrito, Tailwind, shadcn/ui, Lucide, React Hook Form, Zod, TanStack Query quando fizer sentido.
- Back: Supabase (PostgreSQL, Auth com e-mail + Google, Storage, Edge Functions, RLS).
- Infra: GitHub (repositório oficial), GitHub Actions, Vercel. Ambientes: desenvolvimento, homologação, produção.
- Testes: Vitest, Playwright, testes de RLS direto no banco.
- Antes de usar qualquer biblioteca ou API, confira a documentação e a versão atual. Não invente APIs.

## 3. Decisões técnicas já tomadas
- Idioma da interface: pt-BR. Fuso padrão: America/Sao_Paulo. Moeda: BRL.
- Dinheiro sempre em **centavos (integer)**. Nunca float.
- Datas no banco em `timestamptz` (UTC); converter só na interface.
- URL do tenant por caminho: `/{slug}`. Domínio próprio fica para fase posterior, mas o roteamento (middleware) deve ser desenhado desde já para suportá-lo.
- Pagamentos: **Mercado Pago primeiro (Pix + cartão)**. Stripe só depois, se necessário.
- WhatsApp: começar com links `wa.me`. API oficial da Meta só na fase de comunicação.
- Mapas: começar com link de rota externo. Google Maps API só na fase de marketplace.
- Migrations versionadas com Supabase CLI, testadas localmente antes de aplicar em qualquer ambiente.
- Limites de plano e feature flags ficam em tabelas configuráveis (`plans`, `plan_features`), **nunca fixos no código**.

## 4. Multi-tenancy e segurança (inegociável)
- `tenant_id` em toda tabela aplicável. RLS ativada em todas as tabelas, sem exceção.
- Permissões validadas no backend/banco. Nunca confiar só no frontend.
- Proteção contra IDOR; arquivos privados com URLs assinadas e checagem de tenant.
- `service_role_key` nunca no navegador nem em variável `NEXT_PUBLIC_*`.
- Validação server-side (Zod) em toda entrada. Rate limiting nos endpoints sensíveis.
- Uploads: validar MIME real, tamanho e extensão.
- Logs de auditoria para ações sensíveis.
- Webhooks de pagamento: assinados e idempotentes. Nunca armazenar dados de cartão.
- Todo PR/fase inclui teste automatizado provando que a profissional A não acessa dados da profissional B.

## 5. Dados de saúde e LGPD
- Anamneses e dados de saúde ficam em tabelas separadas, acesso mínimo, criptografia reforçada em colunas sensíveis, consentimento registrado e política de retenção.
- Nunca usar anamnese para marketing ou segmentação.
- Nunca enviar anamnese ou dado sensível a provedores de IA.
- Admin da plataforma **não** acessa anamneses de clientes.
- Textos legais (termos, privacidade) são rascunhos e precisam de revisão de advogado. Registrar isso em `SECURITY.md`.

## 6. Design
- Premium, minimalista, elegante. Paleta: off-white, nude, bege, marrom, grafite, dourado discreto.
- Tokens de design e tema por tenant. Evitar rosa em excesso, gradientes e sombras pesadas.
- Mobile-first. Acessibilidade (contraste, foco, labels).
- Estados de carregamento, vazio e erro em toda tela.

## 7. Como trabalhar
- Uma fase por vez. Sempre deixar o app executável ao final de cada tarefa.
- Commits pequenos e descritivos a cada tarefa concluída. Branches: `main` (produção), `develop`, `feature/*`.
- Rodar antes de considerar pronto: typecheck, lint, testes e build de produção. Corrigir a causa dos erros; não suprimir com `@ts-ignore`/`eslint-disable` para esconder problemas.
- Nada de dados falsos na interface. Dados de demonstração só em seeds separados.
- Cada funcionalidade tem: interface, regra de negócio, persistência, validação, permissão, tratamento de erro e teste.
- Decisão faltando: escolha a opção mais segura e simples, registre em `docs/DECISIONS.md` e continue.
- **Credenciais/chaves faltando: pare essa tarefa**, crie as variáveis em `.env.example`, liste exatamente o que falta e o passo a passo para obter. Nunca invente tokens.
- Nunca rodar migração destrutiva em produção sem backup e confirmação explícita.
- Nunca marcar algo como concluído sem ter sido testado.

## 8. Documentação viva (atualizar a cada fase)
`README.md`, `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `SECURITY.md`, `ROADMAP.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`, `docs/DECISIONS.md`.

`PROJECT_STATUS.md` deve listar: concluído, em andamento, pendente, testes executados/aprovados, problemas conhecidos e próxima etapa. Se o contexto acabar, retomar a partir dele.

## 9. Relatório ao fim de cada fase
Separar claramente: código implementado, funcionalidade **validada por teste**, e integração **efetivamente operacional**. Listar pendências, credenciais necessárias e como rodar. Não afirmar "pronto" havendo pendência essencial.

## 10. Roadmap (ordem fixa)
- Fase 0: arquitetura e documentação
- Fase 1: fundação (auth, multi-tenant, RLS, onboarding, planos, permissões)
- Fase 2: operação (serviços, clientes, agenda, anamnese, portfólio, página pública, editor)
- Fase 3: gestão (financeiro, precificação, estoque, relatórios)
- Fase 4: crescimento (pacotes, fidelidade, vouchers, loja, marketing, WhatsApp, área da cliente)
- Fase 5: equipe, comissões, salas, unidades
- Fase 6: marketplace (fornecedores, mapas, parcerias)
- Fase 7: IA (Beauty Copilot)
- Fase 8: comercialização (assinaturas, pagamentos, painel admin)
- Fase 9: homologação e produção

Cortes de MVP: só vender após Fases 1–3 e 8 (mínimo) estarem validadas. Marketplace, IA, loja e unidades vêm depois.
