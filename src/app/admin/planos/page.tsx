import type { Metadata } from "next";
import Link from "next/link";
import { createPlanAction } from "@/app/admin/actions";
import { EMPTY_PLAN, PlanFields } from "@/components/admin-plan-fields";
import { adminButton, Card, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { requireAdminPage } from "@/lib/admin";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Planos" };

export default async function PlansAdminPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const { supabase } = await requireAdminPage("planos");
  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, slug, name, price_monthly_cents, is_public, is_active, sort_order")
    .order("sort_order");

  return (
    <main className="space-y-6">
      <PageTitle sub="Preço, limites e recursos vêm do banco. Mudou aqui, mudou para todos, sem deploy.">Planos</PageTitle>
      <Flash params={params} />
      {error ? <p role="alert" className="text-sm text-red-900">Não foi possível carregar os planos.</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {(plans ?? []).map((p) => (
          <li key={p.id} className="rounded-xl border border-sand bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-serif text-xl text-cocoa">{p.name}</h2>
              <span className="rounded-full bg-nude px-2 py-0.5 text-xs text-cocoa">{p.is_active ? (p.is_public ? "Público" : "Oculto") : "Inativo"}</span>
            </div>
            <p className="text-sm text-graphite/80">{p.slug} · {p.price_monthly_cents === 0 ? "Gratuito" : `${formatBRL(p.price_monthly_cents)}/mês`}</p>
            <Link href={`/admin/planos/${p.id}`} className="mt-3 inline-block text-sm font-medium text-cocoa underline">Editar plano e recursos</Link>
          </li>
        ))}
      </ul>
      <Card title="Novo plano">
        <form action={createPlanAction} className="space-y-4">
          <PlanFields d={EMPTY_PLAN} />
          <button type="submit" className={adminButton}>Criar plano</button>
        </form>
      </Card>
    </main>
  );
}
