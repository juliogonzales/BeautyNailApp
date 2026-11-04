import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicEnv } from "@/lib/env";
import { formatBRL } from "@/lib/money";
import { describeFeature } from "@/lib/plan-limits";
import { getSessionContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Painel" };

type FeatureRow = {
  key: string;
  name: string;
  kind: "flag" | "limit";
  unit: string | null;
  sortOrder: number;
  enabled: boolean;
  limitValue: number | null;
};

const STATUS_LABELS: Record<string, string> = {
  free: "Gratuito",
  trialing: "Período de teste",
  active: "Ativo",
  past_due: "Pagamento pendente",
  canceled: "Cancelado",
};

export default async function PainelPage() {
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/painel");
  if (!membership) redirect("/onboarding");
  const { tenant } = membership;

  // Colunas explícitas: ids do provedor de pagamento não são legíveis pelo cliente (grant por coluna).
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, status, trial_ends_at, plans(name, description, price_monthly_cents)")
    .eq("tenant_id", tenant.id)
    .neq("status", "canceled")
    .maybeSingle();

  const plan = Array.isArray(sub?.plans) ? sub?.plans[0] : sub?.plans;

  let features: FeatureRow[] = [];
  if (sub?.plan_id) {
    const { data: rows } = await supabase
      .from("plan_features")
      .select("enabled, limit_value, features(key, name, kind, unit, sort_order)")
      .eq("plan_id", sub.plan_id);

    features = (rows ?? [])
      .map((r) => {
        const f = Array.isArray(r.features) ? r.features[0] : r.features;
        if (!f) return null;
        return {
          key: f.key as string,
          name: f.name as string,
          kind: f.kind as "flag" | "limit",
          unit: (f.unit as string | null) ?? null,
          sortOrder: Number(f.sort_order ?? 0),
          enabled: Boolean(r.enabled),
          limitValue: (r.limit_value as number | null) ?? null,
        } satisfies FeatureRow;
      })
      .filter((f): f is FeatureRow => f !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const publicUrl = `${new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL).host}/${tenant.slug}`;
  const included = features.filter((f) => f.enabled);
  const notIncluded = features.filter((f) => !f.enabled);

  return (
    <main className="space-y-8">
      <section>
        <h1 className="font-serif text-3xl text-cocoa">Olá! Seu negócio está criado.</h1>
        <p className="mt-2 text-graphite/80">
          Seu endereço será <span className="font-medium text-cocoa">{publicUrl}</span>. A página pública, a agenda e o
          cadastro de clientes chegam na próxima fase.
        </p>
      </section>

      <section className="rounded-xl border border-sand bg-white p-5">
        <h2 className="text-sm uppercase tracking-widest text-gold">Seu plano</h2>
        {plan ? (
          <div className="mt-2">
            <p className="font-serif text-2xl text-cocoa">{plan.name}</p>
            <p className="text-sm text-graphite/80">{plan.description}</p>
            <p className="mt-2 text-sm">
              {plan.price_monthly_cents === 0 ? "Gratuito" : `${formatBRL(plan.price_monthly_cents)}/mês`}
              {" · "}
              {STATUS_LABELS[sub?.status ?? ""] ?? sub?.status}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-graphite/80">Não encontramos uma assinatura ativa para este negócio.</p>
        )}
      </section>

      {features.length > 0 ? (
        <section className="rounded-xl border border-sand bg-white p-5">
          <h2 className="text-sm uppercase tracking-widest text-gold">O que está incluído</h2>
          <ul className="mt-3 divide-y divide-nude">
            {included.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{f.name}</span>
                <span className="font-medium text-cocoa">{describeFeature(f)}</span>
              </li>
            ))}
          </ul>
          {notIncluded.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-cocoa underline">
                Ver o que não está no seu plano ({notIncluded.length})
              </summary>
              <ul className="mt-2 divide-y divide-nude">
                {notIncluded.map((f) => (
                  <li key={f.key} className="flex items-center justify-between gap-3 py-2 text-sm text-graphite/70">
                    <span>{f.name}</span>
                    <span>{describeFeature(f)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
