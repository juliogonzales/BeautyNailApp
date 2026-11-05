import { inputClass } from "@/components/form-bits";

export type ServiceDefaults = {
  name: string; description: string; category: string; price: string; cost: string; duration: string;
  isActive: boolean; showOnPage: boolean;
};

export const EMPTY_SERVICE: ServiceDefaults = {
  name: "", description: "", category: "", price: "", cost: "", duration: "60", isActive: true, showOnPage: true,
};

export function ServiceFields({ d, idPrefix, categories }: { d: ServiceDefaults; idPrefix: string; categories: string[] }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor={id("name")} className="text-sm font-medium text-cocoa">Nome do serviço</label>
        <input id={id("name")} name="name" required maxLength={80} defaultValue={d.name} placeholder="Ex.: Esmaltação em gel" className={inputClass} />
      </div>
      <div>
        <label htmlFor={id("price")} className="text-sm font-medium text-cocoa">Preço (R$)</label>
        <input id={id("price")} name="price" inputMode="decimal" required defaultValue={d.price} placeholder="80,00" className={inputClass} />
      </div>
      <div>
        <label htmlFor={id("duration")} className="text-sm font-medium text-cocoa">Duração (minutos)</label>
        <input id={id("duration")} name="duration" inputMode="numeric" required defaultValue={d.duration} placeholder="60" className={inputClass} />
      </div>
      <div>
        <label htmlFor={id("category")} className="text-sm font-medium text-cocoa">Categoria (opcional)</label>
        <input id={id("category")} name="category" list={id("cats")} maxLength={40} defaultValue={d.category} placeholder="Ex.: Mãos" className={inputClass} />
        <datalist id={id("cats")}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <div>
        <label htmlFor={id("cost")} className="text-sm font-medium text-cocoa">Custo de material (R$, opcional)</label>
        <input id={id("cost")} name="cost" inputMode="decimal" defaultValue={d.cost} placeholder="12,50" className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={id("desc")} className="text-sm font-medium text-cocoa">Descrição (opcional)</label>
        <textarea id={id("desc")} name="description" rows={2} maxLength={300} defaultValue={d.description} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-sm text-cocoa"><input type="checkbox" name="isActive" defaultChecked={d.isActive} className="h-4 w-4" /> Ativo</label>
      <label className="flex items-center gap-2 text-sm text-cocoa"><input type="checkbox" name="showOnPage" defaultChecked={d.showOnPage} className="h-4 w-4" /> Mostrar na minha página</label>
    </div>
  );
}
