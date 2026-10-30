import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import { entrarNoErp, expect, imagensQuebradas, semRolagemLateral, test } from "./fixtures";

const PUBLICAS: [string, string][] = [
  ["inicio", "/"], ["estoque", "/estoque"], ["estoque-motos", "/estoque?kind=moto"], ["destaques", "/destaques"], ["sobre", "/sobre"],
  ["contato", "/contato"], ["reconhecimento", "/reconhecimento"], ["certificacoes", "/certificacoes"], ["creditos", "/creditos"],
];
const ERP: [string, string][] = [
  ["erp-painel", "/erp"], ["erp-estoque", "/erp/veiculos"], ["erp-funil", "/erp/leads"], ["erp-clientes", "/erp/clientes"],
  ["erp-tarefas", "/erp/tarefas"], ["erp-vendas", "/erp/vendas"], ["erp-caixa", "/erp/caixa"], ["erp-novo-veiculo", "/erp/veiculos/novo"], ["erp-nova-venda", "/erp/vendas/nova"],
];

const pasta = (info: TestInfo, nome: string) => `${process.env.E2E_SCREENS ?? "e2e-screens"}/${info.project.name}/${nome}.png`;

async function violacoes(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} [${v.impact}] ${v.help} — ${v.nodes.length}x, ex.: ${v.nodes[0]?.target.join(" ")}`);
}

async function foto(page: Page, info: TestInfo, nome: string) {
  await imagensQuebradas(page);
  await page.screenshot({ path: pasta(info, nome), fullPage: true });
}

test.describe("site público", () => {
  for (const [nome, path] of PUBLICAS) {
    test(`${nome}: aparência, imagens, rolagem e acessibilidade`, async ({ page }, info) => {
      await page.goto(path);
      await foto(page, info, nome);
      expect(await semRolagemLateral(page)).toBe(true);
      expect(await violacoes(page)).toEqual([]);
    });
  }

  test("anúncio do veículo", async ({ page }, info) => {
    await page.goto("/estoque");
    await page.locator('article a[href^="/veiculo/"]').first().click();
    await foto(page, info, "veiculo");
    expect(await violacoes(page)).toEqual([]);
  });

  test("anúncio com a simulação aberta", async ({ page }, info) => {
    await page.addInitScript(() => localStorage.setItem("chimarrao_contato", JSON.stringify({ name: "Ana Souza", phone: "(51) 98765-4321" })));
    await page.goto("/estoque");
    await page.locator('article a[href^="/veiculo/"]').first().click();
    await expect(page.getByRole("heading", { name: "Simulação de financiamento" })).toBeVisible();
    await foto(page, info, "veiculo-simulacao");
    expect(await semRolagemLateral(page)).toBe(true);
    expect(await violacoes(page)).toEqual([]);
  });

  test("assistente virtual aberto, com sugestões e orçamento", async ({ page }, info) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir o assistente virtual" }).click();
    const chat = page.getByRole("dialog", { name: "Assistente virtual" });
    await expect(chat.getByText(/Sou o assistente virtual/)).toBeVisible();
    await page.screenshot({ path: pasta(info, "chat-inicio") });
    await chat.getByLabel("Sua mensagem").fill("quero um carro até 150 mil");
    await chat.getByRole("button", { name: "Enviar", exact: true }).click();
    await chat.getByRole("button", { name: "Para a família" }).click();
    await expect(chat.getByRole("list", { name: "Veículos sugeridos" })).toBeVisible();
    await page.screenshot({ path: pasta(info, "chat-sugestoes") });
    expect(await violacoes(page)).toEqual([]);
  });

  test("menu do celular abre e fecha", async ({ page }, info) => {
    test.skip(info.project.name !== "celular", "só no celular");
    await page.goto("/");
    await page.locator("header details summary").click();
    await page.screenshot({ path: pasta(info, "menu-aberto") });
    await expect(page.locator("header details").getByRole("link", { name: "Estoque" })).toBeVisible();
  });
});

test.describe("ERP", () => {
  test.beforeEach(async ({ page }) => { await entrarNoErp(page); });

  for (const [nome, path] of ERP) {
    test(`${nome}: aparência, rolagem e acessibilidade`, async ({ page }, info) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await foto(page, info, nome);
      expect(await semRolagemLateral(page), "rolagem lateral").toBe(true);
      expect(await violacoes(page)).toEqual([]);
    });
  }

  test("ficha do veículo, cliente e login", async ({ page, context }, info) => {
    await page.goto("/erp/veiculos");
    await page.locator("tbody a[href^='/erp/veiculos/']").first().click();
    await foto(page, info, "erp-ficha-veiculo");
    expect(await violacoes(page)).toEqual([]);

    await page.goto("/erp/clientes");
    await page.locator("tbody a[href^='/erp/clientes/']").first().click();
    await foto(page, info, "erp-cliente");
    expect(await violacoes(page)).toEqual([]);

    await context.clearCookies();
    await page.goto("/erp/login");
    await foto(page, info, "erp-login");
    expect(await violacoes(page)).toEqual([]);
  });
});
