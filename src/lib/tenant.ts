import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Membership = {
  role: "owner" | "admin" | "professional" | "assistant";
  tenant: {
    id: string;
    slug: string;
    businessName: string;
    onboardingCompletedAt: string | null;
  };
};

/** Primeiro negócio ativo da usuária (o mais antigo). Seletor de vários negócios fica para depois (D-011). */
export async function getCurrentMembership(supabase: SupabaseClient, userId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from("tenant_members")
    .select("role, created_at, tenants!inner(id, slug, business_name, status, onboarding_completed_at)")
    .eq("user_id", userId)
    .eq("tenants.status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw new Error(`Falha ao carregar o negócio: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;

  const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
  if (!tenant) return null;

  return {
    role: row.role,
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      businessName: tenant.business_name,
      onboardingCompletedAt: tenant.onboarding_completed_at ?? null,
    },
  };
}

/** Sessão + negócio da requisição atual (uma consulta por requisição, mesmo se chamado várias vezes). */
export const getSessionContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, membership: null as Membership | null };
  const membership = await getCurrentMembership(supabase, user.id);
  return { supabase, user, membership };
});
