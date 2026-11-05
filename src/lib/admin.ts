import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { canAccess, type AdminSection, type PlatformRole } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";

/** Sessão + papel de administrador da plataforma (RLS: cada admin só enxerga a própria linha). */
export const getAdminContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null as PlatformRole | null };
  const { data } = await supabase.from("platform_admins").select("role").eq("user_id", user.id).maybeSingle();
  return { supabase, user, role: (data?.role ?? null) as PlatformRole | null };
});

/** Para páginas: sem login → login; sem papel → 404 (não revela que o console existe). */
export async function requireAdminPage(section: AdminSection) {
  const ctx = await getAdminContext();
  if (!ctx.user) redirect("/login?next=/admin");
  if (!ctx.role || !canAccess(ctx.role, section)) notFound();
  return { ...ctx, user: ctx.user, role: ctx.role };
}
