"use client";

import { useActionState, useMemo, useState } from "react";
import { savePricingProfileAction } from "@/app/painel/calculadora/actions";
import { FormAlert, inputClass } from "@/components/form-bits";
import { formatBRL } from "@/lib/money";
import { parseBRLToCents, parseWholeNumber } from "@/lib/pricing";
import { profileFormSchema, toPricingProfile, type ProfileForm } from "@/lib/pricing-profile";
import {
  diagnosePrice, hourCostCents, materialLineCost, parseQuantityHundredths, priceService, type MaterialLine,
} from "@/lib/service-pricing";

export type CalculatorPreset = {
  slug: string;
  name: string;
  description: string | null;
  useCommission: boolean;
  materials: Array<{ name: string; unit: string }>;
};

type Line = { id: number; name: string; unit: string; price: string; size: string; used: string };

type Props = {
  presets: CalculatorPreset[];
  initialProfile: ProfileForm;
  hasSavedProfile: boolean;
  canSave: boolean;
};

let lineSeq = 0;
const newLine = (name = "", unit = "un"): Line => ({ id: ++lineSeq, name, unit, price: "", size: "", used: "" });
const linesFor = (p: CalculatorPreset | undefined): Line[] => (p ? p.materials.map((m) => newLine(m.name, m.unit)) : []);

function TextField(props: {
  id: string; name?: string; label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: "decimal" | "numeric" | "text";
}) {
  return (
    <div>
      <label htmlFor={props.id} className="text-sm font-medium text-cocoa">{props.label}</label>
      <input
        id={props.id} name={props.name} inputMode={props.inputMode ?? "decimal"} autoComplete="off" value={props.value}
        onChange={(e) => props.onChange(e.target.value)} placeholder={props.placeholder} className={inputClass}
        aria-describedby={props.hint ? `${props.id}-hint` : undefined}
      />
      {props.hint ? <p id={`${props.id}-hint`} className="mt-1 text-xs text-graphite/70">{props.hint}</p> : null}
    </div>
  );
}

const STATUS_TEXT = {
  loss: { tone: "text-red-800", text: "Com esse preço você tem prejuízo: nem o material e as taxas ficam cobertos." },
  no_pay: { tone: "text-red-800", text: "Esse preço cobre o material, mas não paga o seu tempo: você trabalha de graça ou tira do seu bolso." },
  below_goal: { tone: "text-amber-800", text: "Paga o seu tempo, mas o lucro fica abaixo da meta que você definiu." },
  ok: { tone: "text-green-800", text: "Esse preço atinge a sua meta de lucro." },
} as const;

export function PricingCalculator({ presets, initialProfile, hasSavedProfile, canSave }: Props) {
  const [profile, setProfile] = useState<ProfileForm>(initialProfile);
  const [editing, setEditing] = useState(!hasSavedProfile);
  const [saveState, saveAction] = useActionState(savePricingProfileAction, undefined);
  const setP = (k: keyof ProfileForm, v: string) => setProfile((cur) => ({ ...cur, [k]: v }));

  const [presetSlug, setPresetSlug] = useState(initialProfile.presetSlug || presets[0]?.slug || "");
  const preset = presets.find((p) => p.slug === presetSlug);
  const [lines, setLines] = useState<Line[]>(() => linesFor(preset));
  const [minutes, setMinutes] = useState("");
  const [extra, setExtra] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");

  const changePreset = (slug: string) => {
    const hasData = lines.some((l) => l.price || l.size || l.used);
    if (hasData && !window.confirm("Trocar de segmento substitui a lista de materiais. Continuar?")) return;
    setPresetSlug(slug);
    setLines(linesFor(presets.find((p) => p.slug === slug)));
  };
  const setLine = (id: number, k: keyof Line, v: string) => setLines((cur) => cur.map((l) => (l.id === id ? { ...l, [k]: v } : l)));

  const parsedProfile = useMemo(() => profileFormSchema.safeParse({ ...profile, presetSlug }), [profile, presetSlug]);
  const pricingProfile = parsedProfile.success ? toPricingProfile(parsedProfile.data) : null;
  const hour = pricingProfile ? hourCostCents(pricingProfile) : null;

  // Cada linha de material: vazia (ignorada), completa (conta) ou incompleta/ inválida (avisa).
  const lineStates = lines.map((l) => {
    const filled = [l.price, l.size, l.used].some((v) => v.trim() !== "");
    if (!filled) return { line: l, state: "empty" as const, cents: 0 };
    const price = parseBRLToCents(l.price);
    const size = parseQuantityHundredths(l.size);
    const used = parseQuantityHundredths(l.used);
    if (price === null || size === null || used === null) return { line: l, state: "invalid" as const, cents: 0 };
    const m: MaterialLine = { packagePriceCents: price, packageSizeHundredths: size, usedHundredths: used };
    return { line: l, state: "ok" as const, cents: materialLineCost(m) };
  });
  const materialsCents = lineStates.reduce((s, l) => s + l.cents, 0);
  const anyInvalidLine = lineStates.some((l) => l.state === "invalid");

  const mins = minutes.trim() === "" ? null : parseWholeNumber(minutes);
  const extraCents = extra.trim() === "" ? 0 : parseBRLToCents(extra);
  const current = currentPrice.trim() === "" ? null : parseBRLToCents(currentPrice);

  const input = mins !== null && mins > 0 && extraCents !== null ? { minutes: mins, materialsCents, extraCents } : null;
  const result = pricingProfile && input && !anyInvalidLine ? priceService(pricingProfile, input) : null;
  const diagnosis = pricingProfile && input && current && current > 0 ? diagnosePrice(pricingProfile, input, current) : null;

  const showCommission = Boolean(preset?.useCommission) || profile.commission.trim() !== "";

  return (
    <div className="space-y-6">
      {/* 1. O negócio */}
      <section className="rounded-xl border border-sand bg-white p-5" aria-labelledby="neg-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="neg-title" className="text-sm uppercase tracking-widest text-gold">1. O seu negócio</h2>
            {!editing && hour !== null ? (
              <p className="mt-2 text-cocoa">Sua hora de atendimento precisa render <span className="font-serif text-2xl">{formatBRL(hour)}</span></p>
            ) : (
              <p className="mt-2 text-sm text-graphite/80">Preencha uma vez. Depois você só informa cada serviço.</p>
            )}
          </div>
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} className="shrink-0 rounded-lg border border-sand px-3 py-2 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa">Editar</button>
          ) : null}
        </div>

        {editing ? (
          <form action={saveAction} className="mt-4 space-y-4" noValidate>
            <input type="hidden" name="presetSlug" value={presetSlug} />
            <TextField id="income" name="income" label="Quanto você quer retirar por mês (R$)" hint="O seu “salário” com o negócio." value={profile.income} onChange={(v) => setP("income", v)} placeholder="Ex.: 3000" />
            <div className="grid grid-cols-2 gap-3">
              <TextField id="days" name="days" label="Dias por semana" inputMode="numeric" value={profile.days} onChange={(v) => setP("days", v)} />
              <TextField id="hours" name="hours" label="Horas por dia" inputMode="numeric" value={profile.hours} onChange={(v) => setP("hours", v)} />
            </div>
            <TextField id="occupancy" name="occupancy" label="Agenda ocupada (%)" hint="Das horas em que você trabalha, quantas estão com cliente? Ninguém lota 100%. Se não sabe, comece com 70." value={profile.occupancy} onChange={(v) => setP("occupancy", v)} />
            <TextField id="fixed" name="fixed" label="Custos fixos do mês (R$)" hint="Aluguel, energia, internet, contador, MEI, produtos de uso geral." value={profile.fixed} onChange={(v) => setP("fixed", v)} placeholder="Ex.: 800" />
            <div className="grid grid-cols-2 gap-3">
              <TextField id="cardFee" name="cardFee" label="Taxa da maquininha (%)" hint="Em branco se não usa." value={profile.cardFee} onChange={(v) => setP("cardFee", v)} placeholder="Ex.: 4,5" />
              <TextField id="tax" name="tax" label="Imposto sobre vendas (%)" hint="MEI paga valor fixo: ponha nos custos fixos. Confirme com seu contador." value={profile.tax} onChange={(v) => setP("tax", v)} />
            </div>
            {showCommission ? (
              <TextField id="commission" name="commission" label="Comissão de quem atende (%)" hint="Parte do preço repassada ao profissional. Deixe em branco se você atende sozinha(o)." value={profile.commission} onChange={(v) => setP("commission", v)} placeholder="Ex.: 40" />
            ) : (
              <>
                <input type="hidden" name="commission" value={profile.commission} />
                <button type="button" onClick={() => setP("commission", "0")} className="text-sm text-cocoa underline">Tenho equipe: informar comissão</button>
              </>
            )}
            <TextField id="margin" name="margin" label="Lucro do negócio (%)" hint="O que sobra do preço, além da sua retirada." value={profile.margin} onChange={(v) => setP("margin", v)} />

            {!parsedProfile.success ? <p role="alert" className="text-sm text-red-800">{parsedProfile.error.issues[0]?.message}</p> : null}
            <FormAlert error={saveState?.error} message={saveState?.message} />
            <div className="flex flex-wrap gap-2">
              {canSave ? (
                <button type="submit" disabled={!parsedProfile.success} className="rounded-lg bg-cocoa px-4 py-2.5 text-sm font-medium text-paper hover:bg-cocoa/90 focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2 disabled:opacity-50">Salvar meus dados</button>
              ) : null}
              {hour !== null ? (
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-sand px-4 py-2.5 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa">Concluir</button>
              ) : null}
            </div>
            {hour !== null ? <p className="text-sm text-graphite/80" aria-live="polite">Com esses dados, sua hora precisa render <strong>{formatBRL(hour)}</strong>.</p> : null}
          </form>
        ) : null}
      </section>

      {/* 2. O serviço */}
      <section className="rounded-xl border border-sand bg-white p-5" aria-labelledby="srv-title">
        <h2 id="srv-title" className="text-sm uppercase tracking-widest text-gold">2. O serviço</h2>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor="segment" className="text-sm font-medium text-cocoa">Segmento</label>
            <select id="segment" value={presetSlug} onChange={(e) => changePreset(e.target.value)} className={inputClass}>
              {presets.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
            {preset?.description ? <p className="mt-1 text-xs text-graphite/70">{preset.description}</p> : null}
          </div>
          <TextField id="minutes" label="Tempo do atendimento (minutos)" hint="Do início ao fim, incluindo preparo e limpeza." value={minutes} onChange={setMinutes} inputMode="numeric" placeholder="Ex.: 60" />

          <fieldset>
            <legend className="text-sm font-medium text-cocoa">Materiais usados</legend>
            <p className="mt-1 text-xs text-graphite/70">Para cada item, diga quanto custou a embalagem, quanto ela traz e quanto você usa em um atendimento. Deixe em branco o que não usa.</p>
            <ul className="mt-3 space-y-3">
              {lineStates.map(({ line, state, cents }) => (
                <li key={line.id} className="rounded-lg border border-nude p-3">
                  <div className="flex items-start justify-between gap-2">
                    <input aria-label="Nome do material" value={line.name} onChange={(e) => setLine(line.id, "name", e.target.value)} placeholder="Nome do material" className={`${inputClass} mt-0`} />
                    <button type="button" onClick={() => setLines((cur) => cur.filter((l) => l.id !== line.id))} className="shrink-0 rounded-lg border border-sand px-2 py-2 text-xs text-cocoa hover:bg-nude" aria-label={`Remover ${line.name || "material"}`}>Remover</button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="text-xs text-graphite/80">Embalagem (R$)
                      <input inputMode="decimal" value={line.price} onChange={(e) => setLine(line.id, "price", e.target.value)} className={inputClass} placeholder="Ex.: 25" />
                    </label>
                    <label className="text-xs text-graphite/80">Traz ({line.unit})
                      <input inputMode="decimal" value={line.size} onChange={(e) => setLine(line.id, "size", e.target.value)} className={inputClass} placeholder="Ex.: 500" />
                    </label>
                    <label className="text-xs text-graphite/80">Uso ({line.unit})
                      <input inputMode="decimal" value={line.used} onChange={(e) => setLine(line.id, "used", e.target.value)} className={inputClass} placeholder="Ex.: 20" />
                    </label>
                  </div>
                  {state === "invalid" ? <p role="alert" className="mt-1 text-xs text-red-800">Preencha os três campos com números (ou apague).</p> : null}
                  {state === "ok" ? <p className="mt-1 text-xs text-graphite/70">Custo por atendimento: {formatBRL(cents)}</p> : null}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setLines((cur) => [...cur, newLine()])} className="mt-3 rounded-lg border border-sand px-3 py-2 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa">+ Adicionar material</button>
            <p className="mt-2 text-sm text-cocoa">Material por atendimento: <strong>{formatBRL(materialsCents)}</strong></p>
          </fieldset>

          <TextField id="extra" label="Outros custos do atendimento (R$)" hint="Ex.: deslocamento, taxa de aplicativo. Em branco se não há." value={extra} onChange={setExtra} placeholder="Ex.: 10" />
        </div>
      </section>

      {/* 3. Resultado */}
      <section aria-live="polite" className="rounded-xl border border-sand bg-white p-5" aria-labelledby="res-title">
        <h2 id="res-title" className="text-sm uppercase tracking-widest text-gold">3. Quanto cobrar</h2>
        {!parsedProfile.success ? (
          <p className="mt-2 text-sm text-graphite/70">Complete “O seu negócio” para calcular.</p>
        ) : anyInvalidLine ? (
          <p role="alert" className="mt-2 text-sm text-red-800">Confira os materiais: há linhas incompletas.</p>
        ) : mins === null || mins === 0 || extraCents === null ? (
          <p className="mt-2 text-sm text-graphite/70">{mins === null && minutes.trim() !== "" ? "Tempo: use só números inteiros." : "Informe o tempo do atendimento para ver o preço."}</p>
        ) : !result ? (
          <p className="mt-2 text-sm text-graphite/70">Preencha os dados para ver o preço.</p>
        ) : !result.ok ? (
          <p role="alert" className="mt-2 text-sm text-red-800">
            {result.error === "invalid_percent" ? "Taxa, imposto, comissão e lucro somados precisam ficar abaixo de 100%." : result.error === "no_hours" ? "Confira dias, horas e ocupação da agenda." : "Confira os valores informados."}
          </p>
        ) : (
          <div className="mt-2 space-y-4">
            <div>
              <p className="text-sm text-graphite/80">Preço sugerido</p>
              <p className="font-serif text-4xl text-cocoa">{formatBRL(result.suggestedCents)}</p>
              {result.roundedCents !== result.suggestedCents ? <p className="text-sm text-graphite/80">Arredondando: <strong>{formatBRL(result.roundedCents)}</strong></p> : null}
            </div>
            <dl className="divide-y divide-nude text-sm">
              <div className="flex justify-between py-2"><dt>Material e outros custos</dt><dd>{formatBRL(result.directCostCents)}</dd></div>
              <div className="flex justify-between py-2"><dt>Seu tempo (retirada + custos fixos)</dt><dd>{formatBRL(result.atSuggested.timeCents)}</dd></div>
              {result.atSuggested.cardFeeCents > 0 ? <div className="flex justify-between py-2"><dt>Maquininha</dt><dd>{formatBRL(result.atSuggested.cardFeeCents)}</dd></div> : null}
              {result.atSuggested.taxCents > 0 ? <div className="flex justify-between py-2"><dt>Imposto</dt><dd>{formatBRL(result.atSuggested.taxCents)}</dd></div> : null}
              {result.atSuggested.commissionCents > 0 ? <div className="flex justify-between py-2"><dt>Comissão</dt><dd>{formatBRL(result.atSuggested.commissionCents)}</dd></div> : null}
              <div className="flex justify-between py-2 font-medium text-cocoa"><dt>Lucro do negócio</dt><dd>{formatBRL(result.atSuggested.profitCents)}</dd></div>
            </dl>
            <div className="rounded-lg bg-nude/60 p-3 text-sm text-cocoa">
              <p className="font-medium">Seus limites</p>
              <ul className="mt-1 space-y-1">
                <li>Abaixo de <strong>{formatBRL(result.floorCents)}</strong>: prejuízo (nem o material e as taxas ficam cobertos).</li>
                <li>Abaixo de <strong>{formatBRL(result.minimumCents)}</strong>: você não paga o seu tempo.</li>
                <li>A partir de <strong>{formatBRL(result.suggestedCents)}</strong>: atinge o lucro que você quer.</li>
              </ul>
            </div>

            <div className="border-t border-nude pt-4">
              <TextField id="current" label="E hoje, quanto você cobra por este serviço? (R$)" hint="Veja o que sobra de verdade com o seu preço atual." value={currentPrice} onChange={setCurrentPrice} placeholder="Ex.: 60" />
              {diagnosis ? (
                <div className="mt-3 text-sm">
                  <p className={STATUS_TEXT[diagnosis.status].tone}>{STATUS_TEXT[diagnosis.status].text}</p>
                  <p className="mt-1 text-graphite/80">
                    Sobra {formatBRL(diagnosis.breakdown.profitCents)} por atendimento ({(diagnosis.marginBp / 100).toFixed(1).replace(".", ",")}% do preço).
                  </p>
                </div>
              ) : current === null && currentPrice.trim() !== "" ? <p role="alert" className="mt-1 text-sm text-red-800">Use só números (vírgula para centavos).</p> : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
