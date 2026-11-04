import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";
import { getProductName } from "@/lib/product";
import { getSessionContext } from "@/lib/tenant";

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const { user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/painel");
  if (!membership) redirect("/bem-vinda");

  const productName = await getProductName();

  return (
    <div className="min-h-screen">
      <header className="border-b border-sand bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-gold">{productName}</p>
            <p className="truncate font-serif text-lg text-cocoa">{membership.tenant.businessName}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-sand px-3 py-2 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa"
            >
              Sair
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
    </div>
  );
}
