import { expect, imagensQuebradas, semRolagemLateral, test } from "./fixtures";

const PAGINAS = [
  { path: "/", h1: /Seu próximo caminho começa aqui/ },
  { path: "/estoque", h1: /Carros e motos usados/ },
  { path: "/destaques", h1: /seleção da equipe/i },
  { path: "/sobre", h1: /Tradição que acolhe/ },
  { path: "/contato", h1: /./ },
  { path: "/reconhecimento", h1: /./ },
  { path: "/certificacoes", h1: /./ },
  { path: "/creditos", h1: /./ },
];

for (const p of PAGINAS) {
  test(`${p.path}: abre sem erro, com imagens, sem rolagem lateral e com os avisos obrigatórios`, async ({ page, erros }) => {
    const res = await page.goto(p.path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(p.h1);
    expect((await page.title()).length).toBeGreaterThan(8);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{30,}/);

    expect(await imagensQuebradas(page), "imagens que não carregaram").toEqual([]);
    expect(await semRolagemLateral(page), "a página não pode rolar para o lado").toBe(true);

    // faixa de demonstração e crédito de desenvolvimento
    await expect(page.getByText(/versão de demonstração|demonstração/i).first()).toBeVisible();
    const tazzin = page.getByRole("contentinfo").getByRole("link", { name: /TAZZIN/i });
    await expect(tazzin).toHaveAttribute("target", "_blank");
    await expect(tazzin).toHaveAttribute("rel", /noopener/);

    // regra da loja: todo link de WhatsApp abre em outra aba
    const links = await page.locator('a[href*="wa.me"]').evaluateAll((as) => as.map((a) => ({ href: (a as HTMLAnchorElement).href, target: (a as HTMLAnchorElement).target, rel: (a as HTMLAnchorElement).rel })));
    expect(links.length, "deve haver ao menos um link de WhatsApp").toBeGreaterThan(0);
    for (const l of links) { expect(l.target, l.href).toBe("_blank"); expect(l.rel, l.href).toMatch(/noopener/); }

    expect(erros).toEqual([]);
  });
}

test("a página inicial mostra destaques e leva ao estoque", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.locator('a[href^="/veiculo/"]').first()).toBeVisible();
  expect(await page.locator('a[href^="/veiculo/"]').count()).toBeGreaterThanOrEqual(3);
  if (info.project.name === "celular") await page.locator("header details summary").click();
  await page.getByRole("link", { name: /^Estoque$/ }).first().click();
  await expect(page).toHaveURL(/\/estoque/);
});

test("o menu leva a cada seção", async ({ page }, info) => {
  const secoes: [string, RegExp][] = [["Destaques", /\/destaques/], ["Sobre", /\/sobre/], ["Contato", /\/contato/], ["Estoque", /\/estoque/]];
  for (const [nome, url] of secoes) {
    await page.goto("/");
    if (info.project.name === "celular") await page.locator("header details summary").click();
    await page.locator("header").getByRole("link", { name: new RegExp(`^${nome}`) }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(url);
  }
});

test("a página de um veículo abre sem erro, com dados estruturados e botão de WhatsApp em nova aba", async ({ page, erros }) => {
  await page.goto("/estoque");
  const href = await page.locator('a[href^="/veiculo/"]').first().getAttribute("href");
  const res = await page.goto(href!);
  expect(res?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveCount(1);
  expect(await imagensQuebradas(page)).toEqual([]);
  expect(await semRolagemLateral(page)).toBe(true);

  const blocos = await page.locator('script[type="application/ld+json"]').allTextContents();
  const veiculo = blocos.map((b) => JSON.parse(b)).find((j) => /Car|Vehicle|Motorcycle|Product/.test(JSON.stringify(j["@type"])));
  expect(veiculo, "dados estruturados do veículo (Schema.org)").toBeTruthy();
  expect(JSON.stringify(veiculo)).toMatch(/"offers"/);
  expect(JSON.stringify(veiculo)).toMatch(/"price"/);

  const wa = page.locator('a[href*="wa.me"]').first();
  await expect(wa).toHaveAttribute("target", "_blank");
  expect(erros).toEqual([]);
});

test("veículo que não existe mostra a página 404 do site", async ({ page }) => {
  const res = await page.goto("/veiculo/nao-existe-xyz");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /estoque/i }).first()).toBeVisible();
});
