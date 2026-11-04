import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

const FALLBACK_NAME = "BeautyNailapp";

/** Nome do produto vem de platform_settings (`product.name`); o valor acima só vale se o banco falhar. */
export const getProductName = cache(async (): Promise<string> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "product.name")
      .eq("is_public", true)
      .maybeSingle();
    const value = data?.value;
    return typeof value === "string" && value.trim() ? value.trim() : FALLBACK_NAME;
  } catch {
    return FALLBACK_NAME;
  }
});
