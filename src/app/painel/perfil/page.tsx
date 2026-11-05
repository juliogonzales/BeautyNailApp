import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicProfileForm } from "@/components/public-profile-form";
import { getSessionContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Perfil público" };

export default async function PerfilPage() {
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/painel/perfil");
  if (!membership) redirect("/bem-vinda");

  const { data, error } = await supabase
    .from("tenant_settings")
    .select("whatsapp, instagram, city, state")
    .eq("tenant_id", membership.tenant.id)
    .maybeSingle();

  return (
    <main className="max-w-lg">
      <Link href="/painel" className="text-sm text-cocoa underline">← Voltar ao painel</Link>
      <h1 className="mt-3 font-serif text-3xl text-cocoa">Perfil público</h1>
      <p className="mt-2 text-graphite/80">O que aparece na sua página <span className="font-medium">/{membership.tenant.slug}</span>.</p>
      {error ? (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Não foi possível carregar seu perfil. Recarregue a página.
        </p>
      ) : (
        <div className="mt-6">
          <PublicProfileForm
            defaults={{ whatsapp: data?.whatsapp ?? "", instagram: data?.instagram ?? "", city: data?.city ?? "", state: data?.state ?? "" }}
          />
        </div>
      )}
    </main>
  );
}
