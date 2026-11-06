import type { Metadata } from "next";
import { createSpecialtyAction, updateSpecialtyAction } from "@/app/admin/actions";
import { adminButton, adminButtonGhost, adminInput, Card, Field, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { requireAdminPage } from "@/lib/admin";

export const metadata: Metadata = { title: "Especialidades" };

export default async function SpecialtiesAdminPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const { supabase } = await requireAdminPage("especialidades");
  const { data: items, error } = await supabase
    .from("specialties").select("id, slug, name, is_active, sort_order, calculator_preset").order("sort_order");
  const { data: presets } = await supabase.from("calculator_presets").select("slug, name").order("sort_order");

  return (
    <main className="space-y-6">
      <PageTitle sub="As áreas que a profissional escolhe ao criar o negócio. Desative em vez de apagar.">Especialidades</PageTitle>
      <Flash params={params} />
      {error ? <p role="alert" className="text-sm text-red-900">Não foi possível carregar as especialidades.</p> : null}
      <Card title="Lista">
        <ul className="divide-y divide-nude">
          {(items ?? []).map((s) => (
            <li key={s.id} className="py-3">
              <form action={updateSpecialtyAction} className="grid items-end gap-2 sm:grid-cols-7">
                <input type="hidden" name="id" value={s.id} />
                <div className="sm:col-span-2"><Field label={`Nome (${s.slug})`}><input name="name" required defaultValue={s.name} className={adminInput} /></Field></div>
                <Field label="Calculadora">
                  <select name="calculatorPreset" defaultValue={s.calculator_preset ?? ""} className={adminInput}>
                    <option value="">Nenhuma</option>
                    {(presets ?? []).map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Ordem"><input name="sortOrder" inputMode="numeric" defaultValue={s.sort_order} className={adminInput} /></Field>
                <label className="flex items-center gap-2 pb-2 text-sm text-cocoa"><input type="checkbox" name="isActive" defaultChecked={s.is_active} className="h-4 w-4" /> Ativa</label>
                <button type="submit" className={adminButtonGhost}>Salvar</button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Nova especialidade">
        <form action={createSpecialtyAction} className="grid gap-3 sm:grid-cols-3">
          <Field label="Nome"><input name="name" required className={adminInput} /></Field>
          <Field label="Slug" hint="Ex.: nail-design"><input name="slug" required className={adminInput} /></Field>
          <Field label="Ordem"><input name="sortOrder" inputMode="numeric" defaultValue={100} className={adminInput} /></Field>
          <div className="sm:col-span-3"><button type="submit" className={adminButton}>Criar especialidade</button></div>
        </form>
      </Card>
    </main>
  );
}
