import { BlocksPage } from "@/components/public-blocks";
import { formatBRL } from "@/lib/money";
import { parseBlocks } from "@/lib/page-blocks";
import { instagramUrl, whatsappContactLink, type PublicTenant } from "@/lib/public-page";
import { formatDuration, groupByCategory } from "@/lib/services";
import { FONT_STACKS, RADIUS_PX, readableOn, type ThemeConfig } from "@/lib/theme";

/** Aparência da página pública a partir de um modelo. Usada na página real e na pré-visualização do console. */
export function PublicPageView({ tenant, theme }: { tenant: PublicTenant; theme: ThemeConfig }) {
  const customBlocks = parseBlocks(tenant.blocks);
  if (customBlocks) return <BlocksPage tenant={tenant} theme={theme} blocks={customBlocks} />;
  const c = theme.colors;
  const r = RADIUS_PX[theme.radius];
  const whatsapp = theme.show.whatsapp ? whatsappContactLink(tenant.whatsapp, `Olá! Vim pela página do ${tenant.business_name}.`) : null;
  const instagram = theme.show.instagram ? instagramUrl(tenant.instagram) : null;
  const place = theme.show.location
    ? [tenant.neighborhood, tenant.city && tenant.state ? `${tenant.city}/${tenant.state}` : tenant.city ?? tenant.state].filter(Boolean).join(" · ")
    : "";
  const address = theme.show.location ? tenant.address_line : null;
  const left = theme.layout === "left";
  const align = left ? "text-left" : "text-center";
  const card = theme.layout === "card";

  return (
    <main style={{ backgroundColor: c.background, color: c.text, fontFamily: FONT_STACKS[theme.font] }} className="min-h-screen">
      <div className="mx-auto flex max-w-md flex-col px-4 py-12">
        <div
          className={card ? "p-6" : ""}
          style={card ? { backgroundColor: c.surface, borderRadius: r.box, border: `1px solid ${c.accent}55` } : undefined}
        >
          <header className={align}>
            {theme.avatar === "initial" ? (
              <div
                aria-hidden="true"
                className={`flex h-20 w-20 items-center justify-center text-3xl ${left ? "" : "mx-auto"}`}
                style={{ backgroundColor: c.primary, color: readableOn(c.primary), borderRadius: theme.radius === "none" ? "0px" : "9999px" }}
              >
                {tenant.business_name.trim().charAt(0).toUpperCase()}
              </div>
            ) : null}
            <h1 className="mt-4 text-3xl">{tenant.business_name}</h1>
            {place ? <p className="mt-1 text-sm" style={{ color: c.muted }}>{place}</p> : null}
            {address ? <p className="text-sm" style={{ color: c.muted }}>{address}</p> : null}
          </header>

          {theme.show.specialties && tenant.specialties.length > 0 ? (
            <ul className={`mt-6 flex flex-wrap gap-2 ${left ? "" : "justify-center"}`} aria-label="Especialidades">
              {tenant.specialties.map((s) => (
                <li
                  key={s}
                  className="px-3 py-1 text-sm"
                  style={{ backgroundColor: card ? c.background : c.surface, border: `1px solid ${c.accent}`, borderRadius: r.chip, color: c.text }}
                >
                  {s}
                </li>
              ))}
            </ul>
          ) : null}

          {theme.show.services && tenant.services.length > 0 ? (
            <section aria-label="Serviços" className="mt-8 space-y-5">
              {groupByCategory(tenant.services).map((g) => (
                <div key={g.category}>
                  <h2 className="text-sm uppercase tracking-widest" style={{ color: c.accent }}>{g.category}</h2>
                  <ul className="mt-2 divide-y" style={{ borderColor: `${c.accent}55` }}>
                    {g.items.map((sv) => (
                      <li key={sv.name} className="flex items-start justify-between gap-3 py-3" style={{ borderColor: `${c.accent}55` }}>
                        <div className="min-w-0">
                          <p className="font-medium">{sv.name}</p>
                          {sv.description ? <p className="text-sm" style={{ color: c.muted }}>{sv.description}</p> : null}
                          <p className="text-xs" style={{ color: c.muted }}>{formatDuration(sv.duration_minutes)}</p>
                        </div>
                        <p className="shrink-0 font-medium">{formatBRL(sv.price_cents)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ) : null}

          <div className="mt-8 space-y-3">
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer"
                className="block px-4 py-3 text-center font-medium focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ backgroundColor: c.primary, color: readableOn(c.primary), borderRadius: r.button }}>
                Falar no WhatsApp
              </a>
            ) : null}
            {instagram ? (
              <a href={instagram} target="_blank" rel="noopener noreferrer"
                className="block px-4 py-3 text-center font-medium focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ backgroundColor: "transparent", color: c.text, border: `1px solid ${c.primary}`, borderRadius: r.button }}>
                Ver o Instagram
              </a>
            ) : null}
            {!whatsapp && !instagram ? (
              <p className="px-4 py-3 text-center text-sm" style={{ backgroundColor: c.surface, borderRadius: r.box, color: c.muted }}>
                Os contatos desta página serão publicados em breve.
              </p>
            ) : null}
          </div>
        </div>
        <p className="mt-6 text-center text-xs" style={{ color: c.muted }}>O agendamento online chega em breve.</p>
      </div>
    </main>
  );
}
