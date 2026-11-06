import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBuilder } from "@/components/page-builder";
import { parseBlocks } from "@/lib/page-blocks";
import { checkLimit, getFeatureState } from "@/lib/plan-limits";
import { publicTenantSchema } from "@/lib/public-page";
import { getSessionContext } from "@/lib/tenant";
import { parseTheme } from "@/lib/theme";

export const metadata: Metadata = { title: "Montar minha página" };

export default async function PaginaBuilderPage() {
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/painel/pagina");
  if (!membership) redirect("/bem-vinda");

  const state = await getFeatureState(supabase, membership.tenant.id, "page_blocks");
  const allowed = checkLimit(state).allowed;
  const { data } = await supabase.rpc("get_public_tenant", { p_slug: membership.tenant.slug });
  const tenant = publicTenantSchema.safeParse(data);

  return (
    <main className="space-y-6">
      <Link href="/painel" className="text-sm text-cocoa underline">← Voltar ao painel</Link>
      <header>
        <h1 className="font-serif text-3xl text-cocoa">Montar minha página</h1>
        <p className="mt-2 text-graphite/80">
          Escolha os blocos, mude a ordem e escreva os textos. Sem código: o que você salva aparece em <span className="font-medium">/{membership.tenant.slug}</span>.
        </p>
      </header>
      {!allowed ? (
        <p className="rounded-xl border border-sand bg-nude/60 p-4 text-sm text-cocoa">
          Montar a página não está incluído no seu plano atual. <Link href="/planos" className="font-medium underline">Ver planos</Link>
        </p>
      ) : !tenant.success ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Não foi possível carregar a sua página agora. Se o seu negócio estiver suspenso, fale com o suporte.
        </p>
      ) : (
        <PageBuilder tenant={tenant.data} theme={parseTheme(tenant.data.theme)} initial={parseBlocks(tenant.data.blocks)} limit={state.limitValue} />
      )}
    </main>
  );
}
