import { describe, expect, it } from "vitest";
import { checkLimit, describeFeature } from "@/lib/plan-limits";

describe("checkLimit", () => {
  it("nega quando a feature está desligada no plano", () => {
    expect(checkLimit({ enabled: false, limitValue: null, used: 0 })).toMatchObject({ allowed: false, reason: "disabled" });
  });

  it("limite nulo = ilimitado", () => {
    expect(checkLimit({ enabled: true, limitValue: null, used: 9999 })).toMatchObject({ allowed: true, unlimited: true, remaining: null });
  });

  it("permite até o limite e bloqueia depois", () => {
    expect(checkLimit({ enabled: true, limitValue: 30, used: 29 })).toMatchObject({ allowed: true, remaining: 1 });
    expect(checkLimit({ enabled: true, limitValue: 30, used: 30 })).toMatchObject({ allowed: false, reason: "limit_reached", remaining: 0 });
  });

  it("considera o incremento pedido", () => {
    expect(checkLimit({ enabled: true, limitValue: 10, used: 8 }, 2).allowed).toBe(true);
    expect(checkLimit({ enabled: true, limitValue: 10, used: 8 }, 3).allowed).toBe(false);
  });

  it("limite zero bloqueia tudo", () => {
    expect(checkLimit({ enabled: true, limitValue: 0, used: 0 }).allowed).toBe(false);
  });
});

describe("describeFeature", () => {
  it("descreve flags e limites", () => {
    expect(describeFeature({ enabled: true, limitValue: null, kind: "flag", unit: null })).toBe("Incluído");
    expect(describeFeature({ enabled: false, limitValue: null, kind: "flag", unit: null })).toBe("Não incluído");
    expect(describeFeature({ enabled: true, limitValue: null, kind: "limit", unit: "clientes" })).toBe("Ilimitado");
    expect(describeFeature({ enabled: true, limitValue: 30, kind: "limit", unit: "clientes" })).toBe("30 clientes");
    expect(describeFeature({ enabled: false, limitValue: null, kind: "limit", unit: "MB" })).toBe("Indisponível");
  });
});
