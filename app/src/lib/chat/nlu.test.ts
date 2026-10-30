import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVocab, detectBodies, detectFuel, detectIntents, detectKind, detectLowKm, detectModel, detectTrans, detectUse, findName, findPhone, normalize, ordinalPick, parseNumbers, type Intent } from "./nlu";
import type { VehicleLite } from "./types";

const v = (id: number, brand: string, model: string): VehicleLite => ({ id, slug: `s${id}`, kind: "carro", brand, model, version: "", body: "Hatch", year: 2020, km: 1, trans: "Manual", fuel: "Flex", engine: "", color: "", price: 1, fipe: null, featured: false, inspected: false, single: false, warranty: null, photo: null });
const vocab = buildVocab([v(1, "Chevrolet", "Onix"), v(2, "Chevrolet", "Onix Plus"), v(3, "Volkswagen", "T-Cross"), v(4, "Toyota", "Corolla Cross"), v(5, "Toyota", "Corolla"), v(6, "Hyundai", "HB20"), v(7, "Ford", "Ka"), v(8, "Honda", "CG 160"), v(9, "Fiat", "Uno")]);

test("normalize tira acentos, símbolos e espaços", () => {
  assert.equal(normalize("  QUERO  um  Sedã!!  "), "quero um seda");
  assert.equal(normalize("Até R$ 80.000,00"), "ate r$ 80.000,00");
});

const money: [string, "budget" | "down" | "parcel" | "none", Record<string, number | undefined>][] = [
  ["até 80 mil", "none", { budgetMax: 80000 }],
  ["no máximo 65k", "none", { budgetMax: 65000 }],
  ["tenho uns 45 mil", "none", { budgetMax: 45000 }],
  ["R$ 120.000", "budget", { budgetMax: 120000 }],
  ["90", "budget", { budgetMax: 90000 }],
  ["1,5 milhão", "budget", { budgetMax: 1500000 }],
  ["a partir de 50 mil", "none", { budgetMin: 50000 }],
  ["mais de 130 mil", "none", { budgetMin: 130000 }],
  ["entre 40 e 60 mil", "none", { budgetMin: 40000, budgetMax: 60000 }],
  ["de 30 a 50 mil", "none", { budgetMin: 30000, budgetMax: 50000 }],
  ["parcela de 1500", "none", { parcelMax: 1500 }],
  ["posso pagar 1.200 por mês", "none", { parcelMax: 1200 }],
  ["parcela de até 2 mil", "none", { parcelMax: 2000 }],
  ["entrada de 20 mil", "none", { down: 20000 }],
  ["dou 15 mil de entrada", "none", { down: 15000 }],
  ["10", "down", { down: 10000 }],
  ["tenho 8000 de entrada", "none", { down: 8000 }],
  ["sem entrada", "none", { down: 0 }],
  ["30% de entrada", "none", { downPct: 0.3 }],
  ["em 48x", "none", { months: 48 }],
  ["60 meses", "none", { months: 60 }],
  ["em 4 anos", "none", { months: 48 }],
  ["2019 pra cima", "none", { yearMin: 2019 }],
  ["a partir de 2020", "none", { yearMin: 2020 }],
  ["até 60 mil km", "none", { kmMax: 60000 }],
  ["no máximo 80.000 km", "none", { kmMax: 80000 }],
  ["parcela de 1500 e 20 mil de entrada", "none", { parcelMax: 1500, down: 20000 }],
  ["entrada de 20 mil e parcela de 1.500", "none", { parcelMax: 1500, down: 20000 }],
  ["até 100 mil com 30 mil de entrada em 48x", "none", { budgetMax: 100000, down: 30000, months: 48 }],
];
for (const [text, expect, want] of money) {
  test(`valores: "${text}"`, () => {
    const got = parseNumbers(normalize(text), expect);
    for (const [k, val] of Object.entries(want)) assert.equal((got as Record<string, unknown>)[k], val, `${k} em "${text}" (obtido ${JSON.stringify(got)})`);
  });
}

test("número solto sem contexto não vira orçamento", () => {
  assert.equal(parseNumbers(normalize("tenho 3 filhos"), "none").budgetMax, undefined);
  assert.equal(parseNumbers(normalize("moro no 51"), "none").budgetMax, undefined);
});

test("tipo, carroceria, câmbio, combustível e uso", () => {
  const n = normalize;
  assert.equal(detectKind(n("quero uma moto")), "moto");
  assert.equal(detectKind(n("preciso de um carro")), "carro");
  assert.equal(detectKind(n("biz")), "moto");
  assert.equal(detectKind(n("bom dia")), undefined);
  assert.deepEqual(detectBodies(n("um suv")), ["SUV"]);
  assert.deepEqual(detectBodies(n("sedan ou hatch")), ["Sedã", "Hatch"]);
  assert.deepEqual(detectBodies(n("picape cabine dupla")), ["Picape"]);
  assert.equal(detectBodies(n("qualquer coisa")), undefined);
  assert.equal(detectTrans(n("câmbio automático")), "Automático");
  assert.equal(detectTrans(n("prefiro manual")), "Manual");
  assert.equal(detectFuel(n("diesel")), "Diesel");
  assert.equal(detectFuel(n("flex")), "Flex");
  assert.equal(detectUse(n("pra família com filhos")), "familia");
  assert.equal(detectUse(n("rodar de uber")), "app");
  assert.equal(detectUse(n("trabalhar com entrega de ifood")), "entrega");
  assert.equal(detectUse(n("viagens longas")), "viagem");
  assert.equal(detectUse(n("uso na fazenda")), "trilha");
  assert.equal(detectUse(n("meu primeiro carro")), "primeiro");
  assert.equal(detectUse(n("quero algo econômico")), "economia");
  assert.equal(detectUse(n("sei lá")), undefined);
  assert.ok(detectLowKm(n("quero pouco rodado")));
});

test("modelo e marca saem do estoque, preferindo o nome mais longo", () => {
  assert.deepEqual(detectModel("quero um onix plus", vocab), { brand: "Chevrolet", model: "Onix Plus" });
  assert.deepEqual(detectModel("quero um onix", vocab), { brand: "Chevrolet", model: "Onix" });
  assert.deepEqual(detectModel("tem corolla cross?", vocab), { brand: "Toyota", model: "Corolla Cross" });
  assert.deepEqual(detectModel("um corolla", vocab), { brand: "Toyota", model: "Corolla" });
  assert.deepEqual(detectModel("t cross", vocab), { brand: "Volkswagen", model: "T-Cross" });
  assert.deepEqual(detectModel("tcross", vocab), { brand: "Volkswagen", model: "T-Cross" });
  assert.deepEqual(detectModel("hb20 comfort", vocab), { brand: "Hyundai", model: "HB20" });
  assert.deepEqual(detectModel("cg 160 titan", vocab), { brand: "Honda", model: "CG 160" });
  assert.deepEqual(detectModel("algo da toyota", vocab), { brand: "Toyota" });
  assert.deepEqual(detectModel("kafka", vocab), {}, "Ka não casa dentro de outra palavra");
  assert.deepEqual(detectModel("unico dono", vocab), {}, "Uno não casa com 'unico'");
});

const intents: [string, Intent][] = [
  ["onde fica a loja?", "address"], ["qual o endereço", "address"], ["como chego aí", "address"],
  ["que horas vocês abrem?", "hours"], ["funciona sábado?", "hours"], ["horário de atendimento", "hours"],
  ["vocês dão garantia?", "warranty"], ["quais documentos preciso?", "docs"], ["tem laudo cautelar?", "inspection"],
  ["quero agendar um test drive", "visit"], ["posso ir aí hoje? quero marcar visita", "visit"],
  ["quero vender meu carro", "sell"], ["vocês compram carro?", "sell"],
  ["aceita meu carro na troca?", "trade"], ["quero financiar", "finance"], ["qual a taxa de juros", "finance"],
  ["dá desconto?", "negotiate"], ["qual o menor preço", "negotiate"], ["aceita pix?", "payment"],
  ["quero falar com um atendente", "human"], ["me liga", "human"], ["você é um robô?", "who"],
  ["tem mais opções?", "more"], ["algo mais barato", "cheaper"], ["quero um mais novo", "newer"],
  ["quero montar um orçamento", "quote"], ["quanto fica a parcela", "finance"], ["me avise quando chegar", "notify"],
  ["obrigado", "thanks"], ["tchau", "bye"], ["oi", "greeting"], ["bom dia", "greeting"], ["sim", "yes"], ["não", "no"],
  ["recomeçar", "restart"], ["quantos carros vocês têm?", "stock"],
];
for (const [text, intent] of intents) {
  test(`intenção "${text}" → ${intent}`, () => {
    assert.ok(detectIntents(normalize(text)).includes(intent), `${text}: ${detectIntents(normalize(text))}`);
  });
}

test("como funciona o financiamento NÃO é pergunta de horário", () => {
  const got = detectIntents(normalize("como funciona o financiamento?"));
  assert.ok(got.includes("finance"));
  assert.ok(!got.includes("hours"));
});

test("ordinais e contato no meio da frase", () => {
  assert.equal(ordinalPick("quero o primeiro"), 0);
  assert.equal(ordinalPick("o segundo"), 1);
  assert.equal(ordinalPick("terceira opção"), 2);
  assert.equal(ordinalPick("nenhum"), undefined);
  assert.equal(findPhone("meu zap é (51) 99999-1234 obrigado"), "(51) 99999-1234");
  assert.equal(findPhone("51999991234"), "51999991234");
  assert.equal(findPhone("sem telefone aqui"), undefined);
  assert.equal(findName("meu nome é carlos souza e quero um carro"), "Carlos Souza");
  assert.equal(findName("me chamo Ana"), "Ana");
  assert.equal(findName("quero um carro"), undefined);
});
