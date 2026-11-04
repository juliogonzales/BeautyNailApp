import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

/** Cliente Supabase para Server Components, Server Actions e Route Handlers (usa só a chave pública + RLS). */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de um Server Component (somente leitura): o middleware já renova a sessão.
        }
      },
    },
  });
}
