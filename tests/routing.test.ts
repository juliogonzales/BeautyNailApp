import { describe, expect, it } from "vitest";
import { isAuthPath, isProtectedPath, resolveTenantKey, safeNextPath } from "@/lib/routing";

describe("safeNextPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeNextPath("/painel")).toBe("/painel");
    expect(safeNextPath("/onboarding?x=1")).toBe("/onboarding?x=1");
  });

  it("bloqueia open redirect", () => {
    expect(safeNextPath("https://evil.com")).toBe("/painel");
    expect(safeNextPath("//evil.com")).toBe("/painel");
    expect(safeNextPath("/\\evil.com")).toBe("/painel");
    expect(safeNextPath("")).toBe("/painel");
    expect(safeNextPath(null)).toBe("/painel");
  });
});

describe("rotas", () => {
  it("protege painel e onboarding (e subrotas), não protege prefixos parecidos", () => {
    expect(isProtectedPath("/painel")).toBe(true);
    expect(isProtectedPath("/painel/clientes")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
    expect(isProtectedPath("/painelzinho")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
  });

  it("identifica rotas de autenticação", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/cadastro")).toBe(true);
    expect(isAuthPath("/painel")).toBe(false);
  });
});

describe("resolveTenantKey", () => {
  const appHosts = ["app.exemplo.com", "localhost"];

  it("resolve por caminho no host do app", () => {
    expect(resolveTenantKey("app.exemplo.com", "/joy-nails/agendar", appHosts)).toEqual({ kind: "path", slug: "joy-nails" });
    expect(resolveTenantKey("localhost:3000", "/Joy", appHosts)).toEqual({ kind: "path", slug: "joy" });
  });

  it("raiz do app não é negócio", () => {
    expect(resolveTenantKey("app.exemplo.com", "/", appHosts)).toEqual({ kind: "app" });
  });

  it("host desconhecido vira domínio próprio", () => {
    expect(resolveTenantKey("Studio.Joy.com.br", "/", appHosts)).toEqual({ kind: "host", host: "studio.joy.com.br" });
  });
});
