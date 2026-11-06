"use client";

import { useActionState, useMemo, useState } from "react";
import { savePricingProfileAction } from "@/app/painel/calculadora/actions";
import { FormAlert, inputClass } from "@/components/form-bits";
import { formatBRL } from "@/lib/money";
import { parseBRLToCents, parseWholeNumber } from "@/lib/pricing";
import { profileFormSchema, toPricingProfile, type ProfileForm } from "@/lib/pricing-profile";
import {
  breakdownAt, diagnosePrice, hourCostCents, materialLineCost, parseQuantityHundredths, priceService,
  productiveMinutesPerMonth, type PriceDiagnosis, type PricingProfile, type ServicePrice,
} from "@/lib/service-pricing";

export type CalculatorPreset = {
  slug: string;
  name: string;
  description: string | null;
  useCommission: boolean;
  materials: Array<{ name: string; unit: string }>;
  services: Array<{ name: string; minutes: number }>;
};

type Line = { id: number; name: string; unit: string; price: string; size: string; used: string };
type Item = { id: number; name: string; minutes: string; material: string; current: string; lines: Line[] | null };

type Props = { presets: CalculatorPreset[]; initialProfile: ProfileForm; hasSavedProfile: boolean; canSave: boolean };

let seq = 0;
const newLine = (name = "", unit = "un"): Line => ({ id: ++seq, name, unit, price: "", size: "", used: "" });
const newItem = (name = "", minutes = ""): Item => ({ id: ++seq, name, minutes, material: "", current: "", lines: null });

const fmtDuration = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`);
const fmtHours = (min: number) => `${Math.round(min / 60)} h`;

type OkPrice = Extract<ServicePrice, { ok: true }>;
type Eval =
  | { state: "incomplete" }
  | { state: "invalid"; message: string }
  | {
      state: "ok"; minutes: number; materialsCents: number; price: OkPrice; recommendedCents: number;
      currentCents: number | null; diagnosis: PriceDiagnosis | null; capacity: number;
      needAtRecommended: number | null; needAtCurrent: number | null; perHourCurrent: number | null; perHourRecommended: number;
    };

/** Calcula um serviço: tudo que a tela mostra para ele sai daqui (funções puras já testadas em service-pricing). */
function evalItem(profile: PricingProfile | null, it: Item): Eval {
  const minutes = parseWholeNumber(it.minutes);
  if (!profile || minutes === null || minutes <= 0) return { state: "incomplete" };
  if (minutes > 1440) return { state: "invalid", message: "O tempo deve ser de até 1.440 minutos." };

  let materialsCents = 0;
  const filledLines = (it.lines ?? []).filter((l) => [l.price, l.size, l.used].some((v) => v.trim() !== ""));
  if (filledLines.length > 0) {
    for (const l of filledLines) {
      const price = parseBRLToCents(l.price);
      const size = parseQuantityHundredths(l.size);
      const used = parseQuantityHundredths(l.used);
      if (price === null || size === null || used === null) return { state: "invalid", message: `Confira o material "${l.name || "sem nome"}": preencha os três campos.` };
      materialsCents += materialLineCost({ packagePriceCents: price, packageSizeHundredths: size, usedHundredths: used });
    }
  } else if (it.material.trim() !== "") {
    const m = parseBRLToCents(it.material);
    if (m === null) return { state: "invalid", message: "Material: use só números (vírgula para centavos)." };
    materialsCents = m;
  }

  const input = { minutes, materialsCents, extraCents: 0 };
  const price = priceService(profile, input);
  if (!price.ok) {
    return { state: "invalid", message: price.error === "invalid_percent" ? "Taxa, imposto, comissão e lucro somados precisam ficar abaixo de 100%." : "Confira os dados do seu negócio." };
  }
  const recommendedCents = price.roundedCents;
  const contributionPerHour = (b: { timeCents: number; profitCents: number }) => Math.round(((b.timeCents + b.profitCents) * 60) / minutes);
  const contribution = (b: { timeCents: number; profitCents: number }) => b.timeCents + b.profitCents;
  const goal = profile.monthlyIncomeCents + profile.fixedCostsCents;
  const need = (c: number) => (c > 0 ? Math.ceil(goal / c) : null);

  const bRec = breakdownAt(profile, recommendedCents, input, price.timeCostCents);
  const currentCents = it.current.trim() === "" ? null : parseBRLToCents(it.current);
  const diagnosis = currentCents && currentCents > 0 ? diagnosePrice(profile, input, currentCents) : null;

  return {
    state: "ok", minutes, materialsCents, price, recommendedCents, currentCents, diagnosis,
    capacity: Math.floor(productiveMinutesPerMonth(profile) / minutes),
    needAtRecommended: need(contribution(bRec)),
    needAtCurrent: diagnosis ? need(contribution(diagnosis.breakdown)) : null,
    perHourCurrent: diagnosis ? contributionPerHour(diagnosis.breakdown) : null,
    perHourRecommended: contributionPerHour(bRec),
  };
}

function Field(props: {
  id: string; name?: string; label: string; hint?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; inputMode?: "decimal" | "numeric" | "text"; prefix?: string;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="text-sm font-medium text-cocoa">{props.label}</label>
      <div className="relative">
        {props.prefix ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-graphite/60">{props.prefix}</span> : null}
        <input
          id={props.id} name={props.name} inputMode={props.inputMode ?? "decimal"} autoComplete="off" value={props.value}
          onChange={(e) => props.onChange(e.target.value)} placeholder={props.placeholder}
          className={`${inputClass} ${props.prefix ? "pl-9" : ""}`} aria-describedby={props.hint ? `${props.id}-hint` : undefined}
        />
      </div>
      {props.hint ? <p id={`${props.id}-hint`} className="mt-1 text-xs text-graphite/70">{props.hint}</p> : null}
    </div>
  );
}

const STATUS = {
  loss: { cls: "border-red-200 bg-red-50 text-red-900", text: "Prejuízo: o preço nem cobre o material e as taxas." },
  no_pay: { cls: "border-red-200 bg-red-50 text-red-900", text: "Você não paga o seu tempo: trabalha de graça ou tira do próprio bolso." },
  below_goal: { cls: "border-amber-200 bg-amber-50 text-amber-900", text: "Paga o seu tempo, mas o lucro fica abaixo da sua meta." },
  ok: { cls: "border-green-200 bg-green-50 text-green-900", text: "Esse preço está bom: atinge a sua meta." },
} as const;

export function PricingCalculator({ presets, initialProfile, hasSavedProfile, canSave }: Props) {
  const [profile, setProfile] = useState<ProfileForm>(initialProfile);
  const [editing, setEditing] = useState(!hasSavedProfile);
  const [saveState, saveAction] = useActionState(savePricingProfileAction, undefined);
  const setP = (k: keyof ProfileForm, v: string) => setProfile((cur) => ({ ...cur, [k]: v }));

  const [presetSlug, setPresetSlug] = useState(initialProfile.presetSlug || presets[0]?.slug || "");
  const preset = presets.find((p) => p.slug === presetSlug);
  const [items, setItems] = useState<Item[]>(() => {
    const first = presets.find((p) => p.slug === (initialProfile.presetSlug || presets[0]?.slug))?.services[0];
    return first ? [newItem(first.name, String(first.minutes))] : [];
  });
  const setItem = (id: number, patch: Partial<Item>) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const setLine = (itemId: number, lineId: number, k: keyof Line, v: string) =>
    setItems((cur) => cur.map((i) => (i.id === itemId ? { ...i, lines: (i.lines ?? []).map((l) => (l.id === lineId ? { ...l, [k]: v } : l)) } : i)));

  const changePreset = (slug: string) => {
    if (items.length > 0 && !window.confirm("Trocar de segmento limpa a lista de serviços abaixo. Continuar?")) return;
    setPresetSlug(slug);
    const first = presets.find((p) => p.slug === slug)?.services[0];
    setItems(first ? [newItem(first.name, String(first.minutes))] : []);
  };

  const parsedProfile = useMemo(() => profileFormSchema.safeParse({ ...profile, presetSlug }), [profile, presetSlug]);
  const pricingProfile = parsedProfile.success ? toPricingProfile(parsedProfile.data) : null;
  const hour = pricingProfile ? hourCostCents(pricingProfile) : null;
  const monthlyMinutes = pricingProfile ? productiveMinutesPerMonth(pricingProfile) : 0;

  const evals = useMemo(() => items.map((it) => ({ it, ev: evalItem(pricingProfile, it) })), [items, pricingProfile]);
  const okEvals = evals.filter((e): e is { it: Item; ev: Extract<Eval, { state: "ok" }> } => e.ev.state === "ok");

  // "Descobertas": só com o que a pessoa informou (preço atual).
  const withCurrent = okEvals.filter((e) => e.ev.perHourCurrent !== null);
  const ranked = [...withCurrent].sort((a, b) => (b.ev.perHourCurrent ?? 0) - (a.ev.perHourCurrent ?? 0));
  const bad = withCurrent.filter((e) => e.ev.diagnosis && (e.ev.diagnosis.status === "loss" || e.ev.diagnosis.status === "no_pay"));
  const tooMany = withCurrent.filter((e) => e.ev.needAtCurrent === null || e.ev.needAtCurrent > e.ev.capacity);

  const addable = (preset?.services ?? []).filter((s) => !items.some((i) => i.name === s.name));
  const showCommission = Boolean(preset?.useCommission) || profile.commission.trim() !== "";

  return (
    <div className="space-y-6">
      {/* 1. Seu negócio: 4 perguntas; o resto já vem com valores comuns */}
      <section className="rounded-xl border border-sand bg-white p-5" aria-labelledby="neg-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="neg-title" className="text-sm uppercase tracking-widest text-gold">1. Seu negócio</h2>
            {!editing && hour !== null ? (
              <p className="mt-2 text-cocoa">Cada hora com cliente precisa render <span className="font-serif text-2xl">{formatBRL(hour)}</span></p>
            ) : (
              <p className="mt-2 text-sm text-graphite/80">Só 4 perguntas, uma única vez. O resto já vem preenchido com valores comuns.</p>
            )}
          </div>
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} className="shrink-0 rounded-lg border border-sand px-3 py-2 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa">Editar</button>
          ) : null}
        </div>

        {editing ? (
          <form action={saveAction} className="mt-4 space-y-4" noValidate>
            <input type="hidden" name="presetSlug" value={presetSlug} />
            <Field id="income" name="income" prefix="R$" label="Quanto você quer ganhar por mês?" hint="É o seu “salário”, o que você quer levar para casa." value={profile.income} onChange={(v) => setP("income", v)} placeholder="3000" />
            <Field id="fixed" name="fixed" prefix="R$" label="Quanto você gasta por mês para trabalhar?" hint="Aluguel, luz, internet, contador, MEI… Se não sabe, deixe em branco por enquanto." value={profile.fixed} onChange={(v) => setP("fixed", v)} placeholder="800" />
            <div className="grid grid-cols-2 gap-3">
              <Field id="days" name="days" label="Dias por semana" inputMode="numeric" value={profile.days} onChange={(v) => setP("days", v)} />
              <Field id="hours" name="hours" label="Horas por dia" inputMode="numeric" value={profile.hours} onChange={(v) => setP("hours", v)} />
            </div>

            <details className="rounded-lg border border-nude p-3">
              <summary className="cursor-pointer text-sm font-medium text-cocoa">Ajustar detalhes (opcional)</summary>
              <div className="mt-3 space-y-4">
                <Field id="occupancy" name="occupancy" label="Agenda ocupada (%)" hint="Das horas que você trabalha, quantas estão com cliente? Ninguém lota 100%. Padrão: 70." value={profile.occupancy} onChange={(v) => setP("occupancy", v)} />
                <Field id="margin" name="margin" label="Lucro do negócio (%)" hint="O que sobra do preço, além do seu salário. Padrão: 20." value={profile.margin} onChange={(v) => setP("margin", v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field id="cardFee" name="cardFee" label="Taxa da maquininha (%)" hint="Em branco se não usa." value={profile.cardFee} onChange={(v) => setP("cardFee", v)} placeholder="4,5" />
                  <Field id="tax" name="tax" label="Imposto (%)" hint="MEI paga valor fixo: ponha nos gastos do mês." value={profile.tax} onChange={(v) => setP("tax", v)} />
                </div>
                {showCommission ? (
                  <Field id="commission" name="commission" label="Comissão de quem atende (%)" hint="Só se você tem equipe. Em branco se atende sozinha(o)." value={profile.commission} onChange={(v) => setP("commission", v)} placeholder="40" />
                ) : (
                  <>
                    <input type="hidden" name="commission" value={profile.commission} />
                    <button type="button" onClick={() => setP("commission", "0")} className="text-sm text-cocoa underline">Tenho equipe: informar comissão</button>
                  </>
                )}
              </div>
            </details>
            {/* Os campos dentro do <details> fechado continuam no formulário; a comissão oculta vai por input hidden. */}

            {!parsedProfile.success ? <p role="alert" className="text-sm text-red-800">{parsedProfile.error.issues[0]?.message}</p> : null}
            <FormAlert error={saveState?.error} message={saveState?.message} />
            {hour !== null ? (
              <p className="rounded-lg bg-nude/60 p-3 text-sm text-cocoa" aria-live="polite">
                Você atende cerca de <strong>{fmtHours(monthlyMinutes)}</strong> por mês com clientes. Por isso cada hora precisa render <strong>{formatBRL(hour)}</strong> para fechar o seu mês.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {canSave ? (
                <button type="submit" disabled={!parsedProfile.success} className="rounded-lg bg-cocoa px-4 py-2.5 text-sm font-medium text-paper hover:bg-cocoa/90 focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2 disabled:opacity-50">Salvar e continuar</button>
              ) : null}
              {hour !== null ? (
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-sand px-4 py-2.5 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa">Continuar sem salvar</button>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>

      {/* 2. Serviços: toque e ajuste */}
      <section className="rounded-xl border border-sand bg-white p-5" aria-labelledby="srv-title">
        <h2 id="srv-title" className="text-sm uppercase tracking-widest text-gold">2. Seus serviços</h2>
        <div className="mt-3">
          <label htmlFor="segment" className="text-sm font-medium text-cocoa">O que você faz?</label>
          <select id="segment" value={presetSlug} onChange={(e) => changePreset(e.target.value)} className={inputClass}>
            {presets.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
        </div>

        <ul className="mt-4 space-y-4">
          {evals.map(({ it, ev }) => {
            const filledMaterial = (it.lines ?? []).some((l) => [l.price, l.size, l.used].some((v) => v.trim() !== ""));
            return (
              <li key={it.id} className="rounded-xl border border-nude p-4">
                <div className="flex items-start justify-between gap-2">
                  <input aria-label="Nome do serviço" value={it.name} onChange={(e) => setItem(it.id, { name: e.target.value })} placeholder="Nome do serviço" className={`${inputClass} mt-0 font-medium`} />
                  <button type="button" onClick={() => setItems((cur) => cur.filter((i) => i.id !== it.id))} className="shrink-0 rounded-lg border border-sand px-2 py-2 text-xs text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa" aria-label={`Remover ${it.name || "serviço"}`}>Remover</button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field id={`min-${it.id}`} label="Dura (minutos)" inputMode="numeric" value={it.minutes} onChange={(v) => setItem(it.id, { minutes: v })} placeholder="60" />
                  <Field id={`mat-${it.id}`} prefix="R$" label="Gasto com material" hint={filledMaterial ? "Calculado abaixo." : "Quanto de produto vai em 1 atendimento."} value={filledMaterial ? "" : it.material} onChange={(v) => setItem(it.id, { material: v })} placeholder="0" />
                </div>

                <details className="mt-3" onToggle={(e) => { if (e.currentTarget.open && it.lines === null) setItem(it.id, { lines: (preset?.materials ?? []).map((m) => newLine(m.name, m.unit)) }); }}>
                  <summary className="cursor-pointer text-sm text-cocoa underline">Não sei o gasto: calcular pelos materiais</summary>
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-graphite/70">Preencha só o que usa neste serviço: quanto pagou na embalagem, quanto ela traz e quanto você gasta em 1 atendimento. O resto fica em branco.</p>
                    {(it.lines ?? []).map((l) => (
                      <div key={l.id} className="rounded-lg bg-nude/40 p-3">
                        <div className="flex gap-2">
                          <input aria-label="Nome do material" value={l.name} onChange={(e) => setLine(it.id, l.id, "name", e.target.value)} placeholder="Material" className={`${inputClass} mt-0`} />
                          <button type="button" onClick={() => setItem(it.id, { lines: (it.lines ?? []).filter((x) => x.id !== l.id) })} className="shrink-0 rounded-lg border border-sand px-2 text-xs text-cocoa hover:bg-nude" aria-label={`Remover ${l.name || "material"}`}>×</button>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <label className="text-xs text-graphite/80">Pagou (R$)<input inputMode="decimal" value={l.price} onChange={(e) => setLine(it.id, l.id, "price", e.target.value)} className={inputClass} placeholder="25" /></label>
                          <label className="text-xs text-graphite/80">Traz ({l.unit})<input inputMode="decimal" value={l.size} onChange={(e) => setLine(it.id, l.id, "size", e.target.value)} className={inputClass} placeholder="500" /></label>
                          <label className="text-xs text-graphite/80">Usa ({l.unit})<input inputMode="decimal" value={l.used} onChange={(e) => setLine(it.id, l.id, "used", e.target.value)} className={inputClass} placeholder="20" /></label>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setItem(it.id, { lines: [...(it.lines ?? []), newLine()] })} className="rounded-lg border border-sand px-3 py-2 text-sm text-cocoa hover:bg-nude">+ Outro material</button>
                    {ev.state === "ok" ? <p className="text-sm text-cocoa">Material por atendimento: <strong>{formatBRL(ev.materialsCents)}</strong></p> : null}
                  </div>
                </details>

                {/* Resultado do serviço, na hora */}
                <div className="mt-4 border-t border-nude pt-4" aria-live="polite">
                  {ev.state === "incomplete" ? (
                    <p className="text-sm text-graphite/70">{pricingProfile ? "Informe quantos minutos dura para ver o preço." : "Responda as 4 perguntas do seu negócio para ver o preço."}</p>
                  ) : ev.state === "invalid" ? (
                    <p role="alert" className="text-sm text-red-800">{ev.message}</p>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-graphite/80">Cobre pelo menos</p>
                        <p className="font-serif text-4xl text-cocoa">{formatBRL(ev.recommendedCents)}</p>
                        <p className="text-xs text-graphite/70">
                          Preço de equilíbrio: {formatBRL(ev.price.minimumCents)} (abaixo disso você não paga o seu tempo). Abaixo de {formatBRL(ev.price.floorCents)}, prejuízo.
                        </p>
                      </div>
                      <Field id={`cur-${it.id}`} prefix="R$" label="Quanto você cobra hoje? (opcional)" hint="Mostramos o que sobra de verdade." value={it.current} onChange={(v) => setItem(it.id, { current: v })} placeholder="60" />
                      {ev.diagnosis ? (
                        <div className={`rounded-lg border p-3 text-sm ${STATUS[ev.diagnosis.status].cls}`}>
                          <p className="font-medium">{STATUS[ev.diagnosis.status].text}</p>
                          <p className="mt-1">
                            Dos {formatBRL(ev.diagnosis.breakdown.priceCents)}, sobram <strong>{formatBRL(ev.diagnosis.breakdown.profitCents)}</strong> de lucro depois de pagar material, taxas e o seu tempo.
                            {ev.needAtCurrent !== null ? <> Para fechar o mês com esse preço, são <strong>{ev.needAtCurrent}</strong> atendimentos (cabem {ev.capacity} na sua agenda).</> : null}
                          </p>
                        </div>
                      ) : it.current.trim() !== "" ? <p role="alert" className="text-sm text-red-800">Use só números (vírgula para centavos).</p> : null}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4">
          <p className="text-sm text-graphite/80">{addable.length > 0 ? "Toque para adicionar:" : "Adicione outro serviço:"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {addable.map((s) => (
              <button key={s.name} type="button" onClick={() => setItems((cur) => [...cur, newItem(s.name, String(s.minutes))])} className="rounded-full border border-sand px-3 py-1.5 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa">
                + {s.name} <span className="text-graphite/60">({fmtDuration(s.minutes)})</span>
              </button>
            ))}
            <button type="button" onClick={() => setItems((cur) => [...cur, newItem()])} className="rounded-full border border-dashed border-sand px-3 py-1.5 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa">+ Outro serviço</button>
          </div>
          {preset?.services.length ? <p className="mt-2 text-xs text-graphite/70">Os tempos são médias comuns; ajuste para o seu jeito de trabalhar.</p> : null}
        </div>
      </section>

      {/* 3. Descobertas */}
      <section className="rounded-xl border border-sand bg-white p-5" aria-labelledby="dsc-title" aria-live="polite">
        <h2 id="dsc-title" className="text-sm uppercase tracking-widest text-gold">3. O que descobrimos</h2>
        {okEvals.length === 0 ? (
          <p className="mt-2 text-sm text-graphite/70">Assim que o preço de um serviço aparecer, as descobertas surgem aqui.</p>
        ) : withCurrent.length === 0 ? (
          <p className="mt-2 text-sm text-graphite/80">Preencha “Quanto você cobra hoje?” em seus serviços e mostramos qual rende mais por hora, qual está dando prejuízo e se o seu mês fecha.</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm text-cocoa">
            {bad.length > 0 ? (
              <li className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
                <strong>{bad.length === 1 ? "1 serviço está" : `${bad.length} serviços estão`} abaixo do necessário:</strong> {bad.map((b) => b.it.name || "sem nome").join(", ")}. Veja o preço sugerido em cada um.
              </li>
            ) : (
              <li className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-900">Nenhum dos serviços informados está dando prejuízo ou deixando de pagar o seu tempo.</li>
            )}
            {ranked.length >= 2 ? (
              <li className="rounded-lg bg-nude/60 p-3">
                <strong>Quem mais rende por hora:</strong> {ranked[0]?.it.name || "serviço"} ({formatBRL(ranked[0]?.ev.perHourCurrent ?? 0)}/h).{" "}
                <strong>Quem menos rende:</strong> {ranked[ranked.length - 1]?.it.name || "serviço"} ({formatBRL(ranked[ranked.length - 1]?.ev.perHourCurrent ?? 0)}/h).
                {hour !== null ? <> Sua meta é {formatBRL(hour)}/h.</> : null}
              </li>
            ) : null}
            {tooMany.length > 0 ? (
              <li className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                Com o preço de hoje, o seu mês <strong>não fecha só com</strong> {tooMany.map((b) => b.it.name || "serviço").join(", ")}: seriam atendimentos demais para a sua agenda. Subir o preço é mais fácil do que trabalhar mais.
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );
}
