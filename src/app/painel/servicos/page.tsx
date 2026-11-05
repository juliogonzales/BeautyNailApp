import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceAction, deleteServiceAction, updateServiceAction } from "@/app/painel/servicos/actions";
import { Flash, type FlashParams } from "@/components/admin-ui";
import { EMPTY_SERVICE, ServiceFields } from "@/components/service-fields";
import { formatBRL } from "@/lib/money";
import { checkLimit, getFeatureState } from "@/lib/plan-limits";
import { centsToInput, formatDuration } from "@/lib/services";
import { getSessionContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Serviços" };

const btn = "rounded-lg bg-cocoa px-4 py-2.5 text-sm font-medium text-paper hover:bg-cocoa/90 focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2";
const btnGhost = "rounded-lg border border-sand bg-white px-3 py-2 text-sm font-medium text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const flash = await searchParams;
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/painel/servicos");
  if (!membership) redirect("/bem-vinda");

  const [state, { data: services, error }] = await Promise.all([
    getFeatureState(supabase, membership.tenant.id, "services"),
    supabase
      .from("services")
      .select("id, name, description, category, price_cents, cost_cents, duration_minutes, is_active, show_on_page")
      .eq("tenant_id", membership.tenant.id)
      .order("sort_order")
      .order("name"),
  ]);
  const list = services ?? [];
  const canManage = membership.role === "owner" || membership.role === "admin";
  const canAdd = checkLimit({ ...state, used: list.length }).allowed;
  const categories = [...new Set(list.map((s) => s.category).filter((c): c is string => Boolean(c)))];

  return (
    <main className="space-y-6">
      <Link href="/painel" className="text-sm text-cocoa underline">← Voltar ao painel</Link>
      <header>
        <h1 className="font-serif text-3xl text-cocoa">Serviços</h1>
        <p className="mt-2 text-graphite/80">
          O que você oferece, com preço e duração. Os marcados aparecem na sua página.{" "}
          {state.enabled ? `Você usa ${list.length} de ${state.limitValue ?? "ilimitados"}.` : ""}
        </p>
        <p className="mt-1 text-sm text-graphite/70">Não sabe quanto cobrar? Use a <Link href="/painel/calculadora" className="text-cocoa underline">calculadora de preços</Link>.</p>
      </header>

      <Flash params={flash} />
      {error ? <p role="alert" className="text-sm text-red-900">Não foi possível carregar seus serviços. Recarregue a página.</p> : null}
      {!state.enabled ? (
        <p className="rounded-xl border border-sand bg-nude/60 p-4 text-sm text-cocoa">O catálogo de serviços não está incluído no seu plano. <Link href="/planos" className="underline">Ver planos</Link></p>
      ) : null}

      {list.length === 0 && state.enabled && !error ? (
        <p className="rounded-xl border border-sand bg-white p-5 text-sm text-graphite/80">Você ainda não cadastrou nenhum serviço. Adicione o primeiro abaixo.</p>
      ) : null}

      <ul className="space-y-3">
        {list.map((s) => (
          <li key={s.id} className="rounded-xl border border-sand bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-cocoa">{s.name}</p>
                <p className="text-sm text-graphite/80">{formatBRL(s.price_cents)} · {formatDuration(s.duration_minutes)}{s.category ? ` · ${s.category}` : ""}</p>
              </div>
              <span className="rounded-full bg-nude px-2 py-0.5 text-xs text-cocoa">{!s.is_active ? "Inativo" : s.show_on_page ? "Na página" : "Oculto"}</span>
            </div>
            {canManage ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-cocoa underline">Editar</summary>
                <form action={updateServiceAction} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={s.id} />
                  <ServiceFields
                    idPrefix={`s-${s.id}`}
                    categories={categories}
                    d={{
                      name: s.name, description: s.description ?? "", category: s.category ?? "", price: centsToInput(s.price_cents),
                      cost: s.cost_cents ? centsToInput(s.cost_cents) : "", duration: String(s.duration_minutes), isActive: s.is_active, showOnPage: s.show_on_page,
                    }}
                  />
                  <button type="submit" className={btn}>Salvar</button>
                </form>
                <form action={deleteServiceAction} className="mt-2">
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className={btnGhost}>Remover serviço</button>
                </form>
              </details>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage && state.enabled ? (
        <section className="rounded-xl border border-sand bg-white p-5">
          <h2 className="text-sm uppercase tracking-widest text-gold">Novo serviço</h2>
          {canAdd ? (
            <form action={createServiceAction} className="mt-3 space-y-3">
              <ServiceFields idPrefix="new" categories={categories} d={EMPTY_SERVICE} />
              <button type="submit" className={btn}>Adicionar serviço</button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-graphite/80">Você chegou ao limite do seu plano. <Link href="/planos" className="text-cocoa underline">Ver planos</Link></p>
          )}
        </section>
      ) : null}
    </main>
  );
}
