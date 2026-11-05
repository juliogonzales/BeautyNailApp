-- Os slugs reais dos planos não incluem "esmalte" (o gratuito é "essencial"); a regra correta é por preço:
-- aparência personalizada só nos planos pagos. Editável depois em /admin/planos.
update public.plan_features pf
   set enabled = (p.price_monthly_cents > 0)
  from public.plans p
 where p.id = pf.plan_id and pf.feature_key = 'custom_theme';
