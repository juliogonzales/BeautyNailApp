const DB_ERRORS: Record<string, string> = {
  slug_unavailable: "Esse endereço já está em uso ou é reservado. Escolha outro.",
  slug_reserved: "Esse endereço é reservado. Escolha outro.",
  tenant_limit_reached: "Você atingiu o limite de negócios por conta.",
  invalid_business_name: "O nome do negócio precisa ter entre 2 e 80 caracteres.",
  not_authenticated: "Sua sessão expirou. Entre novamente.",
  forbidden: "Você não tem permissão para isso.",
  user_not_found: "Não existe usuário cadastrado com esse e-mail. A pessoa precisa criar a conta primeiro.",
  cannot_revoke_self: "Você não pode remover o seu próprio acesso.",
  tenant_not_found: "Negócio não encontrado.",
  limit_reached: "Você atingiu o limite do seu plano para este item. Veja os planos para ampliar.",
  feature_disabled: "Este recurso não está incluído no seu plano.",
  reason_required: "Informe o motivo (fica registrado na auditoria).",
  plan_not_found: "Plano não encontrado ou inativo.",
  subscription_not_found: "Esse negócio não tem assinatura ativa.",
  feature_not_found: "Recurso não encontrado.",
  invalid_expiry: "A validade precisa ser uma data futura.",
  template_not_found: "Modelo não encontrado ou inativo.",
  tenant_deleted: "Esse negócio foi excluído e não pode ser alterado.",
};

const GENERIC = "Algo deu errado. Tente novamente em instantes.";

export function friendlyDbError(message?: string | null): string {
  if (!message) return GENERIC;
  for (const [code, text] of Object.entries(DB_ERRORS)) {
    if (message.includes(code)) return text;
  }
  return GENERIC;
}

export function friendlyAuthError(message?: string | null): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (m.includes("already registered")) return "Já existe uma conta com esse e-mail. Tente entrar.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (m.includes("password")) return "A senha não atende aos requisitos. Use ao menos 8 caracteres.";
  return GENERIC;
}

/** Console admin: igual ao friendlyDbError, mas explica conflito de chave/slug (informação útil para quem administra). */
export function friendlyAdminDbError(message?: string | null): string {
  if (message?.includes("duplicate key")) return "Já existe um item com essa chave ou esse slug.";
  return friendlyDbError(message);
}
