"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@/lib/errors";
import type { FormState } from "@/lib/form-state";
import { blocksSchema } from "@/lib/page-blocks";
import { checkLimit, getFeatureState } from "@/lib/plan-limits";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionContext } from "@/lib/tenant";

/** Salva os blocos da página (ou `null` para voltar à página automática). O negócio vem da sessão; o limite do plano é conferido de novo no banco. */
export async function savePageBlocksAction(input: unknown): Promise<FormState> {
  const { supabase, user, membership } = await getSessionContext();
  if (!user || !membership) return { error: "Sua sessão expirou. Entre novamente." };
  if (!rateLimit(`page-blocks:${user.id}`, 40, 10 * 60_000).ok) return { error: "Muitas tentativas. Aguarde alguns minutos." };

  let value: unknown = null;
  if (input !== null) {
    const parsed = blocksSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os textos dos blocos." };
    value = parsed.data;
  }

  const state = await getFeatureState(supabase, membership.tenant.id, "page_blocks");
  if (!checkLimit(state).allowed && value !== null) return { error: "Montar a página não está incluído no seu plano." };

  const { data, error } = await supabase
    .from("tenant_settings")
    .update({ page_blocks: value })
    .eq("tenant_id", membership.tenant.id)
    .select("tenant_id");
  if (error) return { error: friendlyDbError(error.message) };
  if (!data?.length) return { error: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/painel/pagina");
  revalidatePath(`/${membership.tenant.slug}`);
  return { message: value === null ? "Sua página voltou ao modelo automático." : "Página salva e publicada." };
}
