import { describe, expect, it } from "vitest";
import { friendlyAuthError, friendlyDbError } from "@/lib/errors";
import { formatBRL } from "@/lib/money";

describe("friendlyDbError", () => {
  it("traduz códigos das RPCs", () => {
    expect(friendlyDbError("slug_unavailable")).toContain("endereço");
    expect(friendlyDbError("tenant_limit_reached")).toContain("limite");
  });

  it("não vaza mensagem interna desconhecida", () => {
    const msg = friendlyDbError('duplicate key value violates unique constraint "tenants_slug_key"');
    expect(msg).toBe("Algo deu errado. Tente novamente em instantes.");
  });
});

describe("friendlyAuthError", () => {
  it("traduz erros comuns do Supabase Auth", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe("E-mail ou senha incorretos.");
    expect(friendlyAuthError("User already registered")).toContain("Já existe");
  });
});

describe("formatBRL", () => {
  it("formata centavos em reais", () => {
    expect(formatBRL(3990).replace(/\s/g, " ")).toBe("R$ 39,90");
    expect(formatBRL(0).replace(/\s/g, " ")).toBe("R$ 0,00");
  });
});
