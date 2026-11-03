create index if not exists feature_usage_feature_key_idx on public.feature_usage (feature_key);
create index if not exists platform_settings_updated_by_idx on public.platform_settings (updated_by);
create index if not exists tenants_created_by_idx on public.tenants (created_by);
