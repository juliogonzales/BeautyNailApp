import type { SupabaseClient } from "@supabase/supabase-js";

/** Estado de uma feature para um negócio. `limitValue === null` significa ilimitado. */
export type FeatureState = { enabled: boolean; limitValue: number | null; used: number };

export type LimitCheck = {
  allowed: boolean;
  unlimited: boolean;
  remaining: number | null;
  reason: "ok" | "disabled" | "limit_reached";
};

/** Regra pura: dá para usar mais `increment` unidades desta feature? */
export function checkLimit(state: FeatureState, increment = 1): LimitCheck {
  if (!state.enabled) {
    return { allowed: false, unlimited: false, remaining: 0, reason: "disabled" };
  }
  if (state.limitValue === null) {
    return { allowed: true, unlimited: true, remaining: null, reason: "ok" };
  }
  const remaining = Math.max(state.limitValue - state.used, 0);
  const allowed = state.used + increment <= state.limitValue;
  return { allowed, unlimited: false, remaining, reason: allowed ? "ok" : "limit_reached" };
}

/** Lê do banco (RPC tenant_feature) o estado atual da feature. Nenhum limite fica fixo no código. */
export async function getFeatureState(
  supabase: SupabaseClient,
  tenantId: string,
  key: string,
): Promise<FeatureState> {
  const { data, error } = await supabase.rpc("tenant_feature", { p_tenant: tenantId, p_key: key });
  if (error) throw new Error(`Falha ao consultar a feature "${key}": ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { enabled: false, limitValue: null, used: 0 };
  return {
    enabled: Boolean(row.enabled),
    limitValue: row.limit_value ?? null,
    used: Number(row.used ?? 0),
  };
}

/** Para usar nas Server Actions das próximas fases: lança erro se a feature não permitir mais uso. */
export async function assertFeatureAllowed(
  supabase: SupabaseClient,
  tenantId: string,
  key: string,
  increment = 1,
): Promise<LimitCheck> {
  const result = checkLimit(await getFeatureState(supabase, tenantId, key), increment);
  if (!result.allowed) {
    throw new Error(result.reason === "disabled" ? "feature_disabled" : "limit_reached");
  }
  return result;
}

/** Texto para a interface a partir de uma linha de plan_features + features. */
export function describeFeature(row: {
  enabled: boolean;
  limitValue: number | null;
  kind: "flag" | "limit";
  unit: string | null;
}): string {
  if (!row.enabled) return row.kind === "flag" ? "Não incluído" : "Indisponível";
  if (row.kind === "flag") return "Incluído";
  if (row.limitValue === null) return "Ilimitado";
  const amount = row.limitValue.toLocaleString("pt-BR");
  return row.unit ? `${amount} ${row.unit}` : amount;
}
