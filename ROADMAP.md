# Roadmap

Ordem fixa (CLAUDE.md §10). **MVP vendável: Fases 1–3 + 8 (mínimo) validadas.** Marketplace, IA, loja e unidades vêm depois.

| Fase | Tema | Situação |
|---|---|---|
| 0 | Arquitetura e documentação | Escrita; revisar após validar o app |
| 1 | Fundação: auth, multi-tenant, RLS, onboarding, planos, permissões | Implementada; **CI verde** (121 testes Vitest, build, tipos) e banco **validado por teste** (54 + 47 verificações); falta Playwright |
| 2 | Operação: serviços, clientes, agenda, anamnese, portfólio, página pública, editor | **Em andamento**: serviços, página pública e construtor feitos; faltam clientes, agenda, anamnese, portfólio |
| 3 | Gestão: financeiro, precificação, estoque, relatórios | Precificação (calculadora) adiantada; resto pendente |
| 4 | Crescimento: pacotes, fidelidade, vouchers, loja, marketing, WhatsApp, área da cliente | Pendente |
| 5 | Equipe, comissões, salas, unidades | Pendente |
| 6 | Marketplace: fornecedores, mapas, parcerias | Pendente |
| 7 | IA (Beauty Copilot) | Pendente |
| 8 | Comercialização: assinaturas, pagamentos (Mercado Pago), painel admin | Painel admin parcial; pagamentos pendentes |
| 9 | Homologação e produção | Pendente |

## Próximos passos (curto prazo)
1. Fechar a Fase 1: gerar `package-lock.json` (workflow "Gerar package-lock.json") e escrever o Playwright (cadastro → onboarding → painel). A CI já roda e está verde.
2. Configurar login com Google (credenciais do Google Cloud) e reativar "Confirm email" antes de lançar.
3. Fase 2: clientes e agenda (com sinal por Pix depois), anamnese (tabelas separadas, LGPD), portfólio com Storage.
4. Construtor de página: rascunho/publicar, arrastar para reordenar, galeria de fotos.
5. Limite de requisições persistente (hoje em memória por instância) antes de vender.

## Fora do escopo por enquanto
Domínio próprio por negócio (roteamento já preparado), Stripe, API oficial do WhatsApp, Google Maps API.
