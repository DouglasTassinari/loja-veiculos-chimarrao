import { test } from "node:test";
import assert from "node:assert/strict";
import { reply } from "./engine";
import { newState, type ChatState, type Ctx, type Reply, type VehicleLite } from "./types";
import { FALLBACK_RATES, simulate, priceFromParcel } from "../financing";
import { findMoney, normalize, parseNumbers } from "./nlu";
import { normalizePhone } from "../phone";

const mk = (id: number, kind: "carro" | "moto", brand: string, model: string, version: string, body: string, year: number, km: number, trans: string, price: number, extra: Partial<VehicleLite> = {}): VehicleLite => ({
  id, slug: `${model.toLowerCase()}-${id}`, kind, brand, model, version, body, year, km, trans, fuel: "Flex", engine: "1.0", color: "Preta", price,
  fipe: null, featured: false, inspected: id % 2 === 0, single: false, warranty: null, photo: null, ...extra,
});

const vehicles: VehicleLite[] = [
  mk(1, "carro", "Fiat", "Uno", "Mille", "Hatch", 2009, 118000, "Manual", 15900),
  mk(2, "carro", "Chevrolet", "Onix", "LT", "Hatch", 2015, 91000, "Manual", 44900),
  mk(3, "carro", "Hyundai", "HB20", "Comfort", "Hatch", 2016, 88000, "Manual", 52900),
  mk(4, "carro", "Honda", "Civic", "EXL", "Sedã", 2018, 77000, "Automático", 99900),
  mk(5, "carro", "Toyota", "Corolla", "XEi", "Sedã", 2019, 69000, "Automático", 104900),
  mk(6, "carro", "Honda", "HR-V", "EX", "SUV", 2017, 95000, "Automático", 84900),
  mk(7, "carro", "Jeep", "Compass", "Longitude", "SUV", 2020, 70000, "Automático", 112900, { fuel: "Diesel" }),
  mk(8, "carro", "Volkswagen", "T-Cross", "Highline", "SUV", 2021, 44000, "Automático", 112900, { featured: true }),
  mk(9, "carro", "Toyota", "Hilux", "SRX", "Picape", 2021, 68000, "Automático", 239900, { fuel: "Diesel" }),
  mk(10, "carro", "Fiat", "Toro", "Freedom", "Picape", 2019, 78000, "Automático", 99900),
  mk(11, "carro", "Toyota", "Corolla Cross", "XRE", "SUV", 2022, 58000, "Automático", 139900),
  mk(12, "moto", "Honda", "CG 160", "Titan", "Street", 2022, 18000, "Manual", 14900),
  mk(13, "moto", "Yamaha", "MT-03", "ABS", "Street", 2021, 15000, "Manual", 27900),
  mk(14, "moto", "Honda", "CB 500X", "ABS", "Trail", 2019, 22000, "Manual", 36900),
  mk(15, "moto", "Honda", "Biz 125", "ES", "Scooter", 2020, 24000, "Automática", 10900),
];

const ctx: Ctx = {
  vehicles, rates: FALLBACK_RATES,
  store: { name: "Chimarrão Veículos", short: "Chimarrão", city: "Sapucaia do Sul", state: "RS", address: "Rua Campeiro, 99", phone: "(51) 3499-9999", whatsapp: "5551999999999", whatsappLabel: "(51) 99999-9999", hours: null, offers: { trade: true, financing: true } },
};

function say(st: ChatState, text: string): Reply { return reply(st, { type: "text", text }, ctx); }
const all = (r: Reply) => r.messages.map((m) => m.text).join(" | ");
const cards = (r: Reply) => r.messages.flatMap((m) => m.cards ?? []);

test("lê valores em português", () => {
  assert.equal(parseNumbers(normalize("até 80 mil"), "none").budgetMax, 80000);
  assert.equal(parseNumbers(normalize("até 80k"), "none").budgetMax, 80000);
  assert.equal(parseNumbers(normalize("R$ 65.000"), "budget").budgetMax, 65000);
  assert.equal(parseNumbers(normalize("80"), "budget").budgetMax, 80000);
  assert.equal(parseNumbers(normalize("entre 40 e 60 mil"), "none").budgetMin, 40000);
  assert.equal(parseNumbers(normalize("entre 40 e 60 mil"), "none").budgetMax, 60000);
  assert.equal(parseNumbers(normalize("parcela de 1500"), "none").parcelMax, 1500);
  assert.equal(parseNumbers(normalize("pagar 1.200 por mês"), "none").parcelMax, 1200);
  assert.equal(parseNumbers(normalize("entrada de 20 mil"), "none").down, 20000);
  assert.equal(parseNumbers(normalize("dou 15 mil de entrada"), "none").down, 15000);
  assert.equal(parseNumbers(normalize("sem entrada"), "none").down, 0);
  assert.equal(parseNumbers(normalize("30% de entrada"), "none").downPct, 0.3);
  assert.equal(parseNumbers(normalize("em 48x"), "none").months, 48);
  assert.equal(parseNumbers(normalize("2019 pra cima"), "none").yearMin, 2019);
  assert.equal(parseNumbers(normalize("até 60 mil km"), "none").kmMax, 60000);
  assert.ok(findMoney("tenho 1,5 mil").some((m) => m.value === 1500));
});

test("telefone brasileiro", () => {
  assert.equal(normalizePhone("51999999999"), "(51) 99999-9999");
  assert.equal(normalizePhone("+55 (51) 99999-9999"), "(51) 99999-9999");
  assert.equal(normalizePhone("(51) 3499-9999"), "(51) 3499-9999");
  assert.equal(normalizePhone("123"), null);
  assert.equal(normalizePhone("51899999999"), null);
});

test("simulação: parcela, IOF e CET coerentes", () => {
  const s = simulate({ price: 100000, down: 30000, months: 48, rate: 0.0189 });
  assert.ok(s.iof > 2000 && s.iof < 2500, `iof ${s.iof}`);
  assert.ok(s.parcel > 2000 && s.parcel < 2400, `parcela ${s.parcel}`);
  assert.ok(s.cetMonthly > 0.0189, "CET maior que a taxa por causa do IOF");
  assert.ok(Math.abs(s.total - (30000 + s.parcel * 48)) < 0.01);
  assert.equal(simulate({ price: 50000, down: 50000, months: 24, rate: 0.02 }).parcel, 0);
  const back = priceFromParcel(s.parcel, 30000, 48, 0.0189);
  assert.ok(Math.abs(back - 100000) < 5, `volta ao preço ${back}`);
});

test("conversa completa: SUV automático financiado até 120 mil", () => {
  let r = reply(newState(), { type: "start" }, ctx);
  assert.match(all(r), /assistente virtual/i);
  assert.match(all(r), /sem IA/i);
  r = say(r.state, "quero um carro");
  assert.equal(r.state.step, "budget");
  r = say(r.state, "até 120 mil");
  assert.equal(r.state.slots.budgetMax, 120000);
  assert.equal(r.state.step, "need");
  r = say(r.state, "financiar");
  assert.equal(r.state.step, "down");
  r = say(r.state, "entrada de 30 mil");
  assert.equal(r.state.slots.down, 30000);
  assert.equal(r.state.step, "need");
  r = say(r.state, "SUV para a família, automático");
  const cs = cards(r);
  assert.ok(cs.length >= 1 && cs.length <= 3, "mostra de 1 a 3 opções");
  assert.ok(cs.every((c) => c.price <= 120000), "respeita o orçamento");
  assert.ok(cs[0].reasons.length > 0, "explica por que combina");
  assert.ok(cs.some((c) => /Compass|HR-V|T-Cross/.test(c.title)), `esperava um SUV: ${cs.map((c) => c.title)}`);
});

test("tudo numa frase só", () => {
  const r = say(newState(), "quero um SUV automático até 120 mil, financiado, com 30 mil de entrada");
  assert.equal(r.state.slots.kind, "carro");
  assert.deepEqual(r.state.slots.bodies, ["SUV"]);
  assert.equal(r.state.slots.trans, "Automático");
  assert.equal(r.state.slots.down, 30000);
  assert.ok(cards(r).length > 0);
});

test("moto: entrega e valor", () => {
  const r = say(newState(), "preciso de uma moto para entrega até 20 mil");
  assert.equal(r.state.slots.kind, "moto");
  assert.equal(r.state.slots.use, "entrega");
  const cs = cards(r);
  assert.ok(cs.length > 0 && cs.every((c) => c.price <= 20000));
  assert.ok(/CG|Biz/.test(cs[0].title));
});

test("modelo específico", () => {
  const r = say(newState(), "tem hb20?");
  const cs = cards(r);
  assert.equal(cs.length, 1);
  assert.match(cs[0].title, /HB20/);
});

test("parcela vira orçamento possível", () => {
  const r = say(newState(), "quero um carro com parcela de 1500 e 20 mil de entrada");
  assert.equal(r.state.slots.parcelMax, 1500);
  const cs = cards(r);
  assert.ok(cs.length > 0);
  assert.ok(cs.every((c) => c.price < 130000), "limite derivado da parcela");
});

test("sem resultado: avisa e oferece alternativas", () => {
  const r = say(newState(), "carro até 5 mil");
  assert.match(all(r), /não encontrei/i);
  assert.ok(r.messages[0].chips?.includes("Avise-me quando chegar"));
});

test("orçamento: pede nome, WhatsApp e consentimento antes e cria o lead", () => {
  let r = say(newState(), "quero um sedã automático até 110 mil");
  assert.ok(cards(r).length > 0);
  r = say(r.state, "orçamento do primeiro");
  assert.equal(r.state.step, "pay", "pergunta como vai pagar");
  r = say(r.state, "financiar");
  assert.equal(r.state.step, "down");
  r = say(r.state, "entrada de 30 mil");
  assert.equal(r.state.step, "ask_name");
  r = say(r.state, "Maria Souza");
  assert.equal(r.state.step, "ask_phone");
  r = say(r.state, "isso aí não é telefone");
  assert.equal(r.state.step, "ask_phone");
  r = say(r.state, "51 99999-1234");
  assert.equal(r.state.step, "ask_consent");
  r = say(r.state, "sim, pode");
  assert.equal(r.state.step, "idle");
  const q = r.messages[0].quote;
  assert.ok(q, "gera o orçamento");
  assert.ok(q!.options.length >= 3, "compara prazos");
  assert.ok(q!.options.every((o) => o.parcel > 0 && o.low <= o.parcel && o.parcel <= o.high));
  assert.ok(r.effect && r.effect.type === "lead");
  assert.equal(r.effect!.phone, "(51) 99999-1234");
  assert.match(r.effect!.message, /Chat/);
  assert.ok(r.messages[0].actions?.some((a) => a.external && a.href.startsWith("https://wa.me/")));
});

test("quem recusa dar contato ainda vê o orçamento, sem lead", () => {
  let r = say(newState(), "quero o hb20");
  r = reply(r.state, { type: "pick", id: 3 }, ctx);
  assert.equal(r.state.step, "pay");
  r = say(r.state, "à vista");
  assert.equal(r.state.step, "ask_name");
  r = say(r.state, "prefiro não informar");
  assert.ok(r.messages[0].quote);
  assert.equal(r.effect, undefined);
});

test("mudar a entrada recalcula o orçamento", () => {
  const base = { ...newState(), contact: { name: "Ana", phone: "(51) 99999-0000", consent: true }, slots: { pay: "financiar" as const, down: 20000 } };
  let r = reply(base, { type: "pick", id: 4 }, ctx);
  const first = r.messages[0].quote!;
  r = say(r.state, "e com entrada de 50 mil?");
  const second = r.messages[0].quote!;
  assert.equal(second.entry, 50000);
  const p48a = first.options.find((o) => o.months === 48)!.parcel;
  const p48b = second.options.find((o) => o.months === 48)!.parcel;
  assert.ok(p48b < p48a);
});

test("perguntas frequentes e retomada do fluxo", () => {
  let r = say(newState(), "quero um carro");
  r = say(r.state, "onde fica a loja?");
  assert.match(all(r), /Rua Campeiro/);
  assert.equal(r.state.step, "budget", "continua na pergunta de valor");
  assert.match(all(r), /Voltando/);
  r = say(r.state, "vocês dão garantia?");
  assert.match(all(r), /garantia/i);
  assert.doesNotMatch(all(r), /garantia (de )?(total|vitalícia|de 1 ano)/i, "não promete garantia");
  r = say(r.state, "qual o horário de atendimento?");
  assert.match(all(r), /equipe/i);
  r = say(r.state, "que documentos preciso?");
  assert.match(all(r), /CPF/);
});

test("honestidade: não afirma o que não pode", () => {
  const r = say(newState(), "vocês aprovam meu financiamento mesmo com nome sujo?");
  const t = all(r).toLowerCase();
  assert.doesNotMatch(t, /aprovad[oa] garantid|100% aprovad/);
  assert.match(all(say(newState(), "financiamento como funciona?")), /análise de crédito/i);
});

test("quem é você: assume que é robô", () => {
  const r = say(newState(), "você é um robô?");
  assert.match(all(r), /assistente virtual/i);
  assert.match(all(r), /sem inteligência artificial/i);
});

test("atendente humano abre WhatsApp em nova aba", () => {
  const r = say(newState(), "quero falar com um atendente");
  const a = r.messages[0].actions?.[0];
  assert.ok(a?.external);
  assert.match(a!.href, /^https:\/\/wa\.me\/5551999999999\?text=/);
});

test("avaliar troca coleta dados e contato", () => {
  let r = say(newState(), "quanto vocês pagam no meu carro?");
  assert.equal(r.state.step, "trade_desc");
  r = say(r.state, "Gol 1.0 2014, 98 mil km");
  assert.equal(r.state.step, "ask_name");
  r = say(r.state, "meu nome é Carlos");
  r = say(r.state, "(51) 98888-7777");
  r = say(r.state, "sim");
  assert.ok(r.effect);
  assert.match(r.effect!.message, /Gol 1\.0 2014/);
});

test("ajustes: mais barato, mais novo e outras opções", () => {
  let r = say(newState(), "carro automático até 150 mil");
  const firstIds = cards(r).map((c) => c.id);
  r = say(r.state, "tem mais barato?");
  const cheaper = cards(r);
  if (cheaper.length) assert.ok(Math.min(...cheaper.map((c) => c.price)) <= Math.min(...firstIds.map((i) => vehicles.find((v) => v.id === i)!.price)));
  r = say(r.state, "quero um mais novo");
  assert.ok(r.messages.length > 0);
});

test("contexto da página do veículo", () => {
  const r = reply(newState(), { type: "start", path: "/veiculo/hb20-3" }, ctx);
  assert.match(all(r), /HB20/);
  assert.equal(r.state.focus, 3);
  let q = reply({ ...r.state, contact: { name: "Rui", phone: "(51) 97777-6666", consent: true } }, { type: "text", text: "montar orçamento" }, ctx);
  assert.equal(q.state.step, "pay");
  q = say(q.state, "financiar");
  q = say(q.state, "entrada de 15 mil");
  assert.ok(q.messages[0].quote);
  assert.equal(q.messages[0].quote!.vehicleId, 3);
});

test("não entendeu duas vezes: oferece a equipe", () => {
  let r = say(newState(), "xyzzy plugh");
  assert.match(all(r), /não entendi/i);
  r = say(r.state, "qwerty asdf");
  assert.ok(r.messages[0].actions?.some((a) => a.external));
});

test("recomeçar zera a busca e mantém o contato", () => {
  let r = say({ ...newState(), contact: { name: "Bia", phone: "(51) 90000-1111", consent: true } }, "quero um suv até 100 mil");
  r = say(r.state, "recomeçar");
  assert.deepEqual(r.state.slots, {});
  assert.equal(r.state.contact.name, "Bia");
});

test("o que não está no estoque", () => {
  const r = say(newState(), "tem ferrari?");
  assert.ok(r.messages.length > 0);
});

test("no pedido de nome, 'sim', 'ok' e afins não viram o nome do cliente", () => {
  for (const resposta of ["sim", "Não", "ok", "Beleza!", "tá bom", "tanto faz", "Bom dia"]) {
    let r = say(newState(), "quero um carro até 100 mil");
    r = say(r.state, "para a cidade");
    r = reply(r.state, { type: "pick", id: cards(r)[0].id }, ctx);
    r = say(r.state, "à vista");
    assert.equal(r.state.step, "ask_name", `esperava pedir o nome antes de "${resposta}": ${all(r)}`);
    r = say(r.state, resposta);
    assert.equal(r.state.step, "ask_name", `"${resposta}" não pode ser aceito como nome`);
    assert.equal(r.state.contact.name, undefined);
  }
  let r = say(newState(), "quero um carro até 100 mil");
  r = say(r.state, "para a cidade");
  r = reply(r.state, { type: "pick", id: cards(r)[0].id }, ctx);
  r = say(r.state, "à vista");
  r = say(r.state, "Beatriz");
  assert.equal(r.state.contact.name, "Beatriz");
  assert.equal(r.state.step, "ask_phone");
});
