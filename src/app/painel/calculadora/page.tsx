import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PricingCalculator } from "@/components/pricing-calculator";
import { checkLimit, getFeatureState } from "@/lib/plan-limits";
import { getSessionContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Calculadora de preços" };

export default async function CalculatorPage() {
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/painel/calculadora");
  if (!membership) redirect("/bem-vinda");

  // A liberação vem do plano (tabela plan_features), nunca fixa no código.
  const state = await getFeatureState(supabase, membership.tenant.id, "pricing_calculator");
  const allowed = checkLimit(state).allowed;

  return (
    <main className="space-y-6">
      <Link href="/painel" className="text-sm text-cocoa underline">← Voltar ao painel</Link>
      <header>
        <h1 className="font-serif text-3xl text-cocoa">Calculadora de preços</h1>
        <p className="mt-2 text-graphite/80">
          Descubra quanto cobrar por um serviço sem sair no prejuízo: ela soma material, o seu tempo, os custos fixos e a taxa
          da maquininha, e garante o lucro que você escolheu. Nada é salvo; os números ficam só na sua tela.
        </p>
      </header>
      {allowed ? (
        <PricingCalculator />
      ) : (
        <p className="rounded-xl border border-sand bg-white p-5 text-sm text-graphite/80">
          A calculadora não está incluída no seu plano atual. <Link href="/planos" className="font-medium text-cocoa underline">Ver planos</Link>
        </p>
      )}
    </main>
  );
}
