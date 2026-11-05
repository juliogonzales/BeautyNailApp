"use client";

import { useActionState } from "react";
import { savePublicProfileAction } from "@/app/painel/perfil/actions";
import { FieldError, FormAlert, inputClass, SubmitButton } from "@/components/form-bits";

type Props = { defaults: { whatsapp: string; instagram: string; city: string; state: string } };

export function PublicProfileForm({ defaults }: Props) {
  const [state, action] = useActionState(savePublicProfileAction, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <div>
        <label htmlFor="whatsapp" className="text-sm font-medium text-cocoa">WhatsApp</label>
        <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" defaultValue={defaults.whatsapp}
          placeholder="(11) 91234-5678" className={inputClass} aria-describedby="whatsapp-help" />
        <p id="whatsapp-help" className="mt-1 text-xs text-graphite/70">Com DDD. Vira um botão “Falar no WhatsApp” na sua página.</p>
        <FieldError messages={state?.fieldErrors?.whatsapp} />
      </div>
      <div>
        <label htmlFor="instagram" className="text-sm font-medium text-cocoa">Instagram</label>
        <input id="instagram" name="instagram" type="text" autoCapitalize="none" autoCorrect="off" defaultValue={defaults.instagram}
          placeholder="@seuperfil" className={inputClass} />
        <FieldError messages={state?.fieldErrors?.instagram} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label htmlFor="city" className="text-sm font-medium text-cocoa">Cidade</label>
          <input id="city" name="city" type="text" autoComplete="address-level2" defaultValue={defaults.city} className={inputClass} />
          <FieldError messages={state?.fieldErrors?.city} />
        </div>
        <div>
          <label htmlFor="state" className="text-sm font-medium text-cocoa">UF</label>
          <input id="state" name="state" type="text" maxLength={2} autoCapitalize="characters" defaultValue={defaults.state}
            placeholder="SP" className={inputClass} />
          <FieldError messages={state?.fieldErrors?.state} />
        </div>
      </div>
      <p className="text-xs text-graphite/70">Seu endereço residencial não aparece na página.</p>
      <SubmitButton pendingLabel="Salvando…">Salvar perfil</SubmitButton>
    </form>
  );
}
