import { z } from "zod";

/**
 * Blocos da página pública. A profissional monta a página escolhendo blocos e editando textos: só texto simples
 * (nunca HTML) e links https, para a página continuar segura. Validado aqui antes de gravar e ao ler.
 */
const text = (max: number) => z.string().trim().max(max);
const blockId = z.string().regex(/^[a-z0-9]{4,20}$/);
const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Use um link que comece com https://");

const base = { id: blockId, enabled: z.boolean() };

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("cover"), title: text(80), subtitle: text(160), showSpecialties: z.boolean(), showLocation: z.boolean() }),
  z.object({ ...base, type: z.literal("text"), title: text(80), body: text(1000) }),
  z.object({ ...base, type: z.literal("services"), title: text(80) }),
  z.object({ ...base, type: z.literal("highlights"), title: text(80), items: z.array(text(80)).max(8) }),
  z.object({ ...base, type: z.literal("hours"), title: text(80), body: text(400) }),
  z.object({ ...base, type: z.literal("faq"), title: text(80), items: z.array(z.object({ q: text(120), a: text(500) })).max(10) }),
  z.object({ ...base, type: z.literal("contact"), title: text(80), showWhatsapp: z.boolean(), showInstagram: z.boolean(), showAddress: z.boolean() }),
  z.object({ ...base, type: z.literal("button"), label: text(40), kind: z.enum(["whatsapp", "instagram", "link"]), url: httpsUrl }),
]);

export const blocksSchema = z.array(blockSchema).max(30, "A página aceita até 30 blocos.");

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

export const BLOCK_CATALOG: Record<BlockType, { label: string; hint: string }> = {
  cover: { label: "Capa", hint: "Seu nome, uma frase e suas especialidades." },
  text: { label: "Texto livre", hint: "Conte sua história ou o que você oferece." },
  services: { label: "Serviços e preços", hint: "Mostra o seu catálogo de serviços." },
  highlights: { label: "Diferenciais", hint: "Uma lista curta: por que escolher você." },
  hours: { label: "Horários", hint: "Dias e horários de atendimento." },
  faq: { label: "Perguntas frequentes", hint: "Respostas para as dúvidas mais comuns." },
  contact: { label: "Contato", hint: "Botões de WhatsApp e Instagram, e endereço." },
  button: { label: "Botão", hint: "Um botão com o texto e o destino que você quiser." },
};

export const BLOCK_TYPES = Object.keys(BLOCK_CATALOG) as BlockType[];

export function newBlockId(): string {
  return `b${Math.random().toString(36).slice(2, 10).padEnd(7, "0")}`;
}

export function createBlock(type: BlockType): Block {
  const id = newBlockId();
  switch (type) {
    case "cover": return { id, enabled: true, type, title: "", subtitle: "", showSpecialties: true, showLocation: true };
    case "text": return { id, enabled: true, type, title: "", body: "" };
    case "services": return { id, enabled: true, type, title: "Serviços" };
    case "highlights": return { id, enabled: true, type, title: "Por que escolher", items: ["", "", ""] };
    case "hours": return { id, enabled: true, type, title: "Horários", body: "" };
    case "faq": return { id, enabled: true, type, title: "Perguntas frequentes", items: [{ q: "", a: "" }] };
    case "contact": return { id, enabled: true, type, title: "Fale comigo", showWhatsapp: true, showInstagram: true, showAddress: true };
    case "button": return { id, enabled: true, type, label: "", kind: "whatsapp", url: "" };
  }
}

/** Ponto de partida: o mesmo conteúdo da página automática, já em blocos para a profissional mexer. */
export function starterBlocks(): Block[] {
  return [createBlock("cover"), createBlock("services"), createBlock("contact")];
}

/** Lê blocos vindos do banco: descarta o que for inválido; vazio ou ausente = página automática (null). */
export function parseBlocks(value: unknown): Block[] | null {
  if (!Array.isArray(value)) return null;
  const out: Block[] = [];
  for (const raw of value.slice(0, 30)) {
    const r = blockSchema.safeParse(raw);
    if (r.success) out.push(r.data);
  }
  return out.length > 0 ? out : null;
}

export function moveBlock<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const copy = list.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(to, 0, item as T);
  return copy;
}

/** Resumo curto para a lista de blocos do editor. */
export function blockSummary(b: Block): string {
  switch (b.type) {
    case "cover": return b.title || "Nome do seu negócio";
    case "text": case "services": case "highlights": case "hours": case "faq": case "contact": return b.title || BLOCK_CATALOG[b.type].label;
    case "button": return b.label || "Botão sem texto";
  }
}
