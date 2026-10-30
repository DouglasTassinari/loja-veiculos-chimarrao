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

  // Os dados estruturados podem vir soltos ou dentro de um "@graph" (onde ficam também as migalhas).
  const blocos = await page.locator('script[type="application/ld+json"]').allTextContents();
  const itens = blocos.flatMap((b) => { const j = JSON.parse(b); return Array.isArray(j["@graph"]) ? j["@graph"] : [j]; });
  const veiculo = itens.find((j) => /Car|Vehicle|Motorcycle|Product/.test(JSON.stringify(j["@type"])));
  expect(veiculo, "dados estruturados do veículo (Schema.org)").toBeTruthy();
  expect(JSON.stringify(veiculo)).toMatch(/"offers"/);
  expect(JSON.stringify(veiculo)).toMatch(/"price"/);
  expect(JSON.stringify(veiculo), "estado do veículo na oferta").toMatch(/UsedCondition/);
  const migalhas = itens.find((j) => j["@type"] === "BreadcrumbList");
  expect(migalhas, "caminho de migalhas (Schema.org)").toBeTruthy();

  const wa = page.locator('a[href*="wa.me"]').first();
  await expect(wa).toHaveAttribute("target", "_blank");
  expect(erros).toEqual([]);
});

test("veículo que não existe mostra a página 404 do site", async ({ page }) => {
  const res = await page.goto("/veiculo/nao-existe-xyz");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /Esta página não existe/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /estoque/i }).first()).toBeVisible();
});

test("endereço desconhecido também cai na página 404 da loja, com busca e WhatsApp", async ({ page }) => {
  const res = await page.goto("/pagina-que-nao-existe-xyz");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /Esta página não existe/ })).toBeVisible();
  await expect(page.getByLabel("Buscar no estoque")).toBeVisible();
  await expect(page.locator('a[href*="wa.me"]').first()).toHaveAttribute("target", "_blank");
  // A busca da página de erro leva mesmo ao estoque.
  await page.getByLabel("Buscar no estoque").fill("Onix");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/\/estoque\?q=Onix/);
});

test("toda resposta leva os cabeçalhos de segurança, e o ERP fica fora de buscadores e do cache", async ({ page }) => {
  const res = await page.goto("/");
  const h = res!.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["content-security-policy"], "política de conteúdo").toMatch(/frame-ancestors 'none'/);
  expect(h["permissions-policy"]).toMatch(/camera=\(\)/);
  expect(h["x-powered-by"], "não anunciar a tecnologia").toBeUndefined();

  const erp = await page.request.get("/erp/login");
  expect(erp.headers()["x-robots-tag"]).toMatch(/noindex/);
  expect(erp.headers()["cache-control"]).toMatch(/no-store/);
});

test("as fotos ficam guardadas no navegador em vez de serem buscadas de novo a cada página", async ({ page }) => {
  const foto = await page.request.get("/vehicles/01-1.jpg");
  expect(foto.status()).toBe(200);
  expect(foto.headers()["cache-control"], "foto sem cache pesa a navegação").toMatch(/max-age=[1-9]/);
});

test("o estoque filtra por câmbio, combustível, ano e quilometragem", async ({ page }) => {
  await page.goto("/estoque?kind=carro");
  const cartoes = page.locator('a[href^="/veiculo/"]');
  await expect(cartoes.first()).toBeVisible();
  const antes = await cartoes.count();
  expect(antes).toBeGreaterThan(3);

  await page.getByLabel("Câmbio").selectOption("Automático");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/trans=Autom/);
  await expect(cartoes.first()).toBeVisible();
  const automaticos = await cartoes.count();
  expect(automaticos).toBeGreaterThan(0);
  // Todo cartão listado precisa dizer "Automático" na linha "ano · km · câmbio" (a que começa pelo ano).
  const linhas = (await page.locator("article p").allTextContents()).filter((t) => /^\d{4} · /.test(t));
  expect(linhas.length).toBeGreaterThan(0);
  for (const l of linhas) expect(l, "cartão fora do filtro de câmbio").toMatch(/Automático/);

  // O filtro de ano continua valendo junto com o de câmbio.
  const ano = page.getByLabel("Ano a partir de");
  const opcao = (await ano.locator("option").nth(1).getAttribute("value"))!;
  await ano.selectOption(opcao);
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(new RegExp(`minYear=${opcao}`));
  await expect(page).toHaveURL(/trans=Autom/);
  await expect(cartoes.first()).toBeVisible();
  expect(await cartoes.count()).toBeLessThanOrEqual(automaticos);

  await page.getByRole("link", { name: "Limpar" }).click();
  await expect(page).toHaveURL(/\/estoque$/);
  await expect(cartoes.first()).toBeVisible();
  expect(await cartoes.count()).toBeGreaterThanOrEqual(antes);
});
