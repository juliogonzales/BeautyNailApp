import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { setDefaultTemplateAction, updateTemplateAction } from "@/app/admin/actions";
import { TemplateFields } from "@/components/admin-template-fields";
import { adminButton, adminButtonGhost, Card, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { PublicPageView } from "@/components/public-page-view";
import { requireAdminPage } from "@/lib/admin";
import type { PublicTenant } from "@/lib/public-page";
import { parseTheme } from "@/lib/theme";

export const metadata: Metadata = { title: "Editar modelo" };

// Dados fictícios só para a pré-visualização; nunca vão para o banco nem para uma página real.
const SAMPLE: PublicTenant = {
  slug: "exemplo", business_name: "Studio Exemplo", city: "São Paulo", state: "SP", neighborhood: "Jardins", address_line: null,
  whatsapp: "11912345678", instagram: "studioexemplo", primary_color: null, accent_color: null,
  specialties: ["Nail design", "Manicure", "Sobrancelhas"],
};

export default async function EditTemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<FlashParams> }) {
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const flash = await searchParams;
  const { supabase } = await requireAdminPage("modelos");
  const { data: t } = await supabase.from("page_templates").select("*").eq("id", id.data).maybeSingle();
  if (!t) notFound();
  const theme = parseTheme(t.config);
  const { count: usage } = await supabase.from("tenant_settings").select("tenant_id", { count: "exact", head: true }).eq("template_id", t.id);

  return (
    <main className="space-y-6">
      <Link href="/admin/modelos" className="text-sm text-cocoa underline">← Modelos</Link>
      <PageTitle sub={`${usage ?? 0} negócio(s) escolheram este modelo.${t.is_default ? " É o modelo padrão." : ""}`}>{t.name}</PageTitle>
      <Flash params={flash} />

      <Card title="Configuração">
        <form action={updateTemplateAction} className="space-y-4">
          <input type="hidden" name="id" value={t.id} />
          <TemplateFields meta={{ slug: t.slug, name: t.name, description: t.description ?? "", sortOrder: t.sort_order, isActive: t.is_active }} theme={theme} />
          <button type="submit" className={adminButton}>Salvar modelo</button>
        </form>
        {!t.is_default && t.is_active ? (
          <form action={setDefaultTemplateAction} className="mt-3">
            <input type="hidden" name="id" value={t.id} />
            <button type="submit" className={adminButtonGhost}>Definir como padrão</button>
          </form>
        ) : null}
      </Card>

      <Card title="Pré-visualização (versão salva)">
        <div className="overflow-hidden rounded-xl border border-sand">
          <PublicPageView tenant={SAMPLE} theme={theme} />
        </div>
      </Card>
    </main>
  );
}
