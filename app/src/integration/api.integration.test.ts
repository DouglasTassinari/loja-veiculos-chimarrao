import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.SQLITE_PATH = path.join(mkdtempSync(path.join(os.tmpdir(), "chim-api-")), "t.db");
delete process.env.DATABASE_URL;
// Sem internet nos testes: o Banco Central "fica fora do ar" e vale a taxa de referência.
globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;

let lead: typeof import("../app/api/lead/route");
let chat: typeof import("../app/api/chat/route");
let data: typeof import("../lib/data");
let crm: typeof import("../lib/crm-data");

before(async () => {
  lead = await import("../app/api/lead/route");
  chat = await import("../app/api/chat/route");
  data = await import("../lib/data");
  crm = await import("../lib/crm-data");
});

let ipSeq = 0;
const ip = () => `10.77.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
const req = (url: string, method: string, body: unknown, address = ip(), raw = false) =>
  new Request(`http://localhost${url}`, { method, headers: { "content-type": "application/json", "x-forwarded-for": address }, body: raw ? (body as string) : JSON.stringify(body) });
const json = async (r: Response) => (await r.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const good = { name: "Maria Teste", phone: "(51) 99999-1234", vehicleId: 3, source: "simulador", consent: true, message: "Simulação" };

// ---------------------------------------------------------------- /api/lead
test("lead: cria com nome, WhatsApp e consentimento e devolve id e token", async () => {
  const res = await lead.POST(req("/api/lead", "POST", good));
  assert.equal(res.status, 200);
  const j = await json(res);
  assert.equal(j.ok, true);
  assert.ok(j.id > 0 && typeof j.token === "string" && j.token.length === 24);
  assert.equal(j.phone, "(51) 99999-1234");
  const saved = await crm.leadById(j.id);
  assert.equal(saved!.source, "simulador");
  assert.equal(saved!.status, "novo");
  assert.equal(saved!.vehicle_id, 3);
});

test("lead: normaliza telefone, reaproveita o mesmo contato e acumula mensagens", async () => {
  const a = await json(await lead.POST(req("/api/lead", "POST", { ...good, phone: "51 98888 0001", vehicleId: 5, message: "primeira" })));
  const b = await json(await lead.POST(req("/api/lead", "POST", { ...good, phone: "+55 (51) 98888-0001", vehicleId: 5, message: "segunda" })));
  assert.equal(a.id, b.id, "mesmo telefone, veículo e origem em 6h = mesmo lead");
  const l = await crm.leadById(a.id);
  assert.match(l!.message, /primeira[\s\S]*segunda/);
  const c = await json(await lead.POST(req("/api/lead", "POST", { ...good, phone: "51 98888 0001", vehicleId: 6 })));
  assert.notEqual(c.id, a.id, "outro veículo cria outro lead");
});

test("lead: recusa o que está errado, sem gravar nada", async () => {
  const before = (await data.leads()).length;
  const cases: [string, unknown, number][] = [
    ["sem consentimento", { ...good, consent: false }, 400],
    ["consentimento como texto", { ...good, consent: "true" }, 400],
    ["sem nome", { ...good, name: "" }, 400],
    ["nome numérico", { ...good, name: "12345" }, 400],
    ["telefone inválido", { ...good, phone: "123" }, 400],
    ["celular sem 9", { ...good, phone: "(51) 89999-1234" }, 400],
    ["corpo vazio", {}, 400],
  ];
  for (const [label, body, status] of cases) {
    const r = await lead.POST(req("/api/lead", "POST", body));
    assert.equal(r.status, status, label);
    assert.equal((await json(r)).ok, false, label);
  }
  const bad = await lead.POST(req("/api/lead", "POST", "{não é json", ip(), true));
  assert.equal(bad.status, 400);
  assert.equal((await data.leads()).length, before, "nada foi gravado");
});

test("lead: origem desconhecida vira 'site' e textos longos são cortados", async () => {
  const j = await json(await lead.POST(req("/api/lead", "POST", { ...good, phone: "51 98888 0002", vehicleId: undefined, source: "hacker", message: "m".repeat(5000) })));
  const l = await crm.leadById(j.id);
  assert.equal(l!.source, "site");
  assert.ok(l!.message.length <= 600);
  assert.equal(l!.vehicle_id, null);
});

test("lead: PATCH só funciona com o token de quem criou", async () => {
  const j = await json(await lead.POST(req("/api/lead", "POST", { ...good, phone: "51 98888 0003" })));
  const ok = await lead.PATCH(req("/api/lead", "PATCH", { id: j.id, token: j.token, message: "Simulação enviada" }));
  assert.equal(ok.status, 200);
  assert.match((await crm.leadById(j.id))!.message, /Simulação enviada/);
  for (const token of ["", "x", "0".repeat(24), j.token.slice(0, 23) + "z"]) {
    const r = await lead.PATCH(req("/api/lead", "PATCH", { id: j.id, token, message: "invasão" }));
    assert.equal(r.status, 403, `token ${token || "(vazio)"}`);
  }
  const other = await json(await lead.POST(req("/api/lead", "POST", { ...good, phone: "51 98888 0004" })));
  assert.equal((await lead.PATCH(req("/api/lead", "PATCH", { id: other.id, token: j.token, message: "x" }))).status, 403, "token de outro lead");
  assert.equal((await lead.PATCH(req("/api/lead", "PATCH", { id: -1, token: j.token, message: "x" }))).status, 403);
  assert.doesNotMatch((await crm.leadById(j.id))!.message, /invasão/);
});

test("lead: limite de requisições por IP", async () => {
  const same = "10.99.99.99";
  let last = 200;
  for (let i = 0; i < 14; i++) last = (await lead.POST(req("/api/lead", "POST", { ...good, phone: `51 98777 ${String(1000 + i)}` }, same))).status;
  assert.equal(last, 429, "depois de 12 pedidos em 10 min o IP é barrado");
  assert.equal((await lead.POST(req("/api/lead", "POST", good, "10.99.99.98"))).status, 200, "outro IP segue normal");
});

// ---------------------------------------------------------------- /api/chat
const say = async (state: unknown, text: string, address = ip()) => json(await chat.POST(req("/api/chat", "POST", { state, input: { type: "text", text } }, address)));

test("chat: conversa do começo ao orçamento e cria o lead com consentimento", async () => {
  const address = ip();
  let r = await json(await chat.POST(req("/api/chat", "POST", { state: null, input: { type: "start", path: "/" } }, address)));
  assert.equal(r.ok, true);
  assert.match(r.messages[0].text, /assistente virtual/i);
  r = await say(r.state, "quero um suv automático até 130 mil", address);
  const cards = r.messages.flatMap((m: any) => m.cards ?? []); // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.ok(cards.length >= 1 && cards.every((c: any) => c.price <= 130000 && c.slug && c.reasons.length)); // eslint-disable-line @typescript-eslint/no-explicit-any
  r = await say(r.state, "orçamento do primeiro", address);
  r = await say(r.state, "financiar", address);
  r = await say(r.state, "entrada de 30 mil", address);
  r = await say(r.state, "Carla Chat", address);
  r = await say(r.state, "51 97777-4321", address);
  r = await say(r.state, "sim, pode", address);
  const quote = r.messages[0].quote;
  assert.ok(quote && quote.options.length >= 3 && quote.options.every((o: any) => o.parcel > 0)); // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.equal(quote.rateLabel.includes("referência"), true, "sem internet usa taxa de referência");
  assert.ok(r.state.contact.id > 0 && r.state.contact.token, "lead criado e devolvido ao navegador");
  const saved = await crm.leadById(r.state.contact.id);
  assert.equal(saved!.source, "chat");
  assert.equal(saved!.phone, "(51) 97777-4321");
  assert.match(saved!.message, /\[Chat\]/);
});

test("chat: sem consentimento ou com contato inválido nada é gravado", async () => {
  const before = (await data.leads()).length;
  let r = await say({ v: 1, step: "ask_consent", slots: { pay: "avista" }, shown: [], focus: 4, pending: "quote", contact: { name: "Sem Consent", phone: "(51) 96666-0000" }, misses: 0, turns: 0 }, "não");
  assert.ok(r.messages[0].quote, "ainda mostra o orçamento");
  r = await say({ v: 1, step: "idle", slots: {}, shown: [], contact: { name: "Forjado", phone: "123", consent: true }, misses: 0, turns: 0 }, "oi");
  assert.equal(r.state.contact.phone, undefined, "telefone inválido é descartado");
  assert.equal((await data.leads()).length, before);
});

test("chat: entrada inválida e estado adulterado não derrubam nem poluem", async () => {
  const addr = ip();
  assert.equal((await chat.POST(req("/api/chat", "POST", { state: null, input: { type: "hack" } }, addr))).status, 400);
  assert.equal((await chat.POST(req("/api/chat", "POST", { state: null }, addr))).status, 400);
  assert.equal((await chat.POST(req("/api/chat", "POST", "{ruim", addr, true))).status, 400);

  const evil = { v: 9, step: "hack", slots: { __proto__: { poluido: true }, constructor: { prototype: { poluido: true } }, budgetMax: "abc", bodies: "SUV" }, shown: ["x", null, 5, 7.5], contact: { name: 123, phone: {}, consent: "yes", id: "7" }, pending: "apagar", misses: -5, turns: 1e9, lastNeed: { a: 1 } };
  const r = await say(JSON.parse(JSON.stringify(evil).replace('"slots":{', '"slots":{"__proto__":{"poluido":true},')), "oi");
  assert.equal(r.ok, true);
  assert.equal(r.state.step, "start", "etapa inválida volta ao início");
  assert.equal(({} as Record<string, unknown>).poluido, undefined, "Object.prototype intacto");
  assert.ok(r.state.turns <= 501);
  assert.deepEqual(r.state.shown, [5].filter((n) => Number.isInteger(n)));

  const long = await say(null, "a".repeat(5000));
  assert.equal(long.ok, true, "mensagem longa é cortada, não recusada");
  const html = await say(null, "<img src=x onerror=alert(1)> quero um carro até 60 mil");
  assert.equal(html.ok, true);
  assert.ok(html.state.slots.budgetMax === 60000, "entende mesmo com lixo no texto");
});

test("chat: nunca expõe custo, margem ou dados de compra", async () => {
  let r = await say(null, "quero um carro até 250 mil");
  r = await say(r.state, "ver outras opções");
  const raw = JSON.stringify(r);
  assert.doesNotMatch(raw, /purchase_price|sale_price|min_price|margem|custo do capital|buy|"cost"/i);
  const prices = r.messages.flatMap((m: any) => (m.cards ?? []).map((c: any) => c.price)); // eslint-disable-line @typescript-eslint/no-explicit-any
  const asking = new Map((await data.allVehicles()).map((v) => [v.asking_price, true]));
  assert.ok(prices.every((p: number) => asking.has(p)), "só preços de anúncio");
});

test("chat: só mostra veículos disponíveis e publicados", async () => {
  const hidden = (await data.allVehicles()).filter((v) => v.status === "vendido" || v.status === "preparacao" || v.status === "reservado").map((v) => v.slug);
  for (const text of ["quero um carro até 300 mil", "quero uma moto", "mostra tudo"]) {
    let r = await say(null, text);
    for (let i = 0; i < 3; i++) r = await say(r.state, "ver outras opções");
    const slugs = r.messages.flatMap((m: any) => (m.cards ?? []).map((c: any) => c.slug)); // eslint-disable-line @typescript-eslint/no-explicit-any
    assert.ok(slugs.every((s: string) => !hidden.includes(s)), `${text}: apareceu veículo indisponível`);
  }
});

test("chat: limite de mensagens por IP", async () => {
  const same = "10.88.88.88";
  let last = 200;
  for (let i = 0; i < 82; i++) last = (await chat.POST(req("/api/chat", "POST", { state: null, input: { type: "text", text: "oi" } }, same))).status;
  assert.equal(last, 429);
});
