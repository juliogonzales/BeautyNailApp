import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-serif text-3xl text-cocoa">Página não encontrada</h1>
      <p className="mt-2 text-graphite/80">Esse endereço não existe ou ainda não foi publicado.</p>
      <Link href="/" className="mt-6 inline-block text-cocoa underline">
        Ir para o início
      </Link>
    </main>
  );
}
