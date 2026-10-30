import type { Page } from "@playwright/test";
import { entrarNoErp, expect, telefoneUnico, test } from "./fixtures";

const abrir = async (page: Page) => {
  await page.getByRole("button", { name: "Abrir o assistente virtual" }).click();
  const chat = page.getByRole("dialog", { name: "Assistente virtual" });
  await expect(chat).toBeVisible();
  return chat;
};
const dizer = async (chat: ReturnType<Page["getByRole"]>, texto: string) => {
  await chat.getByLabel("Sua mensagem").fill(texto);
  await chat.getByRole("button", { name: "Enviar", exact: true }).click();
};
const chip = (chat: ReturnType<Page["getByRole"]>, nome: string | RegExp) => chat.getByRole("button", { name: nome, exact: typeof nome === "string" });

test("conversa completa: entende o pedido, sugere veículos, monta o orçamento e entrega o contato à equipe", async ({ page, context, erros }) => {
  const telefone = telefoneUnico();
  await page.goto("/");
  const chat = await abrir(page);
  await expect(chat.getByText(/Respondo por regras, sem IA/).last()).toBeVisible();
  await expect(chip(chat, "Quero um carro")).toBeVisible();

  await dizer(chat, "quero um carro até 150 mil");
  await expect(chat.getByText(/Para que você vai usar/)).toBeVisible();
  await chip(chat, "Para a família").click();

  const sugestoes = chat.getByRole("list", { name: "Veículos sugeridos" });
  await expect(sugestoes).toBeVisible();
  const cards = sugestoes.locator(':scope > [role="listitem"]');
  expect(await cards.count()).toBeGreaterThanOrEqual(2);
  for (const t of await cards.allTextContents()) {
    const preco = Number(/R\$\s*([\d.]+)/.exec(t)![1].replace(/\./g, ""));
    expect(preco).toBeLessThanOrEqual(150_000);
    expect(t).toMatch(/Combina|Aproximado/);
  }
  const titulo = (await cards.first().locator("p.line-clamp-2").textContent())!.trim();
  await expect(cards.first().getByRole("link", { name: "Ver anúncio" })).toHaveAttribute("href", /\/veiculo\//);

  // orçamento financiado
  await cards.first().getByRole("button", { name: "Montar orçamento" }).click();
  await expect(chat.getByText(/Como você pretende pagar/)).toBeVisible();
  await chip(chat, "Financiar").click();
  await expect(chat.getByText(/Quanto você teria de entrada/)).toBeVisible();
  await dizer(chat, "dou 30 mil de entrada");

  // captação de contato: nome -> WhatsApp -> autorização (LGPD)
  await expect(chat.getByText(/como posso te chamar/i)).toBeVisible();
  await dizer(chat, "Maria Chatbot");
  await expect(chat.getByText(/Prazer, Maria/)).toBeVisible();
  await dizer(chat, "12345");
  await expect(chat.getByText(/WhatsApp/).last()).toBeVisible();
  await expect(chat.getByRole("link", { name: /Enviar para a equipe/ })).toHaveCount(0);
  await dizer(chat, telefone);
  await expect(chat.getByText(/passar seu nome e WhatsApp para a equipe/)).toBeVisible();
  await chip(chat, "Sim, pode").click();

  // orçamento pronto
  await expect(chat.getByText("Orçamento", { exact: true })).toBeVisible();
  await expect(chat.getByText("CET estimado", { exact: true })).toBeVisible();
  await expect(chat.getByText("IOF estimado", { exact: true })).toBeVisible();
  await expect(chat.getByText("Parcela por prazo")).toBeVisible();
  await expect(chat.getByText(titulo.slice(0, 12)).first()).toBeVisible();

  // WhatsApp: nova aba, loja continua aberta
  const wa = chat.getByRole("link", { name: /Enviar para a equipe no WhatsApp/ });
  await expect(wa).toHaveAttribute("target", "_blank");
  await expect(wa).toHaveAttribute("rel", /noopener/);
  const [aba] = await Promise.all([context.waitForEvent("page"), wa.click()]);
  await aba.waitForURL(/wa\.me\/5551999999999\?text=/);
  expect(page.url()).toMatch(/localhost:\d+\/$/);
  await expect(chat).toBeVisible();
  await aba.close();

  // a conversa sobrevive à troca de página e ao recarregar
  await page.goto("/estoque");
  await expect(page.getByRole("dialog", { name: "Assistente virtual" }).getByText("Orçamento", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Assistente virtual" }).getByText("Orçamento", { exact: true })).toBeVisible();

  // fechar com Esc e reabrir mantém a conversa
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Assistente virtual" })).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir o assistente virtual" }).click();
  await expect(page.getByRole("dialog", { name: "Assistente virtual" }).getByText("Orçamento", { exact: true })).toBeVisible();

  expect(erros).toEqual([]);

  // o lead chegou ao funil do ERP, vindo do chat
  await entrarNoErp(page);
  await page.goto("/erp/leads");
  const lead = page.locator("article").filter({ hasText: "Maria Chatbot" }).filter({ hasText: telefone });
  await expect(lead).toHaveCount(1);
  await expect(lead).toContainText("chat");
  await expect(lead).toContainText("chat");
});

test("não repete o pedido de contato para quem já se identificou e 'Recomeçar' limpa a conversa", async ({ page }) => {
  await page.goto("/");
  const chat = await abrir(page);
  await chip(chat, "Quero uma moto").click();
  await expect(chat.getByText(/orçamento|quanto|valor|investir/i).last()).toBeVisible();
  await chat.getByRole("button", { name: "Recomeçar" }).click();
  await expect(chat.getByText(/Sou o assistente virtual/).last()).toBeVisible();
  await expect(chat.locator("div.bg-brand", { hasText: "Quero uma moto" })).toHaveCount(0); // a fala do cliente sumiu
});

test("responde a perguntas da loja (endereço, horário, troca, financiamento) sem inventar", async ({ page }) => {
  await page.goto("/");
  const chat = await abrir(page);
  await dizer(chat, "onde fica a loja?");
  await expect(chat.getByText(/Rua Campeiro/)).toBeVisible();
  await dizer(chat, "qual o horário de funcionamento?");
  await expect(chat.getByText(/equipe|WhatsApp|confirm/i).last()).toBeVisible();
  await expect(chat.getByText(/\b(das|às)\s*\d{1,2}h/i)).toHaveCount(0); // horário não foi informado: o robô não inventa
  await dizer(chat, "aceitam troca?");
  await expect(chat.getByText(/troca/i).last()).toBeVisible();
});

test("frase que o robô não entende recebe orientação, e o campo limita o tamanho", async ({ page }) => {
  await page.goto("/");
  const chat = await abrir(page);
  await dizer(chat, "asdkjh qwe zxcmn");
  await expect(chat.getByText(/Não entendi/)).toBeVisible();
  expect(await chat.getByLabel("Sua mensagem").getAttribute("maxlength")).toBe("300");
  await expect(chat.getByRole("button", { name: "Enviar", exact: true })).toBeDisabled();
});

test("erros da rede aparecem em português, sem quebrar o chat", async ({ page }) => {
  await page.route("**/api/chat", (r) => r.abort());
  await page.goto("/");
  const chat = await abrir(page);
  await expect(chat.getByText(/Sem conexão no momento/)).toBeVisible();

  await page.unroute("**/api/chat");
  await page.route("**/api/chat", (r) => r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Muitas mensagens em pouco tempo. Aguarde um instante." }) }));
  await dizer(chat, "oi");
  await expect(chat.getByText(/Muitas mensagens em pouco tempo/)).toBeVisible();
  await expect(chat.getByLabel("Sua mensagem")).toBeEnabled();
});

test("no celular o assistente ocupa a tela inteira e não vaza para os lados", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const chat = await abrir(page);
  const caixa = (await chat.boundingBox())!;
  expect(caixa.width).toBeGreaterThanOrEqual(388);
  expect(caixa.height).toBeGreaterThanOrEqual(840);
  await dizer(chat, "quero uma moto até 20 mil");
  await expect(chat.getByText(/Separei|Não encontrei/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
