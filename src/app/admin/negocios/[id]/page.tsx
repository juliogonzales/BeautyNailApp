import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { clearFeatureOverrideAction, setFeatureOverrideAction, setTenantPlanAction, setTenantStatusAction } from "@/app/admin/actions";
import { adminButton, adminButtonGhost, adminInput, Card, Field, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { requireAdminPage } from "@/lib/admin";
import { auditLabel } from "@/lib/audit-labels";

export const metadata: Metadata = { title: "Negócio" };

const STATUS: Record<string, string> = { active: "Ativo", suspended: "Suspenso", deleted: "Excluído" };
const dt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default async function TenantDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<FlashParams> }) {
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const flash = await searchParams;
  const { supabase, role } = await requireAdminPage("negocios");
  const canSupport = role === "superadmin" || role === "support";
  const canBilling = role === "superadmin" || role === "billing";

  const { data: tenant } = await supabase.from("tenants").select("id, slug, business_name, status, created_at").eq("id", id.data).maybeSingle();
  if (!tenant) notFound();

  const [{ data: sub }, { data: plans }, { data: features }, { data: overrides }, { data: usage }, overview, { data: logs }] = await Promise.all([
    supabase.from("subscriptions").select("plan_id, status, plans(name)").eq("tenant_id", id.data).neq("status", "canceled").maybeSingle(),
    supabase.from("plans").select("id, name, price_monthly_cents").eq("is_active", true).order("sort_order"),
    supabase.from("features").select("key, name, kind, unit").order("sort_order"),
    supabase.from("tenant_feature_overrides").select("feature_key, enabled, limit_value, reason, expires_at").eq("tenant_id", id.data),
    supabase.from("feature_usage").select("feature_key, used").eq("tenant_id", id.data).eq("period", "lifetime"),
    canSupport ? supabase.rpc("admin_tenant_overview", { p_tenant: id.data }) : Promise.resolve({ data: null }),
    canSupport
      ? supabase.from("audit_logs").select("id, action, created_at, metadata").eq("tenant_id", id.data).order("created_at", { ascending: false }).limit(25)
      : Promise.resolve({ data: [] as Array<{ id: string; action: string; created_at: string; metadata: unknown }> }),
  ]);

  const planRow = Array.isArray(sub?.plans) ? sub?.plans[0] : sub?.plans;
  const { data: planFeatures } = sub?.plan_id
    ? await supabase.from("plan_features").select("feature_key, enabled, limit_value").eq("plan_id", sub.plan_id)
    : { data: [] };
  const pf = new Map((planFeatures ?? []).map((r) => [r.feature_key as string, r]));
  const ov = new Map((overrides ?? []).map((r) => [r.feature_key as string, r]));
  const used = new Map((usage ?? []).map((r) => [r.feature_key as string, r.used as number]));
  const info = (overview.data ?? null) as { owner_name?: string | null; owner_email?: string | null; members?: number; specialties?: string[] } | null;
  const back = `/admin/negocios/${tenant.id}`;

  return (
    <main className="space-y-6">
      <Link href="/admin/negocios" className="text-sm text-cocoa underline">← Negócios</Link>
      <PageTitle sub={`/${tenant.slug} · criado em ${dt(tenant.created_at)}`}>{tenant.business_name}</PageTitle>
      <Flash params={flash} />

      <Card title="Resumo">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-graphite/70">Status</dt><dd className="font-medium text-cocoa">{STATUS[tenant.status] ?? tenant.status}</dd></div>
          <div><dt className="text-graphite/70">Plano</dt><dd className="font-medium text-cocoa">{(planRow?.name as string | undefined) ?? "—"} ({sub?.status ?? "sem assinatura"})</dd></div>
          {info ? (
            <>
              <div><dt className="text-graphite/70">Responsável</dt><dd className="font-medium text-cocoa">{info.owner_name || "—"}</dd></div>
              <div><dt className="text-graphite/70">E-mail do responsável</dt><dd className="break-all font-medium text-cocoa">{info.owner_email || "—"}</dd></div>
              <div><dt className="text-graphite/70">Pessoas na equipe</dt><dd className="font-medium text-cocoa">{info.members ?? 0}</dd></div>
              <div><dt className="text-graphite/70">Especialidades</dt><dd className="font-medium text-cocoa">{(info.specialties ?? []).join(", ") || "—"}</dd></div>
            </>
          ) : null}
        </dl>
        {tenant.status === "active" ? <p className="mt-3 text-sm"><Link href={`/${tenant.slug}`} target="_blank" className="text-cocoa underline">Abrir página pública</Link></p> : null}
      </Card>

      {canSupport && tenant.status !== "deleted" ? (
        <Card title={tenant.status === "active" ? "Suspender" : "Reativar"}>
          <form action={setTenantStatusAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="status" value={tenant.status === "active" ? "suspended" : "active"} />
            {tenant.status === "active" ? (
              <label className="flex-1 text-xs text-graphite/80">Motivo (obrigatório)<input name="reason" required minLength={3} maxLength={300} className={adminInput} /></label>
            ) : <input type="hidden" name="reason" value="reativação" />}
            <button type="submit" className={adminButtonGhost}>{tenant.status === "active" ? "Suspender negócio" : "Reativar negócio"}</button>
          </form>
        </Card>
      ) : null}

      {canBilling ? (
        <Card title="Trocar plano manualmente">
          <p className="mb-3 text-xs text-graphite/70">Para cortesia ou correção. Não gera cobrança (pagamentos entram na Fase 8).</p>
          <form action={setTenantPlanAction} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <Field label="Novo plano">
              <select name="planId" defaultValue={sub?.plan_id ?? ""} className={adminInput}>
                {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2"><Field label="Motivo (obrigatório)"><input name="reason" required minLength={3} maxLength={300} className={adminInput} /></Field></div>
            <div className="sm:col-span-3"><button type="submit" className={adminButton}>Trocar plano</button></div>
          </form>
        </Card>
      ) : null}

      <Card title="Recursos deste negócio">
        <p className="mb-3 text-xs text-graphite/70">“Exceção” vale no lugar do plano, com motivo e validade opcional. Sem exceção, o negócio segue o plano.</p>
        <ul className="divide-y divide-nude">
          {(features ?? []).map((f) => {
            const p = pf.get(f.key);
            const o = ov.get(f.key);
            const expired = o?.expires_at ? new Date(o.expires_at).getTime() <= Date.now() : false;
            const active = o && !expired ? o : null;
            const effEnabled = active ? active.enabled : Boolean(p?.enabled);
            const effLimit = active ? active.limit_value : (p?.limit_value ?? null);
            return (
              <li key={f.key} className="py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-cocoa">{f.name}</p>
                    <p className="text-xs text-graphite/70">
                      Plano: {p?.enabled ? (f.kind === "limit" ? (p.limit_value === null ? "ilimitado" : `até ${p.limit_value}`) : "incluído") : "não incluído"}
                      {f.kind === "limit" ? ` · uso: ${used.get(f.key) ?? 0}${f.unit ? ` ${f.unit}` : ""}` : ""}
                    </p>
                    {o ? (
                      <p className="text-xs text-cocoa">
                        Exceção{expired ? " (vencida)" : ""}: {o.enabled ? (f.kind === "limit" ? (o.limit_value === null ? "ilimitado" : `até ${o.limit_value}`) : "liberado") : "bloqueado"}
                        {o.expires_at ? ` até ${new Date(o.expires_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""} · {o.reason}
                      </p>
                    ) : null}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${effEnabled ? "bg-nude text-cocoa" : "bg-graphite/10 text-graphite"}`}>
                    {effEnabled ? (f.kind === "limit" ? (effLimit === null ? "Ilimitado" : `Até ${effLimit}`) : "Ativo") : "Desligado"}
                  </span>
                </div>
                {canBilling ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-cocoa underline">{o ? "Alterar exceção" : "Criar exceção"}</summary>
                    <form action={setFeatureOverrideAction} className="mt-2 grid gap-2 sm:grid-cols-4">
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <input type="hidden" name="key" value={f.key} />
                      <label className="text-xs text-graphite/80">Situação
                        <select name="enabled" defaultValue={o ? (o.enabled ? "sim" : "nao") : "sim"} className={adminInput}>
                          <option value="sim">Liberar</option><option value="nao">Bloquear</option>
                        </select>
                      </label>
                      {f.kind === "limit" ? (
                        <label className="text-xs text-graphite/80">Limite (vazio = ilimitado)
                          <input name="limit" inputMode="numeric" defaultValue={o?.limit_value ?? ""} className={adminInput} />
                        </label>
                      ) : <input type="hidden" name="limit" value="" />}
                      <label className="text-xs text-graphite/80">Válida até (opcional)
                        <input name="expires" type="date" className={adminInput} />
                      </label>
                      <label className="text-xs text-graphite/80 sm:col-span-4">Motivo (obrigatório)
                        <input name="reason" required minLength={3} maxLength={300} className={adminInput} />
                      </label>
                      <div className="sm:col-span-4"><button type="submit" className={adminButtonGhost}>Salvar exceção</button></div>
                    </form>
                    {o ? (
                      <form action={clearFeatureOverrideAction} className="mt-2">
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <input type="hidden" name="key" value={f.key} />
                        <button type="submit" className={adminButtonGhost}>Remover exceção</button>
                      </form>
                    ) : null}
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {canSupport ? (
        <Card title="Histórico">
          {(logs ?? []).length === 0 ? <p className="text-sm text-graphite/80">Sem registros.</p> : (
            <ul className="space-y-2">
              {(logs ?? []).map((l) => (
                <li key={l.id} className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-cocoa">{auditLabel(l.action)}</span>
                  <time dateTime={l.created_at} className="text-graphite/70">{dt(l.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </main>
  );
}
