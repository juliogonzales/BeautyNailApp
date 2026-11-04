import { headers } from "next/headers";

/** IP do cliente (primeiro da cadeia x-forwarded-for) para chaves de rate limit. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
