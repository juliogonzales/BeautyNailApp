/** Rótulos legíveis para as ações de auditoria (o código continua sendo gravado como está). */
const LABELS: Record<string, string> = {
  "admin.tenant.set_status": "Status do negócio alterado",
  "admin.tenant.set_plan": "Plano do negócio alterado",
  "admin.feature_override.clear": "Exceção de recurso removida",
  "tenant_feature_overrides.insert": "Exceção de recurso criada",
  "tenant_feature_overrides.update": "Exceção de recurso alterada",
  "admin.platform_admin.grant": "Acesso de administrador concedido",
  "admin.platform_admin.revoke": "Acesso de administrador removido",
  "admin.plans.insert": "Plano criado",
  "admin.plans.update": "Plano alterado",
  "admin.features.insert": "Recurso criado",
  "admin.features.update": "Recurso alterado",
  "admin.plan_features.update": "Recurso de plano alterado",
  "admin.specialties.insert": "Especialidade criada",
  "admin.specialties.update": "Especialidade alterada",
  "admin.platform_settings.update": "Configuração alterada",
  "admin.page_templates.insert": "Modelo de página criado",
  "admin.page_templates.update": "Modelo de página alterado",
  "tenants.insert": "Negócio criado",
  "tenants.update": "Dados do negócio alterados",
  "subscriptions.update": "Assinatura alterada",
};

export function auditLabel(action: string): string {
  return LABELS[action] ?? action;
}
