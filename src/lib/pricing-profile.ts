import { z } from "zod";
import { parseBRLToCents, parsePercentToBp, parseWholeNumber } from "@/lib/pricing";
import type { PricingProfile } from "@/lib/service-pricing";

const money = (label: string, max = 100_000_000) =>
  z.string().trim().transform((v, ctx) => {
    const n = v === "" ? 0 : parseBRLToCents(v);
    if (n === null || n > max) {
      ctx.addIssue({ code: "custom", message: `${label}: informe um valor válido, ex.: 1500,00.` });
      return z.NEVER;
    }
    return n;
  });

const whole = (label: string, min: number, max: number) =>
  z.string().trim().transform((v, ctx) => {
    const n = parseWholeNumber(v);
    if (n === null || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: `${label}: informe um número inteiro entre ${min} e ${max}.` });
      return z.NEVER;
    }
    return n;
  });

const percent = (label: string, min: number, max: number) =>
  z.string().trim().transform((v, ctx) => {
    const bp = v === "" ? 0 : parsePercentToBp(v);
    if (bp === null || bp < min * 100 || bp > max * 100) {
      ctx.addIssue({ code: "custom", message: `${label}: informe uma porcentagem entre ${min}% e ${max}%.` });
      return z.NEVER;
    }
    return bp;
  });

/** Formulário do perfil de preço. Vazio conta como zero (exceto dias, horas e ocupação, que precisam de valor). */
export const profileFormSchema = z
  .object({
    income: money("Retirada mensal"),
    days: whole("Dias por semana", 1, 7),
    hours: whole("Horas por dia", 1, 16),
    occupancy: percent("Ocupação", 10, 100),
    fixed: money("Custos fixos"),
    cardFee: percent("Taxa da maquininha", 0, 50),
    tax: percent("Imposto", 0, 50),
    commission: percent("Comissão", 0, 90),
    margin: percent("Lucro", 0, 80),
    presetSlug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/).or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.cardFee + v.tax + v.commission + v.margin >= 10000) {
      ctx.addIssue({ code: "custom", path: ["margin"], message: "Taxa, imposto, comissão e lucro somados precisam ficar abaixo de 100%." });
    }
  });

export type ProfileForm = z.input<typeof profileFormSchema>;
export type ParsedProfileForm = z.output<typeof profileFormSchema>;

export function toPricingProfile(p: ParsedProfileForm): PricingProfile {
  return {
    monthlyIncomeCents: p.income, daysPerWeek: p.days, hoursPerDay: p.hours, occupancyBp: p.occupancy,
    fixedCostsCents: p.fixed, cardFeeBp: p.cardFee, taxBp: p.tax, commissionBp: p.commission, marginBp: p.margin,
  };
}

/** Converte o perfil do formulário para as colunas de `pricing_profiles`. */
export function toRow(p: ParsedProfileForm) {
  return {
    monthly_income_cents: p.income, days_per_week: p.days, hours_per_day: p.hours, occupancy_bp: p.occupancy,
    fixed_costs_cents: p.fixed, card_fee_bp: p.cardFee, tax_bp: p.tax, commission_bp: p.commission, margin_bp: p.margin,
    preset_slug: p.presetSlug === "" ? null : p.presetSlug,
  };
}

const bpToText = (bp: number) => (bp / 100).toString().replace(".", ",");
const centsToText = (c: number) => (c === 0 ? "" : (c / 100).toFixed(2).replace(".", ","));

/** Linha do banco → texto dos campos. */
export function fromRow(r: {
  monthly_income_cents: number; days_per_week: number; hours_per_day: number; occupancy_bp: number; fixed_costs_cents: number;
  card_fee_bp: number; tax_bp: number; commission_bp: number; margin_bp: number; preset_slug: string | null;
}): ProfileForm {
  return {
    income: centsToText(r.monthly_income_cents), days: String(r.days_per_week), hours: String(r.hours_per_day),
    occupancy: bpToText(r.occupancy_bp), fixed: centsToText(r.fixed_costs_cents), cardFee: r.card_fee_bp ? bpToText(r.card_fee_bp) : "",
    tax: r.tax_bp ? bpToText(r.tax_bp) : "", commission: r.commission_bp ? bpToText(r.commission_bp) : "", margin: bpToText(r.margin_bp),
    presetSlug: r.preset_slug ?? "",
  };
}

export const DEFAULT_PROFILE_FORM: ProfileForm = {
  income: "", days: "5", hours: "8", occupancy: "70", fixed: "", cardFee: "", tax: "", commission: "", margin: "20", presetSlug: "",
};
