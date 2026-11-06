import { describe, expect, it } from "vitest";
import { materialsToText, parseMaterialLines, parseServiceLines, servicesToText } from "@/lib/admin-validation";

describe("serviços-modelo da calculadora", () => {
  it("lê linhas 'Nome | minutos' e corrige minutos inválidos para 60", () => {
    expect(parseServiceLines("Corte | 40\nBarba|30\nSelagem | abc\n\n | 10")).toEqual([
      { name: "Corte", minutes: 40 },
      { name: "Barba", minutes: 30 },
      { name: "Selagem", minutes: 60 },
    ]);
  });
  it("limita a 40 serviços e ida e volta preserva o conteúdo", () => {
    const many = Array.from({ length: 50 }, (_, i) => `S${i} | 30`).join("\n");
    expect(parseServiceLines(many)).toHaveLength(40);
    const list = [{ name: "Corte", minutes: 40 }];
    expect(parseServiceLines(servicesToText(list))).toEqual(list);
  });
  it("materiais: unidade padrão 'un'", () => {
    expect(parseMaterialLines("Esmalte | ml\nLixa")).toEqual([{ name: "Esmalte", unit: "ml" }, { name: "Lixa", unit: "un" }]);
    expect(materialsToText([{ name: "Lixa" }])).toBe("Lixa | un");
  });
});
