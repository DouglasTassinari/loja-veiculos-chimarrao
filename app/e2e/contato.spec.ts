import { alerta, entrarNoErp, expect, test } from "./fixtures";

test("mostra endereço, mapa embutido e rota; links abrem em outra aba", async ({ page }) => {
  await page.goto("/contato");
  await expect(page.getByText(/Rua Campeiro, 99/).first()).toBeVisible();
  const mapa = page.locator('iframe[src*="google.com/maps"]');
  await expect(mapa).toHaveCount(1);
  await expect(mapa).toHaveAttribute("title", /.+/);
  const rotas = page.locator('a[href*="google.com/maps"]');
  expect(await rotas.count()).toBeGreaterThan(0);
  for (const a of await rotas.all()) { await expect(a).toHaveAttribute("target", "_blank"); await expect(a).toHaveAttribute("rel", /noopener/); }
  await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
});

test("não aceita contato sem WhatsApp válido; aceita o completo e cria o lead no funil", async ({ page }) => {
  await page.goto("/contato");
  const form = page.locator("form").filter({ has: page.locator('input[name="consent"]') });
  await form.locator('input[name="name"]').fill("Pessoa Contato E2E");
  await form.locator('input[name="phone"]').fill("123");
  await form.locator('input[name="consent"]').check();
  await form.getByRole("button", { name: "Enviar" }).click();
  await expect(page).toHaveURL(/erro=1/);
  await expect(alerta(page)).toContainText("Confira o nome");

  await form.locator('input[name="name"]').fill("Pessoa Contato E2E");
  await form.locator('input[name="phone"]').fill("(51) 98123-4567");
  await form.locator('textarea[name="message"]').fill("Quero saber sobre financiamento de SUV.");
  await form.locator('input[name="consent"]').check();
  await form.getByRole("button", { name: "Enviar" }).click();
  await expect(page).toHaveURL(/enviado=1/);
  await expect(page.getByRole("status")).toContainText("Recebemos seu contato");

  await entrarNoErp(page);
  await page.goto("/erp/leads");
  const card = page.locator("article").filter({ hasText: "Pessoa Contato E2E" });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("contato");
  await expect(card).toContainText("financiamento de SUV");
});

test("o consentimento é obrigatório no navegador", async ({ page }) => {
  await page.goto("/contato");
  const form = page.locator("form").filter({ has: page.locator('input[name="consent"]') });
  await form.locator('input[name="name"]').fill("Sem Consentimento");
  await form.locator('input[name="phone"]').fill("(51) 98123-0000");
  await form.getByRole("button", { name: "Enviar" }).click();
  await expect(page).not.toHaveURL(/enviado=1/);
  expect(await form.locator('input[name="consent"]').evaluate((i: HTMLInputElement) => i.validity.valueMissing)).toBe(true);
});
