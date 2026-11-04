"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, signupAction } from "@/app/auth/actions";
import type { FormState } from "@/lib/form-state";
import { FieldError, FormAlert, SubmitButton, inputClass } from "@/components/form-bits";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormAlert error={state?.error} message={state?.message} />
      <div>
        <label htmlFor="email" className="text-sm font-medium text-cocoa">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        <FieldError messages={state?.fieldErrors?.email} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-cocoa">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
        <FieldError messages={state?.fieldErrors?.password} />
      </div>
      <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
      <p className="text-center text-sm text-graphite/80">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-cocoa underline">Criar conta</Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(signupAction, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <div>
        <label htmlFor="fullName" className="text-sm font-medium text-cocoa">Seu nome</label>
        <input id="fullName" name="fullName" type="text" autoComplete="name" required className={inputClass} />
        <FieldError messages={state?.fieldErrors?.fullName} />
      </div>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-cocoa">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        <FieldError messages={state?.fieldErrors?.email} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-cocoa">Senha (mínimo 8 caracteres)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
        <FieldError messages={state?.fieldErrors?.password} />
      </div>
      <SubmitButton pendingLabel="Criando…">Criar conta</SubmitButton>
      <p className="text-center text-xs text-graphite/70">
        Ao criar a conta você concorda com os termos de uso e a política de privacidade (textos em revisão jurídica).
      </p>
      <p className="text-center text-sm text-graphite/80">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-cocoa underline">Entrar</Link>
      </p>
    </form>
  );
}
