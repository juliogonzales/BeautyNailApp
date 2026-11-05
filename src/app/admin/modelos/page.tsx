import type { Metadata } from "next";
import Link from "next/link";
import { createTemplateAction } from "@/app/admin/actions";
import { EMPTY_TEMPLATE_META, TemplateFields } from "@/components/admin-template-fields";
import { adminButton, Card, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { requireAdminPage } from "@/lib/admin";
import { parseTheme } from "@/lib/theme";

export const metadata: Metadata = { title: "Modelos de página" };

export default async function TemplatesAdminPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const { supabase } = await requireAdminPage("modelos");
  const { data: templates, error } = await supabase
    .from("page_templates").select("id, name, slug, config, is_active, is_default").order("sort_order");

  return (
    <main className="space-y-6">
      <PageTitle sub="Visuais da página pública. Profissionais de planos com “Aparência da página” escolhem entre os modelos ativos.">Modelos de página</PageTitle>
      <Flash params={params} />
      {error ? <p role="alert" className="text-sm text-red-900">Não foi possível carregar os modelos.</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {(templates ?? []).map((t) => {
          const c = parseTheme(t.config).colors;
          return (
            <li key={t.id} className="rounded-xl border border-sand bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-serif text-xl text-cocoa">{t.name}</h2>
                <span className="rounded-full bg-nude px-2 py-0.5 text-xs text-cocoa">{t.is_default ? "Padrão" : t.is_active ? "Ativo" : "Inativo"}</span>
              </div>
              <p className="text-sm text-graphite/80">{t.slug}</p>
              <div className="mt-2 flex gap-1" aria-hidden="true">
                {[c.background, c.surface, c.primary, c.accent].map((col, i) => (
                  <span key={i} className="h-5 w-5 rounded-full border border-sand" style={{ backgroundColor: col }} />
                ))}
              </div>
              <Link href={`/admin/modelos/${t.id}`} className="mt-3 inline-block text-sm font-medium text-cocoa underline">Editar e pré-visualizar</Link>
            </li>
          );
        })}
      </ul>
      <Card title="Novo modelo">
        <form action={createTemplateAction} className="space-y-4">
          <TemplateFields meta={EMPTY_TEMPLATE_META} />
          <button type="submit" className={adminButton}>Criar modelo</button>
        </form>
      </Card>
    </main>
  );
}
