import { Field, adminInput } from "@/components/admin-ui";
import { FALLBACK_THEME, THEME_FONTS, THEME_LAYOUTS, THEME_RADIUS, type ThemeConfig } from "@/lib/theme";

type Meta = { slug: string; name: string; description: string; sortOrder: number; isActive: boolean };

export const EMPTY_TEMPLATE_META: Meta = { slug: "", name: "", description: "", sortOrder: 100, isActive: true };

const COLOR_FIELDS = [
  ["background", "Fundo"], ["surface", "Cartão"], ["text", "Texto"], ["muted", "Texto secundário"], ["primary", "Cor principal"], ["accent", "Destaque"],
] as const;

function Select<T extends string>({ name, label, options, value }: { name: string; label: string; options: Record<T, string>; value: T }) {
  return (
    <Field label={label}>
      <select name={name} defaultValue={value} className={adminInput}>
        {(Object.keys(options) as T[]).map((k) => (
          <option key={k} value={k}>{options[k]}</option>
        ))}
      </select>
    </Field>
  );
}

export function TemplateFields({ meta, theme = FALLBACK_THEME }: { meta: Meta; theme?: ThemeConfig }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome"><input name="name" required defaultValue={meta.name} className={adminInput} /></Field>
        <Field label="Slug" hint="Identificador interno, ex.: nude-classico."><input name="slug" required defaultValue={meta.slug} className={adminInput} /></Field>
        <div className="sm:col-span-2"><Field label="Descrição"><input name="description" defaultValue={meta.description} className={adminInput} /></Field></div>
        <Select name="layout" label="Layout" options={THEME_LAYOUTS} value={theme.layout} />
        <Select name="font" label="Fonte" options={THEME_FONTS} value={theme.font} />
        <Select name="radius" label="Cantos" options={THEME_RADIUS} value={theme.radius} />
        <Select name="avatar" label="Avatar" options={{ initial: "Inicial do nome", none: "Sem avatar" }} value={theme.avatar} />
        <Field label="Ordem"><input name="sortOrder" inputMode="numeric" defaultValue={meta.sortOrder} className={adminInput} /></Field>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-cocoa">Cores</legend>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOR_FIELDS.map(([key, label]) => (
            <label key={key} className="block text-sm text-cocoa">
              {label}
              <input type="color" name={`c_${key}`} defaultValue={theme.colors[key]} className="mt-1 block h-11 w-full cursor-pointer rounded-lg border border-sand bg-white p-1" />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-graphite/70">O texto do botão é escolhido automaticamente (claro ou escuro). Texto sobre fundo e cartão precisa de contraste mínimo de 4,5:1.</p>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-cocoa">Blocos visíveis</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-cocoa">
          {([["s_specialties", "Especialidades", theme.show.specialties], ["s_whatsapp", "Botão WhatsApp", theme.show.whatsapp],
             ["s_instagram", "Botão Instagram", theme.show.instagram], ["s_location", "Localização", theme.show.location]] as const).map(([name, label, on]) => (
            <label key={name} className="flex items-center gap-2"><input type="checkbox" name={name} defaultChecked={on} className="h-4 w-4" /> {label}</label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-cocoa"><input type="checkbox" name="isActive" defaultChecked={meta.isActive} className="h-4 w-4" /> Ativo (aparece para as profissionais)</label>
    </div>
  );
}
