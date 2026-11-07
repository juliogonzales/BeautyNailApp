import { expect, test, type Browser, type Page } from "@playwright/test";

const stamp = Date.now().toString(36);
const senha = "Senha-e2e-12345";

type Conta = { page: Page; slug: string; negocio: string; servico: string };

async function criarConta(browser: Browser, letra: "a" | "b"): Promise<Conta> {
  const context = await browser.newContext({ locale: "pt-BR" });
  const page = await context.newPage();
  const slug = `iso-${letra}-${stamp}`;
  const negocio = `Studio ${letra.toUpperCase()} ${stamp}`;
  const servico = `Serviço secreto ${letra.toUpperCase()} ${stamp}`;

  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(`Profissional ${letra.toUpperCase()}`);
  await page.getByLabel("E-mail").fill(`iso-${letra}-${stamp}@example.com`);
  await page.getByLabel(/^Senha/).fill(senha);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/bem-vinda/);

  await page.goto("/onboarding");
  await page.getByLabel("Nome do seu negócio").fill(negocio);
  await page.getByLabel("Endereço da sua página").fill(slug);
  await page.locator('input[name="specialtyIds"]').first().check();
  await page.getByRole("button", { name: "Criar meu negócio" }).click();
  await expect(page).toHaveURL(/\/painel/);

  await page.goto("/painel/servicos");
  const novo = page.locator("section", { has: page.getByRole("heading", { name: "Novo serviço" }) });
  await novo.getByLabel("Nome do serviço").fill(servico);
  await novo.getByLabel("Preço (R$)").fill("90,00");
  await novo.getByLabel("Duração (minutos)").fill("60");
  await novo.getByRole("button", { name: "Adicionar serviço" }).click();
  await expect(page.getByText(servico).first()).toBeVisible();
  return { page, slug, negocio, servico };
}

test("profissional A não enxerga dados da profissional B (e vice-versa)", async ({ browser }) => {
  const a = await criarConta(browser, "a");
  const b = await criarConta(browser, "b");

  // Painel de cada uma mostra só o que é dela.
  for (const [eu, outra] of [[a, b], [b, a]] as const) {
    await eu.page.goto("/painel/servicos");
    await expect(eu.page.getByText(eu.servico).first()).toBeVisible();
    await expect(eu.page.getByText(outra.servico)).toHaveCount(0);

    await eu.page.goto("/painel");
    await expect(eu.page.getByText(outra.negocio)).toHaveCount(0);

    // A página pública da outra mostra o negócio dela, nunca o meu serviço.
    await eu.page.goto(`/${outra.slug}`);
    await expect(eu.page.getByText(outra.servico)).toBeVisible();
    await expect(eu.page.getByText(eu.servico)).toHaveCount(0);
  }

  // Conteúdo privado do console não é alcançável por nenhuma das duas.
  for (const eu of [a, b]) {
    const res = await eu.page.goto("/admin");
    expect(res?.status()).toBe(404);
  }

  await a.page.context().close();
  await b.page.context().close();
});
