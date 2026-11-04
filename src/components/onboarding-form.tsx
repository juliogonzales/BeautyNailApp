"use client";

import { useActionState, useState, useTransition } from "react";
import { checkSlugAction, createBusinessAction, type SlugStatus } from "@/app/onboarding/actions";
import type { FormState } from "@/lib/form-state";
import { slugify } from "@/lib/validation";
import { FieldError, FormAlert, SubmitButton, inputClass } from "@/components/form-bits";

type Specialty = { id: string; name: string };
type UiSlugStatus = SlugStatus | "idle" | "checking";

const SLUG_MESSAGES: Record<UiSlugStatus, string> = {
  idle: "",
  checking: "Verificando…",
  ok: "Endereço disponível.",
  taken: "Endereço indisponível ou reservado.",
  invalid: "Use de 3 a 40 letras minúsculas, números e hífen.",
  limited: "Muitas verificações. Aguarde um instante.",
  error: "Não foi possível verificar agora.",
};

export function OnboardingForm({ specialties, baseHost }: { specialties: Specialty[]; baseHost: string }) {
  const [state, action] = useActionState<FormState, FormData>(createBusinessAction, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<UiSlugStatus>("idle");
  const [selected, setSelected] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  function verify(value: string) {
    if (!value) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    startTransition(async () => {
      const result = await checkSlugAction(value);
      setSlugStatus(result.status);
    });
  }

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
      setSlugStatus("idle");
    }
  }

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  const slugOk = slugStatus === "ok";

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormAlert error={state?.error} message={state?.message} />

      <div>
        <label htmlFor="businessName" className="text-sm font-medium text-cocoa">Nome do seu negócio</label>
        <input
          id="businessName"
          name="businessName"
          type="text"
          required
          maxLength={80}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onBlur={() => slug && slugStatus === "idle" && verify(slug)}
          className={inputClass}
          placeholder="Ex.: Joy Vega Nails"
        />
        <FieldError messages={state?.fieldErrors?.businessName} />
      </div>

      <div>
        <label htmlFor="slug" className="text-sm font-medium text-cocoa">Endereço da sua página</label>
        <div className="mt-1 flex items-center rounded-lg border border-sand bg-white focus-within:ring-2 focus-within:ring-cocoa">
          <span className="pl-3 text-sm text-graphite/60">{baseHost}/</span>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            maxLength={40}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
              setSlugStatus("idle");
            }}
            onBlur={() => verify(slug)}
            className="w-full rounded-lg bg-transparent px-1 py-2.5 text-base text-graphite focus:outline-none"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <p aria-live="polite" className={`mt-1 text-sm ${slugOk ? "text-green-800" : "text-graphite/70"}`}>
          {SLUG_MESSAGES[slugStatus]}
        </p>
        <FieldError messages={state?.fieldErrors?.slug} />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-cocoa">O que você faz? (pode marcar várias)</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {specialties.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-lg border border-sand bg-white px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                name="specialtyIds"
                value={s.id}
                checked={selected.includes(s.id)}
                onChange={() => toggle(s.id)}
                className="h-4 w-4 accent-cocoa"
              />
              {s.name}
            </label>
          ))}
        </div>
        <FieldError messages={state?.fieldErrors?.specialtyIds} />
      </fieldset>

      <SubmitButton pendingLabel="Criando seu negócio…">Criar meu negócio</SubmitButton>
    </form>
  );
}
