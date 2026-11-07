-- Teste de isolamento multi-tenant da Fase 2: serviços, perfil de preço, segmentos da calculadora, blocos da página,
-- leitura pública e funções do console. Roda numa transação que SEMPRE é revertida; o resultado vem na mensagem do erro final.
-- Não depende de nome/slug de plano (usa preço zero). Uso: psql / Supabase SQL editor / MCP execute_sql.
do $test$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  uc uuid := gen_random_uuid();
  ud uuid := gen_random_uuid(); -- superadmin da plataforma (não é dona de negócio)
  ta uuid; tb uuid; n bigint; sp uuid[]; j jsonb; k text[];
  allowed text[] := array['slug','business_name','city','state','neighborhood','address_line','whatsapp','instagram',
                          'primary_color','accent_color','theme','blocks','specialties','services'];
  v jsonb := '[]'::jsonb;
  out text;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (ua, 'authenticated', 'authenticated', 'a2@test.local', '{"full_name":"Ana"}'),
    (ub, 'authenticated', 'authenticated', 'b2@test.local', '{"name":"Bia"}'),
    (uc, 'authenticated', 'authenticated', 'c2@test.local', '{}'),
    (ud, 'authenticated', 'authenticated', 'd2@test.local', '{}');
  insert into public.platform_admins (user_id, role) values (ud, 'superadmin');
  select array_agg(id) into sp from public.specialties where slug in ('nail-design', 'manicure');

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ta := public.create_tenant('Ana Nails', 'ana-nails-t2', sp);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tb := public.create_tenant('Bia Studio', 'bia-studio-t2', sp);
  reset role;

  -- Dados da Bia, criados como dono do banco, para a Ana tentar alcançar
  insert into public.services (tenant_id, name, price_cents, duration_minutes) values (tb, 'Corte da Bia', 5000, 60);
  insert into public.services (tenant_id, name, price_cents, duration_minutes, show_on_page) values (tb, 'Oculto da Bia', 9000, 30, false);
  insert into public.pricing_profiles (tenant_id, monthly_income_cents, days_per_week, hours_per_day, occupancy_bp, fixed_costs_cents, card_fee_bp, tax_bp, commission_bp, margin_bp)
    values (tb, 400000, 5, 8, 7000, 0, 0, 0, 0, 2000);
  update public.tenant_settings set page_blocks = '[{"id":"bbbb1111","type":"text","enabled":true,"title":"Segredo da Bia","body":"x"}]'::jsonb,
    whatsapp = '11999990000', address_line = 'Rua Secreta 1', address_public = false where tenant_id = tb;

  -- ===================== Superadmin da plataforma =====================
  perform set_config('request.jwt.claims', json_build_object('sub', ud, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_set_feature_override(tb, 'services', true, 3, 'teste de isolamento', null);
  select count(*) into n from public.services;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' superadmin NÃO lê serviços de nenhum negócio (' || n || ')');
  select count(*) into n from public.pricing_profiles;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' superadmin NÃO lê perfis de preço de negócios (' || n || ')');
  update public.calculator_presets set description = description where slug = 'unhas';
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 1 then 'PASS' else 'FAIL' end) || ' superadmin edita segmentos da calculadora');
  update public.plans set description = description where id = (select id from public.plans limit 1);
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 1 then 'PASS' else 'FAIL' end) || ' superadmin ainda edita planos (grants restaurados)');
  reset role;

  -- ===================== Ana tenta alcançar a Bia =====================
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.services (tenant_id, name, price_cents, duration_minutes) values (ta, 'Corte', 4000, 45);
  insert into public.services (tenant_id, name, price_cents, duration_minutes) values (ta, 'Corte da Bia', 4500, 45);
  select count(*) into n from public.services;
  v := v || to_jsonb((case when n = 2 then 'PASS' else 'FAIL' end) || ' A cria e enxerga só os próprios serviços (' || n || '; nome igual ao de outro negócio é permitido)');
  select count(*) into n from public.services where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê serviços de B');
  update public.services set price_cents = 1 where tenant_id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera serviço de B');
  delete from public.services where tenant_id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não apaga serviço de B');
  begin
    insert into public.services (tenant_id, name, price_cents, duration_minutes) values (tb, 'Invasor', 100, 30);
    v := v || to_jsonb('FAIL A criou serviço em B'::text);
  exception when others then
    v := v || to_jsonb('PASS A não cria serviço em B (' || sqlerrm || ')');
  end;
  begin
    update public.services set tenant_id = tb where tenant_id = ta;
    v := v || to_jsonb('FAIL A moveu serviço para B'::text);
  exception when others then
    v := v || to_jsonb('PASS A não move serviço para B (' || sqlerrm || ')');
  end;
  begin
    insert into public.services (tenant_id, name, price_cents, duration_minutes) values (ta, 'Negativo', -1, 30);
    v := v || to_jsonb('FAIL preço negativo aceito'::text);
  exception when others then
    v := v || to_jsonb('PASS preço negativo é recusado'::text);
  end;

  -- Perfil de preço
  insert into public.pricing_profiles (tenant_id, monthly_income_cents, days_per_week, hours_per_day, occupancy_bp, fixed_costs_cents, card_fee_bp, tax_bp, commission_bp, margin_bp)
    values (ta, 300000, 5, 8, 7000, 0, 0, 0, 0, 2000);
  select count(*) into n from public.pricing_profiles;
  v := v || to_jsonb((case when n = 1 then 'PASS' else 'FAIL' end) || ' A cria e enxerga só o próprio perfil de preço (' || n || ')');
  update public.pricing_profiles set margin_bp = 1 where tenant_id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera perfil de preço de B');
  begin
    insert into public.pricing_profiles (tenant_id, monthly_income_cents, days_per_week, hours_per_day, occupancy_bp, fixed_costs_cents, card_fee_bp, tax_bp, commission_bp, margin_bp)
      values (tb, 1, 5, 8, 7000, 0, 0, 0, 0, 2000);
    v := v || to_jsonb('FAIL A criou perfil de preço em B'::text);
  exception when others then
    v := v || to_jsonb('PASS A não cria perfil de preço em B'::text);
  end;

  -- Segmentos da calculadora: leitura sim, escrita não
  select count(*) into n from public.calculator_presets;
  v := v || to_jsonb((case when n >= 1 then 'PASS' else 'FAIL' end) || ' A lê segmentos da calculadora (' || n || ')');
  update public.calculator_presets set name = 'HACK' where slug = 'unhas';
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera segmentos da calculadora');
  begin
    insert into public.calculator_presets (slug, name) values ('hack', 'Hack');
    v := v || to_jsonb('FAIL A criou segmento'::text);
  exception when others then
    v := v || to_jsonb('PASS A não cria segmento'::text);
  end;

  -- Blocos da página
  select count(*) into n from public.tenant_settings where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê blocos/configurações de B');
  update public.tenant_settings set page_blocks = '[]'::jsonb where tenant_id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera blocos de B');
  update public.tenant_settings set page_blocks = (select jsonb_agg(jsonb_build_object('id', 'blk' || g, 'type', 'services', 'enabled', true, 'title', 'S')) from generate_series(1, 5) g)
    where tenant_id = ta;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 1 then 'PASS' else 'FAIL' end) || ' A grava 5 blocos no plano gratuito');
  begin
    update public.tenant_settings set page_blocks = (select jsonb_agg(jsonb_build_object('id', 'blk' || g, 'type', 'services', 'enabled', true, 'title', 'S')) from generate_series(1, 6) g)
      where tenant_id = ta;
    v := v || to_jsonb('FAIL A gravou 6 blocos acima do limite do plano gratuito'::text);
  exception when others then
    v := v || to_jsonb('PASS limite de blocos do plano é aplicado no banco (' || sqlerrm || ')');
  end;
  begin
    update public.tenant_settings set page_blocks = '{"nao":"array"}'::jsonb where tenant_id = ta;
    v := v || to_jsonb('FAIL page_blocks aceitou objeto'::text);
  exception when others then
    v := v || to_jsonb('PASS page_blocks só aceita lista'::text);
  end;
  update public.tenant_settings set instagram = 'ana', city = 'Campinas', template_id = null where tenant_id = ta;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 1 then 'PASS' else 'FAIL' end) || ' A edita perfil público e modelo (grants de coluna restaurados)');

  -- Exceções de recurso e funções do console
  select count(*) into n from public.tenant_feature_overrides where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê exceções de recurso de B');
  select count(*) into n from public.platform_admins where user_id = ud;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não enxerga quem é admin da plataforma');
  begin
    insert into public.platform_admins (user_id, role) values (ua, 'superadmin');
    v := v || to_jsonb('FAIL A se tornou superadmin'::text);
  exception when others then
    v := v || to_jsonb('PASS A não se torna superadmin'::text);
  end;
  begin perform public.admin_set_tenant_status(tb, 'suspended', 'x'); v := v || to_jsonb('FAIL A suspendeu B'::text);
  exception when others then v := v || to_jsonb('PASS A não suspende negócio (' || sqlerrm || ')'); end;
  begin perform public.admin_tenant_overview(tb); v := v || to_jsonb('FAIL A leu o resumo administrativo de B'::text);
  exception when others then v := v || to_jsonb('PASS A não lê resumo administrativo (' || sqlerrm || ')'); end;
  begin perform public.admin_set_feature_override(ta, 'services', true, 9999, 'x', null); v := v || to_jsonb('FAIL A deu exceção de recurso a si'::text);
  exception when others then v := v || to_jsonb('PASS A não concede exceção de recurso a si (' || sqlerrm || ')'); end;
  begin perform public.admin_set_tenant_plan(ta, (select id from public.plans order by price_monthly_cents desc limit 1), 'x'); v := v || to_jsonb('FAIL A trocou o próprio plano'::text);
  exception when others then v := v || to_jsonb('PASS A não troca o próprio plano (' || sqlerrm || ')'); end;
  begin perform public.admin_grant_platform_role('a2@test.local', 'superadmin'); v := v || to_jsonb('FAIL A concedeu admin a si'::text);
  exception when others then v := v || to_jsonb('PASS A não concede admin (' || sqlerrm || ')'); end;
  begin perform public.admin_list_platform_admins(); v := v || to_jsonb('FAIL A listou admins'::text);
  exception when others then v := v || to_jsonb('PASS A não lista admins (' || sqlerrm || ')'); end;
  reset role;

  -- ===================== Usuária sem negócio (C) =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.services;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' usuária sem negócio não lê serviços (' || n || ')');
  select count(*) into n from public.pricing_profiles;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' usuária sem negócio não lê perfis de preço (' || n || ')');
  update public.tenant_settings set page_blocks = '[]'::jsonb where tenant_id = ta;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' usuária sem negócio não altera blocos de A');
  begin
    insert into public.services (tenant_id, name, price_cents, duration_minutes) values (ta, 'Intrusa', 100, 30);
    v := v || to_jsonb('FAIL usuária sem negócio criou serviço em A'::text);
  exception when others then
    v := v || to_jsonb('PASS usuária sem negócio não cria serviço em A'::text);
  end;
  reset role;

  -- ===================== Visitante anônimo e página pública =====================
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin perform count(*) from public.services; v := v || to_jsonb('FAIL anon leu a tabela de serviços'::text);
  exception when others then v := v || to_jsonb('PASS anon não lê a tabela de serviços'::text); end;
  begin perform count(*) from public.pricing_profiles; v := v || to_jsonb('FAIL anon leu perfis de preço'::text);
  exception when others then v := v || to_jsonb('PASS anon não lê perfis de preço'::text); end;
  begin perform public.admin_tenant_overview(tb); v := v || to_jsonb('FAIL anon executou função do console'::text);
  exception when others then v := v || to_jsonb('PASS anon não executa funções do console'::text); end;
  begin perform public.tenant_feature(tb, 'services'); v := v || to_jsonb('FAIL anon executou tenant_feature'::text);
  exception when others then v := v || to_jsonb('PASS anon não executa tenant_feature'::text); end;
  begin perform public.log_audit(tb, 'x'); v := v || to_jsonb('FAIL anon executou log_audit'::text);
  exception when others then v := v || to_jsonb('PASS anon não executa log_audit'::text); end;

  j := public.get_public_tenant('bia-studio-t2');
  select array_agg(x) into k from jsonb_object_keys(j) x;
  v := v || to_jsonb((case when k <@ allowed then 'PASS' else 'FAIL' end) || ' página pública só devolve campos permitidos');
  v := v || to_jsonb((case when j ->> 'address_line' is null then 'PASS' else 'FAIL' end) || ' endereço oculto quando address_public = false');
  v := v || to_jsonb((case when jsonb_array_length(j -> 'services') = 1 and j -> 'services' -> 0 ->> 'name' = 'Corte da Bia' then 'PASS' else 'FAIL' end) || ' página pública mostra só serviços ativos e marcados para aparecer');
  v := v || to_jsonb((case when not (j::text ilike '%@test.local%') then 'PASS' else 'FAIL' end) || ' página pública não vaza e-mail');
  j := public.get_public_tenant('ana-nails-t2');
  v := v || to_jsonb((case when not (j::text like '%Oculto da Bia%' or j::text like '%Segredo da Bia%' or j::text like '%Rua Secreta%') then 'PASS' else 'FAIL' end) || ' página de A não mostra dados de B');
  reset role;

  update public.tenants set status = 'suspended' where id = tb;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  v := v || to_jsonb((case when public.get_public_tenant('bia-studio-t2') is null then 'PASS' else 'FAIL' end) || ' negócio suspenso some da página pública');
  reset role;

  select string_agg(e #>> '{}', E'\n' order by ord) into out from jsonb_array_elements(v) with ordinality t(e, ord);
  raise exception E'RESULTADOS (%: PASS=%, FAIL=%)\n%',
    'rollback automático',
    (select count(*) from jsonb_array_elements_text(v) x where x like 'PASS%'),
    (select count(*) from jsonb_array_elements_text(v) x where x like 'FAIL%'),
    out;
end
$test$;
