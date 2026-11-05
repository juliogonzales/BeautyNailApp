import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatBRL } from "@/lib/money";
import { describeFeature } from "@/lib/plan-limits";
import { getFreePlanName } from "@/lib/free-plan";
import { getSessionContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Planos" };

type PlanFeature = {
  key: string;
  name: string;
  kind: "flag" | "limit";
  unit: string | null;
  sortOrder: number;
  enabled: boolean;
  limitValue: number | null;
};

type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceMonthlyCents: number;
  trialDays: number;
  features: PlanFeature[];
};

const MAX_LISTED = 8;
// Pagamento ainda não existe: só o plano gratuito (preço zero) pode ser escolhido (docs/DECISIONS.md D-014).

export default async function PlansPage() {
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/planos");
  if (membership) redirect("/painel");

  const { data, error } = await supabase
    .from("plans")
    .select(
      "id, slug, name, description, price_monthly_cents, trial_days, sort_order, plan_features(enabled, limit_value, features(key, name, kind, unit, sort_order))",
    )
    .eq("is_active", true)
    .eq("is_public", true)
    .order("sort_order", { ascending: true });

  const freeName = await getFreePlanName(supabase);

  const plans: Plan[] = (data ?? []).map((p) => ({
    id: p.id as string,
    slug: p.slug as string,
    name: p.name as string,
    description: (p.description as string | null) ?? null,
    priceMonthlyCents: Number(p.price_monthly_cents ?? 0),
    trialDays: Number(p.trial_days ?? 0),
    features: ((p.plan_features ?? []) as Array<Record<string, unknown>>)
      .map((pf) => {
        const f = (Array.isArray(pf.features) ? pf.features[0] : pf.features) as Record<string, unknown> | null | undefined;
        if (!f) return null;
        return {
          key: f.key as string,
          name: f.name as string,
          kind: f.kind as "flag" | "limit",
          unit: (f.unit as string | null) ?? null,
          sortOrder: Number(f.sort_order ?? 0),
          enabled: Boolean(pf.enabled),
          limitValue: (pf.limit_value as number | null) ?? null,
        } satisfies PlanFeature;
      })
      .filter((f): f is PlanFeature => f !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm uppercase tracking-widest text-gold">Passo 2 de 3</p>
      <h1 className="mt-2 font-serif text-3xl text-cocoa">Escolha o seu plano</h1>
      <p className="mt-2 text-graphite/80">
        {freeName ? `Comece pelo ${freeName}, que é gratuito` : "Comece pelo plano gratuito"} e já inclui o painel e a calculadora de preços. Os planos pagos chegam em breve, e
        você poderá mudar quando quiser, sem perder nada do que cadastrou.
      </p>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Não foi possível carregar os planos. Recarregue a página.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const selectable = plan.priceMonthlyCents === 0;
            const included = plan.features.filter((f) => f.enabled);
            const listed = included.slice(0, MAX_LISTED);
            const rest = included.length - listed.length;
            return (
              <li key={plan.id} className={`flex flex-col rounded-xl border bg-white p-5 ${selectable ? "border-cocoa" : "border-sand"}`}>
                <h2 className="font-serif text-2xl text-cocoa">{plan.name}</h2>
                <p className="text-sm text-graphite/80">{plan.description}</p>
                <p className="mt-3 text-lg font-medium text-cocoa">
                  {plan.priceMonthlyCents === 0 ? "Gratuito" : `${formatBRL(plan.priceMonthlyCents)}/mês`}
                </p>
                {plan.trialDays > 0 ? <p className="text-xs text-graphite/70">{plan.trialDays} dias de teste quando os pagamentos abrirem</p> : null}

                <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                  {listed.map((f) => (
                    <li key={f.key} className="flex justify-between gap-2">
                      <span>{f.name}</span>
                      <span className="text-right text-cocoa">{describeFeature(f)}</span>
                    </li>
                  ))}
                  {rest > 0 ? <li className="text-graphite/70">e mais {rest} recursos</li> : null}
                </ul>

                {selectable ? (
                  <Link
                    href="/onboarding"
                    className="mt-5 rounded-lg bg-cocoa px-4 py-3 text-center font-medium text-paper hover:bg-cocoa/90 focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2"
                  >
                    Começar grátis
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-5 cursor-not-allowed rounded-lg border border-sand px-4 py-3 text-center font-medium text-graphite/60"
                  >
                    Em breve
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
