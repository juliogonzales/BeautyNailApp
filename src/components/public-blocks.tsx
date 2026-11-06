import { formatBRL } from "@/lib/money";
import type { Block } from "@/lib/page-blocks";
import { instagramUrl, whatsappContactLink, type PublicTenant } from "@/lib/public-page";
import { formatDuration, groupByCategory } from "@/lib/services";
import { FONT_STACKS, RADIUS_PX, readableOn, type ThemeConfig } from "@/lib/theme";

type Props = { tenant: PublicTenant; theme: ThemeConfig; blocks: Block[]; preview?: boolean };

/** Página pública montada com os blocos da profissional. Só texto e links https; nada de HTML vindo do usuário. */
export function BlocksPage({ tenant, theme, blocks, preview = false }: Props) {
  const c = theme.colors;
  const r = RADIUS_PX[theme.radius];
  const left = theme.layout === "left";
  const align = left ? "text-left" : "text-center";
  const card = theme.layout === "card";
  const wa = whatsappContactLink(tenant.whatsapp, `Olá! Vim pela página do ${tenant.business_name}.`);
  const ig = instagramUrl(tenant.instagram);
  const place = [tenant.neighborhood, tenant.city && tenant.state ? `${tenant.city}/${tenant.state}` : tenant.city ?? tenant.state].filter(Boolean).join(" · ");

  const primaryBtn = { backgroundColor: c.primary, color: readableOn(c.primary), borderRadius: r.button } as const;
  const ghostBtn = { backgroundColor: "transparent", color: c.text, border: `1px solid ${c.primary}`, borderRadius: r.button } as const;
  const btnClass = "block px-4 py-3 text-center font-medium focus:outline-none focus:ring-2 focus:ring-offset-2";
  const Empty = ({ children }: { children: string }) => (
    <p className="rounded border border-dashed px-3 py-2 text-sm" style={{ borderColor: c.accent, color: c.muted }}>{children}</p>
  );

  function render(b: Block) {
    switch (b.type) {
      case "cover":
        return (
          <header className={align}>
            {theme.avatar === "initial" ? (
              <div aria-hidden="true" className={`flex h-20 w-20 items-center justify-center text-3xl ${left ? "" : "mx-auto"}`}
                style={{ backgroundColor: c.primary, color: readableOn(c.primary), borderRadius: theme.radius === "none" ? "0px" : "9999px" }}>
                {(b.title || tenant.business_name).trim().charAt(0).toUpperCase()}
              </div>
            ) : null}
            <h1 className="mt-4 text-3xl">{b.title || tenant.business_name}</h1>
            {b.subtitle ? <p className="mt-2" style={{ color: c.muted }}>{b.subtitle}</p> : null}
            {b.showLocation && place ? <p className="mt-1 text-sm" style={{ color: c.muted }}>{place}</p> : null}
            {b.showSpecialties && tenant.specialties.length > 0 ? (
              <ul className={`mt-4 flex flex-wrap gap-2 ${left ? "" : "justify-center"}`} aria-label="Especialidades">
                {tenant.specialties.map((s) => (
                  <li key={s} className="px-3 py-1 text-sm" style={{ backgroundColor: card ? c.background : c.surface, border: `1px solid ${c.accent}`, borderRadius: r.chip }}>{s}</li>
                ))}
              </ul>
            ) : null}
          </header>
        );
      case "text":
        if (!b.body) return preview ? <Empty>Bloco de texto: escreva o conteúdo para ele aparecer.</Empty> : null;
        return (
          <section aria-label={b.title || "Texto"}>
            {b.title ? <h2 className="text-sm uppercase tracking-widest" style={{ color: c.accent }}>{b.title}</h2> : null}
            <p className="mt-2 whitespace-pre-line">{b.body}</p>
          </section>
        );
      case "services":
        if (tenant.services.length === 0) return preview ? <Empty>Serviços: cadastre serviços em “Meus serviços” para eles aparecerem aqui.</Empty> : null;
        return (
          <section aria-label={b.title || "Serviços"} className="space-y-5">
            {b.title ? <h2 className="text-sm uppercase tracking-widest" style={{ color: c.accent }}>{b.title}</h2> : null}
            {groupByCategory(tenant.services).map((g) => (
              <div key={g.category}>
                {tenant.services.some((s) => s.category) ? <h3 className="text-xs uppercase tracking-widest" style={{ color: c.muted }}>{g.category}</h3> : null}
                <ul className="mt-1 divide-y" style={{ borderColor: `${c.accent}55` }}>
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
        );
      case "highlights": {
        const items = b.items.filter(Boolean);
        if (items.length === 0) return preview ? <Empty>Diferenciais: escreva ao menos um item.</Empty> : null;
        return (
          <section aria-label={b.title || "Diferenciais"}>
            {b.title ? <h2 className="text-sm uppercase tracking-widest" style={{ color: c.accent }}>{b.title}</h2> : null}
            <ul className="mt-2 space-y-2">
              {items.map((it, i) => (
                <li key={`${i}-${it}`} className="flex gap-2"><span aria-hidden="true" style={{ color: c.accent }}>✓</span><span>{it}</span></li>
              ))}
            </ul>
          </section>
        );
      }
      case "hours":
        if (!b.body) return preview ? <Empty>Horários: escreva os dias e horários.</Empty> : null;
        return (
          <section aria-label={b.title || "Horários"}>
            {b.title ? <h2 className="text-sm uppercase tracking-widest" style={{ color: c.accent }}>{b.title}</h2> : null}
            <p className="mt-2 whitespace-pre-line">{b.body}</p>
          </section>
        );
      case "faq": {
        const items = b.items.filter((i) => i.q && i.a);
        if (items.length === 0) return preview ? <Empty>Perguntas: preencha pergunta e resposta.</Empty> : null;
        return (
          <section aria-label={b.title || "Perguntas frequentes"}>
            {b.title ? <h2 className="text-sm uppercase tracking-widest" style={{ color: c.accent }}>{b.title}</h2> : null}
            <div className="mt-2 divide-y" style={{ borderColor: `${c.accent}55` }}>
              {items.map((it, i) => (
                <details key={`${i}-${it.q}`} className="py-3" style={{ borderColor: `${c.accent}55` }}>
                  <summary className="cursor-pointer font-medium">{it.q}</summary>
                  <p className="mt-2 whitespace-pre-line text-sm" style={{ color: c.muted }}>{it.a}</p>
                </details>
              ))}
            </div>
          </section>
        );
      }
      case "contact": {
        const address = b.showAddress ? tenant.address_line : null;
        const any = (b.showWhatsapp && wa) || (b.showInstagram && ig) || address;
        if (!any) return preview ? <Empty>Contato: preencha WhatsApp ou Instagram em “Perfil do negócio”.</Empty> : null;
        return (
          <section aria-label={b.title || "Contato"} className="space-y-3">
            {b.title ? <h2 className="text-sm uppercase tracking-widest" style={{ color: c.accent }}>{b.title}</h2> : null}
            {b.showWhatsapp && wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className={btnClass} style={primaryBtn}>Falar no WhatsApp</a> : null}
            {b.showInstagram && ig ? <a href={ig} target="_blank" rel="noopener noreferrer" className={btnClass} style={ghostBtn}>Ver o Instagram</a> : null}
            {address ? <p className="text-sm" style={{ color: c.muted }}>{address}</p> : null}
          </section>
        );
      }
      case "button": {
        const href = b.kind === "whatsapp" ? wa : b.kind === "instagram" ? ig : /^https:\/\//i.test(b.url) ? b.url : null;
        if (!b.label || !href) return preview ? <Empty>Botão: informe o texto e o destino.</Empty> : null;
        return <a href={href} target="_blank" rel="noopener noreferrer" className={btnClass} style={primaryBtn}>{b.label}</a>;
      }
    }
  }

  const visible = blocks.filter((b) => b.enabled);
  return (
    <main style={{ backgroundColor: c.background, color: c.text, fontFamily: FONT_STACKS[theme.font] }} className={preview ? "" : "min-h-screen"}>
      <div className="mx-auto flex max-w-md flex-col px-4 py-12">
        <div className={`space-y-8 ${card ? "p-6" : ""}`} style={card ? { backgroundColor: c.surface, borderRadius: r.box, border: `1px solid ${c.accent}55` } : undefined}>
          {visible.map((b) => {
            const node = render(b);
            return node ? <div key={b.id}>{node}</div> : null;
          })}
        </div>
        <p className="mt-6 text-center text-xs" style={{ color: c.muted }}>O agendamento online chega em breve.</p>
      </div>
    </main>
  );
}
