import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE_FORM, fromRow, profileFormSchema, toPricingProfile, toRow } from "@/lib/pricing-profile";
import {
  diagnosePrice, hourCostCents, materialLineCost, materialsTotal, parseQuantityHundredths, priceService,
  productiveMinutesPerMonth, roundUpPrice, type PricingProfile,
} from "@/lib/service-pricing";

const profile: PricingProfile = {
  monthlyIncomeCents: 300000, daysPerWeek: 5, hoursPerDay: 8, occupancyBp: 7000, fixedCostsCents: 100000,
  cardFeeBp: 500, taxBp: 0, commissionBp: 0, marginBp: 2000,
};

describe("custo da hora", () => {
  it("5 dias × 8 h × 4,33 semanas × 70% de ocupação", () => {
    expect(productiveMinutesPerMonth(profile)).toBe(7274);
  });
  it("(retirada + custos fixos) ÷ horas produtivas", () => {
    expect(hourCostCents(profile)).toBe(3299);
  });
  it("sem horas produtivas não calcula", () => {
    expect(hourCostCents({ ...profile, occupancyBp: 0 })).toBeNull();
  });
});

describe("material por atendimento", () => {
  it("preço da embalagem × uso ÷ conteúdo", () => {
    expect(materialLineCost({ packagePriceCents: 5000, packageSizeHundredths: 50000, usedHundredths: 3000 })).toBe(300);
  });
  it("linha incompleta não conta", () => {
    expect(materialLineCost({ packagePriceCents: 0, packageSizeHundredths: 100, usedHundredths: 100 })).toBe(0);
    expect(materialLineCost({ packagePriceCents: 100, packageSizeHundredths: 0, usedHundredths: 100 })).toBe(0);
  });
  it("soma as linhas", () => {
    const l = { packagePriceCents: 1000, packageSizeHundredths: 1000, usedHundredths: 500 };
    expect(materialsTotal([l, l])).toBe(1000);
  });
  it("quantidade com até duas casas", () => {
    expect(parseQuantityHundredths("2,5")).toBe(250);
    expect(parseQuantityHundredths("1.25")).toBe(125);
    expect(parseQuantityHundredths("0")).toBeNull();
    expect(parseQuantityHundredths("abc")).toBeNull();
    expect(parseQuantityHundredths("1,234")).toBeNull();
  });
});

describe("preço do serviço", () => {
  const input = { minutes: 60, materialsCents: 1000, extraCents: 0 };
  it("piso, mínimo, sugerido e redondo", () => {
    const r = priceService(profile, input);
    expect(r).toMatchObject({ ok: true, hourCostCents: 3299, timeCostCents: 3299, directCostCents: 1000, floorCents: 1053, minimumCents: 4526, suggestedCents: 5732, roundedCents: 6000 });
  });
  it("o lucro no preço sugerido é a margem escolhida (arredondamento ±1)", () => {
    const r = priceService(profile, input);
    if (!r.ok) throw new Error("esperava ok");
    expect(r.atSuggested.cardFeeCents).toBe(287);
    expect(r.atSuggested.profitCents).toBe(1146);
    expect(Math.abs(r.atSuggested.profitCents - Math.round(r.suggestedCents * 0.2))).toBeLessThanOrEqual(1);
  });
  it("comissão e imposto entram na conta (barbearia)", () => {
    const withComm = { ...profile, commissionBp: 4000, taxBp: 600, cardFeeBp: 300, marginBp: 1000 };
    const r = priceService(withComm, input);
    if (!r.ok) throw new Error("esperava ok");
    const b = r.atSuggested;
    // nada sobra a menos que a margem escolhida (tolerância de arredondamento)
    expect(b.profitCents).toBeGreaterThanOrEqual(Math.floor(r.suggestedCents * 0.1) - 2);
    expect(b.commissionCents).toBe(Math.round((r.suggestedCents * 4000) / 10000));
  });
  it("recusa percentuais que somam 100% ou mais e valores inválidos", () => {
    expect(priceService({ ...profile, commissionBp: 8000 }, input)).toEqual({ ok: false, error: "invalid_percent" });
    expect(priceService(profile, { ...input, minutes: 1.5 })).toEqual({ ok: false, error: "invalid_input" });
    expect(priceService({ ...profile, occupancyBp: 0 }, input)).toEqual({ ok: false, error: "no_hours" });
  });
  it("arredonda para cima: R$ 1 abaixo de R$ 50 e R$ 5 acima", () => {
    expect(roundUpPrice(4321)).toBe(4400);
    expect(roundUpPrice(5732)).toBe(6000);
    expect(roundUpPrice(5000)).toBe(5000);
  });
});

describe("e se eu cobrar X?", () => {
  const input = { minutes: 60, materialsCents: 1000, extraCents: 0 };
  it("detecta prejuízo, preço que não paga o seu tempo, abaixo da meta e ok", () => {
    expect(diagnosePrice(profile, input, 900)?.status).toBe("loss");
    expect(diagnosePrice(profile, input, 4000)?.status).toBe("no_pay");
    expect(diagnosePrice(profile, input, 5000)?.status).toBe("below_goal");
    expect(diagnosePrice(profile, input, 6000)?.status).toBe("ok");
  });
  it("lucro real do exemplo", () => {
    expect(diagnosePrice(profile, input, 6000)?.breakdown.profitCents).toBe(1401);
    expect(diagnosePrice(profile, input, 4000)?.breakdown.profitCents).toBe(-499);
  });
  it("preço zero não tem diagnóstico", () => {
    expect(diagnosePrice(profile, input, 0)).toBeNull();
  });
});

describe("perfil do negócio (formulário)", () => {
  const form = { ...DEFAULT_PROFILE_FORM, income: "3.000,00", fixed: "1000", cardFee: "5", margin: "20" };
  it("converte texto para números", () => {
    const r = profileFormSchema.parse(form);
    expect(toPricingProfile(r)).toEqual(profile);
  });
  it("vira linha do banco e volta", () => {
    const row = toRow(profileFormSchema.parse({ ...form, presetSlug: "barbearia" }));
    expect(row).toMatchObject({ monthly_income_cents: 300000, occupancy_bp: 7000, preset_slug: "barbearia" });
    expect(fromRow(row)).toMatchObject({ income: "3000,00", fixed: "1000,00", cardFee: "5", margin: "20", presetSlug: "barbearia" });
  });
  it("rejeita valores fora dos limites e soma de percentuais ≥ 100%", () => {
    expect(profileFormSchema.safeParse({ ...form, days: "8" }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...form, occupancy: "5" }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...form, income: "abc" }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...form, cardFee: "50", tax: "10", commission: "30", margin: "20" }).success).toBe(false);
  });
});
