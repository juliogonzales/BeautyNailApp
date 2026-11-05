import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { instagramUrl, publicTenantSchema, safeHexColor, whatsappContactLink, type PublicTenant } from "@/lib/public-page";
import { slugSchema } from "@/lib/validation";

type Props = { params: Promise<{ slug: string }> };

/** Página pública do negócio. O banco só devolve campos seguros (RPC get_public_tenant) e só de negócios ativos. */
const loadTenant = cache(async (rawSlug: string): Promise<PublicTenant | null> => {
  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_tenant", { p_slug: parsed.data });
  if (error || !data) return null;
  const result = publicTenantSchema.safeParse(data);
  return result.success ? result.data : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tenant = await loadTenant((await params).slug);
  if (!tenant) return { title: "Página não encontrada" };
  return {
    title: tenant.business_name,
    description: tenant.specialties.length > 0 ? tenant.specialties.join(" · ") : `Página de ${tenant.business_name}`,
  };
}

export default async function PublicTenantPage({ params }: Props) {
  const tenant = await loadTenant((await params).slug);
  if (!tenant) notFound();

  const accent = safeHexColor(tenant.primary_color, "#5b4636");
  const whatsapp = whatsappContactLink(tenant.whatsapp, `Olá! Vim pela página do ${tenant.business_name}.`);
  const instagram = instagramUrl(tenant.instagram);
  const place = [tenant.neighborhood, tenant.city && tenant.state ? `${tenant.city}/${tenant.state}` : tenant.city ?? tenant.state]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-12">
      <header className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full font-serif text-3xl text-paper"
          style={{ backgroundColor: accent }}
        >
          {tenant.business_name.trim().charAt(0).toUpperCase()}
        </div>
        <h1 className="mt-4 font-serif text-3xl text-cocoa">{tenant.business_name}</h1>
        {place ? <p className="mt-1 text-sm text-graphite/70">{place}</p> : null}
        {tenant.address_line ? <p className="text-sm text-graphite/70">{tenant.address_line}</p> : null}
      </header>

      {tenant.specialties.length > 0 ? (
        <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Especialidades">
          {tenant.specialties.map((s) => (
            <li key={s} className="rounded-full border border-sand bg-white px-3 py-1 text-sm text-cocoa">
              {s}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-8 space-y-3">
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg px-4 py-3 text-center font-medium text-paper focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ backgroundColor: accent }}
          >
            Falar no WhatsApp
          </a>
        ) : null}
        {instagram ? (
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-sand bg-white px-4 py-3 text-center font-medium text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa"
          >
            Ver o Instagram
          </a>
        ) : null}
        {!whatsapp && !instagram ? (
          <p className="rounded-lg border border-sand bg-nude/60 px-4 py-3 text-center text-sm text-cocoa">
            Os contatos desta página serão publicados em breve.
          </p>
        ) : null}
      </div>

      <p className="mt-6 text-center text-xs text-graphite/60">O agendamento online chega em breve.</p>
    </main>
  );
}
