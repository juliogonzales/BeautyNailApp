import { describe, expect, it } from "vitest";
import { canAccess } from "@/lib/admin-access";
import { csvCell, featureOverrideSchema, parseTemplateConfig, sanitizeSearch, tenantPlanSchema } from "@/lib/admin-validation";
import { auditLabel } from "@/lib/audit-labels";
import { contrastRatio, FALLBACK_THEME, parseTheme, readableOn, themeContrastIssues } from "@/lib/theme";

const T = "3f8b2a5c-6d1e-4b7a-9c3d-2e1f0a9b8c7d";

describe("tema da página pública", () => {
  it("contraste WCAG: extremos e simetria", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#5b4636", "#faf7f2")).toBeCloseTo(contrastRatio("#faf7f2", "#5b4636"), 8);
  });
  it("escolhe texto claro sobre fundo escuro e escuro sobre claro", () => {
    expect(readableOn("#2b2b2b")).toBe("#ffffff");
    expect(readableOn("#faf7f2")).toBe("#1f1b19");
  });
  it("os modelos padrão atendem ao contraste mínimo", () => {
    expect(themeContrastIssues(FALLBACK_THEME.colors)).toEqual([]);
  });
  it("detecta texto ilegível", () => {
    const bad = { ...FALLBACK_THEME.colors, text: "#cccccc" };
    expect(themeContrastIssues(bad).length).toBeGreaterThan(0);
  });
  it("tema inválido cai no padrão em vez de quebrar a página", () => {
    expect(parseTheme(null)).toEqual(FALLBACK_THEME);
    expect(parseTheme({ layout: "x" })).toEqual(FALLBACK_THEME);
    expect(parseTheme(FALLBACK_THEME)).toEqual(FALLBACK_THEME);
  });
});

describe("formulário de modelo", () => {
  const form = {
    c_background: "#faf7f2", c_surface: "#ffffff", c_text: "#3a3330", c_muted: "#6f6560", c_primary: "#5b4636", c_accent: "#b8975a",
    layout: "left", font: "sans", radius: "none", avatar: "initial", s_specialties: "on", s_whatsapp: "on", s_services: "on",
  };
  it("monta a configuração e converte checkboxes", () => {
    const r = parseTemplateConfig(form);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.layout).toBe("left");
      expect(r.config.show).toEqual({ specialties: true, whatsapp: true, instagram: false, location: false, services: true });
      const off = parseTemplateConfig({ ...form, s_services: "" });
      expect(off.ok && off.config.show.services).toBe(false);
    }
  });
  it("rejeita cor fora do formato, opção inválida e contraste baixo", () => {
    expect(parseTemplateConfig({ ...form, c_primary: "azul" }).ok).toBe(false);
    expect(parseTemplateConfig({ ...form, layout: "grid" }).ok).toBe(false);
    expect(parseTemplateConfig({ ...form, c_text: "#dddddd" }).ok).toBe(false);
  });
});

describe("gestão de negócios", () => {
  it("exceção de recurso: converte e valida", () => {
    const r = featureOverrideSchema.parse({ tenantId: T, key: "custom_theme", enabled: "sim", limit: "", reason: "cortesia", expires: "" });
    expect(r).toMatchObject({ enabled: true, limit: null, expires: null });
    expect(featureOverrideSchema.parse({ tenantId: T, key: "customers", enabled: "sim", limit: "50", reason: "teste", expires: "" }).limit).toBe(50);
  });
  it("exceção exige motivo, data futura e limite válido", () => {
    const base = { tenantId: T, key: "customers", enabled: "sim", limit: "", reason: "ok!", expires: "" };
    expect(featureOverrideSchema.safeParse({ ...base, reason: "x" }).success).toBe(false);
    expect(featureOverrideSchema.safeParse({ ...base, expires: "2020-01-01" }).success).toBe(false);
    expect(featureOverrideSchema.safeParse({ ...base, expires: "amanhã" }).success).toBe(false);
    expect(featureOverrideSchema.safeParse({ ...base, limit: "-3" }).success).toBe(false);
    expect(featureOverrideSchema.safeParse({ ...base, enabled: "talvez" }).success).toBe(false);
    expect(featureOverrideSchema.safeParse({ ...base, expires: "2999-12-31" }).success).toBe(true);
  });
  it("troca de plano exige motivo e ids válidos", () => {
    expect(tenantPlanSchema.safeParse({ tenantId: T, planId: T, reason: "cortesia" }).success).toBe(true);
    expect(tenantPlanSchema.safeParse({ tenantId: T, planId: "x", reason: "cortesia" }).success).toBe(false);
    expect(tenantPlanSchema.safeParse({ tenantId: T, planId: T, reason: "" }).success).toBe(false);
  });
  it("busca remove caracteres de sintaxe do filtro", () => {
    expect(sanitizeSearch("joy),status.eq.deleted")).toBe("joystatus.eq.deleted");
    expect(sanitizeSearch("  Ana % _ , ( ) ")).toBe("Ana");
    expect(sanitizeSearch("Estúdio da Joãozinha")).toBe("Estúdio da Joãozinha");
  });
  it("CSV escapa aspas e neutraliza fórmulas de planilha", () => {
    expect(csvCell('Joy "Nails"')).toBe('"Joy ""Nails"""');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
    expect(csvCell(null)).toBe('""');
  });
  it("rótulos de auditoria têm reserva para ações desconhecidas", () => {
    expect(auditLabel("admin.tenant.set_plan")).toContain("Plano");
    expect(auditLabel("acao.nova")).toBe("acao.nova");
  });
  it("modelos de página só para superadmin; troca de plano só superadmin e financeiro", () => {
    expect(canAccess("support", "modelos")).toBe(false);
    expect(canAccess("billing", "modelos")).toBe(false);
    expect(canAccess("superadmin", "modelos")).toBe(true);
  });
});
