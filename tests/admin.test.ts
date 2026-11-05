import { describe, expect, it } from "vitest";
import { ADMIN_SECTIONS, canAccess, type AdminSection } from "@/lib/admin-access";
import {
  featureSchema, grantSchema, parseBenefitRows, parseGuaranteeRows, planSchema, specialtySchema, tenantStatusSchema,
} from "@/lib/admin-validation";
import { isProtectedPath } from "@/lib/routing";
import { benefitsSchema } from "@/lib/welcome-content";

describe("acesso por papel", () => {
  it("sem papel não acessa nada", () => {
    for (const s of Object.keys(ADMIN_SECTIONS) as AdminSection[]) expect(canAccess(null, s)).toBe(false);
  });
  it("superadmin acessa tudo", () => {
    for (const s of Object.keys(ADMIN_SECTIONS) as AdminSection[]) expect(canAccess("superadmin", s)).toBe(true);
  });
  it("financeiro mexe em planos mas não em equipe, textos ou auditoria", () => {
    expect(canAccess("billing", "planos")).toBe(true);
    expect(canAccess("billing", "equipe")).toBe(false);
    expect(canAccess("billing", "textos")).toBe(false);
    expect(canAccess("billing", "auditoria")).toBe(false);
  });
  it("suporte mexe em negócios e especialidades mas não em planos", () => {
    expect(canAccess("support", "negocios")).toBe(true);
    expect(canAccess("support", "especialidades")).toBe(true);
    expect(canAccess("support", "planos")).toBe(false);
  });
  it("/admin exige login", () => {
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/admin/planos/123")).toBe(true);
  });
});

describe("validação do console", () => {
  const plan = {
    slug: "gel", name: "Gel", description: "", priceMonthlyCents: "49,90", priceYearlyCents: "", trialDays: "7", sortOrder: "2", isPublic: "on",
  };
  it("converte preço em centavos e checkboxes em booleano", () => {
    const r = planSchema.parse(plan);
    expect(r.priceMonthlyCents).toBe(4990);
    expect(r.priceYearlyCents).toBe(0);
    expect(r.trialDays).toBe(7);
    expect(r.isPublic).toBe(true);
    expect(r.isActive).toBe(false);
    expect(r.description).toBeNull();
  });
  it("rejeita preço, slug e dias inválidos", () => {
    expect(planSchema.safeParse({ ...plan, priceMonthlyCents: "abc" }).success).toBe(false);
    expect(planSchema.safeParse({ ...plan, slug: "Gel Plus!" }).success).toBe(false);
    expect(planSchema.safeParse({ ...plan, trialDays: "400" }).success).toBe(false);
  });
  it("recurso e especialidade seguem as regras do banco", () => {
    expect(featureSchema.safeParse({ key: "loyalty_program", name: "Fidelidade", kind: "flag", unit: "", description: "", sortOrder: "10" }).success).toBe(true);
    expect(featureSchema.safeParse({ key: "Loyalty!", name: "X1", kind: "flag", unit: "", description: "", sortOrder: "1" }).success).toBe(false);
    expect(featureSchema.safeParse({ key: "ok_key", name: "Ok", kind: "outro", unit: "", description: "", sortOrder: "1" }).success).toBe(false);
    expect(specialtySchema.safeParse({ slug: "nail-design", name: "Nail design", sortOrder: "1" }).success).toBe(true);
    expect(specialtySchema.safeParse({ slug: "N", name: "Nail", sortOrder: "1" }).success).toBe(false);
  });
  it("equipe e status de negócio", () => {
    expect(grantSchema.safeParse({ email: "A@B.com", role: "support" }).success).toBe(true);
    expect(grantSchema.safeParse({ email: "a@b.com", role: "root" }).success).toBe(false);
    const id = "3f8b2a5c-6d1e-4b7a-9c3d-2e1f0a9b8c7d";
    expect(tenantStatusSchema.safeParse({ tenantId: id, status: "suspended", reason: "abuso" }).success).toBe(true);
    expect(tenantStatusSchema.safeParse({ tenantId: id, status: "deleted", reason: "" }).success).toBe(false);
    expect(tenantStatusSchema.safeParse({ tenantId: "x", status: "active", reason: "" }).success).toBe(false);
  });
});

describe("textos da tela Bem-vinda", () => {
  it("monta as linhas, descarta títulos vazios e respeita o 'disponível'", () => {
    const rows = parseBenefitRows(["A", "", "C"], ["a", "x", "c"], new Set([0]));
    expect(rows).toEqual([
      { title: "A", text: "a", available: true },
      { title: "C", text: "c", available: false },
    ]);
    expect(benefitsSchema.safeParse(rows).success).toBe(true);
  });
  it("benefício sem texto é inválido", () => {
    expect(benefitsSchema.safeParse(parseBenefitRows(["A"], [""], new Set())).success).toBe(false);
  });
  it("garantias vazias são removidas", () => {
    expect(parseGuaranteeRows([" a ", "", "  "])).toEqual(["a"]);
  });
});
