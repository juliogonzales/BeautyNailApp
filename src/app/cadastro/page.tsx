import type { Metadata } from "next";
import { SignupForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-serif text-3xl text-cocoa">Criar conta</h1>
      <p className="mt-2 text-graphite/80">Comece grátis no plano Esmalte. Sem cartão.</p>
      <div className="mt-6">
        <SignupForm />
      </div>
    </main>
  );
}
