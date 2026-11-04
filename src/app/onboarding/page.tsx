import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getPublicEnv } from "@/lib/env";
import { getSessionContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Criar meu negócio" };

export default async function OnboardingPage() {
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/onboarding");
  if (membership) redirect("/painel");

  const { data, error } = await supabase
    .from("specialties")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const baseHost = new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL).host;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <p className="text-sm uppercase tracking-widest text-gold">Passo 1 de 1</p>
      <h1 className="mt-2 font-serif text-3xl text-cocoa">Vamos criar o seu negócio</h1>
      <p className="mt-2 text-graphite/80">Leva menos de um minuto. Você poderá mudar tudo depois.</p>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Não foi possível carregar as especialidades. Recarregue a página.
        </p>
      ) : (
        <div className="mt-8">
          <OnboardingForm specialties={data ?? []} baseHost={baseHost} />
        </div>
      )}
    </main>
  );
}
