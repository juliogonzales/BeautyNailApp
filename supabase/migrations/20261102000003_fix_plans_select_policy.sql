-- Visitantes e usuárias: planos públicos e ativos (não toca em subscriptions)
alter policy plans_select on public.plans
  to anon, authenticated
  using (is_active and is_public);

-- Usuárias autenticadas: o plano que o próprio negócio usa (mesmo se privado) e admins
create policy plans_select_member on public.plans for select to authenticated
  using (private.is_platform_admin()
         or exists (select 1 from public.subscriptions s
                    where s.plan_id = plans.id and private.is_tenant_member(s.tenant_id)));
