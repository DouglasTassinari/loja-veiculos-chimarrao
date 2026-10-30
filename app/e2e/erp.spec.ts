import { alerta, arrastar, criarLead, entrarNoErp, expect, PASSWORD, telefoneUnico, test, veiculoDisponivel } from "./fixtures";

const sufixo = Date.now().toString(36).slice(-5);
const coluna = (page: import("@playwright/test").Page, etapa: string) => page.getByRole("region", { name: new RegExp(`^${etapa}: \\d+ leads?$`) });

test.describe("acesso", () => {
  test("telas internas pedem senha, senha errada é recusada e sair encerra a sessão", async ({ page }) => {
    for (const p of ["/erp", "/erp/clientes", "/erp/tarefas", "/erp/leads", "/erp/vendas", "/erp/caixa", "/erp/veiculos", "/erp/veiculos/novo", "/erp/vendas/nova"]) {
      await page.goto(p);
      await expect(page).toHaveURL(/\/erp\/login/);
    }
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    await page.getByLabel("Senha").fill("senha-errada-123");
    await page.getByRole("button", { name: "Acessar" }).click();
    await expect(page.getByText("Senha incorreta.")).toBeVisible();
    await expect(page).toHaveURL(/erro=1/);

    await page.getByLabel("Senha").fill(PASSWORD);
    await page.getByRole("button", { name: "Acessar" }).click();
    await expect(page.getByRole("heading", { name: "Painel do dono" })).toBeVisible();

    const cookie = (await page.context().cookies()).find((c) => /sess|erp/i.test(c.name));
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    await page.getByRole("button", { name: "Sair" }).click();
    await page.goto("/erp/clientes");
    await expect(page).toHaveURL(/\/erp\/login/);
  });

  test("a API de lead não aceita alterações sem o token do próprio lead", async ({ request }) => {
    const lead = await criarLead(request, { name: "Lead Token E2E" });
    const sem = await request.patch("/api/lead", { data: { id: lead.id, token: "x".repeat(24), message: "invasor" } });
    expect(sem.status()).toBe(403);
    const ok = await request.patch("/api/lead", { data: { id: lead.id, token: lead.token, message: "mais detalhes" } });
    expect(ok.status()).toBe(200);
  });
});

test.describe("painel e navegação", () => {
  test.beforeEach(async ({ page }) => { await entrarNoErp(page); });

  test("todas as telas abrem sem erro e sem rolagem lateral", async ({ page, erros }) => {
    const telas: [string, RegExp][] = [
      ["Painel", /Painel do dono/], ["Estoque", /^Estoque$/], ["Funil", /Funil de leads/], ["Clientes", /^Clientes$/],
      ["Tarefas", /Tarefas e relacionamento/], ["Vendas", /^Vendas$/], ["Caixa", /Fluxo de caixa/],
    ];
    for (const [menu, titulo] of telas) {
      await page.getByRole("navigation", { name: "Menu do ERP" }).getByRole("link", { name: new RegExp(`^${menu}`) }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(titulo);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${menu}: rolagem lateral`).toBe(true);
    }
    await expect(page.getByRole("contentinfo").getByRole("link", { name: /TAZZIN/i })).toHaveAttribute("target", "_blank");
    expect(erros).toEqual([]);
  });

  test("painel mostra o dinheiro parado, os alertas e o card de relacionamento", async ({ page }) => {
    await page.goto("/erp");
    await expect(page.getByText(/Relacionamento com clientes/)).toBeVisible();
    await expect(page.getByText(/R\$\s?[\d.]+/).first()).toBeVisible();
  });
});

test.describe("funil de vendas (CRM)", () => {
  test.beforeEach(async ({ page }) => { await entrarNoErp(page); });

  test("mover cartão pela lista e arrastando; a etapa fica salva", async ({ page, request }) => {
    const nome = `Funil Lista ${sufixo}`;
    await criarLead(request, { name: nome, message: "Quer saber da Hilux." });
    await page.goto("/erp/leads");

    const card = page.locator("article").filter({ hasText: nome });
    await expect(coluna(page, "Novo").locator("article").filter({ hasText: nome })).toHaveCount(1);

    // 1) pela lista "mover"
    const antes = Number(/: (\d+) lead/.exec((await coluna(page, "Contatado").getAttribute("aria-label"))!)![1]);
    await card.getByLabel(`Mover ${nome} para outra etapa`).selectOption("contatado");
    await expect(coluna(page, "Contatado")).toHaveAttribute("aria-label", `Contatado: ${antes + 1} leads`);
    await expect(coluna(page, "Contatado").locator("article").filter({ hasText: nome })).toHaveCount(1);
    await page.reload();
    await expect(coluna(page, "Contatado").locator("article").filter({ hasText: nome })).toHaveCount(1);

    // 2) arrastando o cartão até a coluna "Visita"
    // pega pelo nome (o meio do cartão tem lista e link, que têm comportamento próprio ao arrastar)
    await arrastar(page, page.locator("article").filter({ hasText: nome }).getByText(nome, { exact: true }), coluna(page, "Visita"));
    await expect(coluna(page, "Visita").locator("article").filter({ hasText: nome })).toHaveCount(1);
    await page.reload();
    await expect(coluna(page, "Visita").locator("article").filter({ hasText: nome })).toHaveCount(1);
    await expect(coluna(page, "Contatado").locator("article").filter({ hasText: nome })).toHaveCount(0);
  });

  test("se o servidor falhar, o cartão volta para a etapa de origem e avisa", async ({ page, request }) => {
    const nome = `Funil Falha ${sufixo}`;
    await criarLead(request, { name: nome });
    await page.goto("/erp/leads");
    await page.route("**/erp/leads", (r) => (r.request().headers()["next-action"] ? r.abort() : r.continue()));
    await page.locator("article").filter({ hasText: nome }).getByLabel(`Mover ${nome} para outra etapa`).selectOption("proposta");
    await expect(alerta(page)).toContainText("Não foi possível mover o lead");
    await expect(coluna(page, "Novo").locator("article").filter({ hasText: nome })).toHaveCount(1);
  });
});

test.describe("venda, financiamento e pós-venda (CRM)", () => {
  test.beforeEach(async ({ page }) => { await entrarNoErp(page); });

  test("registrar venda a partir do lead cria cliente, venda, tarefas de pós-venda e aviso de fim do financiamento", async ({ page, request }) => {
    const nome = `Comprador ${sufixo}`;
    const telefone = telefoneUnico();
    const veiculo = await veiculoDisponivel(request);
    await criarLead(request, { name: nome, phone: telefone, vehicleId: veiculo.id, source: "simulador", message: "Quer financiar em 48x." });

    await page.goto("/erp/leads");
    await page.locator("article").filter({ hasText: nome }).getByLabel(`Mover ${nome} para outra etapa`).selectOption("proposta");
    const cartao = coluna(page, "Proposta").locator("article").filter({ hasText: nome });
    await expect(cartao).toHaveCount(1);
    await cartao.getByRole("link", { name: "Registrar venda" }).click();

    // formulário já vem com veículo, nome e telefone do lead
    await expect(page.getByRole("heading", { name: "Registrar venda" })).toBeVisible();
    await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(nome);
    await expect(page.getByLabel("WhatsApp com DDD")).toHaveValue(telefone);
    await expect(page.locator('select[name="vehicle_id"]')).toHaveValue(String(veiculo.id));
    await page.getByLabel("Forma de pagamento").selectOption("financiado");
    await page.getByLabel(/Entrada em dinheiro/).fill("20000");
    await page.getByLabel(/Prazo \(meses\)/).fill("48");
    await page.getByLabel("Banco / financeira").fill("BV");
    await page.getByRole("button", { name: "Registrar venda" }).click();

    // cliente criado, com a venda e as tarefas automáticas
    await expect(page).toHaveURL(/\/erp\/clientes\/\d+\?venda=1/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(nome);
    await expect(page.getByRole("status")).toContainText("Venda registrada");
    const corpo = page.locator("main");
    await expect(corpo).toContainText("Pós-venda · 7 dias");
    await expect(corpo).toContainText("Pós-venda · 30 dias");
    await expect(corpo).toContainText("Relacionamento · 6 meses");
    await expect(corpo).toContainText("Renovação");
    await expect(corpo).toContainText("Financiado");
    await expect(corpo).toContainText("BV");

    // o veículo vendido sai do estoque público e aparece na lista de vendas
    const anuncio = await page.request.get(`/veiculo/${veiculo.slug}`);
    expect(await anuncio.text()).toMatch(/VENDIDO|Vendido|indisponível/i);
    await page.goto("/erp/vendas");
    await expect(page.locator("tbody tr").filter({ hasText: nome })).toHaveCount(1);
    await expect(page.locator("tbody tr").filter({ hasText: nome })).toContainText(/Financiado/);

    // busca de cliente
    await page.goto("/erp/clientes");
    await page.getByLabel("Buscar cliente").fill(nome);
    await page.getByLabel("Buscar cliente").press("Enter");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("link", { name: nome }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(nome);

    // não oferece de novo o veículo já vendido
    await page.goto(`/erp/vendas/nova?vehicle=${veiculo.id}`);
    await expect(page.getByRole("heading", { name: "Registrar venda" })).toBeVisible();
    await expect(page.locator(`select[name="vehicle_id"] option[value="${veiculo.id}"]`)).toHaveCount(0);
  });

  test("tarefas: concluir, reabrir, adiar e criar", async ({ page }) => {
    await page.goto("/erp/tarefas");
    const itens = page.locator("li").filter({ has: page.getByRole("button", { name: "Feito" }) });
    const n = await itens.count();
    expect(n).toBeGreaterThan(0);

    // adiar +7 dias: o prazo muda para o futuro
    const primeiro = itens.first();
    const titulo = (await primeiro.locator("p.text-ink").first().textContent())!;
    await primeiro.getByRole("button", { name: "+7d" }).click();
    const depois = page.locator("li").filter({ hasText: titulo }).first();
    await expect(depois).toContainText(/Em \d+ dias|Amanhã|Hoje/);

    // concluir: sai da lista e vai para "Concluídas", de onde dá para reabrir
    await page.locator("li").filter({ hasText: titulo }).first().getByRole("button", { name: "Feito" }).click();
    await expect(itens).toHaveCount(n - 1);
    await page.getByText(/Concluídas recentemente/).click();
    await page.locator("li").filter({ hasText: titulo }).getByRole("button", { name: "reabrir" }).click();
    await expect(itens).toHaveCount(n);

    // criar tarefa manual
    const nova = `Ligar para confirmar visita ${sufixo}`;
    await page.getByLabel("O que fazer").fill(nova);
    await page.getByRole("button", { name: "Criar", exact: true }).click();
    await expect(page.locator("li").filter({ hasText: nova })).toHaveCount(1);
  });

  test("clientes: cadastro manual e telefone repetido não duplica", async ({ page }) => {
    await page.goto("/erp/clientes/novo");
    const nome = `Cliente Manual ${sufixo}`;
    const telefone = telefoneUnico();
    await page.getByLabel("Nome", { exact: true }).fill(nome);
    await page.getByLabel("WhatsApp com DDD").fill(telefone);
    await page.getByLabel(/Observações/).fill("Indicado por um cliente antigo.");
    await page.getByRole("button", { name: "Salvar cliente" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(nome);
    await expect(page.locator("main")).toContainText("Indicado por um cliente antigo.");
    await expect(page.getByRole("link", { name: /WhatsApp/ }).first()).toHaveAttribute("target", "_blank");

    // telefone repetido não duplica
    await page.goto("/erp/clientes/novo");
    await page.getByLabel("Nome", { exact: true }).fill(`${nome} duplicado`);
    await page.getByLabel("WhatsApp com DDD").fill(telefone);
    await page.getByRole("button", { name: "Salvar cliente" }).click();
    await page.goto("/erp/clientes");
    await page.getByLabel("Buscar cliente").fill(telefone.slice(-9));
    await page.getByLabel("Buscar cliente").press("Enter");
    await expect(page.locator("tbody tr")).toHaveCount(1);
  });
});

test.describe("estoque e custos", () => {
  test.beforeEach(async ({ page }) => { await entrarNoErp(page); });

  test("cadastrar moto, lançar custo, publicar e destacar; o custo nunca vai ao site", async ({ page, erros }) => {
    const modelo = `CG Teste ${sufixo}`;
    const compra = "7654,32";
    await page.goto("/erp/veiculos/novo");
    await page.locator('select[name="kind"]').selectOption("moto");
    await page.locator('input[name="plate"]').fill("TST1A23");
    await page.locator('input[name="brand"]').fill("Honda");
    await page.locator('input[name="model"]').fill(modelo);
    await page.locator('input[name="version"]').fill("160 Start");
    await page.locator('input[name="km"]').fill("18000");
    await page.locator('input[name="purchase_price"]').fill(compra);
    await page.locator('input[name="asking_price"]').fill("11500");
    await page.getByRole("button", { name: "Salvar e abrir ficha" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(modelo);

    // custo de preparação reduz a margem
    await page.locator('select[name="category"]').first().selectOption({ index: 0 });
    await page.locator('input[name="description"]').first().fill("Revisão e pneus");
    await page.locator('input[name="amount"]').first().fill("612,90");
    await page.getByRole("button", { name: "Lançar" }).first().click();
    await expect(page.locator("main")).toContainText("Revisão e pneus");
    await expect(page.locator("main")).toContainText("R$ 613");

    // antes de publicar, o anúncio não existe no site
    await page.goto(`/estoque?q=${encodeURIComponent(modelo)}`);
    await expect(page.locator("article")).toHaveCount(0);

    // publicar + disponível + destaque
    await page.goto("/erp/veiculos");
    await page.getByRole("link", { name: new RegExp(modelo) }).first().click();
    await page.locator('select[name="status"]').selectOption("disponivel");
    await page.locator('input[name="published"]').check();
    await page.locator('input[name="featured"]').check();
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await page.goto(`/estoque?kind=moto&q=${encodeURIComponent(modelo)}`);
    const anuncio = page.locator("article").filter({ hasText: modelo });
    await expect(anuncio).toHaveCount(1);
    await expect(anuncio).toContainText("MOTO");
    await expect(anuncio).toContainText("R$ 11.500");
    await page.goto("/destaques");
    await expect(page.locator("article").filter({ hasText: modelo })).toHaveCount(1);

    // o preço de compra e os custos jamais aparecem em páginas públicas
    await page.goto(`/estoque?q=${encodeURIComponent(modelo)}`);
    await page.locator("article").filter({ hasText: modelo }).locator('a[href^="/veiculo/"]').first().click();
    const html = await page.content();
    for (const segredo of ["7.654", "7654", "612,90", "612.9", "Revisão e pneus", "purchase_price", "min_price"]) expect(html, segredo).not.toContain(segredo);
    expect(erros.filter((e) => !/404/.test(e))).toEqual([]);
  });

  test("caixa: lançar conta a pagar e dar baixa", async ({ page }) => {
    await page.goto("/erp/caixa");
    const desc = `Aluguel do pátio ${sufixo}`;
    await page.getByLabel("Descrição").fill(desc);
    await page.getByLabel("Valor (R$)").fill("2500");
    await page.getByRole("button", { name: "Lançar" }).click();
    const linha = page.locator("tr").filter({ hasText: desc });
    await expect(linha).toHaveCount(1);
    await expect(linha).toContainText("2.500");
    await linha.getByRole("button").click();
    await expect(page.locator("tr").filter({ hasText: desc }).getByRole("button")).toHaveText(/reabrir/);
  });
});
