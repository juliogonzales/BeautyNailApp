# Decisões
- D-001 Nome do projeto/repositório: **BeautyNailapp** (valor em `platform_settings.product.name`).
- D-002 Slug por caminho `/{slug}`, 3–40 caracteres, minúsculas/números/hífen.
- D-003 Criação de negócio só via RPC `create_tenant` (atômica); máx. 3 negócios por dona.
- D-004 Auditoria registra nomes dos campos alterados, não valores (evita PII em log).
- D-005 **Preços e limites dos planos são sugestões** (editáveis no banco, sem deploy): Gel R$39,90/mês, Fibra R$79,90, Master 
R$149,90 (anual = 10 meses); teste grátis 14 dias nos pagos. Limites do Esmalte: 30 clientes, 10 serviços, 20 fotos, 100 MB, 1 profissional.
- D-006 Pagamentos: Mercado Pago primeiro (Fase 8). WhatsApp via `wa.me`. Mapas via link de rota.
- D-007 Migrations aplicadas via conector Supabase; comandos `DROP/DELETE` exigem confirmação manual e são evitados (usa-se `ALTER POLICY`).
- D-008 App da Fase 1 escrito sem acesso ao npm (DNS bloqueado na sessão de desenvolvimento). Versões em `package.json` usam faixas `^` de versões que o autor conhecia (Next 15, React 19, Tailwind 4, Zod 3, @supabase/ssr 0.7); **a CI é a primeira a instalar/compilar**. Next fica no 15.x de propósito (no 16 o `middleware` muda de nome); migrar é tarefa à parte.
- D-009 shadcn/ui **não** adotado na Fase 1: o CLI não roda sem rede. Componentes simples em Tailwind (`src/components/form-bits.tsx`); shadcn entra quando houver rede para `npx shadcn add`. React Hook Form e TanStack Query ficam para a Fase 2; a Fase 1 usa Server Actions + `useActionState`.
- D-010 Rate limiting da Fase 1 é **em memória, por instância** (`src/lib/rate-limit.ts`). Em serverless cada instância tem seu contador, então só freia abuso simples. Trocar por Upstash/Redis antes de vender (Fase 8/9).
- D-011 Usuária com mais de um negócio: o painel abre o mais antigo. Seletor de negócio fica para a Fase 2.
- D-012 Sem tipos gerados do Supabase na Fase 1 (cliente sem tipagem de banco, colunas selecionadas explicitamente). Gerar `Database` types e tipar o cliente na Fase 2.
- D-013 Sem página pública `/{slug}` na Fase 1: `anon` não lê `tenants` por RLS (por desenho). Será criada na Fase 2 com view/RPC pública própria.
