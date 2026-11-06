import type { Metadata } from "next";
import { createCalculatorPresetAction, updateCalculatorPresetAction } from "@/app/admin/actions";
import { adminButton, adminButtonGhost, adminInput, Card, Field, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { requireAdminPage } from "@/lib/admin";
import { materialsToText } from "@/lib/admin-validation";

export const metadata: Metadata = { title: "Calculadoras" };

export default async function CalculatorsAdminPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const { supabase } = await requireAdminPage("calculadoras");
  const { data: items, error } = await supabase
    .from("calculator_presets").select("slug, name, description, materials, use_commission, is_active, sort_order").order("sort_order");

  return (
    <main className="space-y-6">
      <PageTitle sub="Um segmento por tipo de negócio. A lista de materiais é só um ponto de partida: a profissional informa os próprios preços e quantidades.">Calculadoras por segmento</PageTitle>
      <Flash params={params} />
      {error ? <p role="alert" className="text-sm text-red-900">Não foi possível carregar os segmentos.</p> : null}
      {(items ?? []).map((p) => (
        <Card key={p.slug} title={`${p.name} (${p.slug})`}>
          <form action={updateCalculatorPresetAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="slug" value={p.slug} />
            <Field label="Nome"><input name="name" required defaultValue={p.name} className={adminInput} /></Field>
            <Field label="Ordem"><input name="sortOrder" inputMode="numeric" defaultValue={p.sort_order} className={adminInput} /></Field>
            <div className="sm:col-span-2"><Field label="Descrição"><input name="description" defaultValue={p.description ?? ""} className={adminInput} /></Field></div>
            <div className="sm:col-span-2">
              <Field label="Materiais" hint='Uma linha por item: "Nome | unidade" (ex.: Shampoo | ml). Sem preços.'>
                <textarea name="materials" rows={6} defaultValue={materialsToText(p.materials)} className={adminInput} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-cocoa"><input type="checkbox" name="useCommission" defaultChecked={p.use_commission} className="h-4 w-4" /> Mostrar comissão (equipe)</label>
            <label className="flex items-center gap-2 text-sm text-cocoa"><input type="checkbox" name="isActive" defaultChecked={p.is_active} className="h-4 w-4" /> Ativo</label>
            <div className="sm:col-span-2"><button type="submit" className={adminButtonGhost}>Salvar</button></div>
          </form>
        </Card>
      ))}
      <Card title="Novo segmento">
        <form action={createCalculatorPresetAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome"><input name="name" required className={adminInput} /></Field>
          <Field label="Slug" hint="Ex.: tatuagem"><input name="slug" required className={adminInput} /></Field>
          <Field label="Ordem"><input name="sortOrder" inputMode="numeric" defaultValue={100} className={adminInput} /></Field>
          <Field label="Descrição"><input name="description" className={adminInput} /></Field>
          <div className="sm:col-span-2"><Field label="Materiais" hint='"Nome | unidade" por linha'><textarea name="materials" rows={4} className={adminInput} /></Field></div>
          <label className="flex items-center gap-2 text-sm text-cocoa"><input type="checkbox" name="useCommission" className="h-4 w-4" /> Mostrar comissão</label>
          <div className="sm:col-span-2"><button type="submit" className={adminButton}>Criar segmento</button></div>
        </form>
      </Card>
    </main>
  );
}
