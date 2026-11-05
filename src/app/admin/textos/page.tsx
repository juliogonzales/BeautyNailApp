import type { Metadata } from "next";
import { saveProductNameAction, saveWelcomeAction } from "@/app/admin/actions";
import { adminButton, adminInput, Card, Field, Flash, PageTitle, type FlashParams } from "@/components/admin-ui";
import { requireAdminPage } from "@/lib/admin";
import { getWelcomeContent } from "@/lib/welcome-content";
import { getProductName } from "@/lib/product";

export const metadata: Metadata = { title: "Textos" };

const EXTRA_ROWS = 2;

export default async function TextsAdminPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const { supabase } = await requireAdminPage("textos");
  const [{ benefits, guarantees }, productName] = await Promise.all([getWelcomeContent(supabase), getProductName()]);

  const benefitRows = [...benefits, ...Array.from({ length: EXTRA_ROWS }, () => ({ title: "", text: "", available: false }))];
  const guaranteeRows = [...guarantees, ...Array.from({ length: EXTRA_ROWS }, () => "")];

  return (
    <main className="space-y-6">
      <PageTitle sub="Textos que a profissional vê ao entrar. Só marque “Disponível” no que já funciona.">Textos do sistema</PageTitle>
      <Flash params={params} />

      <Card title="Nome do produto">
        <form action={saveProductNameAction} className="flex items-end gap-3">
          <div className="flex-1"><Field label="Nome"><input name="productName" required defaultValue={productName} className={adminInput} /></Field></div>
          <button type="submit" className={adminButton}>Salvar</button>
        </form>
      </Card>

      <form action={saveWelcomeAction} className="space-y-6">
        <Card title="Benefícios (tela Bem-vinda)">
          <ul className="space-y-4">
            {benefitRows.map((b, i) => (
              <li key={i} className="rounded-lg border border-nude p-3">
                <Field label={`Título ${i + 1}`}><input name="benefitTitle" defaultValue={b.title} className={adminInput} /></Field>
                <div className="mt-2"><Field label="Texto"><textarea name="benefitText" rows={2} defaultValue={b.text} className={adminInput} /></Field></div>
                <label className="mt-2 flex items-center gap-2 text-sm text-cocoa">
                  <input type="checkbox" name="benefitAvailable" value={i} defaultChecked={b.available} className="h-4 w-4" /> Disponível (senão aparece “Em breve”)
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-graphite/70">Deixe o título vazio para remover um item.</p>
        </Card>
        <Card title="Garantias">
          <ul className="space-y-2">
            {guaranteeRows.map((g, i) => (
              <li key={i}><input name="guarantee" aria-label={`Garantia ${i + 1}`} defaultValue={g} className={adminInput} /></li>
            ))}
          </ul>
        </Card>
        <button type="submit" className={adminButton}>Salvar textos</button>
      </form>
    </main>
  );
}
