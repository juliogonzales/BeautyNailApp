import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { ShareLinkCard } from "@/components/share-link-card";
import { getPublicEnv } from "@/lib/env";
import { publicUrl, whatsappShareLink } from "@/lib/public-page";
import { formatBRL } from "@/lib/money";
import { checkLimit, describeFeature, getFeatureState } from "@/lib/plan-limits";
import { getSessionContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Painel" };

type FeatureRow = {
  key: string;
  name: string;
  kind: "flag" | "limit";
  unit: string | null;
  sortOrder: number;
  enabled: boolean;
  limitValue: number | null;
};

const STATUS_LABELS: Record<string, string> = {
  free: "Gratuito",
  trialing: "Período de teste",
  active: "Ativo",
  past_due: "Pagamento pendente",
  canceled: "Cancelado",
};

// Atalhos do painel. `href` só existe para o que já está pronto; o resto aparece como "Em breve".
const SHORTCUTS: Array<{ title: string; text: string; href?: string }> = [
  { title: "Calculadora de preços", text: "Descubra quanto cobrar por serviço.", href: "/painel/calculadora" },
  { title: "Clientes", text: "Ficha e histórico de cada cliente." },
  { title: "Agenda", text: "Seus horários e atendimentos." },
  { title: "Serviços", text: "Cadastre o que você oferece, com preço e duração.", href: "/painel/servicos" },
  { title: "Montar minha página", text: "Escolha os blocos, edite os textos e veja como fica.", href: "/painel/pagina" },
  { title: "Aparência da página", text: "Modelo e cores da sua página pública.", href: "/painel/aparencia" },
  { title: "Perfil público", text: "WhatsApp, Instagram e cidade que aparecem na sua página.", href: "/painel/perfil" },
];

export default async function PainelPage() {
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/painel");
  if (!membership) redirect("/bem-vinda");
  const { tenant } = membership;

  const dashboard = await getFeatureState(supabase, tenant.id, "dashboard");
  const calculator = await getFeatureState(supabase, tenant.id, "pricing_calculator");
  const canSeeDashboard = checkLimit(dashboard).allowed;
  const canUseCalculator = checkLimit(calculator).allowed;

  if (!canSeeDashboard) {
    return (
      <main>
        <h1 className="font-serif text-3xl text-cocoa">Painel</h1>
        <p className="mt-2 text-graphite/80">
          O painel não está incluído no seu plano atual. <Link href="/planos" className="font-medium text-cocoa underline">Ver planos</Link>
        </p>
      </main>
    );
  }

  // Colunas explícitas: ids do provedor de pagamento não são legíveis pelo cliente (grant por coluna).
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, status, trial_ends_at, plans(name, description, price_monthly_cents)")
    .eq("tenant_id", tenant.id)
    .neq("status", "canceled")
    .maybeSingle();

  const plan = Array.isArray(sub?.plans) ? sub?.plans[0] : sub?.plans;

  let features: FeatureRow[] = [];
  if (sub?.plan_id) {
    const { data: rows } = await supabase
      .from("plan_features")
      .select("enabled, limit_value, features(key, name, kind, unit, sort_order)")
      .eq("plan_id", sub.plan_id);

    features = (rows ?? [])
      .map((r) => {
        const f = Array.isArray(r.features) ? r.features[0] : r.features;
        if (!f) return null;
        return {
          key: f.key as string,
          name: f.name as string,
          kind: f.kind as "flag" | "limit",
          unit: (f.unit as string | null) ?? null,
          sortOrder: Number(f.sort_order ?? 0),
          enabled: Boolean(r.enabled),
          limitValue: (r.limit_value as number | null) ?? null,
        } satisfies FeatureRow;
      })
      .filter((f): f is FeatureRow => f !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const siteUrl = getPublicEnv().NEXT_PUBLIC_SITE_URL;
  const url = publicUrl(siteUrl, tenant.slug);
  const displayUrl = `${new URL(siteUrl).host}/${tenant.slug}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("whatsapp, instagram")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  const hasContact = Boolean(settings?.whatsapp || settings?.instagram);
  const steps: Array<{ label: string; done: boolean; href?: string }> = [
    { label: "Criar o seu negócio", done: true },
    { label: "Publicar um contato na sua página (WhatsApp ou Instagram)", done: hasContact, href: "/painel/perfil" },
    { label: "Calcular o preço dos seus serviços", done: false, href: canUseCalculator ? "/painel/calculadora" : undefined },
  ];
  const included = features.filter((f) => f.enabled);
  const notIncluded = features.filter((f) => !f.enabled);

  return (
    <main className="space-y-8">
      <section>
        <h1 className="font-serif text-3xl text-cocoa">Olá! O {tenant.businessName} está criado.</h1>
        <p className="mt-2 text-graphite/80">Sua página já está no ar. Divulgue o link abaixo.</p>
      </section>

      <ShareLinkCard
        url={url}
        displayUrl={displayUrl}
        whatsappShareHref={whatsappShareLink(url, tenant.businessName)}
        qrSvg={qrSvg}
        businessName={tenant.businessName}
      />

      <section className="rounded-xl border border-sand bg-white p-5">
        <h2 className="text-sm uppercase tracking-widest text-gold">Primeiros passos</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {steps.map((st) => (
            <li key={st.label} className="flex items-start gap-2">
              <span aria-hidden="true" className={st.done ? "text-gold" : "text-graphite/40"}>{st.done ? "✓" : "○"}</span>
              <span className={st.done ? "text-graphite/70 line-through" : ""}>
                {st.href && !st.done ? <Link href={st.href} className="font-medium text-cocoa underline">{st.label}</Link> : st.label}
              </span>
              <span className="sr-only">{st.done ? "(feito)" : "(pendente)"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-widest text-gold">Atalhos</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {SHORTCUTS.map((s) => {
            const active = Boolean(s.href) && (s.href !== "/painel/calculadora" || canUseCalculator);
            return (
              <li key={s.title} className="rounded-xl border border-sand bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-cocoa">{s.title}</h3>
                  {!active ? <span className="shrink-0 rounded-full bg-nude px-2 py-0.5 text-xs text-cocoa">Em breve</span> : null}
                </div>
                <p className="mt-1 text-sm text-graphite/80">{s.text}</p>
                {active && s.href ? (
                  <Link href={s.href} className="mt-3 inline-block text-sm font-medium text-cocoa underline">
                    Abrir
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-sand bg-white p-5">
        <h2 className="text-sm uppercase tracking-widest text-gold">Seu plano</h2>
        {plan ? (
          <div className="mt-2">
            <p className="font-serif text-2xl text-cocoa">{plan.name}</p>
            <p className="text-sm text-graphite/80">{plan.description}</p>
            <p className="mt-2 text-sm">
              {plan.price_monthly_cents === 0 ? "Gratuito" : `${formatBRL(plan.price_monthly_cents)}/mês`}
              {" · "}
              {STATUS_LABELS[sub?.status ?? ""] ?? sub?.status}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-graphite/80">Não encontramos uma assinatura ativa para este negócio.</p>
        )}
      </section>

      {features.length > 0 ? (
        <section className="rounded-xl border border-sand bg-white p-5">
          <h2 className="text-sm uppercase tracking-widest text-gold">O que está incluído</h2>
          <ul className="mt-3 divide-y divide-nude">
            {included.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{f.name}</span>
                <span className="font-medium text-cocoa">{describeFeature(f)}</span>
              </li>
            ))}
          </ul>
          {notIncluded.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-cocoa underline">
                Ver o que não está no seu plano ({notIncluded.length})
              </summary>
              <ul className="mt-2 divide-y divide-nude">
                {notIncluded.map((f) => (
                  <li key={f.key} className="flex items-center justify-between gap-3 py-2 text-sm text-graphite/70">
                    <span>{f.name}</span>
                    <span>{describeFeature(f)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
