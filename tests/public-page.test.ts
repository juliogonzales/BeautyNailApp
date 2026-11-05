import { describe, expect, it } from "vitest";
import {
  instagramUrl, normalizeInstagram, normalizeWhatsapp, publicTenantSchema, publicUrl, safeHexColor,
  whatsappContactLink, whatsappShareLink,
} from "@/lib/public-page";
import { publicProfileSchema } from "@/lib/validation";

describe("página pública", () => {
  it("monta o endereço sem barra duplicada", () => {
    expect(publicUrl("https://app.exemplo.com/", "joy")).toBe("https://app.exemplo.com/joy");
  });

  it("normaliza WhatsApp brasileiro", () => {
    expect(normalizeWhatsapp("(11) 91234-5678")).toBe("5511912345678");
    expect(normalizeWhatsapp("+55 11 91234-5678")).toBe("5511912345678");
    expect(normalizeWhatsapp("123")).toBeNull();
    expect(normalizeWhatsapp(null)).toBeNull();
  });

  it("gera links wa.me", () => {
    expect(whatsappContactLink("11912345678", "Oi!")).toBe("https://wa.me/5511912345678?text=Oi!");
    expect(whatsappContactLink("")).toBeNull();
    expect(whatsappShareLink("https://x.com/joy", "Joy Nails")).toBe(
      `https://wa.me/?text=${encodeURIComponent("Joy Nails: https://x.com/joy")}`,
    );
  });

  it("aceita @usuario e URL do Instagram, rejeita lixo", () => {
    expect(normalizeInstagram("@joy.nails")).toBe("joy.nails");
    expect(normalizeInstagram("https://www.instagram.com/joy.nails/?hl=pt")).toBe("joy.nails");
    expect(normalizeInstagram("joy nails")).toBeNull();
    expect(normalizeInstagram("javascript:alert(1)")).toBeNull();
    expect(instagramUrl("@joy")).toBe("https://instagram.com/joy");
  });

  it("só aceita cor hexadecimal válida", () => {
    expect(safeHexColor("#aabbcc", "#000000")).toBe("#aabbcc");
    expect(safeHexColor("red; background:url(x)", "#000000")).toBe("#000000");
    expect(safeHexColor(null, "#111111")).toBe("#111111");
  });

  it("valida o formato devolvido pela RPC", () => {
    const ok = publicTenantSchema.safeParse({
      slug: "joy", business_name: "Joy", city: null, state: null, neighborhood: null, address_line: null,
      whatsapp: null, instagram: null, primary_color: null, accent_color: null, specialties: ["Nail design"],
    });
    expect(ok.success).toBe(true);
    expect(publicTenantSchema.safeParse({ slug: "joy" }).success).toBe(false);
  });
});

describe("publicProfileSchema", () => {
  it("campos vazios viram null", () => {
    const r = publicProfileSchema.parse({ whatsapp: "", instagram: "", city: "", state: "" });
    expect(r).toEqual({ whatsapp: null, instagram: null, city: null, state: null });
  });

  it("limpa e valida", () => {
    const r = publicProfileSchema.parse({ whatsapp: "(11) 91234-5678", instagram: "@joy", city: " Santos ", state: "sp" });
    expect(r).toEqual({ whatsapp: "11912345678", instagram: "joy", city: "Santos", state: "SP" });
  });

  it("rejeita telefone, usuário e UF inválidos", () => {
    expect(publicProfileSchema.safeParse({ whatsapp: "123", instagram: "", city: "", state: "" }).success).toBe(false);
    expect(publicProfileSchema.safeParse({ whatsapp: "", instagram: "a b", city: "", state: "" }).success).toBe(false);
    expect(publicProfileSchema.safeParse({ whatsapp: "", instagram: "", city: "", state: "XX" }).success).toBe(false);
  });
});
