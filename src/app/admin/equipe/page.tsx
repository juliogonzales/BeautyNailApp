import type { Metadata } from "next";
import { grantRoleAction, revokeRoleAction } from "@/app/admin/actions";
import { adminButton, adminButtonGhost, adminInput, Card, Field, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { ROLE_LABELS, type PlatformRole } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin";

export const metadata: Metadata = { title: "Equipe" };

export default async function TeamAdminPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const { supabase, user } = await requireAdminPage("equipe");
  const { data: admins, error } = await supabase.rpc("admin_list_platform_admins");
  const list = (admins ?? []) as Array<{ user_id: string; email: string; role: PlatformRole; created_at: string }>;

  return (
    <main className="space-y-6">
      <PageTitle sub="Quem administra a plataforma. A pessoa precisa já ter criado uma conta.">Equipe</PageTitle>
      <Flash params={params} />
      {error ? <p role="alert" className="text-sm text-red-900">Não foi possível carregar a equipe.</p> : null}
      <Card title="Administradores">
        <ul className="divide-y divide-nude">
          {list.map((a) => (
            <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="truncate text-cocoa">{a.email}</p>
                <p className="text-xs text-graphite/70">{ROLE_LABELS[a.role]}</p>
              </div>
              {a.user_id !== user.id ? (
                <form action={revokeRoleAction}>
                  <input type="hidden" name="userId" value={a.user_id} />
                  <button type="submit" className={adminButtonGhost}>Remover acesso</button>
                </form>
              ) : <span className="text-xs text-graphite/70">você</span>}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Conceder acesso">
        <form action={grantRoleAction} className="grid gap-3 sm:grid-cols-3">
          <Field label="E-mail"><input name="email" type="email" required className={adminInput} /></Field>
          <Field label="Papel">
            <select name="role" defaultValue="support" className={adminInput}>
              <option value="support">Suporte (negócios, especialidades, auditoria)</option>
              <option value="billing">Financeiro (planos e recursos)</option>
              <option value="superadmin">Superadmin (tudo)</option>
            </select>
          </Field>
          <div className="flex items-end"><button type="submit" className={adminButton}>Conceder</button></div>
        </form>
      </Card>
    </main>
  );
}
