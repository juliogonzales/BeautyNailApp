import { z } from "zod";

/** Transforma um nome em slug válido (sem acento, minúsculas, hífens, até 40 caracteres). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

// Mesma regra do banco (tenants.slug): 3–40 caracteres, sem hífen duplo, sem hífen nas pontas.
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "Use de 3 a 40 letras minúsculas, números e hífen (sem hífen no começo ou fim).")
  .refine((s) => !s.includes("--"), "Não use dois hífens seguidos.");

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha.").max(72),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome.").max(120),
  email: emailSchema,
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres.").max(72, "A senha deve ter no máximo 72 caracteres."),
});

export const onboardingSchema = z.object({
  businessName: z.string().trim().min(2, "O nome precisa ter ao menos 2 caracteres.").max(80, "O nome pode ter no máximo 80 caracteres."),
  slug: slugSchema,
  specialtyIds: z.array(z.string().uuid()).max(16),
});

const UF = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

/** Perfil público: tudo opcional. Vazio vira null (apaga o campo). */
export const publicProfileSchema = z.object({
  whatsapp: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), "Informe o WhatsApp com DDD, ex.: (11) 91234-5678.")
    .transform((v) => (v === "" ? null : v)),
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0] ?? "")
    .refine((v) => v === "" || /^[A-Za-z0-9._]{1,30}$/.test(v), "Use só o nome de usuário, ex.: joyvega.nails")
    .transform((v) => (v === "" ? null : v)),
  city: z.string().trim().max(80, "Máximo de 80 caracteres.").transform((v) => (v === "" ? null : v)),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || (UF as readonly string[]).includes(v), "Escolha um estado válido.")
    .transform((v) => (v === "" ? null : v)),
});
