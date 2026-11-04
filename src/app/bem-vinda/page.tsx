import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProductName } from "@/lib/product";
import { getSessionContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Bem-vinda" };

type Benefit = { title: string; text: string; available: boolean };

// Só prometemos o que existe. O que ainda não foi construído aparece como "Em breve".
const BENEFITS: Benefit[] = [
  { title: "Painel do seu negócio", text: "Seu espaço com atalhos e o resumo do seu plano, desde o primeiro dia.", available: true },
  { title: "Calculadora de preços", text: "Calcule quanto cobrar por serviço considerando material, tempo, custos fixos, taxa da maquininha e lucro.", available: true },
  { title: "Serviços e clientes", text: "Cadastro de serviços com preço e duração, e ficha de cada cliente.", available: false },
  { title: "Agenda", text: "Horários, encaixes e histórico de atendimentos em um só lugar.", available: false },
  { title: "Página pública com a sua marca", text: "Um endereço só seu para divulgar serviços e portfólio e receber agendamentos.", available: false },
  { title: "Anamnese digital", text: "Ficha de saúde da cliente guardada com acesso mínimo e protegida (LGPD).", available: false },
  { title: "Financeiro e estoque", text: "Entradas, saídas, fluxo de caixa e controle de materiais.", available: false },
];

const GUARANTEES = [
  "Comece grátis, sem cartão de crédito.",
  "Cada negócio é isolado: ninguém vê os dados de outra profissional.",
  "Dados de saúde das clientes ficam separados, e nem a nossa equipe os acessa.",
  "Feito para usar no celular.",
  "Cresce com você: você muda de plano quando precisar.",
];

export default async function WelcomePage() {
  const { user, membership } = await getSessionContext();
  if (!user) redirect("/login?next=/bem-vinda");
  if (membership) redirect("/painel");

  const name = await getProductName();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm uppercase tracking-widest text-gold">Passo 1 de 3</p>
      <h1 className="mt-2 font-serif text-3xl text-cocoa">Bem-vinda ao {name}</h1>
      <p className="mt-2 text-graphite/80">
        A plataforma para você organizar o seu negócio de beleza e ter a sua própria marca digital. Veja o que você ganha:
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <li key={b.title} className="rounded-xl border border-sand bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium text-cocoa">{b.title}</h2>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${b.available ? "bg-cocoa text-paper" : "bg-nude text-cocoa"}`}
              >
                {b.available ? "Disponível" : "Em breve"}
              </span>
            </div>
            <p className="mt-1 text-sm text-graphite/80">{b.text}</p>
          </li>
        ))}
      </ul>

      <section className="mt-8 rounded-xl border border-sand bg-nude/50 p-5">
        <h2 className="text-sm uppercase tracking-widest text-gold">Por que usar</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {GUARANTEES.map((g) => (
            <li key={g} className="flex gap-2"><span aria-hidden="true" className="text-gold">✓</span><span>{g}</span></li>
          ))}
        </ul>
      </section>

      <Link
        href="/planos"
        className="mt-8 block rounded-lg bg-cocoa px-4 py-3 text-center font-medium text-paper hover:bg-cocoa/90 focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2"
      >
        Ver os planos
      </Link>
    </main>
  );
}
