/** Calculadora de preço — tudo em centavos (inteiros) e pontos-base (1% = 100 bp). Sem float no dinheiro. */

export type PricingInput = {
  materialCostCents: number; // material gasto em um atendimento
  durationMinutes: number; // tempo do atendimento
  hourlyRateCents: number; // quanto a profissional quer ganhar por hora
  monthlyFixedCostsCents: number; // aluguel, energia, internet etc.
  servicesPerMonth: number; // atendimentos por mês (divide os custos fixos)
  cardFeeBp: number; // taxa da maquininha, em pontos-base
  marginBp: number; // lucro desejado sobre o preço, em pontos-base
};

export type PricingResult =
  | {
      ok: true;
      laborCents: number;
      overheadCents: number;
      costCents: number;
      priceCents: number;
      cardFeeCents: number;
      profitCents: number;
    }
  | { ok: false; error: "invalid_input" | "invalid_percent" };

function isNonNegativeInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

export function calculatePrice(input: PricingInput): PricingResult {
  const values = [
    input.materialCostCents,
    input.durationMinutes,
    input.hourlyRateCents,
    input.monthlyFixedCostsCents,
    input.servicesPerMonth,
    input.cardFeeBp,
    input.marginBp,
  ];
  if (!values.every(isNonNegativeInt)) return { ok: false, error: "invalid_input" };

  const totalBp = input.cardFeeBp + input.marginBp;
  if (totalBp >= 10000) return { ok: false, error: "invalid_percent" };

  const laborCents = Math.round((input.hourlyRateCents * input.durationMinutes) / 60);
  const overheadCents = input.servicesPerMonth > 0 ? Math.round(input.monthlyFixedCostsCents / input.servicesPerMonth) : 0;
  const costCents = input.materialCostCents + laborCents + overheadCents;

  // preço = custo / (1 - taxa - margem), arredondado para cima para nunca ficar abaixo da margem desejada.
  const priceCents = Math.ceil((costCents * 10000) / (10000 - totalBp));
  const cardFeeCents = Math.round((priceCents * input.cardFeeBp) / 10000);
  const profitCents = priceCents - costCents - cardFeeCents;

  return { ok: true, laborCents, overheadCents, costCents, priceCents, cardFeeCents, profitCents };
}

/** "12,50", "R$ 1.234,56", "80", "12.5" → centavos. Entrada inválida → null. */
export function parseBRLToCents(input: string): number | null {
  const s = input.replace(/R\$|\s/g, "");
  if (!s) return null;
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(s)) normalized = s;
  else normalized = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** "5", "5,5" → pontos-base (500, 550). Fora de 0–100 ou inválido → null. */
export function parsePercentToBp(input: string): number | null {
  const s = input.replace(/%|\s/g, "").replace(",", ".");
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s);
  if (value < 0 || value > 100) return null;
  return Math.round(value * 100);
}

/** Inteiro não negativo ("90" → 90). Inválido → null. */
export function parseWholeNumber(input: string): number | null {
  const s = input.trim();
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}
