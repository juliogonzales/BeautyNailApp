import { expect, test } from "@playwright/test";

const stamp = Date.now().toString(36);
const email = `e2e-${stamp}@example.com`;
const senha = "Senha-e2e-12345";
const negocio = `Studio E2E ${stamp}`;
const slug = `studio-e2e-${stamp}`;
const servico = `Esmaltação E2E ${stamp}`;

test("jornada: cadastro → negócio → serviço → página pública", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Profissional E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(senha);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/bem-vinda/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bem-vinda");

  await page.goto("/onboarding");
  await page.getByLabel("Nome do seu negócio").fill(negocio);
  await page.getByLabel("Endereço da sua página").fill(slug);
  await page.locator('input[name="specialtyIds"]').first().check();
  await page.getByRole("button", { name: "Criar meu negócio" }).click();
  await expect(page).toHaveURL(/\/painel/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(negocio);

  await page.goto("/painel/servicos");
  const novo = page.locator("section", { has: page.getByRole("heading", { name: "Novo serviço" }) });
  await novo.getByLabel("Nome do serviço").fill(servico);
  await novo.getByLabel("Preço (R$)").fill("80,00");
  await novo.getByLabel("Duração (minutos)").fill("60");
  await novo.getByRole("button", { name: "Adicionar serviço" }).click();
  await expect(page.getByText(servico).first()).toBeVisible();

  await page.goto(`/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(negocio);
  await expect(page.getByText(servico)).toBeVisible();
  await expect(page.getByText(/80,00/)).toBeVisible();

  await page.goto("/painel/calculadora");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("usuária sem permissão recebe 404 em /admin", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/painel/);
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
});

test("anônima: /painel manda para o login e página inexistente dá 404", async ({ page }) => {
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/login/);
  const res = await page.goto("/nao-existe-" + stamp);
  expect(res?.status()).toBe(404);
});
