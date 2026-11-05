import type { Metadata } from "next";
import { createFeatureAction, updateFeatureAction } from "@/app/admin/actions";
import { adminButton, adminButtonGhost, adminInput, Card, Field, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { requireAdminPage } from "@/lib/admin";

export const metadata: Metadata = { title: "Recursos" };

export default async function FeaturesAdminPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const { supabase } = await requireAdminPage("recursos");
  const { data: features, error } = await supabase
    .from("features").select("key, name, description, kind, unit, sort_order").order("sort_order");

  return (
    <main className="space-y-6">
      <PageTitle sub="Catálogo do que um plano pode liberar. Um recurso novo entra desligado em todos os planos.">Recursos</PageTitle>
      <Flash params={params} />
      {error ? <p role="alert" className="text-sm text-red-900">Não foi possível carregar os recursos.</p> : null}

      <Card title="Catálogo">
        <ul className="divide-y divide-nude">
          {(features ?? []).map((f) => (
            <li key={f.key} className="py-3">
              <form action={updateFeatureAction} className="grid gap-2 sm:grid-cols-6">
                <input type="hidden" name="key" value={f.key} />
                <p className="text-xs text-graphite/70 sm:col-span-6">{f.key} · {f.kind === "limit" ? "limite" : "liga/desliga"}</p>
                <div className="sm:col-span-2"><Field label="Nome"><input name="name" required defaultValue={f.name} className={adminInput} /></Field></div>
                <div className="sm:col-span-2"><Field label="Descrição"><input name="description" defaultValue={f.description ?? ""} className={adminInput} /></Field></div>
                <Field label="Unidade"><input name="unit" defaultValue={f.unit ?? ""} className={adminInput} /></Field>
                <Field label="Ordem"><input name="sortOrder" inputMode="numeric" defaultValue={f.sort_order} className={adminInput} /></Field>
                <div className="sm:col-span-6"><button type="submit" className={adminButtonGhost}>Salvar</button></div>
              </form>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Novo recurso">
        <form action={createFeatureAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Chave" hint="Ex.: loyalty_program. É o nome que o código usa; depois de criada não muda.">
            <input name="key" required className={adminInput} />
          </Field>
          <Field label="Nome"><input name="name" required className={adminInput} /></Field>
          <Field label="Tipo">
            <select name="kind" className={adminInput} defaultValue="flag">
              <option value="flag">Liga/desliga</option>
              <option value="limit">Limite numérico</option>
            </select>
          </Field>
          <Field label="Unidade (só para limite)" hint="Ex.: clientes, serviços"><input name="unit" className={adminInput} /></Field>
          <div className="sm:col-span-2"><Field label="Descrição"><input name="description" className={adminInput} /></Field></div>
          <Field label="Ordem"><input name="sortOrder" inputMode="numeric" defaultValue={100} className={adminInput} /></Field>
          <div className="sm:col-span-2"><button type="submit" className={adminButton}>Criar recurso</button></div>
        </form>
        <p className="mt-3 text-xs text-graphite/70">Um recurso novo só passa a ter efeito quando o código do produto o consulta. Criar aqui prepara o catálogo e os planos.</p>
      </Card>
    </main>
  );
}
