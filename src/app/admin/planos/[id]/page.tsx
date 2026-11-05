import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { savePlanFeaturesAction, updatePlanAction } from "@/app/admin/actions";
import { PlanFields } from "@/components/admin-plan-fields";
import { adminButton, adminInput, Card, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { requireAdminPage } from "@/lib/admin";

export const metadata: Metadata = { title: "Editar plano" };

const brl = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export default async function EditPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FlashParams>;
}) {
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const flash = await searchParams;
  const { supabase } = await requireAdminPage("planos");

  const { data: plan } = await supabase.from("plans").select("*").eq("id", id.data).maybeSingle();
  if (!plan) notFound();

  const [{ data: features }, { data: links }, { count: subscribers }] = await Promise.all([
    supabase.from("features").select("key, name, description, kind, unit, sort_order").order("sort_order"),
    supabase.from("plan_features").select("feature_key, enabled, limit_value").eq("plan_id", id.data),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("plan_id", id.data).neq("status", "canceled"),
  ]);
  const byKey = new Map((links ?? []).map((l) => [l.feature_key as string, l]));

  return (
    <main className="space-y-6">
      <Link href="/admin/planos" className="text-sm text-cocoa underline">← Planos</Link>
      <PageTitle sub={`${subscribers ?? 0} negócio(s) neste plano. Alterações valem para todos eles.`}>{plan.name}</PageTitle>
      <Flash params={flash} />

      <Card title="Dados do plano">
        <form action={updatePlanAction} className="space-y-4">
          <input type="hidden" name="id" value={plan.id} />
          <PlanFields
            d={{
              slug: plan.slug, name: plan.name, description: plan.description ?? "",
              priceMonthly: brl(plan.price_monthly_cents), priceYearly: brl(plan.price_yearly_cents),
              trialDays: plan.trial_days, sortOrder: plan.sort_order, isPublic: plan.is_public, isActive: plan.is_active,
            }}
          />
          <button type="submit" className={adminButton}>Salvar dados</button>
        </form>
      </Card>

      <Card title="Recursos e limites">
        <form action={savePlanFeaturesAction} className="space-y-1">
          <input type="hidden" name="id" value={plan.id} />
          <ul className="divide-y divide-nude">
            {(features ?? []).map((f) => {
              const link = byKey.get(f.key);
              return (
                <li key={f.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <label className="flex min-w-0 flex-1 items-start gap-3 text-sm text-cocoa">
                    <input type="checkbox" name={`enabled:${f.key}`} defaultChecked={Boolean(link?.enabled)} className="mt-1 h-4 w-4" />
                    <span>
                      <span className="font-medium">{f.name}</span>
                      <span className="block text-xs text-graphite/70">{f.key}{f.kind === "limit" ? " · limite" : ""}</span>
                    </span>
                  </label>
                  {f.kind === "limit" ? (
                    <label className="text-xs text-graphite/80">
                      Limite{f.unit ? ` (${f.unit})` : ""}
                      <input name={`limit:${f.key}`} inputMode="numeric" placeholder="ilimitado" defaultValue={link?.limit_value ?? ""} className={`${adminInput} w-32`} />
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="pt-2 text-xs text-graphite/70">Limite vazio = ilimitado. Recurso desmarcado = indisponível no plano.</p>
          <button type="submit" className={`${adminButton} mt-3`}>Salvar recursos</button>
        </form>
      </Card>
    </main>
  );
}
