/** Preço de serviço. Tudo em inteiros: dinheiro em centavos, percentuais em pontos-base (1% = 100), quantidades em centésimos. */

export type PricingProfile = {
  monthlyIncomeCents: number; // quanto a profissional quer retirar por mês
  daysPerWeek: number;
  hoursPerDay: number;
  occupancyBp: number; // parte do tempo de trabalho que realmente está com clientes
  fixedCostsCents: number; // aluguel, luz, internet, contador, MEI…
  cardFeeBp: number;
  taxBp: number;
  commissionBp: number; // parte do preço repassada a quem atende (barbearia, salão)
  marginBp: number; // lucro do negócio, além da retirada
};

export type MaterialLine = {
  packagePriceCents: number; // quanto custou a embalagem
  packageSizeHundredths: number; // quanto vem nela (ml, g ou unidades), em centésimos
  usedHundredths: number; // quanto se usa em UM atendimento, em centésimos
};

/** Custo do material em um atendimento = preço da embalagem × (uso ÷ conteúdo). */
export function materialLineCost(l: MaterialLine): number {
  if (l.packageSizeHundredths <= 0 || l.packagePriceCents <= 0 || l.usedHundredths <= 0) return 0;
  return Math.round((l.packagePriceCents * l.usedHundredths) / l.packageSizeHundredths);
}

export function materialsTotal(lines: MaterialLine[]): number {
  return lines.reduce((sum, l) => sum + materialLineCost(l), 0);
}

const WEEKS_PER_MONTH_X100 = 433; // 4,33 semanas por mês

/** Minutos por mês em que a profissional está de fato atendendo. */
export function productiveMinutesPerMonth(p: Pick<PricingProfile, "daysPerWeek" | "hoursPerDay" | "occupancyBp">): number {
  return Math.round((p.daysPerWeek * p.hoursPerDay * 60 * WEEKS_PER_MONTH_X100 * p.occupancyBp) / 1_000_000);
}

/** Quanto custa uma hora atendendo: (retirada + custos fixos) ÷ horas produtivas. `null` se não houver horas. */
export function hourCostCents(p: PricingProfile): number | null {
  const minutes = productiveMinutesPerMonth(p);
  if (minutes <= 0) return null;
  return Math.round(((p.monthlyIncomeCents + p.fixedCostsCents) * 60) / minutes);
}

export type ServiceInput = { minutes: number; materialsCents: number; extraCents: number };

export type Breakdown = {
  priceCents: number;
  materialsCents: number;
  timeCents: number; // sua retirada + custos fixos proporcionais ao tempo
  extraCents: number;
  cardFeeCents: number;
  taxCents: number;
  commissionCents: number;
  profitCents: number;
};

export type ServicePrice =
  | {
      ok: true;
      hourCostCents: number;
      timeCostCents: number;
      directCostCents: number;
      floorCents: number; // cobre só material, extras, taxa, imposto e comissão
      minimumCents: number; // cobre também o seu tempo (retirada e custos fixos), sem lucro
      suggestedCents: number; // com o lucro escolhido
      roundedCents: number; // sugerido arredondado para cima
      atSuggested: Breakdown;
    }
  | { ok: false; error: "invalid_input" | "invalid_percent" | "no_hours" };

const isInt = (n: number) => Number.isInteger(n) && n >= 0;

/** Arredonda para cima: múltiplos de R$ 1 abaixo de R$ 50 e de R$ 5 a partir daí. */
export function roundUpPrice(cents: number): number {
  const step = cents < 5000 ? 100 : 500;
  return Math.ceil(cents / step) * step;
}

export function breakdownAt(profile: PricingProfile, priceCents: number, direct: { materialsCents: number; extraCents: number }, timeCents: number): Breakdown {
  const cardFeeCents = Math.round((priceCents * profile.cardFeeBp) / 10000);
  const taxCents = Math.round((priceCents * profile.taxBp) / 10000);
  const commissionCents = Math.round((priceCents * profile.commissionBp) / 10000);
  const profitCents = priceCents - direct.materialsCents - direct.extraCents - timeCents - cardFeeCents - taxCents - commissionCents;
  return { priceCents, materialsCents: direct.materialsCents, timeCents, extraCents: direct.extraCents, cardFeeCents, taxCents, commissionCents, profitCents };
}

export function priceService(profile: PricingProfile, input: ServiceInput): ServicePrice {
  const nums = [
    profile.monthlyIncomeCents, profile.daysPerWeek, profile.hoursPerDay, profile.occupancyBp, profile.fixedCostsCents,
    profile.cardFeeBp, profile.taxBp, profile.commissionBp, profile.marginBp, input.minutes, input.materialsCents, input.extraCents,
  ];
  if (!nums.every(isInt)) return { ok: false, error: "invalid_input" };
  const deductions = profile.cardFeeBp + profile.taxBp + profile.commissionBp;
  if (deductions + profile.marginBp >= 10000) return { ok: false, error: "invalid_percent" };
  const hour = hourCostCents(profile);
  if (hour === null) return { ok: false, error: "no_hours" };

  const timeCostCents = Math.round((hour * input.minutes) / 60);
  const directCostCents = input.materialsCents + input.extraCents;
  const floorCents = Math.ceil((directCostCents * 10000) / (10000 - deductions));
  const minimumCents = Math.ceil(((directCostCents + timeCostCents) * 10000) / (10000 - deductions));
  const suggestedCents = Math.ceil(((directCostCents + timeCostCents) * 10000) / (10000 - deductions - profile.marginBp));
  const roundedCents = roundUpPrice(suggestedCents);
  return {
    ok: true,
    hourCostCents: hour,
    timeCostCents,
    directCostCents,
    floorCents,
    minimumCents,
    suggestedCents,
    roundedCents,
    atSuggested: breakdownAt(profile, suggestedCents, input, timeCostCents),
  };
}

export type PriceDiagnosis = {
  status: "loss" | "no_pay" | "below_goal" | "ok";
  breakdown: Breakdown;
  marginBp: number; // lucro real ÷ preço, em pontos-base (pode ser negativo)
};

/** "E se eu cobrar X?" — mostra o que sobra de verdade com o preço que a profissional já pratica. */
export function diagnosePrice(profile: PricingProfile, input: ServiceInput, priceCents: number): PriceDiagnosis | null {
  const hour = hourCostCents(profile);
  if (hour === null || !isInt(priceCents) || priceCents <= 0) return null;
  const timeCents = Math.round((hour * input.minutes) / 60);
  const b = breakdownAt(profile, priceCents, input, timeCents);
  const afterDeductions = priceCents - b.cardFeeCents - b.taxCents - b.commissionCents;
  const direct = input.materialsCents + input.extraCents;
  const marginBp = Math.round((b.profitCents * 10000) / priceCents);
  let status: PriceDiagnosis["status"] = "ok";
  if (afterDeductions < direct) status = "loss";
  else if (afterDeductions < direct + timeCents) status = "no_pay";
  else if (marginBp < profile.marginBp) status = "below_goal";
  return { status, breakdown: b, marginBp };
}

/** Quantidade com até 2 casas ("2,5" → 250). Zero, negativo ou inválido → null. */
export function parseQuantityHundredths(input: string): number | null {
  const s = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole = "0", frac = ""] = s.split(".");
  const v = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return v > 0 && v <= 100_000_000 ? v : null;
}
