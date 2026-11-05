"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyDbError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { serviceSchema } from "@/lib/services";
import { getSessionContext } from "@/lib/tenant";

const PATH = "/painel/servicos";

function back(kind: "ok" | "erro", message: string): never {
  revalidatePath(PATH);
  redirect(`${PATH}?${kind}=${encodeURIComponent(message)}`);
}

function serviceError(message?: string | null): string {
  if (message?.includes("services_tenant_name_key")) return "Você já tem um serviço com esse nome.";
  return friendlyDbError(message);
}

async function gate() {
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/painel/servicos");
  if (!membership) redirect("/bem-vinda");
  if (!rateLimit(`services:${user.id}`, 60, 60_000).ok) back("erro", "Muitas ações seguidas. Aguarde um instante.");
  return { supabase, tenantId: membership.tenant.id, slug: membership.tenant.slug };
}

function raw(formData: FormData) {
  return Object.fromEntries(formData);
}

export async function createServiceAction(formData: FormData) {
  const { supabase, tenantId, slug } = await gate();
  const parsed = serviceSchema.safeParse(raw(formData));
  if (!parsed.success) back("erro", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;
  const { error } = await supabase.from("services").insert({
    tenant_id: tenantId, name: d.name, description: d.description, category: d.category, price_cents: d.price,
    cost_cents: d.cost, duration_minutes: d.duration, is_active: d.isActive, show_on_page: d.showOnPage,
  });
  if (error) back("erro", serviceError(error.message));
  revalidatePath(`/${slug}`);
  back("ok", "Serviço adicionado.");
}

export async function updateServiceAction(formData: FormData) {
  const { supabase, tenantId, slug } = await gate();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) back("erro", "Serviço inválido.");
  const parsed = serviceSchema.safeParse(raw(formData));
  if (!parsed.success) back("erro", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;
  const { data, error } = await supabase
    .from("services")
    .update({
      name: d.name, description: d.description, category: d.category, price_cents: d.price, cost_cents: d.cost,
      duration_minutes: d.duration, is_active: d.isActive, show_on_page: d.showOnPage,
    })
    .eq("id", id.data)
    .eq("tenant_id", tenantId)
    .select("id");
  if (error) back("erro", serviceError(error.message));
  if (!data?.length) back("erro", "Serviço não encontrado ou sem permissão.");
  revalidatePath(`/${slug}`);
  back("ok", "Serviço salvo.");
}

export async function deleteServiceAction(formData: FormData) {
  const { supabase, tenantId, slug } = await gate();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) back("erro", "Serviço inválido.");
  const { data, error } = await supabase.from("services").delete().eq("id", id.data).eq("tenant_id", tenantId).select("id");
  if (error) back("erro", serviceError(error.message));
  if (!data?.length) back("erro", "Serviço não encontrado ou sem permissão.");
  revalidatePath(`/${slug}`);
  back("ok", "Serviço removido.");
}
