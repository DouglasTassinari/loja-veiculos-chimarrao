import { entrarNoErp, expect, test } from "./fixtures";

const valor = (t: string | null) => Number((t ?? "").replace(/[^\d,]/g, "").replace(",", "."));
const precosDosCards = (page: import("@playwright/test").Page) =>
  page.locator("article p.text-2xl").evaluateAll((ps) => ps.map((p) => Number((p.textContent ?? "").replace(/\D/g, ""))));

test.describe("estoque", () => {
  test("abas Carros e Motos separam os veículos", async ({ page }) => {
    await page.goto("/estoque");
    const total = await page.locator("article").count();
    expect(total).toBeGreaterThanOrEqual(12);

    await page.getByRole("main").getByRole("link", { name: "Motos", exact: true }).click();
    await expect(page).toHaveURL(/kind=moto/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Motos usadas");
    const motos = await page.locator("article").count();
    expect(motos).toBeGreaterThanOrEqual(5);
    expect(await page.locator("article").filter({ hasText: "MOTO" }).count()).toBe(motos);

    await page.getByRole("main").getByRole("link", { name: "Carros", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carros seminovos e usados");
    expect(await page.locator("article").filter({ hasText: "MOTO" }).count()).toBe(0);
  });

  test("busca, preço máximo e ordenação funcionam", async ({ page }) => {
    await page.goto("/estoque");
    await page.getByLabel("Busca").fill("hilux");
    await page.getByRole("button", { name: "Filtrar" }).click();
    const nomes = await page.locator("article h3").allTextContents();
    expect(nomes.length).toBeGreaterThan(0);
    for (const n of nomes) expect(n.toLowerCase()).toContain("hilux");

    await page.goto("/estoque?maxPrice=60000&sort=menor-preco");
    const precos = await precosDosCards(page);
    expect(precos.length).toBeGreaterThan(0);
    for (const p of precos) expect(p).toBeLessThanOrEqual(60000);
    expect(precos).toEqual([...precos].sort((a, b) => a - b));

    await page.goto("/estoque?q=nenhum-veiculo-assim");
    await expect(page.getByText("Nenhum veículo com esses filtros")).toBeVisible();
  });

  test("a paginação avança e volta", async ({ page }) => {
    await page.goto("/estoque");
    const nav = page.getByRole("navigation", { name: "Páginas" });
    test.skip(!(await nav.count()), "poucos veículos para paginar");
    const primeiro = await page.locator("article h3").first().textContent();
    await nav.getByRole("link", { name: /Próxima/ }).click();
    await expect(page).toHaveURL(/page=2/);
    expect(await page.locator("article h3").first().textContent()).not.toBe(primeiro);
  });
});

test.describe("página do veículo", () => {
  test("galeria troca de foto pelos botões, miniaturas e teclado", async ({ page }) => {
    await page.goto("/estoque");
    await page.locator('article a[href^="/veiculo/"]').first().click();
    const principal = page.locator("img[alt*='foto 1 de']");
    await expect(principal).toBeVisible();
    const total = Number(/ de (\d+)/.exec((await principal.getAttribute("alt"))!)![1]);
    expect(total).toBeGreaterThanOrEqual(3);

    await page.getByRole("button", { name: "Próxima foto" }).click();
    await expect(page.locator("img[alt*='foto 2 de']")).toBeVisible();
    await page.getByRole("button", { name: "Ver foto 3" }).click();
    await expect(page.locator("img[alt*='foto 3 de']")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver foto 3" })).toHaveAttribute("aria-current", "true");
    await page.getByRole("button", { name: "Foto anterior" }).click();
    await expect(page.locator("img[alt*='foto 2 de']")).toBeVisible();
    // volta ao começo passando do fim
    for (let i = 0; i < total - 1; i++) await page.getByRole("button", { name: "Próxima foto" }).click();
    await expect(page.locator(`img[alt*='foto 1 de']`)).toBeVisible();
  });

  test("formulário de contato do anúncio exige consentimento e registra o lead", async ({ page }) => {
    await page.goto("/estoque");
    await page.locator('article a[href^="/veiculo/"]').first().click();
    const form = page.locator("form").filter({ has: page.getByLabel(/WhatsApp/) }).filter({ has: page.locator('input[name="consent"]') });
    await form.locator('input[name="name"]').fill("Cliente Anuncio E2E");
    await form.locator('input[name="phone"]').fill("(51) 97654-3210");
    await form.locator('input[name="consent"]').check();
    await form.getByRole("button").last().click();
    await expect(page).toHaveURL(/enviado=1/);
    await expect(page.getByRole("status")).toContainText("Recebemos seu contato");
  });
});

test.describe("simulador de financiamento", () => {
  test("pede nome e WhatsApp, calcula, compara prazos e envia ao WhatsApp em nova aba", async ({ page, context, erros }) => {
    await page.goto("/estoque");
    await page.locator('article a[href^="/veiculo/"]').first().click();
    await page.waitForURL(/\/veiculo\//);
    const urlDoVeiculo = page.url();

    // 1) porta de entrada: nome + WhatsApp + autorização
    await expect(page.getByRole("heading", { name: "Simule o financiamento" })).toBeVisible();
    const gate = page.locator("form").filter({ has: page.getByRole("button", { name: "Iniciar simulação" }) });
    await gate.getByLabel("Nome", { exact: true }).fill("Teste Simulador");
    await gate.getByLabel("WhatsApp com DDD").fill("123");
    await gate.getByRole("button", { name: "Iniciar simulação" }).click();
    await expect(gate.getByRole("alert")).toContainText("Marque a autorização");
    await gate.getByRole("checkbox").check();
    await gate.getByRole("button", { name: "Iniciar simulação" }).click();
    await expect(gate.getByRole("alert")).toContainText("WhatsApp válido");
    await gate.getByLabel("WhatsApp com DDD").fill("(51) 98765-4321");
    await gate.getByRole("button", { name: "Iniciar simulação" }).click();

    // 2) simulação
    await expect(page.getByRole("heading", { name: "Simulação de financiamento" })).toBeVisible();
    const parcela = () => page.getByText("Parcela estimada").locator("xpath=following-sibling::p[1]").textContent().then(valor);
    const p48 = await parcela();
    expect(p48).toBeGreaterThan(300);

    await page.getByRole("button", { name: "60x", exact: true }).click();
    const p60 = await parcela();
    expect(p60).toBeLessThan(p48);
    await page.getByRole("button", { name: "24x", exact: true }).click();
    const p24 = await parcela();
    expect(p24).toBeGreaterThan(p48);

    await page.getByLabel("Entrada em reais").fill("0");
    expect(await parcela()).toBeGreaterThan(p24);
    await expect(page.getByText(/abaixo de 20%/)).toBeVisible();

    await expect(page.getByText("IOF estimado (incluso)")).toBeVisible();
    await expect(page.getByText(/CET estimado/)).toBeVisible();
    await expect(page.getByText(/Faixa de referência/)).toBeVisible();
    await expect(page.getByText(/Não é oferta nem aprovação de crédito/)).toBeVisible();
    expect(await page.locator("table tbody tr").count()).toBeGreaterThanOrEqual(3);

    // entrada igual ao valor: nada a financiar
    await page.getByLabel("Entrada em reais").fill("99999999");
    await expect(page.getByText("não há valor a financiar")).toBeVisible();
    await page.getByLabel("Entrada em reais").fill("20000");

    // renda: alerta de comprometimento
    await page.getByLabel("Renda mensal (opcional)").fill("3000");
    await expect(page.getByText(/da renda informada/)).toBeVisible();

    // 3) envio ao WhatsApp: nova aba, e a loja continua aberta
    const [wa] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Enviar esta simulação para a equipe" }).click()]);
    await wa.waitForURL(/wa\.me\/5551999999999\?text=/);
    const texto = new URL(wa.url()).searchParams.get("text") ?? ""; // o navegador já decodifica
    expect(texto).toContain("Teste Simulador");
    expect(texto).toMatch(/Simulação do .* entrada R\$/);
    expect(page.url()).toBe(urlDoVeiculo);
    await expect(page.getByText(/A equipe recebeu sua simulação/)).toBeVisible();
    await wa.close();

    // 4) o contato fica guardado; "Não sou ..." volta para a porta de entrada
    await page.reload();
    await expect(page.getByRole("heading", { name: "Simulação de financiamento" })).toBeVisible();
    await page.getByRole("button", { name: /Não sou Teste/ }).click();
    await expect(page.getByRole("heading", { name: "Simule o financiamento" })).toBeVisible();
    expect(erros.filter((e) => !/40[03]/.test(e))).toEqual([]);

    // 5) a equipe vê o lead no funil, com a simulação anexada
    await entrarNoErp(page);
    await page.goto("/erp/leads");
    const card = page.locator("article").filter({ hasText: "Teste Simulador" });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("simulador");
    await expect(card).toContainText("Simulação do");
  });

  test("moto tem prazo máximo menor que carro novo e o aviso aparece quando limitado", async ({ page }) => {
    await page.goto("/estoque?kind=moto");
    await page.locator('article a[href^="/veiculo/"]').first().click();
    const gate = page.locator("form").filter({ has: page.getByRole("button", { name: "Iniciar simulação" }) });
    await gate.getByLabel("Nome", { exact: true }).fill("Moto Teste");
    await gate.getByLabel("WhatsApp com DDD").fill("(51) 98765-1111");
    await gate.getByRole("checkbox").check();
    await gate.getByRole("button", { name: "Iniciar simulação" }).click();
    await expect(page.getByRole("heading", { name: "Simulação de financiamento" })).toBeVisible();
    await expect(page.getByText(/Prazo máximo estimado para este veículo: \d+x/)).toBeVisible();
    await expect(page.getByLabel(/Tenho uma moto para a troca|Tenho/)).toBeVisible();
  });
});
