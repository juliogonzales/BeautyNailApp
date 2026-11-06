"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@/lib/errors";
import type { FormState } from "@/lib/form-state";
import { profileFormSchema, toRow } from "@/lib/pricing-profile";
import { checkLimit, getFeatureState } from "@/lib/plan-limits";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionContext } from "@/lib/tenant";

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** Salva o perfil de preço do negócio (uma vez, vale para todos os serviços). O negócio vem da sessão; o banco confere a permissão. */
export async function savePricingProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, membership } = await getSessionContext();
  if (!user || !membership) return { error: "Sua sessão expirou. Entre novamente." };
  if (!rateLimit(`pricing-profile:${user.id}`, 30, 10 * 60_000).ok) return { error: "Muitas tentativas. Aguarde alguns minutos." };

  const state = await getFeatureState(supabase, membership.tenant.id, "pricing_calculator");
  if (!checkLimit(state).allowed) return { error: "A calculadora não está incluída no seu plano." };

  const parsed = profileFormSchema.safeParse({
    income: field(formData, "income"), days: field(formData, "days"), hours: field(formData, "hours"),
    occupancy: field(formData, "occupancy"), fixed: field(formData, "fixed"), cardFee: field(formData, "cardFee"),
    tax: field(formData, "tax"), commission: field(formData, "commission"), margin: field(formData, "margin"),
    presetSlug: field(formData, "presetSlug"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Confira os campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { error } = await supabase
    .from("pricing_profiles")
    .upsert({ tenant_id: membership.tenant.id, ...toRow(parsed.data) }, { onConflict: "tenant_id" });
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/painel/calculadora");
  return { message: "Dados do seu negócio salvos. Da próxima vez já estarão preenchidos." };
}
