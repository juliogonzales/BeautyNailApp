import { NextResponse } from "next/server";
import { canAccess } from "@/lib/admin-access";
import { getAdminContext } from "@/lib/admin";
import { csvCell, sanitizeSearch } from "@/lib/admin-validation";
import { rateLimit } from "@/lib/rate-limit";

const MAX_ROWS = 5000;

/** Exporta a lista de negócios (nome, endereço, status, plano, data). Sem e-mail, telefone ou dado de cliente. */
export async function GET(request: Request) {
  const { supabase, user, role } = await getAdminContext();
  if (!user) return new NextResponse("Não autenticado", { status: 401 });
  if (!role || !canAccess(role, "negocios")) return new NextResponse("Não encontrado", { status: 404 });
  if (!rateLimit(`export:${user.id}`, 10, 10 * 60_000).ok) return new NextResponse("Muitas exportações. Aguarde.", { status: 429 });

  const url = new URL(request.url);
  const q = sanitizeSearch(url.searchParams.get("q") ?? "");
  const status = url.searchParams.get("status") ?? "";
  const plano = url.searchParams.get("plano") ?? "";

  let query = supabase
    .from("tenants")
    .select("slug, business_name, status, created_at, subscriptions!inner(plan_id, status, plans(name))")
    .neq("subscriptions.status", "canceled")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (q) query = query.or(`business_name.ilike.%${q}%,slug.ilike.%${q}%`);
  if (["active", "suspended"].includes(status)) query = query.eq("status", status);
  if (/^[0-9a-f-]{36}$/.test(plano)) query = query.eq("subscriptions.plan_id", plano);
  const { data, error } = await query;
  if (error) return new NextResponse("Erro ao exportar", { status: 500 });

  const lines = [["Negócio", "Endereço", "Status", "Plano", "Criado em"].map(csvCell).join(",")];
  for (const t of data ?? []) {
    const sub = Array.isArray(t.subscriptions) ? t.subscriptions[0] : t.subscriptions;
    const plan = Array.isArray(sub?.plans) ? sub?.plans[0] : sub?.plans;
    lines.push(
      [t.business_name, `/${t.slug}`, t.status, (plan?.name as string | undefined) ?? "", new Date(t.created_at).toISOString().slice(0, 10)]
        .map(csvCell).join(","),
    );
  }
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="negocios.csv"',
      "Cache-Control": "no-store",
    },
  });
}
