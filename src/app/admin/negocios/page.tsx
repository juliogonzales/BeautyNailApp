import type { Metadata } from "next";
import Link from "next/link";
import { setTenantStatusAction } from "@/app/admin/actions";
import { adminButtonGhost, adminInput, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { requireAdminPage } from "@/lib/admin";
import { sanitizeSearch } from "@/lib/admin-validation";

export const metadata: Metadata = { title: "Negócios" };

const PAGE_SIZE = 20;
const STATUS: Record<string, string> = { active: "Ativo", suspended: "Suspenso", deleted: "Excluído" };
type SearchParams = FlashParams & { q?: string; status?: string; plano?: string; pagina?: string };

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function TenantsAdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { supabase, role } = await requireAdminPage("negocios");
  const canManage = role === "superadmin" || role === "support";

  const q = sanitizeSearch(one(params.q));
  const status = ["active", "suspended"].includes(one(params.status)) ? one(params.status) : "";
  const planId = /^[0-9a-f-]{36}$/.test(one(params.plano)) ? one(params.plano) : "";
  const page = Math.max(1, Math.min(1000, Number.parseInt(one(params.pagina), 10) || 1));

  const { data: plans } = await supabase.from("plans").select("id, name").order("sort_order");

  let query = supabase
    .from("tenants")
    .select("id, slug, business_name, status, created_at, subscriptions!inner(plan_id, status, plans(name))", { count: "exact" })
    .neq("subscriptions.status", "canceled")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`business_name.ilike.%${q}%,slug.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  if (planId) query = query.eq("subscriptions.plan_id", planId);
  const { data: tenants, error, count } = await query;

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (over: Record<string, string>) => {
    const sp = new URLSearchParams();
    const base = { q, status, plano: planId, pagina: String(page), ...over };
    for (const [k, v] of Object.entries(base)) if (v && !(k === "pagina" && v === "1")) sp.set(k, v);
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  return (
    <main className="space-y-4">
      <PageTitle sub="Só dados cadastrais e plano. Fichas de saúde e dados das clientes nunca aparecem aqui.">Negócios</PageTitle>
      <Flash params={params} />

      <form method="get" className="grid gap-2 rounded-xl border border-sand bg-white p-3 sm:grid-cols-5">
        <label className="text-xs text-graphite/80 sm:col-span-2">Buscar por nome ou endereço
          <input name="q" defaultValue={q} maxLength={60} className={adminInput} />
        </label>
        <label className="text-xs text-graphite/80">Status
          <select name="status" defaultValue={status} className={adminInput}>
            <option value="">Todos</option><option value="active">Ativos</option><option value="suspended">Suspensos</option>
          </select>
        </label>
        <label className="text-xs text-graphite/80">Plano
          <select name="plano" defaultValue={planId} className={adminInput}>
            <option value="">Todos</option>
            {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={adminButtonGhost}>Filtrar</button>
          <Link href={`/admin/negocios/export${qs({ pagina: "" })}`} className={adminButtonGhost} prefetch={false}>Exportar CSV</Link>
        </div>
      </form>

      <p className="text-sm text-graphite/80" role="status">{total} negócio(s){q || status || planId ? " com os filtros aplicados" : ""}.</p>
      {error ? <p role="alert" className="text-sm text-red-900">Não foi possível carregar os negócios.</p> : null}
      {(tenants ?? []).length === 0 && !error ? <p className="text-sm text-graphite/80">Nenhum negócio encontrado.</p> : null}

      <ul className="space-y-3">
        {(tenants ?? []).map((t) => {
          const sub = Array.isArray(t.subscriptions) ? t.subscriptions[0] : t.subscriptions;
          const plan = Array.isArray(sub?.plans) ? sub?.plans[0] : sub?.plans;
          return (
            <li key={t.id} className="rounded-xl border border-sand bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/admin/negocios/${t.id}`} className="block truncate font-medium text-cocoa underline">{t.business_name}</Link>
                  <p className="text-sm text-graphite/80">/{t.slug} · Plano {(plan?.name as string | undefined) ?? "—"} · desde {new Date(t.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
                </div>
                <span className="rounded-full bg-nude px-2 py-0.5 text-xs text-cocoa">{STATUS[t.status] ?? t.status}</span>
              </div>
              {canManage && t.status !== "deleted" ? (
                <form action={setTenantStatusAction} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="tenantId" value={t.id} />
                  <input type="hidden" name="status" value={t.status === "active" ? "suspended" : "active"} />
                  {t.status === "active" ? (
                    <label className="flex-1 text-xs text-graphite/80">Motivo (obrigatório)
                      <input name="reason" required minLength={3} maxLength={300} className={adminInput} />
                    </label>
                  ) : <input type="hidden" name="reason" value="reativação" />}
                  <button type="submit" className={adminButtonGhost}>{t.status === "active" ? "Suspender" : "Reativar"}</button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>

      {pages > 1 ? (
        <nav aria-label="Paginação" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/admin/negocios${qs({ pagina: String(page - 1) })}`} className={adminButtonGhost}>← Anterior</Link> : <span />}
          <span className="text-graphite/80">Página {page} de {pages}</span>
          {page < pages ? <Link href={`/admin/negocios${qs({ pagina: String(page + 1) })}`} className={adminButtonGhost}>Próxima →</Link> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
