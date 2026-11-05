import { Field, adminInput } from "@/components/admin-ui";

type PlanDefaults = {
  slug: string; name: string; description: string; priceMonthly: string; priceYearly: string;
  trialDays: number; sortOrder: number; isPublic: boolean; isActive: boolean;
};

export const EMPTY_PLAN: PlanDefaults = {
  slug: "", name: "", description: "", priceMonthly: "0,00", priceYearly: "0,00",
  trialDays: 0, sortOrder: 0, isPublic: true, isActive: true,
};

export function PlanFields({ d }: { d: PlanDefaults }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nome"><input name="name" required defaultValue={d.name} className={adminInput} /></Field>
      <Field label="Slug" hint="Identificador interno, ex.: gel. Não use espaços."><input name="slug" required defaultValue={d.slug} className={adminInput} /></Field>
      <div className="sm:col-span-2"><Field label="Descrição"><input name="description" defaultValue={d.description} className={adminInput} /></Field></div>
      <Field label="Preço mensal (R$)"><input name="priceMonthlyCents" inputMode="decimal" defaultValue={d.priceMonthly} className={adminInput} /></Field>
      <Field label="Preço anual (R$)"><input name="priceYearlyCents" inputMode="decimal" defaultValue={d.priceYearly} className={adminInput} /></Field>
      <Field label="Dias de teste"><input name="trialDays" inputMode="numeric" defaultValue={d.trialDays} className={adminInput} /></Field>
      <Field label="Ordem na lista"><input name="sortOrder" inputMode="numeric" defaultValue={d.sortOrder} className={adminInput} /></Field>
      <label className="flex items-center gap-2 text-sm text-cocoa"><input type="checkbox" name="isPublic" defaultChecked={d.isPublic} className="h-4 w-4" /> Aparece na página de planos</label>
      <label className="flex items-center gap-2 text-sm text-cocoa"><input type="checkbox" name="isActive" defaultChecked={d.isActive} className="h-4 w-4" /> Ativo</label>
    </div>
  );
}
