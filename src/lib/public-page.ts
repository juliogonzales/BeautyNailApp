import { z } from "zod";
import { publicServiceSchema } from "@/lib/services";

/** Campos que a página pública pode mostrar (o banco só devolve estes; ver RPC get_public_tenant). */
export const publicTenantSchema = z.object({
  slug: z.string(),
  business_name: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  neighborhood: z.string().nullable(),
  address_line: z.string().nullable(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  primary_color: z.string().nullable(),
  accent_color: z.string().nullable(),
  specialties: z.array(z.string()),
  theme: z.unknown().optional(),
  blocks: z.unknown().optional(),
  services: z.array(publicServiceSchema).default([]),
});
export type PublicTenant = z.infer<typeof publicTenantSchema>;

/** Endereço público completo do negócio. `siteUrl` vem de NEXT_PUBLIC_SITE_URL. */
export function publicUrl(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/${slug}`;
}

/** Mantém só dígitos. Números brasileiros sem DDI (10 ou 11 dígitos) ganham o 55. */
export function normalizeWhatsapp(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

/** Link wa.me para a cliente falar com a profissional (WhatsApp por link, sem API: ver CLAUDE.md). */
export function whatsappContactLink(raw: string | null | undefined, text?: string): string | null {
  const n = normalizeWhatsapp(raw);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Link para a profissional compartilhar o próprio endereço (abre o seletor de contatos do WhatsApp). */
export function whatsappShareLink(url: string, businessName: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${businessName}: ${url}`)}`;
}

/** Aceita "@maria", "maria" ou a URL do perfil; devolve só o usuário, ou null se inválido. */
export function normalizeInstagram(raw: string | null | undefined): string | null {
  let v = (raw ?? "").trim();
  if (!v) return null;
  v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0] ?? "";
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}

export function instagramUrl(handle: string | null | undefined): string | null {
  const h = normalizeInstagram(handle);
  return h ? `https://instagram.com/${h}` : null;
}

/** Cor hexadecimal segura para usar em estilo inline; qualquer outra coisa cai no padrão. */
export function safeHexColor(value: string | null | undefined, fallback: string): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}
