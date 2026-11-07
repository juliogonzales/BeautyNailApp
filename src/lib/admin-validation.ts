import { z } from "zod";
import { parseBRLToCents, parseWholeNumber } from "@/lib/pricing";
import { themeColorsSchema, themeConfigSchema, themeContrastIssues, type ThemeConfig } from "@/lib/theme";

const blankToNull = (v: string) => (v.trim() === "" ? null : v.trim());
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

const cents = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? "0" : v))
    .transform((v, ctx) => {
      const c = parseBRLToCents(v);
      if (c === null || c > 10_000_000) {
        ctx.addIssue({ code: "custom", message: `${label}: informe um valor válido, ex.: 49,90.` });
        return z.NEVER;
      }
      return c;
    });

const whole = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? "0" : v))
    .transform((v, ctx) => {
      const n = parseWholeNumber(v);
      if (n === null || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label}: informe um número entre ${min} e ${max}.` });
        return z.NEVER;
      }
      return n;
    });

export const planSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, "Slug: 2 a 40 letras minúsculas, números e hífen."),
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  description: z.string().trim().max(300).transform(blankToNull),
  priceMonthlyCents: cents("Preço mensal"),
  priceYearlyCents: cents("Preço anual"),
  trialDays: whole("Dias de teste", 0, 90),
  sortOrder: whole("Ordem", 0, 1000),
  isPublic: checkbox,
  isActive: checkbox,
});

export const featureSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9_]{2,48}$/, "Chave: 2 a 48 letras minúsculas, números e _."),
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  description: z.string().trim().max(300).transform(blankToNull),
  kind: z.enum(["flag", "limit"]),
  unit: z.string().trim().max(30).transform(blankToNull),
  sortOrder: whole("Ordem", 0, 1000),
});

export const featureEditSchema = featureSchema.omit({ key: true, kind: true });

export const specialtySchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,60}$/, "Slug: 2 a 60 letras minúsculas, números e hífen."),
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  sortOrder: whole("Ordem", 0, 1000),
});

export const roleSchema = z.enum(["superadmin", "support", "billing"]);

export const grantSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  role: roleSchema,
});

export const tenantStatusSchema = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().max(300),
});

/** Linhas do editor de benefícios: título vazio = linha removida. */
export function parseBenefitRows(titles: string[], texts: string[], available: Set<number>) {
  const rows = titles
    .map((title, i) => ({ title: title.trim(), text: (texts[i] ?? "").trim(), available: available.has(i) }))
    .filter((r) => r.title !== "");
  return rows;
}

export function parseGuaranteeRows(values: string[]) {
  return values.map((v) => v.trim()).filter((v) => v !== "");
}

// ---------------------------------------------------------------- Modelos de página pública


export const templateMetaSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, "Slug: 2 a 40 letras minúsculas, números e hífen."),
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  description: z.string().trim().max(200).transform(blankToNull),
  sortOrder: whole("Ordem", 0, 1000),
  isActive: checkbox,
});

/** Monta e valida a configuração do modelo a partir do formulário. Barra combinações com texto ilegível. */
export function parseTemplateConfig(
  input: Record<string, FormDataEntryValue>,
): { ok: true; config: ThemeConfig } | { ok: false; error: string } {
  const get = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : "");
  const on = (k: string) => input[k] === "on";
  const colors = themeColorsSchema.safeParse({
    background: get("c_background"), surface: get("c_surface"), text: get("c_text"),
    muted: get("c_muted"), primary: get("c_primary"), accent: get("c_accent"),
  });
  if (!colors.success) return { ok: false, error: colors.error.issues[0]?.message ?? "Cores inválidas." };
  const config = themeConfigSchema.safeParse({
    layout: get("layout"), font: get("font"), radius: get("radius"), avatar: get("avatar"),
    colors: colors.data,
    show: { specialties: on("s_specialties"), whatsapp: on("s_whatsapp"), instagram: on("s_instagram"), location: on("s_location"), services: on("s_services") },
  });
  if (!config.success) return { ok: false, error: "Escolha layout, fonte, cantos e avatar válidos." };
  const issues = themeContrastIssues(config.data.colors);
  if (issues.length > 0) return { ok: false, error: issues[0]! };
  return { ok: true, config: config.data };
}

// ---------------------------------------------------------------- Gestão de negócios

export const featureOverrideSchema = z.object({
  tenantId: z.string().uuid(),
  key: z.string().regex(/^[a-z0-9_]{2,48}$/),
  enabled: z.enum(["sim", "nao"]).transform((v) => v === "sim"),
  limit: z.string().trim().transform((v, ctx) => {
    if (v === "") return null;
    const n = parseWholeNumber(v);
    if (n === null || n > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "Limite: número inteiro ou vazio para ilimitado." });
      return z.NEVER;
    }
    return n;
  }),
  reason: z.string().trim().min(3, "Informe o motivo (fica na auditoria).").max(300),
  expires: z.string().trim().transform((v, ctx) => {
    if (v === "") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "Data de validade inválida." });
      return z.NEVER;
    }
    const d = new Date(`${v}T23:59:59-03:00`);
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      ctx.addIssue({ code: "custom", message: "A validade precisa ser uma data futura." });
      return z.NEVER;
    }
    return d.toISOString();
  }),
});

export const tenantPlanSchema = z.object({
  tenantId: z.string().uuid(),
  planId: z.string().uuid(),
  reason: z.string().trim().min(3, "Informe o motivo (fica na auditoria).").max(300),
});

/** Busca de negócios: só letras, números, espaço, hífen e ponto (evita injetar sintaxe no filtro). */
export function sanitizeSearch(raw: string): string {
  return raw.normalize("NFC").replace(/[^\p{L}\p{N} .-]/gu, "").trim().slice(0, 60);
}

/** Célula de CSV segura: aspas escapadas e proteção contra fórmulas de planilha (=, +, -, @). */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Segmentos da calculadora. Materiais: uma linha por item, "Nome | unidade" (unidade opcional, padrão "un"). */
export const presetSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  description: z.string().trim().max(200).optional().transform((v) => v || null),
  sortOrder: whole("Ordem", 0, 1000),
});

export const presetSlugSchema = z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "Segmento inválido.");

export function parseMaterialLines(text: string): Array<{ name: string; unit: string }> {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((l) => {
      const [name, unit] = l.split("|").map((x) => x.trim());
      return { name: (name ?? "").slice(0, 60), unit: (unit || "un").slice(0, 10) };
    })
    .filter((m) => m.name.length > 0);
}

export function materialsToText(materials: unknown): string {
  if (!Array.isArray(materials)) return "";
  return materials
    .filter((m): m is { name: string; unit?: string } => typeof m?.name === "string")
    .map((m) => `${m.name} | ${typeof m.unit === "string" ? m.unit : "un"}`)
    .join("\n");
}

/** Serviços-modelo do segmento: uma linha por serviço, "Nome | minutos". */
export function parseServiceLines(text: string): Array<{ name: string; minutes: number }> {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((l) => {
      const [name, minutes] = l.split("|").map((x) => x.trim());
      const m = Number(minutes);
      return { name: (name ?? "").slice(0, 60), minutes: Number.isInteger(m) && m >= 1 && m <= 1440 ? m : 60 };
    })
    .filter((s) => s.name.length > 0);
}

export function servicesToText(services: unknown): string {
  if (!Array.isArray(services)) return "";
  return services
    .filter((s): s is { name: string; minutes?: number } => typeof s?.name === "string")
    .map((s) => `${s.name} | ${typeof s.minutes === "number" ? s.minutes : 60}`)
    .join("\n");
}
