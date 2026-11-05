import { describe, expect, it } from "vitest";
import { centsToInput, formatDuration, groupByCategory, serviceSchema } from "@/lib/services";

const base = { name: "Gel", description: "", category: "", price: "80,00", cost: "", duration: "60" };

describe("serviceSchema", () => {
  it("converte preço em centavos, usa custo 0 e checkboxes", () => {
    const r = serviceSchema.parse({ ...base, isActive: "on" });
    expect(r).toMatchObject({ price: 8000, cost: 0, duration: 60, isActive: true, showOnPage: false, description: null, category: null });
  });
  it("aceita custo e categoria", () => {
    const r = serviceSchema.parse({ ...base, cost: "12,50", category: "Mãos" });
    expect(r.cost).toBe(1250);
    expect(r.category).toBe("Mãos");
  });
  it("rejeita nome curto, preço vazio ou inválido e duração fora da faixa", () => {
    expect(serviceSchema.safeParse({ ...base, name: "G" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, price: "" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, price: "abc" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, duration: "3" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, duration: "900" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, category: "x" }).success).toBe(false);
  });
});

describe("formatação", () => {
  it("duração legível", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(125)).toBe("2h05");
  });
  it("centavos para o campo do formulário", () => {
    expect(centsToInput(8000)).toBe("80,00");
    expect(centsToInput(1250)).toBe("12,50");
  });
  it("agrupa por categoria mantendo a ordem e usa 'Serviços' sem categoria", () => {
    const g = groupByCategory([
      { category: "Mãos", n: 1 }, { category: null, n: 2 }, { category: "Mãos", n: 3 }, { category: "Pés", n: 4 },
    ]);
    expect(g.map((x) => x.category)).toEqual(["Mãos", "Serviços", "Pés"]);
    expect(g[0]!.items.map((i) => i.n)).toEqual([1, 3]);
  });
});
