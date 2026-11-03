-- ============================================================================
-- BEAUTY OS — Fase 1: fundação (multi-tenant, RLS, planos, auditoria)
-- Regras: RLS em todas as tabelas; anon sem acesso, exceto leitura pública de
-- planos/features/configurações públicas; escritas sensíveis só via RPC
-- (security definer) ou service_role.
-- ============================================================================

-- Schema privado (não exposto pela Data API) para funções auxiliares
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Endurecimento: novas tabelas/sequências/funções NÃO nascem com acesso para anon/authenticated.
-- Cada migration precisa conceder explicitamente o que for necessário.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------
create type public.tenant_role as enum ('owner', 'admin', 'professional', 'assistant');
create type public.tenant_status as enum ('active', 'suspended', 'deleted');
create type public.subscription_status as enum ('free', 'trialing', 'active', 'past_due', 'canceled');
create type public.billing_cycle as enum ('monthly', 'yearly');
create type public.platform_role as enum ('superadmin', 'support', 'billing');
create type public.feature_kind as enum ('flag', 'limit');

-- ----------------------------------------------------------------------------
-- Utilitário: updated_at
-- ----------------------------------------------------------------------------
create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- profiles (1:1 com auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) <= 120),
  avatar_url  text check (avatar_url is null or char_length(avatar_url) <= 500),
  phone       text check (phone is null or char_length(phone) <= 20),
  whatsapp    text check (whatsapp is null or char_length(whatsapp) <= 20),
  locale      text not null default 'pt-BR',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Cria o profile automaticamente quando um usuário se cadastra (e-mail ou Google)
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 120), ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''), 500), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ----------------------------------------------------------------------------
-- Administração da plataforma
-- ----------------------------------------------------------------------------
create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.platform_role not null,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

create function private.is_platform_admin(p_roles public.platform_role[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = (select auth.uid())
      and (p_roles is null or pa.role = any (p_roles))
  );
$$;

create table public.platform_settings (
  key         text primary key check (key ~ '^[a-z0-9_.]{1,64}$'),
  value       jsonb not null,
  is_public   boolean not null default false,
  description text,
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- Especialidades (gerenciadas pelo admin, sem alterar código)
-- ----------------------------------------------------------------------------
create table public.specialties (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name       text not null check (char_length(name) between 2 and 80),
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.specialties enable row level security;
create trigger specialties_updated_at before update on public.specialties
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- Planos e features (nenhum limite comercial fixo no código)
-- ----------------------------------------------------------------------------
create table public.features (
  key         text primary key check (key ~ '^[a-z0-9_]{2,48}$'),
  name        text not null,
  description text,
  kind        public.feature_kind not null,
  unit        text,
  sort_order  integer not null default 0
);
alter table public.features enable row level security;

create table public.plans (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name               text not null,
  description        text,
  price_monthly_cents integer not null default 0 check (price_monthly_cents >= 0),
  price_yearly_cents  integer not null default 0 check (price_yearly_cents >= 0),
  trial_days         integer not null default 0 check (trial_days between 0 and 90),
  is_public          boolean not null default true,
  is_active          boolean not null default true,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.plans enable row level security;
create trigger plans_updated_at before update on public.plans
  for each row execute function private.set_updated_at();

-- Semântica: flag -> enabled. limit -> enabled + limit_value (NULL = ilimitado; enabled=false = indisponível)
create table public.plan_features (
  plan_id      uuid not null references public.plans (id) on delete cascade,
  feature_key  text not null references public.features (key) on delete cascade,
  enabled      boolean not null default false,
  limit_value  integer check (limit_value is null or limit_value >= 0),
  primary key (plan_id, feature_key)
);
alter table public.plan_features enable row level security;
create index plan_features_feature_key_idx on public.plan_features (feature_key);

-- ----------------------------------------------------------------------------
-- Tenants
-- ----------------------------------------------------------------------------
create table public.reserved_slugs (
  slug text primary key
);
alter table public.reserved_slugs enable row level security; -- sem policies: só funções definer leem

create table public.tenants (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique
                          check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and slug !~ '--'),
  business_name           text not null check (char_length(business_name) between 2 and 80),
  status                  public.tenant_status not null default 'active',
  onboarding_step         smallint not null default 0 check (onboarding_step between 0 and 10),
  onboarding_completed_at timestamptz,
  created_by              uuid references auth.users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
alter table public.tenants enable row level security;
create trigger tenants_updated_at before update on public.tenants
  for each row execute function private.set_updated_at();

create function private.check_tenant_slug() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.reserved_slugs r where r.slug = new.slug) then
    raise exception 'slug_reserved' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger tenants_check_slug before insert or update of slug on public.tenants
  for each row execute function private.check_tenant_slug();

create table public.tenant_members (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.tenant_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
alter table public.tenant_members enable row level security;
create index tenant_members_user_id_idx on public.tenant_members (user_id);
create unique index tenant_members_one_owner_idx on public.tenant_members (tenant_id) where role = 'owner';
create trigger tenant_members_updated_at before update on public.tenant_members
  for each row execute function private.set_updated_at();

-- Funções auxiliares de autorização (usadas pelas policies)
create function private.is_tenant_member(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = p_tenant and m.user_id = (select auth.uid())
  );
$$;

create function private.has_tenant_role(p_tenant uuid, p_roles public.tenant_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = p_tenant and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;

-- Pode administrar o tenant: dono/admin e tenant ativo
create function private.can_manage_tenant(p_tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tenant_members m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
      and t.status = 'active'
  );
$$;

create function private.shares_tenant_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tenant_members a
    join public.tenant_members b on b.tenant_id = a.tenant_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

create table public.tenant_settings (
  tenant_id       uuid primary key references public.tenants (id) on delete cascade,
  legal_name      text check (legal_name is null or char_length(legal_name) <= 120),
  document        text check (document is null or document ~ '^\d{11}(\d{3})?$'), -- CPF/CNPJ só dígitos
  phone           text check (phone is null or char_length(phone) <= 20),
  whatsapp        text check (whatsapp is null or char_length(whatsapp) <= 20),
  email           text check (email is null or char_length(email) <= 254),
  postal_code     text check (postal_code is null or postal_code ~ '^\d{8}$'),
  state           text check (state is null or state ~ '^[A-Z]{2}$'),
  city            text check (city is null or char_length(city) <= 80),
  neighborhood    text check (neighborhood is null or char_length(neighborhood) <= 80),
  address_line    text check (address_line is null or char_length(address_line) <= 200),
  address_public  boolean not null default false, -- nunca expor endereço residencial por padrão
  instagram       text check (instagram is null or char_length(instagram) <= 100),
  primary_color   text check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color    text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_path       text check (logo_path is null or char_length(logo_path) <= 300),
  timezone        text not null default 'America/Sao_Paulo',
  locale          text not null default 'pt-BR',
  currency        char(3) not null default 'BRL',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.tenant_settings enable row level security;
create trigger tenant_settings_updated_at before update on public.tenant_settings
  for each row execute function private.set_updated_at();

create table public.tenant_specialties (
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  specialty_id uuid not null references public.specialties (id) on delete restrict,
  created_at   timestamptz not null default now(),
  primary key (tenant_id, specialty_id)
);
alter table public.tenant_specialties enable row level security;
create index tenant_specialties_specialty_idx on public.tenant_specialties (specialty_id);

-- ----------------------------------------------------------------------------
-- Assinaturas SaaS da profissional e uso de features
-- ----------------------------------------------------------------------------
create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants (id) on delete cascade,
  plan_id                  uuid not null references public.plans (id) on delete restrict,
  status                   public.subscription_status not null default 'free',
  billing_cycle            public.billing_cycle,
  trial_ends_at            timestamptz,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  canceled_at              timestamptz,
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create unique index subscriptions_one_current_idx on public.subscriptions (tenant_id) where status <> 'canceled';
create index subscriptions_plan_idx on public.subscriptions (plan_id);
create unique index subscriptions_provider_sub_idx on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();

create table public.feature_usage (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  feature_key text not null references public.features (key) on delete cascade,
  period      text not null default 'lifetime',
  used        integer not null default 0 check (used >= 0),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, feature_key, period)
);
alter table public.feature_usage enable row level security;

-- ----------------------------------------------------------------------------
-- Auditoria (append-only)
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid, -- sem FK: logs sobrevivem à exclusão do tenant (retenção/LGPD)
  actor_id    uuid,
  action      text not null check (char_length(action) <= 80),
  entity_type text check (entity_type is null or char_length(entity_type) <= 60),
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 8192),
  created_at  timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create index audit_logs_tenant_created_idx on public.audit_logs (tenant_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

create function private.audit_logs_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.audit_logs_immutable();

-- Trigger genérico: registra quais CAMPOS mudaram (nunca os valores, para não vazar PII)
create function private.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_new     jsonb := to_jsonb(new);
  v_old     jsonb;
  v_tenant  uuid;
  v_meta    jsonb := '{}'::jsonb;
  v_changed text[];
begin
  if tg_table_name = 'tenants' then
    v_tenant := new.id;
  else
    v_tenant := (v_new ->> 'tenant_id')::uuid;
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    select coalesce(array_agg(k order by k), '{}') into v_changed
    from jsonb_object_keys(v_new) k
    where k <> 'updated_at' and (v_new -> k) is distinct from (v_old -> k);
    if coalesce(array_length(v_changed, 1), 0) = 0 then
      return new;
    end if;
    v_meta := jsonb_build_object('changed', to_jsonb(v_changed));
    if tg_table_name = 'subscriptions' then
      v_meta := v_meta || jsonb_build_object(
        'old_plan_id', v_old -> 'plan_id', 'new_plan_id', v_new -> 'plan_id',
        'old_status', v_old -> 'status', 'new_status', v_new -> 'status');
    end if;
  end if;

  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_tenant, (select auth.uid()), tg_table_name || '.' || lower(tg_op), tg_table_name,
          coalesce((v_new ->> 'id')::uuid, v_tenant), v_meta);
  return new;
end $$;

create trigger tenants_audit after insert or update on public.tenants
  for each row execute function private.audit_row_change();
create trigger tenant_settings_audit after insert or update on public.tenant_settings
  for each row execute function private.audit_row_change();
create trigger subscriptions_audit after insert or update on public.subscriptions
  for each row execute function private.audit_row_change();

-- ============================================================================
-- RPCs (security definer) — única porta de entrada para operações sensíveis
-- ============================================================================

create function public.is_slug_available(p_slug text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v text := lower(trim(coalesce(p_slug, '')));
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' or v ~ '--' then return false; end if;
  if exists (select 1 from public.reserved_slugs where slug = v) then return false; end if;
  return not exists (select 1 from public.tenants where slug = v);
end $$;

create function public.create_tenant(p_business_name text, p_slug text, p_specialty_ids uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := (select auth.uid());
  v_slug    text := lower(trim(coalesce(p_slug, '')));
  v_name    text := trim(coalesce(p_business_name, ''));
  v_plan    uuid;
  v_tenant  uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'invalid_business_name' using errcode = 'P0001'; end if;
  if (select count(*) from public.tenant_members m join public.tenants t on t.id = m.tenant_id
      where m.user_id = v_uid and m.role = 'owner' and t.status <> 'deleted') >= 3 then
    raise exception 'tenant_limit_reached' using errcode = 'P0001';
  end if;
  if not public.is_slug_available(v_slug) then raise exception 'slug_unavailable' using errcode = 'P0001'; end if;

  select id into v_plan from public.plans where slug = 'esmalte' and is_active;
  if v_plan is null then raise exception 'default_plan_missing' using errcode = 'P0001'; end if;

  insert into public.tenants (slug, business_name, created_by) values (v_slug, v_name, v_uid) returning id into v_tenant;
  insert into public.tenant_members (tenant_id, user_id, role) values (v_tenant, v_uid, 'owner');
  insert into public.tenant_settings (tenant_id) values (v_tenant);
  insert into public.subscriptions (tenant_id, plan_id, status) values (v_tenant, v_plan, 'free');

  if p_specialty_ids is not null and array_length(p_specialty_ids, 1) > 0 then
    insert into public.tenant_specialties (tenant_id, specialty_id)
    select v_tenant, s.id from public.specialties s where s.id = any (p_specialty_ids) and s.is_active;
  end if;
  return v_tenant;
end $$;

create function public.log_audit(
  p_tenant_id uuid, p_action text, p_entity_type text default null,
  p_entity_id uuid default null, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_tenant_id is not null and not private.is_tenant_member(p_tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_tenant_id, (select auth.uid()), left(p_action, 80), left(p_entity_type, 60), p_entity_id,
          coalesce(p_metadata, '{}'::jsonb));
end $$;

-- Estado de uma feature para o tenant: habilitada?, limite (NULL = ilimitado) e uso registrado
create function public.tenant_feature(p_tenant uuid, p_key text)
returns table (enabled boolean, limit_value integer, used integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.is_tenant_member(p_tenant) or private.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select coalesce(pf.enabled, false),
         pf.limit_value,
         coalesce((select fu.used from public.feature_usage fu
                   where fu.tenant_id = p_tenant and fu.feature_key = p_key and fu.period = 'lifetime'), 0)
  from (select 1) d
  left join public.subscriptions s on s.tenant_id = p_tenant and s.status <> 'canceled'
  left join public.plan_features pf on pf.plan_id = s.plan_id and pf.feature_key = p_key;
end $$;

-- ============================================================================
-- Policies
-- ============================================================================

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_tenant_with(id) or private.is_platform_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- platform_admins (cada admin só vê a própria linha; escrita só service_role)
create policy platform_admins_select_own on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- platform_settings
create policy platform_settings_select on public.platform_settings for select to anon, authenticated
  using (is_public or private.is_platform_admin());
create policy platform_settings_write on public.platform_settings for all to authenticated
  using (private.is_platform_admin(array['superadmin']::public.platform_role[]))
  with check (private.is_platform_admin(array['superadmin']::public.platform_role[]));

-- specialties
create policy specialties_select on public.specialties for select to authenticated
  using (is_active or private.is_platform_admin());
create policy specialties_write on public.specialties for all to authenticated
  using (private.is_platform_admin(array['superadmin','support']::public.platform_role[]))
  with check (private.is_platform_admin(array['superadmin','support']::public.platform_role[]));

-- features / plans / plan_features (leitura pública dos planos públicos; escrita admin)
create policy features_select on public.features for select to anon, authenticated using (true);
create policy features_write on public.features for all to authenticated
  using (private.is_platform_admin(array['superadmin','billing']::public.platform_role[]))
  with check (private.is_platform_admin(array['superadmin','billing']::public.platform_role[]));

create policy plans_select on public.plans for select to anon, authenticated
  using ((is_active and is_public) or private.is_platform_admin()
         or exists (select 1 from public.subscriptions s where s.plan_id = plans.id and private.is_tenant_member(s.tenant_id)));
create policy plans_write on public.plans for all to authenticated
  using (private.is_platform_admin(array['superadmin','billing']::public.platform_role[]))
  with check (private.is_platform_admin(array['superadmin','billing']::public.platform_role[]));

create policy plan_features_select on public.plan_features for select to anon, authenticated
  using (exists (select 1 from public.plans p where p.id = plan_features.plan_id));
create policy plan_features_write on public.plan_features for all to authenticated
  using (private.is_platform_admin(array['superadmin','billing']::public.platform_role[]))
  with check (private.is_platform_admin(array['superadmin','billing']::public.platform_role[]));

-- tenants
create policy tenants_select on public.tenants for select to authenticated
  using (private.is_tenant_member(id) or private.is_platform_admin());
create policy tenants_update on public.tenants for update to authenticated
  using (private.can_manage_tenant(id)) with check (private.can_manage_tenant(id));

-- tenant_members (dono não pode ser criado/alterado/removido pelo cliente)
create policy tenant_members_select on public.tenant_members for select to authenticated
  using (private.is_tenant_member(tenant_id));
create policy tenant_members_insert on public.tenant_members for insert to authenticated
  with check (private.can_manage_tenant(tenant_id) and role <> 'owner');
create policy tenant_members_update on public.tenant_members for update to authenticated
  using (private.can_manage_tenant(tenant_id) and role <> 'owner')
  with check (private.can_manage_tenant(tenant_id) and role <> 'owner');
create policy tenant_members_delete on public.tenant_members for delete to authenticated
  using (private.can_manage_tenant(tenant_id) and role <> 'owner');

-- tenant_settings
create policy tenant_settings_select on public.tenant_settings for select to authenticated
  using (private.is_tenant_member(tenant_id));
create policy tenant_settings_update on public.tenant_settings for update to authenticated
  using (private.can_manage_tenant(tenant_id)) with check (private.can_manage_tenant(tenant_id));

-- tenant_specialties
create policy tenant_specialties_select on public.tenant_specialties for select to authenticated
  using (private.is_tenant_member(tenant_id));
create policy tenant_specialties_insert on public.tenant_specialties for insert to authenticated
  with check (private.can_manage_tenant(tenant_id));
create policy tenant_specialties_delete on public.tenant_specialties for delete to authenticated
  using (private.can_manage_tenant(tenant_id));

-- subscriptions / feature_usage: leitura por membros; escrita só service_role/RPC
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (private.is_tenant_member(tenant_id)
         or private.is_platform_admin(array['superadmin','support','billing']::public.platform_role[]));
create policy feature_usage_select on public.feature_usage for select to authenticated
  using (private.is_tenant_member(tenant_id));

-- audit_logs: dono/admin do tenant e admins da plataforma
create policy audit_logs_select on public.audit_logs for select to authenticated
  using ((tenant_id is not null and private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_role[]))
         or private.is_platform_admin(array['superadmin','support']::public.platform_role[]));

-- ============================================================================
-- Grants (mínimo necessário; RLS faz o resto)
-- ============================================================================
grant select on public.platform_settings, public.features, public.plans, public.plan_features to anon;
grant select on public.platform_settings, public.features, public.plans, public.plan_features, public.specialties,
  public.platform_admins, public.tenants, public.tenant_members, public.tenant_settings, public.tenant_specialties,
  public.feature_usage, public.audit_logs, public.profiles to authenticated;
grant select (id, tenant_id, plan_id, status, billing_cycle, trial_ends_at, current_period_start, current_period_end,
  cancel_at_period_end, canceled_at, created_at, updated_at) on public.subscriptions to authenticated;

grant update (full_name, avatar_url, phone, whatsapp, locale) on public.profiles to authenticated;
grant update (business_name, slug, onboarding_step, onboarding_completed_at) on public.tenants to authenticated;
grant insert (tenant_id, user_id, role), update (role), delete on public.tenant_members to authenticated;
grant update (legal_name, document, phone, whatsapp, email, postal_code, state, city, neighborhood, address_line,
  address_public, instagram, primary_color, accent_color, logo_path) on public.tenant_settings to authenticated;
grant insert (tenant_id, specialty_id), delete on public.tenant_specialties to authenticated;
grant insert, update, delete on public.platform_settings, public.specialties, public.features, public.plans,
  public.plan_features to authenticated;

-- RPCs: só usuárias autenticadas
revoke all on function public.is_slug_available(text) from public, anon;
revoke all on function public.create_tenant(text, text, uuid[]) from public, anon;
revoke all on function public.log_audit(uuid, text, text, uuid, jsonb) from public, anon;
revoke all on function public.tenant_feature(uuid, text) from public, anon;
grant execute on function public.is_slug_available(text) to authenticated;
grant execute on function public.create_tenant(text, text, uuid[]) to authenticated;
grant execute on function public.log_audit(uuid, text, text, uuid, jsonb) to authenticated;
grant execute on function public.tenant_feature(uuid, text) to authenticated;

-- Funções privadas usadas pelas policies
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_platform_admin(public.platform_role[]) to authenticated;
grant execute on function private.is_tenant_member(uuid) to authenticated;
grant execute on function private.has_tenant_role(uuid, public.tenant_role[]) to authenticated;
grant execute on function private.can_manage_tenant(uuid) to authenticated;
grant execute on function private.shares_tenant_with(uuid) to authenticated;
-- anon também avalia is_platform_admin nas policies públicas
grant usage on schema private to anon;
grant execute on function private.is_platform_admin(public.platform_role[]) to anon;
-- policies de plans chamam is_tenant_member para anon também
grant execute on function private.is_tenant_member(uuid) to anon;
