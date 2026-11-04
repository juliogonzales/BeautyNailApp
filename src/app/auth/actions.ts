"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";
import { friendlyAuthError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { safeNextPath } from "@/lib/routing";
import { loginSchema, signupSchema } from "@/lib/validation";
import type { FormState } from "@/lib/form-state";

const TOO_MANY = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!rateLimit(`login:${await clientIp()}`, 10, 10 * 60_000).ok) return { error: TOO_MANY };

  const parsed = loginSchema.safeParse({ email: text(formData, "email"), password: text(formData, "password") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: friendlyAuthError(error.message) };

  redirect(safeNextPath(text(formData, "next")));
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000).ok) return { error: TOO_MANY };

  const parsed = signupSchema.safeParse({
    fullName: text(formData, "fullName"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { NEXT_PUBLIC_SITE_URL } = getPublicEnv();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { error: friendlyAuthError(error.message) };

  // Com confirmação de e-mail ligada não há sessão ainda.
  if (!data.session) {
    return { message: "Enviamos um link de confirmação para o seu e-mail. Abra-o para continuar." };
  }
  redirect("/onboarding");
}

export async function googleAction(): Promise<void> {
  if (!rateLimit(`google:${await clientIp()}`, 20, 10 * 60_000).ok) redirect("/login?error=limit");

  const supabase = await createClient();
  const { NEXT_PUBLIC_SITE_URL } = getPublicEnv();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/painel` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
