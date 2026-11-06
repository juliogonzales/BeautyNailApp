import { describe, expect, it } from "vitest";
import { parseBRLToCents, parsePercentToBp, parseWholeNumber } from "@/lib/pricing";

describe("parseBRLToCents", () => {
  it.each([
    ["12,50", 1250],
    ["1.234,56", 123456],
    ["R$ 80", 8000],
    ["12.5", 1250],
    ["1.200", 120000],
    ["0,5", 50],
  ])("converte %s", (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "1,234", "-5", "12,5,5"])("rejeita %s", (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});

describe("parsePercentToBp / parseWholeNumber", () => {
  it("converte percentuais para pontos-base", () => {
    expect(parsePercentToBp("5")).toBe(500);
    expect(parsePercentToBp("4,5")).toBe(450);
    expect(parsePercentToBp("20%")).toBe(2000);
  });

  it("rejeita percentuais inválidos", () => {
    expect(parsePercentToBp("101")).toBeNull();
    expect(parsePercentToBp("-1")).toBeNull();
    expect(parsePercentToBp("x")).toBeNull();
  });

  it("aceita só inteiros não negativos", () => {
    expect(parseWholeNumber("90")).toBe(90);
    expect(parseWholeNumber("9,5")).toBeNull();
    expect(parseWholeNumber("")).toBeNull();
  });
});
