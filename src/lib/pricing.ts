/** Leitura de valores digitados (dinheiro em centavos, porcentagens em pontos-base). O cálculo de preço está em service-pricing.ts. */

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
