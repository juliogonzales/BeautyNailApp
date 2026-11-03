# Decisões
- D-001 Nome do projeto/repositório: **BeautyNailapp** (valor em `platform_settings.product.name`).
- D-002 Slug por caminho `/{slug}`, 3–40 caracteres, minúsculas/números/hífen.
- D-003 Criação de negócio só via RPC `create_tenant` (atômica); máx. 3 negócios por dona.
- D-004 Auditoria registra nomes dos campos alterados, não valores (evita PII em log).
- D-005 **Preços e limites dos planos são sugestões** (editáveis no banco, sem deploy): Gel R$39,90/mês, Fibra R$79,90, Master 
R$149,90 (anual = 10 meses); teste grátis 14 dias nos pagos. Limites do Esmalte: 30 clientes, 10 serviços, 20 fotos, 100 MB, 1 profissional.
- D-006 Pagamentos: Mercado Pago primeiro (Fase 8). WhatsApp via `wa.me`. Mapas via link de rota.
- D-007 Migrations aplicadas via conector Supabase; comandos `DROP/DELETE` exigem confirmação manual e são evitados (usa-se `ALTER POLICY`).
