import type { SupabaseClient } from "@supabase/supabase-js";

/** Nome do plano gratuito (preço zero), lido do banco. O nome é editável no console; nada fica fixo no código. */
export async function getFreePlanName(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("plans")
    .select("name")
    .eq("is_active", true)
    .eq("is_public", true)
    .eq("price_monthly_cents", 0)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  return (data?.name as string | undefined) ?? null;
}
