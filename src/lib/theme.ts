import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #rrggbb.");

export const THEME_LAYOUTS = { centered: "Centralizado", left: "Alinhado à esquerda", card: "Em cartão" } as const;
export const THEME_FONTS = { serif: "Com serifa (clássica)", sans: "Sem serifa (moderna)", elegant: "Elegante" } as const;
export const THEME_RADIUS = { none: "Reto", soft: "Suave", round: "Arredondado" } as const;

/** Famílias de fonte do sistema (sem carregar fontes externas: rápido e sem enviar dados a terceiros). */
export const FONT_STACKS: Record<keyof typeof THEME_FONTS, string> = {
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  elegant: '"Didot", "Bodoni MT", "Playfair Display", Georgia, serif',
};

export const RADIUS_PX: Record<keyof typeof THEME_RADIUS, { box: string; button: string; chip: string }> = {
  none: { box: "0px", button: "0px", chip: "0px" },
  soft: { box: "12px", button: "10px", chip: "9999px" },
  round: { box: "24px", button: "9999px", chip: "9999px" },
};

export const themeColorsSchema = z.object({
  background: hex, surface: hex, text: hex, muted: hex, primary: hex, accent: hex,
});

export const themeConfigSchema = z.object({
  layout: z.enum(["centered", "left", "card"]),
  font: z.enum(["serif", "sans", "elegant"]),
  radius: z.enum(["none", "soft", "round"]),
  avatar: z.enum(["initial", "none"]),
  colors: themeColorsSchema,
  show: z.object({ specialties: z.boolean(), whatsapp: z.boolean(), instagram: z.boolean(), location: z.boolean() }),
});
export type ThemeConfig = z.infer<typeof themeConfigSchema>;

/** Tema de reserva (igual ao modelo "Nude clássico"), usado se o banco não devolver um tema válido. */
export const FALLBACK_THEME: ThemeConfig = {
  layout: "centered", font: "serif", radius: "soft", avatar: "initial",
  colors: { background: "#faf7f2", surface: "#ffffff", text: "#3a3330", muted: "#6f6560", primary: "#5b4636", accent: "#b8975a" },
  show: { specialties: true, whatsapp: true, instagram: true, location: true },
};

export function parseTheme(raw: unknown): ThemeConfig {
  const r = themeConfigSchema.safeParse(raw);
  return r.success ? r.data : FALLBACK_THEME;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa (WCAG) de uma cor #rrggbb. */
export function luminance(hexColor: string): number {
  const n = parseInt(hexColor.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Cor de texto (branco ou quase preto) com melhor contraste sobre o fundo dado. */
export function readableOn(background: string): string {
  return contrastRatio("#ffffff", background) >= contrastRatio("#1f1b19", background) ? "#ffffff" : "#1f1b19";
}

/** Regras de acessibilidade para salvar um modelo: texto legível sobre fundo e sobre cartão. */
export function themeContrastIssues(colors: z.infer<typeof themeColorsSchema>): string[] {
  const issues: string[] = [];
  if (contrastRatio(colors.text, colors.background) < 4.5) issues.push("Texto e fundo precisam de contraste mínimo de 4,5:1.");
  if (contrastRatio(colors.text, colors.surface) < 4.5) issues.push("Texto e cartão precisam de contraste mínimo de 4,5:1.");
  if (contrastRatio(colors.muted, colors.background) < 4.5) issues.push("O texto secundário e o fundo precisam de contraste mínimo de 4,5:1.");
  return issues;
}
