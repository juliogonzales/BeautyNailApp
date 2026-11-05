import type { Metadata } from "next";
import { setTenantStatusAction } from "@/app/admin/actions";
import { adminButtonGhost, adminInput, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { requireAdminPage } from "@/lib/admin";

export const metadata: Metadata = { title: "Negócios" };

const STATUS: Record<string, string> = { active: "Ativo", suspended: "Suspenso", deleted: "Excluído" };

export default async function TenantsAdminPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const { supabase, role } = await requireAdminPage("negocios");
  const canManage = role === "superadmin" || role === "support";

  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, slug, business_name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const ids = (tenants ?? []).map((t) => t.id);
  const { data: subs } = ids.length
    ? await supabase.from("subscriptions").select("tenant_id, status, plans(name)").in("tenant_id", ids).neq("status", "canceled")
    : { data: [] };
  const planOf = new Map(
    (subs ?? []).map((s) => {
      const p = Array.isArray(s.plans) ? s.plans[0] : s.plans;
      return [s.tenant_id as string, (p?.name as string | undefined) ?? "—"] as const;
    }),
  );

  return (
    <main>
      <PageTitle sub="Só dados cadastrais e plano. Fichas de saúde e dados das clientes nunca aparecem aqui.">Negócios</PageTitle>
      <Flash params={params} />
      {error ? <p role="alert" className="text-sm text-red-900">Não foi possível carregar os negócios.</p> : null}
      {(tenants ?? []).length === 0 && !error ? <p className="text-sm text-graphite/80">Nenhum negócio criado ainda.</p> : null}
      <ul className="space-y-3">
        {(tenants ?? []).map((t) => (
          <li key={t.id} className="rounded-xl border border-sand bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-cocoa">{t.business_name}</p>
                <p className="text-sm text-graphite/80">/{t.slug} · Plano {planOf.get(t.id) ?? "—"} · desde {new Date(t.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
              </div>
              <span className="rounded-full bg-nude px-2 py-0.5 text-xs text-cocoa">{STATUS[t.status] ?? t.status}</span>
            </div>
            {canManage && t.status !== "deleted" ? (
              <form action={setTenantStatusAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="tenantId" value={t.id} />
                <input type="hidden" name="status" value={t.status === "active" ? "suspended" : "active"} />
                {t.status === "active" ? (
                  <label className="flex-1 text-xs text-graphite/80">
                    Motivo (obrigatório)
                    <input name="reason" required minLength={3} maxLength={300} className={adminInput} />
                  </label>
                ) : (
                  <input type="hidden" name="reason" value="reativação" />
                )}
                <button type="submit" className={adminButtonGhost}>{t.status === "active" ? "Suspender" : "Reativar"}</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
