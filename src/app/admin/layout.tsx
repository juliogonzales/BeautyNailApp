import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";
import { ADMIN_SECTIONS, canAccess, ROLE_LABELS, type AdminSection } from "@/lib/admin-access";
import { getAdminContext } from "@/lib/admin";
import { getProductName } from "@/lib/product";

export const metadata: Metadata = { title: { default: "Console", template: "%s · Console" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user, role } = await getAdminContext();
  if (!user) redirect("/login?next=/admin");
  if (!role) notFound(); // quem não é admin não descobre que o console existe

  const productName = await getProductName();
  const sections = (Object.keys(ADMIN_SECTIONS) as AdminSection[]).filter((s) => canAccess(role, s));

  return (
    <div className="min-h-screen">
      <header className="border-b border-sand bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-gold">Console · {ROLE_LABELS[role]}</p>
            <p className="truncate font-serif text-lg text-cocoa">{productName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/painel" className="rounded-lg border border-sand px-3 py-2 text-sm text-cocoa hover:bg-nude">Meu painel</Link>
            <form action={signOutAction}>
              <button type="submit" className="rounded-lg border border-sand px-3 py-2 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa">Sair</button>
            </form>
          </div>
        </div>
        <nav aria-label="Console" className="mx-auto max-w-5xl overflow-x-auto px-4">
          <ul className="flex gap-1 whitespace-nowrap pb-2">
            {sections.map((s) => (
              <li key={s}>
                <Link href={ADMIN_SECTIONS[s].href} className="block rounded-lg px-3 py-1.5 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa">
                  {ADMIN_SECTIONS[s].label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
