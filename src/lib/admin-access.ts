export type PlatformRole = "superadmin" | "support" | "billing";

/** Seções do console e quem pode acessar. O banco (RLS/RPC) repete essas regras: aqui é só conveniência de tela. */
export const ADMIN_SECTIONS = {
  visao: { label: "Visão geral", href: "/admin", roles: ["superadmin", "support", "billing"] },
  planos: { label: "Planos", href: "/admin/planos", roles: ["superadmin", "billing"] },
  recursos: { label: "Recursos", href: "/admin/recursos", roles: ["superadmin", "billing"] },
  especialidades: { label: "Especialidades", href: "/admin/especialidades", roles: ["superadmin", "support"] },
  textos: { label: "Textos", href: "/admin/textos", roles: ["superadmin"] },
  negocios: { label: "Negócios", href: "/admin/negocios", roles: ["superadmin", "support", "billing"] },
  auditoria: { label: "Auditoria", href: "/admin/auditoria", roles: ["superadmin", "support"] },
  equipe: { label: "Equipe", href: "/admin/equipe", roles: ["superadmin"] },
} as const satisfies Record<string, { label: string; href: string; roles: readonly PlatformRole[] }>;

export type AdminSection = keyof typeof ADMIN_SECTIONS;

export function canAccess(role: PlatformRole | null | undefined, section: AdminSection): boolean {
  if (!role) return false;
  return (ADMIN_SECTIONS[section].roles as readonly PlatformRole[]).includes(role);
}

export const ROLE_LABELS: Record<PlatformRole, string> = {
  superadmin: "Superadmin",
  support: "Suporte",
  billing: "Financeiro",
};
