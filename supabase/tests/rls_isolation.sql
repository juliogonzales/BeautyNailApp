-- Teste de isolamento multi-tenant (RLS) — roda inteiro dentro de uma transação que SEMPRE é revertida.
-- O resultado aparece na mensagem do erro final "RESULTADOS". Nenhum dado de teste permanece.
-- Uso: psql / Supabase SQL editor / MCP execute_sql.
do $test$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  uc uuid := gen_random_uuid();
  ta uuid; tb uuid; n bigint; sp uuid[]; b boolean; r record;
  exp_customers integer; exp_finance boolean; exp_plans bigint; exp_public bigint; top_plan_slug text;
  v jsonb := '[]'::jsonb;
  out text;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (ua, 'authenticated', 'authenticated', 'a@test.local', '{"full_name":"Ana"}'),
    (ub, 'authenticated', 'authenticated', 'b@test.local', '{"name":"Bia"}'),
    (uc, 'authenticated', 'authenticated', 'c@test.local', '{}');
  select array_agg(id) into sp from public.specialties where slug in ('nail-design', 'manicure');
  -- Valores esperados vêm do próprio banco (planos e textos são dados editáveis; nada de nome/slug fixo).
  select pf.limit_value, true into exp_customers, b from public.plan_features pf join public.plans p on p.id = pf.plan_id
    where p.price_monthly_cents = 0 and pf.feature_key = 'customers' order by p.sort_order limit 1;
  select coalesce((select pf.enabled from public.plan_features pf join public.plans p on p.id = pf.plan_id
    where p.price_monthly_cents = 0 and pf.feature_key = 'finance' order by p.sort_order limit 1), false) into exp_finance;
  select count(*) into exp_plans from public.plans where is_active;
  select count(*) into exp_public from public.platform_settings where is_public;
  select slug into top_plan_slug from public.plans order by price_monthly_cents desc limit 1;

  -- Ana e Bia criam seus negócios pela RPC oficial
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ta := public.create_tenant('Ana Nails', 'ana-nails', sp);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tb := public.create_tenant('Bia Studio', 'bia-studio', sp);
  reset role;
  insert into public.feature_usage (tenant_id, feature_key, used) values (tb, 'customers', 5);

  select count(*) into n from public.profiles where id in (ua, ub, uc);
  v := v || to_jsonb((case when n = 3 then 'PASS' else 'FAIL' end) || ' trigger criou 3 profiles (' || n || ')');
  select count(*) into n from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.tenant_id in (ta, tb) and p.price_monthly_cents = 0 and s.status = 'free';
  v := v || to_jsonb((case when n = 2 then 'PASS' else 'FAIL' end) || ' ambos começam no plano gratuito (' || n || ')');

  -- ===================== Ana tenta acessar dados da Bia =====================
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.tenants;
  v := v || to_jsonb((case when n = 1 then 'PASS' else 'FAIL' end) || ' A enxerga só 1 tenant (' || n || ')');
  select count(*) into n from public.tenants where id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê tenant de B');
  select count(*) into n from public.tenant_settings where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê settings de B');
  select count(*) into n from public.tenant_members where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê membros de B');
  select count(*) into n from public.subscriptions where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê assinatura de B');
  select count(*) into n from public.tenant_specialties where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê especialidades de B');
  select count(*) into n from public.feature_usage where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê uso de features de B');
  select count(*) into n from public.audit_logs where tenant_id = tb;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê auditoria de B');
  select count(*) into n from public.profiles where id = ub;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não lê profile de B');
  select count(*) into n from public.profiles;
  v := v || to_jsonb((case when n = 1 then 'PASS' else 'FAIL' end) || ' A enxerga só o próprio profile (' || n || ')');

  update public.tenants set business_name = 'HACK' where id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera tenant de B');
  update public.tenant_settings set city = 'HACK' where tenant_id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera settings de B');
  delete from public.tenant_members where tenant_id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não remove membros de B');
  delete from public.tenant_specialties where tenant_id = tb;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não remove especialidades de B');

  begin
    insert into public.tenant_members (tenant_id, user_id, role) values (tb, ua, 'admin');
    v := v || to_jsonb('FAIL A conseguiu se inserir como admin no tenant de B'::text);
  exception when others then
    v := v || to_jsonb('PASS A não se insere no tenant de B (' || sqlerrm || ')');
  end;
  begin
    insert into public.tenant_specialties (tenant_id, specialty_id) values (tb, sp[1]);
    v := v || to_jsonb('FAIL A inseriu especialidade em tenant de B'::text);
  exception when others then
    v := v || to_jsonb('PASS A não insere especialidade em tenant de B'::text);
  end;
  begin
    perform public.log_audit(tb, 'hack');
    v := v || to_jsonb('FAIL A escreveu auditoria no tenant de B'::text);
  exception when others then
    v := v || to_jsonb('PASS A não escreve auditoria em tenant de B (' || sqlerrm || ')');
  end;
  begin
    perform * from public.tenant_feature(tb, 'customers');
    v := v || to_jsonb('FAIL A consultou limites do tenant de B'::text);
  exception when others then
    v := v || to_jsonb('PASS A não consulta features de B (' || sqlerrm || ')');
  end;

  -- ===================== Escalada de privilégio dentro do próprio tenant =====================
  begin
    update public.tenants set status = 'suspended' where id = ta;
    v := v || to_jsonb('FAIL A alterou status do próprio tenant'::text);
  exception when others then
    v := v || to_jsonb('PASS A não altera status do tenant (' || sqlerrm || ')');
  end;
  begin
    update public.subscriptions set plan_id = (select id from public.plans where slug = top_plan_slug) where tenant_id = ta;
    v := v || to_jsonb('FAIL A trocou o próprio plano direto'::text);
  exception when others then
    v := v || to_jsonb('PASS A não troca plano direto (' || sqlerrm || ')');
  end;
  begin
    insert into public.subscriptions (tenant_id, plan_id) values (ta, (select id from public.plans where slug = top_plan_slug));
    v := v || to_jsonb('FAIL A inseriu assinatura'::text);
  exception when others then
    v := v || to_jsonb('PASS A não insere assinatura'::text);
  end;
  begin
    update public.feature_usage set used = 0 where tenant_id = ta;
    get diagnostics n = row_count;
    v := v || to_jsonb('FAIL A escreveu em feature_usage'::text);
  exception when others then
    v := v || to_jsonb('PASS A não escreve em feature_usage'::text);
  end;
  begin
    insert into public.tenant_members (tenant_id, user_id, role) values (ta, ub, 'owner');
    v := v || to_jsonb('FAIL A criou segundo dono'::text);
  exception when others then
    v := v || to_jsonb('PASS A não cria dono via cliente'::text);
  end;
  update public.tenant_members set role = 'assistant' where tenant_id = ta and user_id = ua;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' dono não se rebaixa pelo cliente');
  begin
    update public.audit_logs set action = 'x' where tenant_id = ta;
    v := v || to_jsonb('FAIL A alterou auditoria'::text);
  exception when others then
    v := v || to_jsonb('PASS A não altera auditoria'::text);
  end;
  begin
    delete from public.audit_logs where tenant_id = ta;
    v := v || to_jsonb('FAIL A apagou auditoria'::text);
  exception when others then
    v := v || to_jsonb('PASS A não apaga auditoria'::text);
  end;
  begin
    insert into public.platform_admins (user_id, role) values (ua, 'superadmin');
    v := v || to_jsonb('FAIL A virou admin da plataforma'::text);
  exception when others then
    v := v || to_jsonb('PASS A não vira admin da plataforma'::text);
  end;
  begin
    update public.plans set price_monthly_cents = 0 where slug = top_plan_slug;
    get diagnostics n = row_count;
    v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' A não altera preços de planos (linhas: ' || n || ')');
  exception when others then
    v := v || to_jsonb('PASS A não altera planos'::text);
  end;
  begin
    insert into public.specialties (slug, name) values ('hack', 'Hack');
    v := v || to_jsonb('FAIL A criou especialidade global'::text);
  exception when others then
    v := v || to_jsonb('PASS A não cria especialidade global'::text);
  end;
  begin
    insert into public.platform_settings (key, value) values ('hack', '1'::jsonb);
    v := v || to_jsonb('FAIL A escreveu em platform_settings'::text);
  exception when others then
    v := v || to_jsonb('PASS A não escreve em platform_settings'::text);
  end;

  -- ===================== Operações legítimas de A =====================
  update public.tenants set business_name = 'Ana Nails Studio', onboarding_step = 2 where id = ta;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 1 then 'PASS' else 'FAIL' end) || ' A edita o próprio tenant');
  update public.tenant_settings set city = 'São Paulo', state = 'SP', postal_code = '01001000' where tenant_id = ta;
  get diagnostics n = row_count;
  v := v || to_jsonb((case when n = 1 then 'PASS' else 'FAIL' end) || ' A edita as próprias settings');
  select count(*) into n from public.tenant_specialties where tenant_id = ta;
  v := v || to_jsonb((case when n = 2 then 'PASS' else 'FAIL' end) || ' A vê as 2 especialidades escolhidas (' || n || ')');
  select count(*) into n from public.audit_logs where tenant_id = ta;
  v := v || to_jsonb((case when n >= 4 then 'PASS' else 'FAIL' end) || ' auditoria automática registrou ações de A (' || n || ')');
  perform public.log_audit(ta, 'auth.login');
  select count(*) into n from public.audit_logs where tenant_id = ta and action = 'auth.login';
  v := v || to_jsonb((case when n = 1 then 'PASS' else 'FAIL' end) || ' log_audit funciona no próprio tenant');
  select * into r from public.tenant_feature(ta, 'customers');
  v := v || to_jsonb((case when r.enabled and r.limit_value is not distinct from exp_customers then 'PASS' else 'FAIL' end) || ' limite de clientes do plano gratuito confere com plan_features (veio ' || coalesce(r.limit_value::text, 'null') || ')');
  select * into r from public.tenant_feature(ta, 'finance');
  v := v || to_jsonb((case when r.enabled = exp_finance then 'PASS' else 'FAIL' end) || ' financeiro no plano gratuito confere com plan_features');
  select public.is_slug_available('admin') into b;
  v := v || to_jsonb((case when not b then 'PASS' else 'FAIL' end) || ' slug reservado indisponível');
  select public.is_slug_available('bia-studio') into b;
  v := v || to_jsonb((case when not b then 'PASS' else 'FAIL' end) || ' slug já usado indisponível');
  select public.is_slug_available('novo-negocio') into b;
  v := v || to_jsonb((case when b then 'PASS' else 'FAIL' end) || ' slug livre disponível');
  begin
    perform public.create_tenant('Outro', 'admin');
    v := v || to_jsonb('FAIL criou tenant com slug reservado'::text);
  exception when others then
    v := v || to_jsonb('PASS slug reservado bloqueado na criação (' || sqlerrm || ')');
  end;
  begin
    update public.tenants set slug = 'api' where id = ta;
    v := v || to_jsonb('FAIL trocou slug para reservado'::text);
  exception when others then
    v := v || to_jsonb('PASS troca para slug reservado bloqueada (' || sqlerrm || ')');
  end;
  reset role;

  -- ===================== Usuária sem negócio =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.tenants;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' C (sem negócio) não vê tenants');
  select count(*) into n from public.audit_logs;
  v := v || to_jsonb((case when n = 0 then 'PASS' else 'FAIL' end) || ' C não vê auditoria');
  select count(*) into n from public.plans;
  v := v || to_jsonb((case when n = exp_plans then 'PASS' else 'FAIL' end) || ' C vê os planos ativos (' || n || ')');
  reset role;

  -- ===================== Visitante anônimo =====================
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    perform count(*) from public.tenants;
    v := v || to_jsonb('FAIL anon leu tenants'::text);
  exception when others then
    v := v || to_jsonb('PASS anon não lê tenants'::text);
  end;
  begin
    perform count(*) from public.profiles;
    v := v || to_jsonb('FAIL anon leu profiles'::text);
  exception when others then
    v := v || to_jsonb('PASS anon não lê profiles'::text);
  end;
  begin
    perform public.create_tenant('Anon', 'anon-tenant');
    v := v || to_jsonb('FAIL anon criou tenant'::text);
  exception when others then
    v := v || to_jsonb('PASS anon não cria tenant'::text);
  end;
  select count(*) into n from public.plans;
  v := v || to_jsonb((case when n = exp_plans then 'PASS' else 'FAIL' end) || ' anon vê preços dos planos (' || n || ')');
  select count(*) into n from public.platform_settings;
  v := v || to_jsonb((case when n = exp_public then 'PASS' else 'FAIL' end) || ' anon vê só configurações públicas (' || n || ')');
  begin
    perform count(*) from public.reserved_slugs;
    v := v || to_jsonb('FAIL anon leu reserved_slugs'::text);
  exception when others then
    v := v || to_jsonb('PASS anon não lê reserved_slugs'::text);
  end;
  reset role;

  -- Auditoria é append-only até para o dono do banco
  begin
    update public.audit_logs set action = 'x';
    v := v || to_jsonb('FAIL audit_logs alterável'::text);
  exception when others then
    v := v || to_jsonb('PASS audit_logs é append-only (até para postgres)'::text);
  end;

  select string_agg(e #>> '{}', E'\n' order by ord) into out from jsonb_array_elements(v) with ordinality t(e, ord);
  raise exception E'RESULTADOS (%: PASS=%, FAIL=%)\n%',
    'rollback automático',
    (select count(*) from jsonb_array_elements_text(v) x where x like 'PASS%'),
    (select count(*) from jsonb_array_elements_text(v) x where x like 'FAIL%'),
    out;
end
$test$;
