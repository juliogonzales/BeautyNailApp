import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

beforeEach(() => resetRateLimits());

describe("rateLimit", () => {
  it("permite até o limite dentro da janela e depois bloqueia", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, 0).ok).toBe(true);
    const blocked = rateLimit("k", 3, 1000, 500);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(500);
  });

  it("reabre após a janela", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 1000, 0);
    expect(rateLimit("k", 3, 1000, 1001).ok).toBe(true);
  });

  it("chaves diferentes não interferem", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", 3, 1000, 0);
    expect(rateLimit("b", 3, 1000, 0).ok).toBe(true);
  });
});
