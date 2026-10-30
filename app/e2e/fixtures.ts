import { test as base, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

export { expect };

export const PASSWORD = process.env.E2E_PASSWORD ?? "senha-de-teste-123";

let seq = 0;
// Cada teste "vem de um IP diferente": o limite de pedidos por IP (anti-abuso) não atrapalha a bateria.
export const ipNovo = () => `10.${Math.floor(Math.random() * 250)}.${(++seq * 7) % 250}.${1 + Math.floor(Math.random() * 250)}`;

type Fixtures = { erros: string[] };

export const test = base.extend<Fixtures>({
  context: async ({ context, baseURL }, aplicar) => {
    const origem = new URL(baseURL!).origin;
    await context.setExtraHTTPHeaders({ "x-forwarded-for": ipNovo() });
    // Nada sai para a internet: WhatsApp, mapa etc. recebem uma página vazia, e o teste vê só o endereço aberto.
    await context.route((u) => u.origin !== origem, (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>externo</title><p>página externa</p>" }));
    await aplicar(context);
  },
  // Erros de console, exceções e respostas 4xx/5xx do próprio site durante o teste.
  erros: async ({ page, baseURL }, aplicar) => {
    const origem = new URL(baseURL!).origin;
    const lista: string[] = [];
    page.on("pageerror", (e) => lista.push(`exceção: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") lista.push(`console: ${m.text()}`); });
    page.on("response", (r) => { if (r.url().startsWith(origem) && r.status() >= 400) lista.push(`${r.status()} ${r.url()}`); });
    await aplicar(lista);
  },
});

export async function entrarNoErp(page: Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Acessar" }).click();
  await expect(page.getByRole("heading", { name: "Painel do dono" })).toBeVisible();
}

// Telefone diferente a cada chamada (o sistema junta leads repetidos do mesmo telefone, e os testes não podem depender disso).
export const telefoneUnico = () => `(51) 9${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

// Aviso de erro do próprio formulário (o Next também usa role="alert" para anunciar a troca de página).
export const alerta = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

export async function criarLead(request: APIRequestContext, dados: { name: string; phone?: string; vehicleId?: number; source?: string; message?: string }) {
  const r = await request.post("/api/lead", {
    headers: { "x-forwarded-for": ipNovo() },
    data: { phone: telefoneUnico(), consent: true, source: "site", message: "Lead criado pelo teste automático.", ...dados },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()) as { id: number; token: string; name: string; phone: string };
}

// Id de um veículo à venda (pelo assistente, que só enxerga o que é público).
export async function veiculoDisponivel(request: APIRequestContext): Promise<{ id: number; slug: string; title: string; price: number }> {
  const headers = { "x-forwarded-for": ipNovo() };
  const a = await request.post("/api/chat", { headers, data: { state: null, input: { type: "text", text: "quero um carro até 120 mil" } } });
  const b = await request.post("/api/chat", { headers, data: { state: (await a.json()).state, input: { type: "text", text: "para a cidade" } } });
  const cards = ((await b.json()).messages as { cards?: { id: number; slug: string; title: string; price: number }[] }[]).flatMap((m) => m.cards ?? []);
  expect(cards.length).toBeGreaterThan(0);
  return cards[cards.length - 1];
}

// Rola a página inteira (fotos "preguiçosas" só carregam quando aparecem) e devolve o que não carregou.
export async function imagensQuebradas(page: Page): Promise<string[]> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  return page.evaluate(() => [...document.images].filter((i) => (i.complete && i.naturalWidth === 0) || (!i.complete && !!i.currentSrc)).map((i) => i.currentSrc || i.src));
}

export async function semRolagemLateral(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

// Arrasta com o mouse de verdade, em passos, como uma pessoa faria (o dragTo do Playwright mira o centro da
// coluna, que no funil fica muito abaixo da tela, e solta rápido demais para o navegador iniciar o arrasto).
export async function arrastar(page: Page, origem: Locator, alvo: Locator) {
  await origem.scrollIntoViewIfNeeded();
  const a = (await origem.boundingBox())!;
  const b = (await alvo.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + Math.min(120, b.height / 2), { steps: 25 });
  await page.mouse.up();
}
