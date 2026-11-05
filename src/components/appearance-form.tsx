"use client";

import { useActionState } from "react";
import { saveAppearanceAction } from "@/app/painel/aparencia/actions";
import { FieldError, FormAlert, inputClass, SubmitButton } from "@/components/form-bits";

export type TemplateOption = { id: string; name: string; description: string | null; colors: string[]; isDefault: boolean };

type Props = { templates: TemplateOption[]; selectedId: string | null; primary: string; accent: string };

export function AppearanceForm({ templates, selectedId, primary, accent }: Props) {
  const [state, action] = useActionState(saveAppearanceAction, undefined);
  const current = selectedId ?? templates.find((t) => t.isDefault)?.id ?? "";
  return (
    <form action={action} className="space-y-6" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <fieldset>
        <legend className="text-sm font-medium text-cocoa">Modelo</legend>
        <ul className="mt-2 space-y-2">
          {templates.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-sand bg-white p-3 has-[:checked]:border-cocoa has-[:checked]:ring-1 has-[:checked]:ring-cocoa">
                <input type="radio" name="templateId" value={t.id} defaultChecked={t.id === current} className="mt-1 h-4 w-4" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-cocoa">{t.name}</span>
                  {t.description ? <span className="block text-sm text-graphite/80">{t.description}</span> : null}
                  <span className="mt-2 flex gap-1" aria-hidden="true">
                    {t.colors.map((col) => (
                      <span key={col} className="h-5 w-5 rounded-full border border-sand" style={{ backgroundColor: col }} />
                    ))}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-cocoa">Cores próprias (opcional)</legend>
        <p className="mt-1 text-xs text-graphite/70">Deixe em branco para usar as cores do modelo.</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="primary" className="text-sm text-cocoa">Cor principal</label>
            <input id="primary" name="primary" defaultValue={primary} placeholder="#5b4636" className={inputClass} autoCapitalize="none" />
            <FieldError messages={state?.fieldErrors?.primary} />
          </div>
          <div>
            <label htmlFor="accent" className="text-sm text-cocoa">Cor de destaque</label>
            <input id="accent" name="accent" defaultValue={accent} placeholder="#b8975a" className={inputClass} autoCapitalize="none" />
            <FieldError messages={state?.fieldErrors?.accent} />
          </div>
        </div>
      </fieldset>
      <SubmitButton pendingLabel="Salvando…">Salvar aparência</SubmitButton>
    </form>
  );
}
