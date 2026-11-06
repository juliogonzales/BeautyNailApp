import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PricingCalculator, type CalculatorPreset } from "@/components/pricing-calculator";
import { checkLimit, getFeatureState } from "@/lib/plan-limits";
import { DEFAULT_PROFILE_FORM, fromRow } from "@/lib/pricing-profile";
import { getSessionContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Calculadora de preços" };

type MaterialRow = { name?: unknown; unit?: unknown };
type ServiceRow = { name?: unknown; minutes?: unknown };

export default async function CalculatorPage() {
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/painel/calculadora");
  if (!membership) redirect("/bem-vinda");

  // A liberação vem do plano (tabela plan_features), nunca fixa no código.
  const state = await getFeatureState(supabase, membership.tenant.id, "pricing_calculator");
  const allowed = checkLimit(state).allowed;

  let content: React.ReactNode;
  if (!allowed) {
    content = (
      <p className="rounded-xl border border-sand bg-white p-5 text-sm text-graphite/80">
        A calculadora não está incluída no seu plano atual. <Link href="/planos" className="font-medium text-cocoa underline">Ver planos</Link>
      </p>
    );
  } else {
    const [{ data: presetRows, error }, { data: profileRow }, { data: mySpecialties }] = await Promise.all([
      supabase.from("calculator_presets").select("slug, name, description, materials, services, use_commission").eq("is_active", true).order("sort_order"),
      supabase.from("pricing_profiles").select("*").eq("tenant_id", membership.tenant.id).maybeSingle(),
      supabase.from("tenant_specialties").select("specialties(calculator_preset, sort_order)").eq("tenant_id", membership.tenant.id),
    ]);

    const presets: CalculatorPreset[] = (presetRows ?? []).map((p) => ({
      slug: p.slug as string,
      name: p.name as string,
      description: (p.description as string | null) ?? null,
      useCommission: Boolean(p.use_commission),
      materials: (Array.isArray(p.materials) ? (p.materials as MaterialRow[]) : [])
        .filter((m) => typeof m.name === "string")
        .map((m) => ({ name: m.name as string, unit: typeof m.unit === "string" ? m.unit : "un" })),
      services: (Array.isArray(p.services) ? (p.services as ServiceRow[]) : [])
        .filter((s) => typeof s.name === "string" && typeof s.minutes === "number")
        .map((s) => ({ name: s.name as string, minutes: s.minutes as number })),
    }));

    // Segmento inicial: o salvo no perfil, senão o da primeira especialidade do negócio.
    const fromSpecialty = (mySpecialties ?? [])
      .map((r) => (Array.isArray(r.specialties) ? r.specialties[0] : r.specialties) as { calculator_preset: string | null; sort_order: number } | null)
      .filter((s): s is { calculator_preset: string; sort_order: number } => Boolean(s?.calculator_preset))
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.calculator_preset;
    const initial = profileRow ? fromRow(profileRow) : { ...DEFAULT_PROFILE_FORM, presetSlug: fromSpecialty ?? "" };
    if (!initial.presetSlug && fromSpecialty) initial.presetSlug = fromSpecialty;

    content = error || presets.length === 0 ? (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">Não foi possível carregar os segmentos. Recarregue a página.</p>
    ) : (
      <PricingCalculator presets={presets} initialProfile={initial} hasSavedProfile={Boolean(profileRow)} canSave />
    );
  }

  return (
    <main className="space-y-6">
      <Link href="/painel" className="text-sm text-cocoa underline">← Voltar ao painel</Link>
      <header>
        <h1 className="font-serif text-3xl text-cocoa">Calculadora de preços</h1>
        <p className="mt-2 text-graphite/80">
          Responda 4 perguntas sobre o seu negócio (uma vez só), toque nos serviços que você faz e veja quanto cobrar, quanto sobra de
          verdade e se o seu mês fecha. Os dados do negócio ficam salvos; os cálculos de cada serviço, por enquanto, não.
        </p>
      </header>
      {content}
    </main>
  );
}
