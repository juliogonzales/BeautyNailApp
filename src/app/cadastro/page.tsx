import type { Metadata } from "next";
import { SignupForm } from "@/components/auth-forms";
import { getFreePlanName } from "@/lib/free-plan";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage() {
  const freeName = await getFreePlanName(await createClient());
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-serif text-3xl text-cocoa">Criar conta</h1>
      <p className="mt-2 text-graphite/80">{freeName ? `Comece grátis no plano ${freeName}. Sem cartão.` : "Comece grátis. Sem cartão."}</p>
      <div className="mt-6">
        <SignupForm />
      </div>
    </main>
  );
}
