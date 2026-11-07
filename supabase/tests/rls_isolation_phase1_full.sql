-- Teste de isolamento (Fase 1 completa): serviços, calculadora, blocos da página, console admin e leitura pública.
-- Roda numa transação que SEMPRE é revertida; o resultado vem na mensagem do erro final "RESULTADOS".
do $test$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  ud uuid := gen_random_uuid(); ue uuid := gen_random_uuid();
  ta uuid; tb uuid; n bigint; sp uuid[]; lim integer; j jsonb;
  v jsonb := '[]'::jsonb; out text;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (ua, 'authenticated', 'authenticated', 'a2@test.local', '{}'),
    (ub, 'authenticated', 'authenticated', 'b2@test.local', '{}'),
    (uc, 'authenticated', 'authenticated', 'c2@test.local', '{}'),
    (ud, 'authenticated', 'authenticated', 'd2@test.local', '{}'),
    (ue, 'authenticated', 'authenticated', 'e2@test.local', '{}');
  select array_agg(id) into sp from public.specialties where slug in ('nail-design', 'manicure');
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated; ta := public.create_tenant('Ana Dois', 'ana-dois', sp); reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated; tb := public.create_tenant('Bia Dois', 'bia-dois', sp); reset role;
  -- Admins da plataforma: C superadmin, D suporte, E financeiro
  insert into public.platform_admins (user_id, role) values (uc, 'superadmin'), (ud, 'support'), (ue, 'billing');

  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.services (tenant_id, name, price_cents, duration_minutes) values (tb, 'Serviço da Bia', 5000, 60);
    v := v || to_jsonb('PASS B cria serviço'::text);
  exception when others then
    v := v || to_jsonb('FAIL B cria serviço (' || sqlerrm || ')');
  end;
  begin
    insert into public.services (tenant_id, name, price_cents, duration_minutes, show_on_page) values (tb, 'Oculto da Bia', 3000, 30, false);
    v := v || to_jsonb('PASS B cria serviço oculto'::text);
  exception when others then
    v := v || to_jsonb('FAIL B cria serviço oculto (' || sqlerrm || ')');
  end;
  begin
    insert into public.pricing_profiles (tenant_id, monthly_income_cents, days_per_week, hours_per_day, occupancy_bp, fixed_costs_cents, card_fee_bp, tax_bp, commission_bp, margin_bp) values (tb, 300000, 5, 8, 7000, 80000, 450, 0, 0, 2000);
    v := v || to_jsonb('PASS B cria perfil de preço'::text);
  exception when others then
    v := v || to_jsonb('FAIL B cria perfil de preço (' || sqlerrm || ')');
  end;
  begin
    update public.tenant_settings set page_blocks = '[{"id":"bbbb1","type":"services","enabled":true,"title":"Serviços"}]'::jsonb where tenant_id = tb;
    v := v || to_jsonb('PASS B salva blocos da página'::text);
  exception when others then
    v := v || to_jsonb('FAIL B salva blocos da página (' || sqlerrm || ')');
  end;
  reset role;
  insert into public.tenant_feature_overrides (tenant_id, feature_key, enabled, limit_value, reason) values (tb, 'services', true, 99, 'teste');
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.services where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê serviços de B (' || n || ')');
  update public.services set name = 'HACK' where tenant_id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera serviços de B (' || n || ')');
  delete from public.services where tenant_id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não remove serviços de B (' || n || ')');
  begin
    insert into public.services (tenant_id, name, price_cents, duration_minutes) values (tb, 'Invasão', 100, 30);
    v := v || to_jsonb('FAIL A não cria serviço em B'::text);
  exception when others then
    v := v || to_jsonb('PASS A não cria serviço em B (' || left(sqlerrm, 60) || ')');
  end;
  select count(*) into n from public.pricing_profiles where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê perfil de preço de B (' || n || ')');
  update public.pricing_profiles set margin_bp = 1 where tenant_id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera perfil de preço de B (' || n || ')');
  begin
    insert into public.pricing_profiles (tenant_id, monthly_income_cents, days_per_week, hours_per_day, occupancy_bp, fixed_costs_cents, card_fee_bp, tax_bp, commission_bp, margin_bp) values (tb, 1, 5, 8, 7000, 0, 0, 0, 0, 2000);
    v := v || to_jsonb('FAIL A não cria perfil de preço em B'::text);
  exception when others then
    v := v || to_jsonb('PASS A não cria perfil de preço em B (' || left(sqlerrm, 60) || ')');
  end;
  update public.tenant_settings set page_blocks = '[]'::jsonb where tenant_id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera blocos da página de B (' || n || ')');
  select count(*) into n from public.tenant_feature_overrides where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê exceções de recurso de B (' || n || ')');
  begin
    insert into public.services (tenant_id, name, price_cents, duration_minutes) values (ta, 'Serviço da Ana', 4000, 45);
    v := v || to_jsonb('PASS A cria o próprio serviço'::text);
  exception when others then
    v := v || to_jsonb('FAIL A cria o próprio serviço (' || sqlerrm || ')');
  end;
  begin
    insert into public.services (tenant_id, name, price_cents, duration_minutes) values (ta, 'serviço DA ana', 4000, 45);
    v := v || to_jsonb('FAIL nome duplicado (sem diferenciar maiúsculas) é barrado'::text);
  exception when others then
    v := v || to_jsonb('PASS nome duplicado (sem diferenciar maiúsculas) é barrado (' || left(sqlerrm, 60) || ')');
  end;
  begin
    insert into public.services (tenant_id, name, price_cents, duration_minutes) values (ta, 'Preço inválido', -1, 45);
    v := v || to_jsonb('FAIL preço negativo é barrado'::text);
  exception when others then
    v := v || to_jsonb('PASS preço negativo é barrado (' || left(sqlerrm, 60) || ')');
  end;
  begin
    insert into public.services (tenant_id, name, price_cents, duration_minutes) values (ta, 'Duração inválida', 100, 2);
    v := v || to_jsonb('FAIL duração abaixo de 5 min é barrada'::text);
  exception when others then
    v := v || to_jsonb('PASS duração abaixo de 5 min é barrada (' || left(sqlerrm, 60) || ')');
  end;
  begin
    insert into public.pricing_profiles (tenant_id, monthly_income_cents, days_per_week, hours_per_day, occupancy_bp, fixed_costs_cents, card_fee_bp, tax_bp, commission_bp, margin_bp) values (ta, 200000, 5, 8, 7000, 50000, 0, 0, 0, 2000);
    v := v || to_jsonb('PASS A cria o próprio perfil de preço'::text);
  exception when others then
    v := v || to_jsonb('FAIL A cria o próprio perfil de preço (' || sqlerrm || ')');
  end;
  begin
    update public.pricing_profiles set days_per_week = 9 where tenant_id = ta;
    v := v || to_jsonb('FAIL dias por semana > 7 é barrado'::text);
  exception when others then
    v := v || to_jsonb('PASS dias por semana > 7 é barrado (' || left(sqlerrm, 60) || ')');
  end;
  begin
    update public.tenant_settings set page_blocks = '[{"id":"aaaa1","type":"text","enabled":true,"title":"","body":"oi"}]'::jsonb where tenant_id = ta;
    v := v || to_jsonb('PASS A salva blocos da própria página'::text);
  exception when others then
    v := v || to_jsonb('FAIL A salva blocos da própria página (' || sqlerrm || ')');
  end;
  begin
    update public.tenant_settings set page_blocks = '{"x":1}'::jsonb where tenant_id = ta;
    v := v || to_jsonb('FAIL blocos que não são lista são barrados'::text);
  exception when others then
    v := v || to_jsonb('PASS blocos que não são lista são barrados (' || left(sqlerrm, 60) || ')');
  end;
  begin
    update public.tenant_settings set page_blocks = (select jsonb_agg(jsonb_build_object('id','b'||g||'xx','type','services','enabled',true,'title','S')) from generate_series(1,31) g) where tenant_id = ta;
    v := v || to_jsonb('FAIL mais de 30 blocos é barrado'::text);
  exception when others then
    v := v || to_jsonb('PASS mais de 30 blocos é barrado (' || left(sqlerrm, 60) || ')');
  end;
  select count(*) into n from public.calculator_presets where is_active;
  v := v || to_jsonb((case when n >= 10 then 'PASS' else 'FAIL' end) || ' A lê os segmentos da calculadora (' || n || ')');
  update public.calculator_presets set name = 'HACK';
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera segmentos da calculadora (' || n || ')');
  begin
    insert into public.calculator_presets (slug, name) values ('hack', 'Hack');
    v := v || to_jsonb('FAIL A não cria segmento da calculadora'::text);
  exception when others then
    v := v || to_jsonb('PASS A não cria segmento da calculadora (' || left(sqlerrm, 60) || ')');
  end;
  begin
    insert into public.page_templates (name, config) values ('Hack', '{}'::jsonb);
    v := v || to_jsonb('FAIL A não cria modelo de página'::text);
  exception when others then
    v := v || to_jsonb('PASS A não cria modelo de página (' || left(sqlerrm, 60) || ')');
  end;
  update public.plans set name = 'HACK';
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera planos (' || n || ')');
  update public.plan_features set enabled = true;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera recursos dos planos (' || n || ')');
  update public.specialties set name = 'HACK';
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera especialidades (' || n || ')');
  update public.platform_settings set value = '"x"'::jsonb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera configurações da plataforma (' || n || ')');
  select count(*) into n from public.platform_admins;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê a lista de admins da plataforma (' || n || ')');
  select count(*) into n from public.audit_logs where tenant_id is null;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê auditoria administrativa (' || n || ')');
  begin
    perform public.admin_set_tenant_status(tb, 'suspended', 'x');
    v := v || to_jsonb('FAIL A não suspende negócio'::text);
  exception when others then
    v := v || to_jsonb('PASS A não suspende negócio (' || left(sqlerrm, 60) || ')');
  end;
  begin
    perform public.admin_set_tenant_plan(tb, (select id from public.plans limit 1), 'x');
    v := v || to_jsonb('FAIL A não troca plano de negócio'::text);
  exception when others then
    v := v || to_jsonb('PASS A não troca plano de negócio (' || left(sqlerrm, 60) || ')');
  end;
  begin
    perform public.admin_set_feature_override(ta, 'services', true, 999, 'x');
    v := v || to_jsonb('FAIL A não cria exceção de recurso para si'::text);
  exception when others then
    v := v || to_jsonb('PASS A não cria exceção de recurso para si (' || left(sqlerrm, 60) || ')');
  end;
  begin
    perform public.admin_list_platform_admins();
    v := v || to_jsonb('FAIL A não lista admins'::text);
  exception when others then
    v := v || to_jsonb('PASS A não lista admins (' || left(sqlerrm, 60) || ')');
  end;
  begin
    perform public.admin_grant_platform_role('a2@test.local', 'superadmin');
    v := v || to_jsonb('FAIL A não se concede superadmin'::text);
  exception when others then
    v := v || to_jsonb('PASS A não se concede superadmin (' || left(sqlerrm, 60) || ')');
  end;
  begin
    perform public.admin_tenant_overview(tb);
    v := v || to_jsonb('FAIL A não vê visão administrativa de B'::text);
  exception when others then
    v := v || to_jsonb('PASS A não vê visão administrativa de B (' || left(sqlerrm, 60) || ')');
  end;
  reset role;
  select fs.limit_value into lim from private.feature_state(ta, 'page_blocks') fs;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if lim is not null then
    begin
      update public.tenant_settings set page_blocks = (select jsonb_agg(jsonb_build_object('id','c'||g||'xxx','type','services','enabled',true,'title','S')) from generate_series(1, lim + 1) g) where tenant_id = ta;
      v := v || to_jsonb('FAIL limite de blocos do plano não foi aplicado'::text);
    exception when others then
      v := v || to_jsonb('PASS limite de blocos do plano é aplicado no banco (limite ' || lim || ')');
    end;
  end if;
  reset role;
  select fs.limit_value into lim from private.feature_state(ta, 'services') fs;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if lim is not null then
    begin
      insert into public.services (tenant_id, name, price_cents, duration_minutes) select ta, 'Extra ' || g, 100, 30 from generate_series(1, lim + 1) g;
      v := v || to_jsonb('FAIL limite de serviços do plano não foi aplicado'::text);
    exception when others then
      v := v || to_jsonb('PASS limite de serviços do plano é aplicado no banco (limite ' || lim || ')');
    end;
  end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ud, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.services;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' suporte da plataforma não lê serviços de clientes (' || n || ')');
  select count(*) into n from public.pricing_profiles;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' suporte da plataforma não lê perfil de preço de clientes (' || n || ')');
  begin
    perform public.admin_set_tenant_status(tb, 'suspended', 'teste');
    v := v || to_jsonb('PASS suporte suspende negócio'::text);
  exception when others then
    v := v || to_jsonb('FAIL suporte suspende negócio (' || sqlerrm || ')');
  end;
  begin
    perform public.admin_set_tenant_status(tb, 'active', 'teste');
    v := v || to_jsonb('PASS suporte reativa negócio'::text);
  exception when others then
    v := v || to_jsonb('FAIL suporte reativa negócio (' || sqlerrm || ')');
  end;
  begin
    perform public.admin_grant_platform_role('d2@test.local', 'superadmin');
    v := v || to_jsonb('FAIL suporte não concede papel de admin'::text);
  exception when others then
    v := v || to_jsonb('PASS suporte não concede papel de admin (' || left(sqlerrm, 60) || ')');
  end;
  begin
    perform public.admin_set_feature_override(tb, 'services', true, 5, 'x');
    v := v || to_jsonb('FAIL suporte não cria exceção de recurso'::text);
  exception when others then
    v := v || to_jsonb('PASS suporte não cria exceção de recurso (' || left(sqlerrm, 60) || ')');
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ue, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_set_tenant_status(tb, 'suspended', 'x');
    v := v || to_jsonb('FAIL financeiro não suspende negócio'::text);
  exception when others then
    v := v || to_jsonb('PASS financeiro não suspende negócio (' || left(sqlerrm, 60) || ')');
  end;
  begin
    perform public.admin_set_feature_override(tb, 'customers', true, 50, 'teste financeiro');
    v := v || to_jsonb('PASS financeiro cria exceção de recurso'::text);
  exception when others then
    v := v || to_jsonb('FAIL financeiro cria exceção de recurso (' || sqlerrm || ')');
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.services;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' superadmin não lê serviços de clientes (RLS por negócio) (' || n || ')');
  select count(*) into n from public.pricing_profiles;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' superadmin não lê perfil de preço de clientes (' || n || ')');
  begin
    update public.calculator_presets set sort_order = sort_order where slug = 'unhas';
    v := v || to_jsonb('PASS superadmin edita segmentos'::text);
  exception when others then
    v := v || to_jsonb('FAIL superadmin edita segmentos (' || sqlerrm || ')');
  end;
  begin
    perform public.admin_list_platform_admins();
    v := v || to_jsonb('PASS superadmin lista admins'::text);
  exception when others then
    v := v || to_jsonb('FAIL superadmin lista admins (' || sqlerrm || ')');
  end;
  begin
    perform public.admin_revoke_platform_role(uc);
    v := v || to_jsonb('FAIL superadmin não remove o próprio acesso'::text);
  exception when others then
    v := v || to_jsonb('PASS superadmin não remove o próprio acesso (' || left(sqlerrm, 60) || ')');
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    perform count(*) from public.services;
    v := v || to_jsonb('FAIL anon não lê serviços'::text);
  exception when others then
    v := v || to_jsonb('PASS anon não lê serviços (' || left(sqlerrm, 60) || ')');
  end;
  begin
    perform count(*) from public.pricing_profiles;
    v := v || to_jsonb('FAIL anon não lê perfil de preço'::text);
  exception when others then
    v := v || to_jsonb('PASS anon não lê perfil de preço (' || left(sqlerrm, 60) || ')');
  end;
  begin
    perform count(*) from public.calculator_presets;
    v := v || to_jsonb('FAIL anon não lê segmentos da calculadora'::text);
  exception when others then
    v := v || to_jsonb('PASS anon não lê segmentos da calculadora (' || left(sqlerrm, 60) || ')');
  end;
  begin
    update public.tenant_settings set page_blocks = '[]'::jsonb;
    v := v || to_jsonb('FAIL anon não altera blocos'::text);
  exception when others then
    v := v || to_jsonb('PASS anon não altera blocos (' || left(sqlerrm, 60) || ')');
  end;
  begin
    perform public.admin_set_tenant_status(tb, 'suspended', 'x');
    v := v || to_jsonb('FAIL anon não executa RPC admin'::text);
  exception when others then
    v := v || to_jsonb('PASS anon não executa RPC admin (' || left(sqlerrm, 60) || ')');
  end;
  begin
    perform public.admin_list_platform_admins();
    v := v || to_jsonb('FAIL anon não lista admins'::text);
  exception when others then
    v := v || to_jsonb('PASS anon não lista admins (' || left(sqlerrm, 60) || ')');
  end;
  j := public.get_public_tenant('bia-dois');
  v := v || to_jsonb((case when j ->> 'business_name' = 'Bia Dois' then 'PASS' else 'FAIL' end) || ' anon lê a página pública de B');
  v := v || to_jsonb((case when j -> 'blocks' is not null and jsonb_typeof(j -> 'blocks') = 'array' then 'PASS' else 'FAIL' end) || ' página pública devolve os blocos');
  v := v || to_jsonb((case when jsonb_array_length(j -> 'services') = 1 and j -> 'services' -> 0 ->> 'name' = 'Serviço da Bia' then 'PASS' else 'FAIL' end) || ' página pública mostra só serviço visível (oculto não aparece)');
  v := v || to_jsonb((case when not (j ?| array['email','document','owner','owner_id','tenant_id','id','legal_name','phone','cost_cents']) and not (j -> 'services' -> 0 ? 'cost_cents') then 'PASS' else 'FAIL' end) || ' página pública não expõe e-mail, documento, id nem custo');
  reset role;
  update public.tenants set status = 'suspended' where id = tb;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  v := v || to_jsonb((case when public.get_public_tenant('bia-dois') is null then 'PASS' else 'FAIL' end) || ' negócio suspenso some da página pública');
  reset role;
  select string_agg(e #>> '{}', E'\n' order by ord) into out from jsonb_array_elements(v) with ordinality t(e, ord);
  raise exception E'RESULTADOS (rollback automático: PASS=%, FAIL=%)\n%',
    (select count(*) from jsonb_array_elements_text(v) x where x like 'PASS%'),
    (select count(*) from jsonb_array_elements_text(v) x where x like 'FAIL%'),
    out;
end
$test$;
