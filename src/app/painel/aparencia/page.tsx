import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppearanceForm, type TemplateOption } from "@/components/appearance-form";
import { getFeatureState } from "@/lib/plan-limits";
import { getSessionContext } from "@/lib/tenant";
import { parseTheme } from "@/lib/theme";

export const metadata: Metadata = { title: "Aparência da página" };

export default async function AparenciaPage() {
  const { supabase, user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/painel/aparencia");
  if (!membership) redirect("/bem-vinda");

  const feature = await getFeatureState(supabase, membership.tenant.id, "custom_theme");
  const [{ data: templates }, { data: settings }] = await Promise.all([
    supabase.from("page_templates").select("id, name, description, config, is_default").eq("is_active", true).order("sort_order"),
    supabase.from("tenant_settings").select("template_id, primary_color, accent_color").eq("tenant_id", membership.tenant.id).maybeSingle(),
  ]);

  const options: TemplateOption[] = (templates ?? []).map((t) => {
    const c = parseTheme(t.config).colors;
    return { id: t.id, name: t.name, description: t.description, colors: [c.background, c.primary, c.accent], isDefault: Boolean(t.is_default) };
  });

  return (
    <main className="max-w-lg">
      <Link href="/painel" className="text-sm text-cocoa underline">← Voltar ao painel</Link>
      <h1 className="mt-3 font-serif text-3xl text-cocoa">Aparência da página</h1>
      <p className="mt-2 text-graphite/80">Escolha o visual de <span className="font-medium">/{membership.tenant.slug}</span>.</p>

      {!feature.enabled ? (
        <div className="mt-6 rounded-xl border border-sand bg-nude/60 p-4 text-sm text-cocoa">
          <p className="font-medium">Disponível nos planos pagos.</p>
          <p className="mt-1">Seu plano atual usa o modelo padrão. Veja os planos para saber o que cada um inclui.</p>
          <Link href="/planos" className="mt-2 inline-block underline">Ver planos</Link>
        </div>
      ) : (
        <div className="mt-6">
          <AppearanceForm
            templates={options}
            selectedId={settings?.template_id ?? null}
            primary={settings?.primary_color ?? ""}
            accent={settings?.accent_color ?? ""}
          />
        </div>
      )}
    </main>
  );
}
