import { z } from "zod";
import { parseBRLToCents, parseWholeNumber } from "@/lib/pricing";

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
