import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageTitle } from "@/components/admin-ui";
import { ADMIN_SECTIONS, canAccess, type AdminSection } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin";

export const metadata: Metadata = { title: "Visão geral" };

export default async function AdminHome() {
  const { supabase, role } = await requireAdminPage("visao");

  const count = async (status?: "active" | "suspended") => {
    let q = supabase.from("tenants").select("id", { count: "exact", head: true });
    if (status) q = q.eq("status", status);
    const { count: n } = await q;
    return n ?? 0;
  };
  const [total, active, suspended] = await Promise.all([count(), count("active"), count("suspended")]);
  const { count: plansCount } = await supabase.from("plans").select("id", { count: "exact", head: true });

  const stats = [
    { label: "Negócios", value: total },
    { label: "Ativos", value: active },
    { label: "Suspensos", value: suspended },
    { label: "Planos", value: plansCount ?? 0 },
  ];
  const shortcuts = (Object.keys(ADMIN_SECTIONS) as AdminSection[]).filter((s) => s !== "visao" && canAccess(role, s));

  return (
    <main>
      <PageTitle sub="Tudo que muda o produto sem precisar publicar código novo.">Visão geral</PageTitle>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label} className="rounded-xl border border-sand bg-white p-4">
            <p className="text-xs uppercase tracking-widest text-graphite/70">{s.label}</p>
            <p className="mt-1 font-serif text-3xl text-cocoa">{s.value}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Card title="Atalhos">
          <ul className="grid gap-2 sm:grid-cols-2">
            {shortcuts.map((s) => (
              <li key={s}>
                <Link href={ADMIN_SECTIONS[s].href} className="block rounded-lg border border-sand px-3 py-3 text-cocoa hover:bg-nude">
                  {ADMIN_SECTIONS[s].label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
