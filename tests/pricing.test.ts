import { describe, expect, it } from "vitest";
import { calculatePrice, parseBRLToCents, parsePercentToBp, parseWholeNumber } from "@/lib/pricing";

const base = {
  materialCostCents: 1250,
  durationMinutes: 90,
  hourlyRateCents: 3000,
  monthlyFixedCostsCents: 80000,
  servicesPerMonth: 60,
  cardFeeBp: 0,
  marginBp: 0,
};

describe("calculatePrice", () => {
  it("soma material + mão de obra + custos fixos quando não há taxa nem margem", () => {
    // trabalho: 3000 * 90 / 60 = 4500; fixos: 80000 / 60 = 1333,33 -> 1333; custo: 1250 + 4500 + 1333 = 7083
    expect(calculatePrice(base)).toEqual({
      ok: true,
      laborCents: 4500,
      overheadCents: 1333,
      costCents: 7083,
      priceCents: 7083,
      cardFeeCents: 0,
      profitCents: 0,
    });
  });

  it("aplica taxa da maquininha e margem sobre o preço final", () => {
    const r = calculatePrice({ materialCostCents: 5000, durationMinutes: 0, hourlyRateCents: 0, monthlyFixedCostsCents: 0, servicesPerMonth: 0, cardFeeBp: 500, marginBp: 2000 });
    // 5000 / (1 - 0,25) = 6666,67 -> 6667
    expect(r).toMatchObject({ ok: true, costCents: 5000, priceCents: 6667, cardFeeCents: 333, profitCents: 1334 });
  });

  it("não divide custos fixos por zero atendimentos", () => {
    expect(calculatePrice({ ...base, servicesPerMonth: 0 })).toMatchObject({ ok: true, overheadCents: 0 });
  });

  it("recusa taxa + margem de 100% ou mais", () => {
    expect(calculatePrice({ ...base, cardFeeBp: 5000, marginBp: 5000 })).toEqual({ ok: false, error: "invalid_percent" });
  });

  it("recusa valores negativos ou fracionários", () => {
    expect(calculatePrice({ ...base, materialCostCents: -1 })).toEqual({ ok: false, error: "invalid_input" });
    expect(calculatePrice({ ...base, durationMinutes: 1.5 })).toEqual({ ok: false, error: "invalid_input" });
  });
});

describe("parseBRLToCents", () => {
  it.each([
    ["12,50", 1250],
    ["1.234,56", 123456],
    ["R$ 80", 8000],
    ["12.5", 1250],
    ["1.200", 120000],
    ["0,5", 50],
  ])("converte %s", (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "1,234", "-5", "12,5,5"])("rejeita %s", (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});

describe("parsePercentToBp / parseWholeNumber", () => {
  it("converte percentuais para pontos-base", () => {
    expect(parsePercentToBp("5")).toBe(500);
    expect(parsePercentToBp("4,5")).toBe(450);
    expect(parsePercentToBp("20%")).toBe(2000);
  });

  it("rejeita percentuais inválidos", () => {
    expect(parsePercentToBp("101")).toBeNull();
    expect(parsePercentToBp("-1")).toBeNull();
    expect(parsePercentToBp("x")).toBeNull();
  });

  it("aceita só inteiros não negativos", () => {
    expect(parseWholeNumber("90")).toBe(90);
    expect(parseWholeNumber("9,5")).toBeNull();
    expect(parseWholeNumber("")).toBeNull();
  });
});
