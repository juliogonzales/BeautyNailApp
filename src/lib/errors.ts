const DB_ERRORS: Record<string, string> = {
  slug_unavailable: "Esse endereço já está em uso ou é reservado. Escolha outro.",
  slug_reserved: "Esse endereço é reservado. Escolha outro.",
  tenant_limit_reached: "Você atingiu o limite de negócios por conta.",
  invalid_business_name: "O nome do negócio precisa ter entre 2 e 80 caracteres.",
  not_authenticated: "Sua sessão expirou. Entre novamente.",
  forbidden: "Você não tem permissão para isso.",
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
