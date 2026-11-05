const PROTECTED_PREFIXES = ["/painel", "/onboarding", "/bem-vinda", "/planos", "/admin"];
const AUTH_PREFIXES = ["/login", "/cadastro"];

function matches(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export function isProtectedPath(path: string): boolean {
  return matches(path, PROTECTED_PREFIXES);
}

export function isAuthPath(path: string): boolean {
  return matches(path, AUTH_PREFIXES);
}

/** Aceita só caminhos internos (evita open redirect via ?next=). */
export function safeNextPath(next: string | null | undefined, fallback = "/painel"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

export type TenantKey =
  | { kind: "app" }
  | { kind: "path"; slug: string }
  | { kind: "host"; host: string };

/**
 * Resolve de onde vem o negócio: pelo caminho (/{slug}) hoje, pelo domínio próprio (plano Fibra+) no futuro.
 * Quem chamar deve conferir o slug contra `reserved_slugs` antes de tratá-lo como negócio.
 */
export function resolveTenantKey(host: string, pathname: string, appHosts: string[]): TenantKey {
  const cleanHost = host.toLowerCase().replace(/:\d+$/, "");
  const isAppHost = appHosts.some((h) => h.toLowerCase() === cleanHost);
  if (!isAppHost) return { kind: "host", host: cleanHost };
  const first = pathname.split("/").filter(Boolean)[0];
  if (!first) return { kind: "app" };
  return { kind: "path", slug: first.toLowerCase() };
}
