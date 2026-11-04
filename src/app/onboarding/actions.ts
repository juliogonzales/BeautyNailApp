"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { onboardingSchema, slugSchema } from "@/lib/validation";
import type { FormState } from "@/lib/form-state";

export type SlugStatus = "ok" | "taken" | "invalid" | "limited" | "error";

/** Confere se o endereço (/slug) está livre. A RPC exige login e já considera slugs reservados. */
export async function checkSlugAction(rawSlug: string): Promise<{ status: SlugStatus }> {
  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) return { status: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error" };
  if (!rateLimit(`slug:${user.id}`, 30, 60_000).ok) return { status: "limited" };

  const { data, error } = await supabase.rpc("is_slug_available", { p_slug: parsed.data });
  if (error) return { status: "error" };
  return { status: data === true ? "ok" : "taken" };
}

export async function createBusinessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = onboardingSchema.safeParse({
    businessName: formData.get("businessName") ?? "",
    slug: formData.get("slug") ?? "",
    specialtyIds: formData.getAll("specialtyIds").map(String),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");
  if (!rateLimit(`create-tenant:${user.id}`, 5, 10 * 60_000).ok) {
    return { error: "Muitas tentativas. Aguarde alguns minutos." };
  }

  // Criação atômica (tenant + dona + configurações + assinatura gratuita) no banco.
  const { data: tenantId, error } = await supabase.rpc("create_tenant", {
    p_business_name: parsed.data.businessName,
    p_slug: parsed.data.slug,
    p_specialty_ids: parsed.data.specialtyIds,
  });
  if (error || typeof tenantId !== "string") return { error: friendlyDbError(error?.message) };

  // Marca o onboarding como concluído (a dona pode atualizar essas colunas por RLS).
  const { error: updateError } = await supabase
    .from("tenants")
    .update({ onboarding_step: 1, onboarding_completed_at: new Date().toISOString() })
    .eq("id", tenantId);
  if (updateError) console.error("onboarding: falha ao marcar conclusão", updateError.message);

  const { error: auditError } = await supabase.rpc("log_audit", {
    p_tenant_id: tenantId,
    p_action: "onboarding.completed",
    p_entity_type: "tenant",
    p_entity_id: tenantId,
    p_metadata: {},
  });
  if (auditError) console.error("onboarding: falha ao registrar auditoria", auditError.message);

  redirect("/painel");
}
