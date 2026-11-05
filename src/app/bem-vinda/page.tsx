import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProductName } from "@/lib/product";
import { getSessionContext } from "@/lib/tenant";
import { getWelcomeContent } from "@/lib/welcome-content";

export const metadata: Metadata = { title: "Bem-vinda" };

export default async function WelcomePage() {
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/bem-vinda");
  if (membership) redirect("/painel");

  const name = await getProductName();
  const { benefits: BENEFITS, guarantees: GUARANTEES } = await getWelcomeContent(supabase);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm uppercase tracking-widest text-gold">Passo 1 de 3</p>
      <h1 className="mt-2 font-serif text-3xl text-cocoa">Bem-vinda ao {name}</h1>
      <p className="mt-2 text-graphite/80">
        A plataforma para você organizar o seu negócio de beleza e ter a sua própria marca digital. Veja o que você ganha:
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <li key={b.title} className="rounded-xl border border-sand bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium text-cocoa">{b.title}</h2>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${b.available ? "bg-cocoa text-paper" : "bg-nude text-cocoa"}`}
              >
                {b.available ? "Disponível" : "Em breve"}
              </span>
            </div>
            <p className="mt-1 text-sm text-graphite/80">{b.text}</p>
          </li>
        ))}
      </ul>

      <section className="mt-8 rounded-xl border border-sand bg-nude/50 p-5">
        <h2 className="text-sm uppercase tracking-widest text-gold">Por que usar</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {GUARANTEES.map((g) => (
            <li key={g} className="flex gap-2"><span aria-hidden="true" className="text-gold">✓</span><span>{g}</span></li>
          ))}
        </ul>
      </section>

      <Link
        href="/planos"
        className="mt-8 block rounded-lg bg-cocoa px-4 py-3 text-center font-medium text-paper hover:bg-cocoa/90 focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2"
      >
        Ver os planos
      </Link>
    </main>
  );
}
