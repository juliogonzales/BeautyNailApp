import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { PublicPageView } from "@/components/public-page-view";
import { publicTenantSchema, type PublicTenant } from "@/lib/public-page";
import { parseTheme } from "@/lib/theme";
import { slugSchema } from "@/lib/validation";

type Props = { params: Promise<{ slug: string }> };

/** Página pública do negócio. O banco só devolve campos seguros (RPC get_public_tenant) e só de negócios ativos. */
const loadTenant = cache(async (rawSlug: string): Promise<PublicTenant | null> => {
  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_tenant", { p_slug: parsed.data });
  if (error || !data) return null;
  const result = publicTenantSchema.safeParse(data);
  return result.success ? result.data : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tenant = await loadTenant((await params).slug);
  if (!tenant) return { title: "Página não encontrada" };
  return {
    title: tenant.business_name,
    description: tenant.specialties.length > 0 ? tenant.specialties.join(" · ") : `Página de ${tenant.business_name}`,
  };
}

export default async function PublicTenantPage({ params }: Props) {
  const tenant = await loadTenant((await params).slug);
  if (!tenant) notFound();
  return <PublicPageView tenant={tenant} theme={parseTheme(tenant.theme)} />;
}
