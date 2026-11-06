import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, blockSchema, blocksSchema, createBlock, moveBlock, parseBlocks, starterBlocks } from "@/lib/page-blocks";

describe("blocos da página", () => {
  it("todo bloco novo já nasce válido", () => {
    for (const t of BLOCK_TYPES) expect(blockSchema.safeParse(createBlock(t)).success).toBe(true);
    expect(blocksSchema.safeParse(starterBlocks()).success).toBe(true);
  });

  it("botão só aceita link https (bloqueia javascript: e http:)", () => {
    const base = { ...createBlock("button"), kind: "link" as const, label: "Agendar" };
    expect(blockSchema.safeParse({ ...base, url: "https://exemplo.com/a" }).success).toBe(true);
    expect(blockSchema.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(false);
    expect(blockSchema.safeParse({ ...base, url: "http://exemplo.com" }).success).toBe(false);
  });

  it("rejeita textos acima do limite e mais de 30 blocos", () => {
    expect(blockSchema.safeParse({ ...createBlock("text"), body: "x".repeat(1001) }).success).toBe(false);
    expect(blocksSchema.safeParse(Array.from({ length: 31 }, () => createBlock("services"))).success).toBe(false);
  });

  it("parseBlocks descarta blocos inválidos e trata vazio como página automática", () => {
    const ok = createBlock("hours");
    expect(parseBlocks([ok, { type: "script", id: "abcd" }, "lixo"])).toEqual([ok]);
    expect(parseBlocks([])).toBeNull();
    expect(parseBlocks(null)).toBeNull();
    expect(parseBlocks({})).toBeNull();
  });

  it("moveBlock troca de lugar e respeita as pontas", () => {
    expect(moveBlock([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveBlock([1, 2, 3], 1, 1)).toEqual([1, 3, 2]);
    expect(moveBlock([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveBlock([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });
});
