import { describe, expect, it } from "vitest";
import { onboardingSchema, signupSchema, slugSchema, slugify } from "@/lib/validation";

describe("slugify", () => {
  it("remove acentos, espaços e símbolos", () => {
    expect(slugify("Joy Vega Nails")).toBe("joy-vega-nails");
    expect(slugify("Ateliê da Ana!!")).toBe("atelie-da-ana");
    expect(slugify("  --a--  ")).toBe("a");
  });

  it("limita a 40 caracteres sem terminar em hífen", () => {
    const out = slugify("a".repeat(39) + " b");
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("-")).toBe(false);
  });
});

describe("slugSchema (espelha a regra do banco)", () => {
  it.each(["joy-vega-nails", "abc", "a1b", "ana-2024"])("aceita %s", (s) => {
    expect(slugSchema.safeParse(s).success).toBe(true);
  });

  it.each(["a", "ab", "-ab", "ab-", "a--b", "a b", "a_b", "x".repeat(41)])("rejeita %s", (s) => {
    expect(slugSchema.safeParse(s).success).toBe(false);
  });

  it("normaliza maiúsculas e espaços nas pontas", () => {
    const r = slugSchema.safeParse("  Joy-Nails ");
    expect(r.success && r.data).toBe("joy-nails");
  });
});

describe("signupSchema", () => {
  it("exige senha com 8+ caracteres e e-mail válido", () => {
    expect(signupSchema.safeParse({ fullName: "Ana", email: "ana@exemplo.com", password: "12345678" }).success).toBe(true);
    expect(signupSchema.safeParse({ fullName: "Ana", email: "ana@exemplo.com", password: "1234567" }).success).toBe(false);
    expect(signupSchema.safeParse({ fullName: "Ana", email: "invalido", password: "12345678" }).success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";

  it("aceita dados válidos", () => {
    expect(onboardingSchema.safeParse({ businessName: "Joy Vega Nails", slug: "joy-vega-nails", specialtyIds: [uuid] }).success).toBe(true);
  });

  it("rejeita ids de especialidade que não são UUID", () => {
    expect(onboardingSchema.safeParse({ businessName: "Joy", slug: "joy", specialtyIds: ["x"] }).success).toBe(false);
  });

  it("rejeita nome curto demais", () => {
    expect(onboardingSchema.safeParse({ businessName: "J", slug: "joy", specialtyIds: [] }).success).toBe(false);
  });
});
