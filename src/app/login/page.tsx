import type { Metadata } from "next";
import { googleAction } from "@/app/auth/actions";
import { LoginForm } from "@/components/auth-forms";
import { safeNextPath } from "@/lib/routing";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  callback: "Não foi possível confirmar o link. Abra-o no mesmo navegador em que fez o cadastro ou entre com e-mail e senha.",
  google: "O login com Google não está disponível no momento.",
  limit: "Muitas tentativas. Aguarde alguns minutos.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const errorText = error ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-serif text-3xl text-cocoa">Entrar</h1>
      <p className="mt-2 text-graphite/80">Acesse o painel do seu negócio.</p>

      {errorText ? (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {errorText}
        </p>
      ) : null}

      <div className="mt-6">
        <LoginForm next={next ? safeNextPath(next) : undefined} />
      </div>

      <div className="my-6 flex items-center gap-3 text-sm text-graphite/60">
        <span className="h-px flex-1 bg-sand" />
        ou
        <span className="h-px flex-1 bg-sand" />
      </div>

      <form action={googleAction}>
        <button
          type="submit"
          className="w-full rounded-lg border border-sand bg-white px-4 py-3 font-medium text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2"
        >
          Continuar com Google
        </button>
      </form>
    </main>
  );
}
