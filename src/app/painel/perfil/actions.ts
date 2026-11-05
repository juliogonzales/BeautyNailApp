"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionContext } from "@/lib/tenant";
import { publicProfileSchema } from "@/lib/validation";
import type { FormState } from "@/lib/form-state";

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** Atualiza o perfil público. O negócio vem da sessão (nunca do formulário) e o banco confere a permissão por RLS. */
export async function savePublicProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, membership } = await getSessionContext();
  if (!user || !membership) return { error: "Sua sessão expirou. Entre novamente." };
  if (!rateLimit(`profile:${user.id}`, 20, 10 * 60_000).ok) return { error: "Muitas tentativas. Aguarde alguns minutos." };

  const parsed = publicProfileSchema.safeParse({
    whatsapp: field(formData, "whatsapp"),
    instagram: field(formData, "instagram"),
    city: field(formData, "city"),
    state: field(formData, "state"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const { data, error } = await supabase
    .from("tenant_settings")
    .update(parsed.data)
    .eq("tenant_id", membership.tenant.id)
    .select("tenant_id");
  if (error) return { error: friendlyDbError(error.message) };
  if (!data || data.length === 0) return { error: "Você não tem permissão para alterar o perfil deste negócio." };

  revalidatePath("/painel");
  revalidatePath(`/${membership.tenant.slug}`);
  return { message: "Perfil salvo. Sua página já mostra as novas informações." };
}
