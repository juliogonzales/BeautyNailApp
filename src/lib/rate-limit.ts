// Limitador em memória (por instância). Suficiente para frear abuso simples na Fase 1;
// em produção serverless cada instância tem o seu contador — trocar por Redis/Upstash (ver docs/DECISIONS.md D-010).
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 5000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): { ok: boolean; retryAfterMs: number } {
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

export function resetRateLimits(): void {
  buckets.clear();
}
