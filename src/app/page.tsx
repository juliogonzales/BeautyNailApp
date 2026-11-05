import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFreePlanName } from "@/lib/free-plan";
import { getProductName } from "@/lib/product";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/painel");

  const [name, freeName] = await Promise.all([getProductName(), getFreePlanName(supabase)]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <p className="text-sm uppercase tracking-widest text-gold">{name}</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-cocoa">
        O seu negócio de beleza, organizado e com a sua marca.
      </h1>
      <p className="mt-4 text-base text-graphite/80">
        Agenda, clientes e página pública em um só lugar. {freeName ? `Comece grátis no plano ${freeName}.` : "Comece grátis."}
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/cadastro"
          className="rounded-lg bg-cocoa px-4 py-3 text-center font-medium text-paper hover:bg-cocoa/90 focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2"
        >
          Criar minha conta
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-sand px-4 py-3 text-center font-medium text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2"
        >
          Já tenho conta
        </Link>
      </div>
    </main>
  );
}
