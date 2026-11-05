import type { ReactNode } from "react";

export const adminInput =
  "mt-1 block w-full rounded-lg border border-sand bg-white px-3 py-2 text-base text-graphite focus:outline-none focus:ring-2 focus:ring-cocoa";
export const adminButton =
  "rounded-lg bg-cocoa px-4 py-2.5 text-sm font-medium text-paper hover:bg-cocoa/90 focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2";
export const adminButtonGhost =
  "rounded-lg border border-sand bg-white px-3 py-2 text-sm font-medium text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa";

export type FlashParams = { ok?: string | string[]; erro?: string | string[] };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Aviso de sucesso/erro vindo da URL (ações do console redirecionam com ?ok= ou ?erro=). */
export function Flash({ params }: { params: FlashParams }) {
  const erro = one(params.erro);
  const ok = one(params.ok);
  if (erro) {
    return (
      <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
        {erro.slice(0, 300)}
      </p>
    );
  }
  if (ok) {
    return (
      <p role="status" className="mb-4 rounded-lg border border-sand bg-nude px-3 py-2 text-sm text-cocoa">
        {ok.slice(0, 300)}
      </p>
    );
  }
  return null;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-cocoa">
      {label}
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-graphite/70">{hint}</span> : null}
    </label>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-sand bg-white p-5">
      {title ? <h2 className="mb-3 text-sm uppercase tracking-widest text-gold">{title}</h2> : null}
      {children}
    </section>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-serif text-3xl text-cocoa">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-graphite/80">{sub}</p> : null}
    </div>
  );
}
