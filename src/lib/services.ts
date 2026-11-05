import { z } from "zod";
import { parseBRLToCents, parseWholeNumber } from "@/lib/pricing";

const blankToNull = (v: string) => (v.trim() === "" ? null : v.trim());
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

const money = (label: string, { required }: { required: boolean }) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") {
        if (required) {
          ctx.addIssue({ code: "custom", message: `${label}: informe o valor, ex.: 80,00.` });
          return z.NEVER;
        }
        return 0;
      }
      const c = parseBRLToCents(v);
      if (c === null || c > 10_000_000) {
        ctx.addIssue({ code: "custom", message: `${label}: valor inválido, use algo como 80,00.` });
        return z.NEVER;
      }
      return c;
    });

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome ao serviço (mínimo 2 letras).").max(80, "Nome com até 80 caracteres."),
  description: z.string().trim().max(300, "Descrição com até 300 caracteres.").transform(blankToNull),
  category: z.string().trim().max(40, "Categoria com até 40 caracteres.").transform(blankToNull).refine((v) => v === null || v.length >= 2, "Categoria com pelo menos 2 letras."),
  price: money("Preço", { required: true }),
  cost: money("Material", { required: false }),
  duration: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = parseWholeNumber(v);
      if (n === null || n < 5 || n > 720) {
        ctx.addIssue({ code: "custom", message: "Duração: informe os minutos, entre 5 e 720." });
        return z.NEVER;
      }
      return n;
    }),
  isActive: checkbox,
  showOnPage: checkbox,
});

export type ServiceInput = z.infer<typeof serviceSchema>;

/** 90 → "1h30", 45 → "45 min", 120 → "2h". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Agrupa por categoria mantendo a ordem de chegada; serviços sem categoria vão para "Serviços". */
export function groupByCategory<T extends { category: string | null }>(items: T[]): Array<{ category: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const key = it.category?.trim() || "Serviços";
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  return [...groups.entries()].map(([category, list]) => ({ category, items: list }));
}

/** Centavos → texto para campo de formulário ("8000" → "80,00"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export const publicServiceSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  price_cents: z.number().int(),
  duration_minutes: z.number().int(),
});
export type PublicService = z.infer<typeof publicServiceSchema>;
