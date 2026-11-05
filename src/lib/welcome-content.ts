import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const benefitsSchema = z
  .array(
    z.object({
      title: z.string().trim().min(1).max(80),
      text: z.string().trim().min(1).max(300),
      available: z.boolean(),
    }),
  )
  .max(20);
export const guaranteesSchema = z.array(z.string().trim().min(1).max(200)).max(12);

export type Benefit = z.infer<typeof benefitsSchema>[number];

// Usado só se o banco estiver indisponível ou com conteúdo inválido. O texto oficial fica em platform_settings.
const FALLBACK_BENEFITS: Benefit[] = [
  { title: "Painel do seu negócio", text: "Seu espaço com atalhos e o resumo do seu plano, desde o primeiro dia.", available: true },
  { title: "Calculadora de preços", text: "Calcule quanto cobrar por serviço.", available: true },
];
const FALLBACK_GUARANTEES = ["Comece grátis, sem cartão de crédito."];

export async function getWelcomeContent(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", ["welcome.benefits", "welcome.guarantees"])
    .eq("is_public", true);
  const byKey = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  const benefits = benefitsSchema.safeParse(byKey.get("welcome.benefits"));
  const guarantees = guaranteesSchema.safeParse(byKey.get("welcome.guarantees"));
  return {
    benefits: benefits.success && benefits.data.length > 0 ? benefits.data : FALLBACK_BENEFITS,
    guarantees: guarantees.success && guarantees.data.length > 0 ? guarantees.data : FALLBACK_GUARANTEES,
  };
}
