"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyDbError } from "@/lib/errors";
import type { FormState } from "@/lib/form-state";
import { getFeatureState } from "@/lib/plan-limits";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionContext } from "@/lib/tenant";

const optionalHex = z
  .string()
  .trim()
  .refine((v) => v === "" || /^#[0-9a-fA-F]{6}$/.test(v), "Use uma cor no formato #rrggbb.")
  .transform((v) => (v === "" ? null : v.toLowerCase()));

const schema = z.object({
  templateId: z.union([z.literal(""), z.string().uuid()]).transform((v) => (v === "" ? null : v)),
  primary: optionalHex,
  accent: optionalHex,
});

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** Modelo e cores da página pública. Exige o recurso `custom_theme` (plano ou exceção); o banco confere de novo ao publicar. */
export async function saveAppearanceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, membership } = await getSessionContext();
  if (!user || !membership) return { error: "Sua sessão expirou. Entre novamente." };
  if (!rateLimit(`appearance:${user.id}`, 20, 10 * 60_000).ok) return { error: "Muitas tentativas. Aguarde alguns minutos." };

  const parsed = schema.safeParse({
    templateId: field(formData, "templateId"), primary: field(formData, "primary"), accent: field(formData, "accent"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const feature = await getFeatureState(supabase, membership.tenant.id, "custom_theme");
  if (!feature.enabled) return { error: "A personalização da página não está incluída no seu plano." };

  if (parsed.data.templateId) {
    const { data: tpl } = await supabase.from("page_templates").select("id").eq("id", parsed.data.templateId).eq("is_active", true).maybeSingle();
    if (!tpl) return { error: "Esse modelo não está disponível." };
  }

  const { data, error } = await supabase
    .from("tenant_settings")
    .update({ template_id: parsed.data.templateId, primary_color: parsed.data.primary, accent_color: parsed.data.accent })
    .eq("tenant_id", membership.tenant.id)
    .select("tenant_id");
  if (error) return { error: friendlyDbError(error.message) };
  if (!data || data.length === 0) return { error: "Você não tem permissão para alterar este negócio." };

  revalidatePath(`/${membership.tenant.slug}`);
  revalidatePath("/painel/aparencia");
  return { message: "Aparência salva. Sua página já usa o novo visual." };
}
