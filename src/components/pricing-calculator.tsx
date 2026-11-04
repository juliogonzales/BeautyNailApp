"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/money";
import { calculatePrice, parseBRLToCents, parsePercentToBp, parseWholeNumber } from "@/lib/pricing";
import { inputClass } from "@/components/form-bits";

type Fields = {
  material: string;
  minutes: string;
  hourly: string;
  fixed: string;
  perMonth: string;
  fee: string;
  margin: string;
};

const EMPTY: Fields = { material: "", minutes: "", hourly: "", fixed: "", perMonth: "", fee: "", margin: "" };

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  id: keyof Fields;
  label: string;
  hint: string;
  value: string;
  onChange: (id: keyof Fields, value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-cocoa">{label}</label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      <p className="mt-1 text-xs text-graphite/70">{hint}</p>
    </div>
  );
}

export function PricingCalculator() {
  const [f, setF] = useState<Fields>(EMPTY);
  const set = (id: keyof Fields, value: string) => setF((cur) => ({ ...cur, [id]: value }));

  // Campos vazios contam como zero; texto inválido bloqueia o cálculo.
  const orZero = <T,>(raw: string, parse: (s: string) => T | null): T | null | 0 => (raw.trim() === "" ? 0 : parse(raw));
  const material = orZero(f.material, parseBRLToCents);
  const hourly = orZero(f.hourly, parseBRLToCents);
  const fixed = orZero(f.fixed, parseBRLToCents);
  const minutes = orZero(f.minutes, parseWholeNumber);
  const perMonth = orZero(f.perMonth, parseWholeNumber);
  const fee = orZero(f.fee, parsePercentToBp);
  const margin = orZero(f.margin, parsePercentToBp);

  const anyInvalid = [material, hourly, fixed, minutes, perMonth, fee, margin].some((v) => v === null);
  const hasAnyInput = Object.values(f).some((v) => v.trim() !== "");

  const result =
    !anyInvalid && hasAnyInput
      ? calculatePrice({
          materialCostCents: material as number,
          durationMinutes: minutes as number,
          hourlyRateCents: hourly as number,
          monthlyFixedCostsCents: fixed as number,
          servicesPerMonth: perMonth as number,
          cardFeeBp: fee as number,
          marginBp: margin as number,
        })
      : null;

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()} noValidate>
        <Field id="material" label="Material gasto no atendimento (R$)" hint="Esmalte, gel, algodão, lixas, descartáveis…" value={f.material} onChange={set} placeholder="Ex.: 12,50" />
        <Field id="minutes" label="Tempo do atendimento (minutos)" hint="Do início ao fim, incluindo preparo." value={f.minutes} onChange={set} placeholder="Ex.: 90" />
        <Field id="hourly" label="Quanto você quer ganhar por hora (R$)" hint="O valor do seu trabalho, sem contar o lucro do negócio." value={f.hourly} onChange={set} placeholder="Ex.: 30" />
        <Field id="fixed" label="Custos fixos do mês (R$)" hint="Aluguel, energia, internet, produtos de uso geral." value={f.fixed} onChange={set} placeholder="Ex.: 800" />
        <Field id="perMonth" label="Atendimentos por mês" hint="Usamos para dividir os custos fixos entre eles." value={f.perMonth} onChange={set} placeholder="Ex.: 60" />
        <Field id="fee" label="Taxa da maquininha (%)" hint="Deixe em branco se não usa cartão." value={f.fee} onChange={set} placeholder="Ex.: 4,5" />
        <Field id="margin" label="Lucro que você quer (%)" hint="Percentual do preço final que deve sobrar como lucro." value={f.margin} onChange={set} placeholder="Ex.: 20" />
      </form>

      <section aria-live="polite" className="rounded-xl border border-sand bg-white p-5">
        <h2 className="text-sm uppercase tracking-widest text-gold">Resultado</h2>
        {anyInvalid ? (
          <p role="alert" className="mt-2 text-sm text-red-800">Confira os campos: use só números (vírgula para centavos).</p>
        ) : !result ? (
          <p className="mt-2 text-sm text-graphite/70">Preencha os campos acima para ver o preço sugerido.</p>
        ) : !result.ok ? (
          <p role="alert" className="mt-2 text-sm text-red-800">
            {result.error === "invalid_percent"
              ? "A taxa da maquininha somada ao lucro precisa ser menor que 100%."
              : "Confira os valores informados."}
          </p>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-graphite/80">Preço sugerido</p>
            <p className="font-serif text-4xl text-cocoa">{formatBRL(result.priceCents)}</p>
            <dl className="mt-4 divide-y divide-nude text-sm">
              <div className="flex justify-between py-2"><dt>Material</dt><dd>{formatBRL(material as number)}</dd></div>
              <div className="flex justify-between py-2"><dt>Seu trabalho (tempo × hora)</dt><dd>{formatBRL(result.laborCents)}</dd></div>
              <div className="flex justify-between py-2"><dt>Custos fixos por atendimento</dt><dd>{formatBRL(result.overheadCents)}</dd></div>
              <div className="flex justify-between py-2 font-medium"><dt>Custo total</dt><dd>{formatBRL(result.costCents)}</dd></div>
              <div className="flex justify-between py-2"><dt>Taxa da maquininha</dt><dd>{formatBRL(result.cardFeeCents)}</dd></div>
              <div className="flex justify-between py-2 font-medium text-cocoa"><dt>Lucro</dt><dd>{formatBRL(result.profitCents)}</dd></div>
            </dl>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => setF(EMPTY)}
        className="rounded-lg border border-sand px-3 py-2 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa"
      >
        Limpar
      </button>
    </div>
  );
}
