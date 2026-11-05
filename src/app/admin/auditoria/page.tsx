import type { Metadata } from "next";
import { PageTitle } from "@/components/admin-ui";
import { requireAdminPage } from "@/lib/admin";

export const metadata: Metadata = { title: "Auditoria" };

export default async function AuditAdminPage() {
  const { supabase } = await requireAdminPage("auditoria");
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("id, tenant_id, actor_id, action, entity_type, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main>
      <PageTitle sub="Últimos 100 registros. A trilha é só de leitura: ninguém edita nem apaga.">Auditoria</PageTitle>
      {error ? <p role="alert" className="text-sm text-red-900">Não foi possível carregar a auditoria.</p> : null}
      <ul className="space-y-2">
        {(logs ?? []).map((l) => (
          <li key={l.id} className="rounded-lg border border-sand bg-white p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium text-cocoa">{l.action}</span>
              <time dateTime={l.created_at} className="text-graphite/70">
                {new Date(l.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </time>
            </div>
            <p className="break-all text-xs text-graphite/70">
              {l.entity_type ?? "—"} · autor {l.actor_id ? String(l.actor_id).slice(0, 8) : "sistema"}
              {l.tenant_id ? ` · negócio ${String(l.tenant_id).slice(0, 8)}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
