"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { savePageBlocksAction } from "@/app/painel/pagina/actions";
import { FormAlert, inputClass } from "@/components/form-bits";
import { BlocksPage } from "@/components/public-blocks";
import {
  BLOCK_CATALOG, BLOCK_TYPES, blockSummary, createBlock, moveBlock, starterBlocks, type Block, type BlockType,
} from "@/lib/page-blocks";
import type { PublicTenant } from "@/lib/public-page";
import type { ThemeConfig } from "@/lib/theme";

type Props = { tenant: PublicTenant; theme: ThemeConfig; initial: Block[] | null; limit: number | null };

function Txt(props: { label: string; value: string; onChange: (v: string) => void; max: number; multiline?: boolean; placeholder?: string; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-cocoa">
      {props.label}
      {props.multiline ? (
        <textarea value={props.value} onChange={(e) => props.onChange(e.target.value)} maxLength={props.max} rows={4} placeholder={props.placeholder} className={inputClass} />
      ) : (
        <input value={props.value} onChange={(e) => props.onChange(e.target.value)} maxLength={props.max} placeholder={props.placeholder} className={inputClass} />
      )}
      {props.hint ? <span className="mt-1 block text-xs font-normal text-graphite/70">{props.hint}</span> : null}
    </label>
  );
}

function Check(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-cocoa">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} className="h-4 w-4" /> {props.label}
    </label>
  );
}

const iconBtn = "rounded-lg border border-sand px-2.5 py-2 text-sm text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa disabled:opacity-40";

function BlockFields({ b, set }: { b: Block; set: (patch: Partial<Block>) => void }) {
  switch (b.type) {
    case "cover":
      return (
        <div className="space-y-3">
          <Txt label="Título" value={b.title} max={80} onChange={(v) => set({ title: v })} placeholder="Em branco = nome do seu negócio" />
          <Txt label="Frase de apresentação" value={b.subtitle} max={160} onChange={(v) => set({ subtitle: v })} placeholder="Ex.: Unhas feitas com cuidado, no seu tempo" />
          <Check label="Mostrar especialidades" checked={b.showSpecialties} onChange={(v) => set({ showSpecialties: v })} />
          <Check label="Mostrar cidade e bairro" checked={b.showLocation} onChange={(v) => set({ showLocation: v })} />
        </div>
      );
    case "text":
      return (
        <div className="space-y-3">
          <Txt label="Título (opcional)" value={b.title} max={80} onChange={(v) => set({ title: v })} placeholder="Ex.: Sobre mim" />
          <Txt label="Texto" value={b.body} max={1000} multiline onChange={(v) => set({ body: v })} />
        </div>
      );
    case "services":
      return <Txt label="Título" value={b.title} max={80} onChange={(v) => set({ title: v })} hint="Os serviços vêm do seu catálogo (Meus serviços)." />;
    case "highlights":
      return (
        <div className="space-y-3">
          <Txt label="Título" value={b.title} max={80} onChange={(v) => set({ title: v })} />
          {b.items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label={`Diferencial ${i + 1}`} value={it} maxLength={80} placeholder="Ex.: Material esterilizado" className={`${inputClass} mt-0`}
                onChange={(e) => set({ items: b.items.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className={iconBtn} aria-label={`Remover diferencial ${i + 1}`} onClick={() => set({ items: b.items.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          {b.items.length < 8 ? <button type="button" className={iconBtn} onClick={() => set({ items: [...b.items, ""] })}>+ Item</button> : null}
        </div>
      );
    case "hours":
      return (
        <div className="space-y-3">
          <Txt label="Título" value={b.title} max={80} onChange={(v) => set({ title: v })} />
          <Txt label="Horários" value={b.body} max={400} multiline placeholder={"Seg a sex: 9h às 18h\nSábado: 9h às 14h"} onChange={(v) => set({ body: v })} />
        </div>
      );
    case "faq":
      return (
        <div className="space-y-3">
          <Txt label="Título" value={b.title} max={80} onChange={(v) => set({ title: v })} />
          {b.items.map((it, i) => (
            <div key={i} className="space-y-2 rounded-lg bg-nude/40 p-3">
              <Txt label={`Pergunta ${i + 1}`} value={it.q} max={120} onChange={(v) => set({ items: b.items.map((x, j) => (j === i ? { ...x, q: v } : x)) })} />
              <Txt label="Resposta" value={it.a} max={500} multiline onChange={(v) => set({ items: b.items.map((x, j) => (j === i ? { ...x, a: v } : x)) })} />
              <button type="button" className={iconBtn} onClick={() => set({ items: b.items.filter((_, j) => j !== i) })}>Remover pergunta</button>
            </div>
          ))}
          {b.items.length < 10 ? <button type="button" className={iconBtn} onClick={() => set({ items: [...b.items, { q: "", a: "" }] })}>+ Pergunta</button> : null}
        </div>
      );
    case "contact":
      return (
        <div className="space-y-3">
          <Txt label="Título" value={b.title} max={80} onChange={(v) => set({ title: v })} />
          <Check label="Botão do WhatsApp" checked={b.showWhatsapp} onChange={(v) => set({ showWhatsapp: v })} />
          <Check label="Botão do Instagram" checked={b.showInstagram} onChange={(v) => set({ showInstagram: v })} />
          <Check label="Endereço (se estiver público no perfil)" checked={b.showAddress} onChange={(v) => set({ showAddress: v })} />
          <p className="text-xs text-graphite/70">Os contatos vêm do seu <Link href="/painel/perfil" className="underline">perfil público</Link>.</p>
        </div>
      );
    case "button":
      return (
        <div className="space-y-3">
          <Txt label="Texto do botão" value={b.label} max={40} onChange={(v) => set({ label: v })} placeholder="Ex.: Agende pelo WhatsApp" />
          <label className="block text-sm font-medium text-cocoa">
            Para onde leva
            <select value={b.kind} onChange={(e) => set({ kind: e.target.value as "whatsapp" | "instagram" | "link" })} className={inputClass}>
              <option value="whatsapp">Meu WhatsApp</option>
              <option value="instagram">Meu Instagram</option>
              <option value="link">Outro link</option>
            </select>
          </label>
          {b.kind === "link" ? <Txt label="Link" value={b.url} max={300} onChange={(v) => set({ url: v })} placeholder="https://" hint="Precisa começar com https://" /> : null}
        </div>
      );
  }
}

export function PageBuilder({ tenant, theme, initial, limit }: Props) {
  const [blocks, setBlocks] = useState<Block[] | null>(initial);
  const [saved, setSaved] = useState<Block[] | null>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [result, setResult] = useState<{ error?: string; message?: string } | undefined>();
  const [pending, start] = useTransition();

  const dirty = useMemo(() => JSON.stringify(blocks) !== JSON.stringify(saved), [blocks, saved]);
  const atLimit = limit !== null && (blocks?.length ?? 0) >= limit;

  const update = (id: string, patch: Partial<Block>) =>
    setBlocks((cur) => (cur ? cur.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)) : cur));
  const add = (type: BlockType) => {
    const b = createBlock(type);
    setBlocks((cur) => [...(cur ?? []), b]);
    setOpenId(b.id);
  };
  const save = () =>
    start(async () => {
      const r = await savePageBlocksAction(blocks);
      setResult(r ?? undefined);
      if (!r?.error) setSaved(blocks);
    });

  if (blocks === null) {
    return (
      <section className="rounded-xl border border-sand bg-white p-5">
        <h2 className="font-serif text-xl text-cocoa">Sua página hoje é automática</h2>
        <p className="mt-2 text-sm text-graphite/80">Ela mostra seu nome, especialidades, serviços e contatos. Quer escolher o que aparece, a ordem e os textos?</p>
        <button type="button" onClick={() => { const s = starterBlocks(); setBlocks(s); setOpenId(s[0]?.id ?? null); }}
          className="mt-4 rounded-lg bg-cocoa px-4 py-2.5 text-sm font-medium text-paper hover:bg-cocoa/90 focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2">
          Montar minha página
        </button>
        <FormAlert error={result?.error} message={result?.message} />
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending || !dirty} onClick={save}
            className="rounded-lg bg-cocoa px-4 py-2.5 text-sm font-medium text-paper hover:bg-cocoa/90 focus:outline-none focus:ring-2 focus:ring-cocoa focus:ring-offset-2 disabled:opacity-50">
            {pending ? "Salvando…" : "Salvar e publicar"}
          </button>
          <button type="button" disabled={pending}
            onClick={() => { if (window.confirm("Voltar ao modelo automático? Seus blocos serão apagados depois de salvar.")) { setBlocks(null); setSaved(initial); start(async () => { const r = await savePageBlocksAction(null); setResult(r ?? undefined); if (!r?.error) setSaved(null); }); } }}
            className={iconBtn}>Voltar ao automático</button>
          <span className="text-sm text-graphite/70">{blocks.length}{limit !== null ? ` de ${limit}` : ""} blocos{dirty ? " · alterações não salvas" : ""}</span>
        </div>
        <FormAlert error={result?.error} message={result?.message} />

        <ol className="space-y-3">
          {blocks.map((b, i) => (
            <li key={b.id} className={`rounded-xl border bg-white p-3 ${b.enabled ? "border-sand" : "border-dashed border-sand opacity-70"}`}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-widest text-gold">{BLOCK_CATALOG[b.type].label}</p>
                  <p className="truncate text-cocoa">{blockSummary(b)}{b.enabled ? "" : " (oculto)"}</p>
                </div>
                <button type="button" className={iconBtn} disabled={i === 0} aria-label="Subir bloco" onClick={() => setBlocks(moveBlock(blocks, i, -1))}>↑</button>
                <button type="button" className={iconBtn} disabled={i === blocks.length - 1} aria-label="Descer bloco" onClick={() => setBlocks(moveBlock(blocks, i, 1))}>↓</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={iconBtn} aria-expanded={openId === b.id} onClick={() => setOpenId(openId === b.id ? null : b.id)}>{openId === b.id ? "Fechar" : "Editar"}</button>
                <button type="button" className={iconBtn} onClick={() => update(b.id, { enabled: !b.enabled })}>{b.enabled ? "Ocultar" : "Mostrar"}</button>
                <button type="button" className={iconBtn} onClick={() => setBlocks(blocks.filter((x) => x.id !== b.id))}>Remover</button>
              </div>
              {openId === b.id ? <div className="mt-3 border-t border-nude pt-3"><BlockFields b={b} set={(patch) => update(b.id, patch)} /></div> : null}
            </li>
          ))}
        </ol>

        <section aria-label="Adicionar bloco" className="rounded-xl border border-sand bg-white p-4">
          <h2 className="text-sm uppercase tracking-widest text-gold">Adicionar bloco</h2>
          {atLimit ? (
            <p className="mt-2 text-sm text-graphite/80">Você chegou ao limite de {limit} blocos do seu plano. <Link href="/planos" className="underline">Ver planos</Link></p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {BLOCK_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => add(t)} className="rounded-lg border border-sand p-3 text-left hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa">
                  <span className="block text-sm font-medium text-cocoa">+ {BLOCK_CATALOG[t].label}</span>
                  <span className="block text-xs text-graphite/70">{BLOCK_CATALOG[t].hint}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <section aria-label="Pré-visualização" className="lg:sticky lg:top-4 lg:self-start">
        <h2 className="mb-2 text-sm uppercase tracking-widest text-gold">Como fica</h2>
        <div className="max-h-[75vh] overflow-auto rounded-xl border border-sand">
          <BlocksPage tenant={tenant} theme={theme} blocks={blocks} preview />
        </div>
        <p className="mt-2 text-xs text-graphite/70">A pré-visualização mostra avisos nos blocos vazios; na página pública eles ficam escondidos.</p>
      </section>
    </div>
  );
}
