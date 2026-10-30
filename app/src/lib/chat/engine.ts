// Assistente virtual por regras (sem IA). Função pura: (estado, mensagem, estoque) -> (novo estado, respostas).
// O estado viaja com o cliente; o servidor só carrega o estoque e executa efeitos (criar lead).
import { brl } from "../finance";
import { MIN_DOWN_PCT, TERMS, maxMonths, pct, priceFromParcel, rateLabel, simulate } from "../financing";
import { normalizePhone, validName } from "../phone";
import {
  buildVocab, detectBodies, detectFuel, detectIntents, detectKind, detectLowKm, detectModel, detectNewer, detectTrans, detectUse,
  findName, findPhone, normalize, ordinalPick, parseNumbers, type Intent, type Parsed, type Vocab,
} from "./nlu";
import { newState, type Action, type Card, type ChatState, type Ctx, type Effect, type Input, type Kind, type Msg, type Quote, type Reply, type Slots, type Use, type VehicleLite } from "./types";

const YEAR = 2026;
const SLOT_KEYS: (keyof Slots)[] = ["kind", "budgetMax", "budgetMin", "down", "parcelMax", "pay", "trade", "bodies", "brand", "model", "trans", "fuel", "yearMin", "kmMax", "lowKm", "use", "months", "newer", "tradeValue"];

const first = (name?: string) => name?.split(" ")[0];
const roundTo = (n: number, to: number) => Math.round(n / to) * to;
const titleOf = (v: Pick<VehicleLite, "brand" | "model" | "version">) => `${v.brand} ${v.model} ${v.version}`.trim();
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const msg = (text: string, extra: Partial<Msg> = {}): Msg => ({ text, ...extra });
const comma = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`);

function wa(ctx: Ctx, text: string): string {
  return `https://wa.me/${ctx.store.whatsapp}?text=${encodeURIComponent(text)}`;
}
const waAction = (ctx: Ctx, label: string, text: string): Action => ({ label, href: wa(ctx, text), external: true });

// ---------- resumo do que o cliente procura ----------
function describe(s: Slots): string {
  const parts: string[] = [];
  if (s.model) parts.push(`${s.brand ?? ""} ${s.model}`.trim());
  else if (s.bodies?.length) parts.push(s.bodies.join("/"));
  else if (s.kind) parts.push(s.kind === "moto" ? "moto" : "carro");
  if (s.brand && !s.model) parts.push(s.brand);
  if (s.budgetMin && s.budgetMax) parts.push(`entre ${brl(s.budgetMin)} e ${brl(s.budgetMax)}`);
  else if (s.budgetMax) parts.push(`até ${brl(s.budgetMax)}`);
  else if (s.budgetMin) parts.push(`a partir de ${brl(s.budgetMin)}`);
  if (s.parcelMax) parts.push(`parcela de até ${brl(s.parcelMax)}`);
  if (s.down !== undefined) parts.push(s.down ? `entrada de ${brl(s.down)}` : "sem entrada");
  if (s.trans) parts.push(`câmbio ${s.trans.toLowerCase()}`);
  if (s.fuel) parts.push(s.fuel.toLowerCase());
  if (s.yearMin) parts.push(`${s.yearMin} em diante`);
  if (s.kmMax) parts.push(`até ${s.kmMax.toLocaleString("pt-BR")} km`);
  if (s.lowKm) parts.push("pouco rodado");
  if (s.use) parts.push(`uso: ${USE_LABEL[s.use]}`);
  if (s.pay === "avista") parts.push("à vista");
  if (s.pay === "financiar") parts.push("financiando");
  if (s.trade) parts.push("com veículo na troca");
  return parts.join(", ");
}

const USE_LABEL: Record<Use, string> = {
  familia: "família", trabalho: "trabalho", app: "aplicativo", cidade: "cidade", viagem: "viagem", trilha: "estrada de chão e trabalho pesado",
  entrega: "entregas", primeiro: "primeiro veículo", economia: "economia", esportivo: "esportivo", luxo: "conforto e acabamento",
};

function teamSummary(st: ChatState, extra?: string): string {
  const d = describe(st.slots);
  return [d && `Procura: ${d}.`, st.slots.tradeDesc && `Veículo na troca: ${st.slots.tradeDesc}.`, extra].filter(Boolean).join(" ");
}

// ---------- extração de informações da frase ----------
type Extracted = { slots: Slots; changed: boolean; intents: Intent[]; parsed: Parsed; n: string };

function expectOf(step: ChatState["step"]): "budget" | "down" | "parcel" | "none" {
  if (step === "budget") return "budget";
  if (step === "down") return "down";
  return "none";
}

function extract(raw: string, st: ChatState, ctx: Ctx, vocab: Vocab): Extracted {
  const n = normalize(raw);
  const intents = detectIntents(n);
  const parsed = parseNumbers(n, expectOf(st.step));
  const s: Slots = clone(st.slots);
  const before = JSON.stringify(SLOT_KEYS.map((k) => st.slots[k]));

  const bodies = detectBodies(n);
  if (bodies) s.bodies = bodies;
  const kind = detectKind(n) ?? (bodies?.some((b) => ["Scooter", "Trail", "Esportiva", "Street"].includes(b)) ? "moto" : undefined);
  if (kind) { s.kind = kind; if (s.bodies && kind === "carro") s.bodies = s.bodies.filter((b) => ["Hatch", "Sedã", "SUV", "Picape"].includes(b)); }

  const m = detectModel(n, vocab);
  if (m.model) {
    s.model = m.model; s.brand = m.brand;
    s.kind = ctx.vehicles.find((v) => v.model === m.model)?.kind ?? s.kind;
  } else if (m.brand) {
    s.brand = m.brand;
    const kinds = new Set(ctx.vehicles.filter((v) => v.brand === m.brand).map((v) => v.kind));
    if (kinds.size === 1) s.kind = [...kinds][0];
  }

  const t = detectTrans(n); if (t) s.trans = t;
  const f = detectFuel(n); if (f) s.fuel = f;
  const u = detectUse(n); if (u) s.use = u;
  if (detectLowKm(n)) s.lowKm = true;
  if (detectNewer(n)) s.newer = true;

  if (parsed.budgetMax) s.budgetMax = parsed.budgetMax;
  if (parsed.budgetMin) s.budgetMin = parsed.budgetMin;
  if (parsed.parcelMax) { s.parcelMax = parsed.parcelMax; s.pay = "financiar"; }
  if (parsed.down !== undefined) { s.down = parsed.down; if (parsed.down > 0 && s.pay !== "troca") s.pay = "financiar"; }
  if (parsed.downPct) s.downPct = parsed.downPct;
  if (parsed.yearMin) s.yearMin = parsed.yearMin;
  if (parsed.kmMax) s.kmMax = parsed.kmMax;
  if (parsed.months) s.months = Math.min(Math.max(parsed.months, 12), 60);
  if (parsed.tradeValue) { s.tradeValue = parsed.tradeValue; s.trade = true; }

  if (/\b(a vista|avista|pagar (no )?pix|dinheiro vivo|pago a vista)\b/.test(n)) { s.pay = "avista"; s.down = undefined; }
  if (/\b(financ\w*|parcelad\w*|a prazo|em parcelas)\b/.test(n) && !/\bnao (quero|vou) financ/.test(n)) s.pay = "financiar";
  if (/\b(sem troca|nao tenho (carro|moto|veiculo|troca)|nao vou dar|nao tenho nada pra trocar)\b/.test(n)) s.trade = false;
  else if (/\b(troca|trocar|na troca|dar o meu|tenho (um|uma) (carro|moto|veiculo))\b/.test(n)) { s.trade = true; if (!s.pay) s.pay = "troca"; }

  // área "preciso de X": resposta curta "à vista" / "financiar" quando o robô perguntou a forma de pagamento
  if (st.step === "pay") {
    if (/^(a vista|avista)/.test(n)) s.pay = "avista";
    if (/^financ/.test(n)) s.pay = "financiar";
  }
  if (st.step === "need" && intents.includes("skip")) s.skippedNeed = true;
  if (intents.includes("changebudget")) { s.budgetMax = parsed.budgetMax; s.budgetMin = undefined; s.parcelMax = parsed.parcelMax; }

  // "30% de entrada" vira valor assim que houver orçamento
  if (s.downPct && (s.budgetMax || st.focus)) {
    const base = s.budgetMax ?? ctx.vehicles.find((v) => v.id === st.focus)?.price ?? 0;
    if (base) { s.down = roundTo(base * s.downPct, 500); s.downPct = undefined; if (s.pay !== "troca") s.pay = "financiar"; }
  }
  if (s.kind && s.kind === "moto" && s.bodies) s.bodies = s.bodies.filter((b) => ["Scooter", "Trail", "Esportiva", "Street"].includes(b));
  if (s.bodies && s.bodies.length === 0) delete s.bodies;

  const after = JSON.stringify(SLOT_KEYS.map((k) => s[k]));
  return { slots: s, changed: before !== after || !!s.downPct, intents, parsed, n };
}

// ---------- chips ----------
function budgetChips(ctx: Ctx, kind?: Kind): string[] {
  const ps = ctx.vehicles.filter((v) => !kind || v.kind === kind).map((v) => v.price).sort((a, b) => a - b);
  if (ps.length < 4) return ["Qual o valor?"];
  const at = (p: number) => ps[Math.floor((ps.length - 1) * p)];
  const nice = (x: number) => (x < 30000 ? roundTo(x, 5000) : x < 100000 ? roundTo(x, 10000) : roundTo(x, 20000));
  const cuts = [...new Set([0.25, 0.5, 0.75].map((p) => nice(at(p))))].filter((x) => x > 0);
  return [...cuts.map((c) => `Até ${brl(c)}`), `Mais de ${brl(cuts[cuts.length - 1])}`];
}

const NEED_CHIPS_CAR = ["Para a família", "Trabalho", "Aplicativo", "Cidade", "Viagem", "Qualquer um"];
const NEED_CHIPS_MOTO = ["Dia a dia", "Entrega", "Viagem", "Esportiva", "Qualquer uma"];
const TOP_CHIPS = ["Quero um carro", "Quero uma moto", "Quero financiar", "Tenho veículo na troca", "Falar com a equipe"];

function stepChips(st: ChatState, ctx: Ctx): string[] {
  switch (st.step) {
    case "kind": return ["Carro", "Moto"];
    case "budget": return [...budgetChips(ctx, st.slots.kind), "Prefiro dizer a parcela"];
    case "pay": return ["À vista", "Financiar", "Tenho veículo na troca"];
    case "down": {
      const base = st.slots.budgetMax ?? 60000;
      return ["Sem entrada", ...[0.2, 0.3, 0.4].map((p) => `Entrada de ${brl(roundTo(base * p, 1000))}`)];
    }
    case "need": return st.slots.kind === "moto" ? NEED_CHIPS_MOTO : NEED_CHIPS_CAR;
    default: return [];
  }
}

// ---------- perguntas do fluxo ----------
function ask(st: ChatState, ctx: Ctx, lead = ""): Msg {
  const who = st.contact.name ? `, ${first(st.contact.name)}` : "";
  switch (st.step) {
    case "kind": return msg(`${lead}Você procura um carro ou uma moto?`, { chips: stepChips(st, ctx) });
    case "budget": return msg(`${lead}Qual valor você pretende investir${who}? Pode falar o valor total (ex.: "até 80 mil") ou a parcela que cabe no seu bolso (ex.: "parcela de 1.500").`, { chips: stepChips(st, ctx) });
    case "pay": return msg(`${lead}Como você pretende pagar? À vista, financiado ou com seu veículo na troca?`, { chips: stepChips(st, ctx) });
    case "down": return msg(`${lead}Quanto você teria de entrada? Pode ser zero. Entrada maior costuma ajudar na aprovação e baixa a parcela.`, { chips: stepChips(st, ctx) });
    case "need": return msg(`${lead}Para que você vai usar? Assim eu priorizo o que combina com o seu dia a dia. Pode também dizer marca, modelo ou câmbio.`, { chips: stepChips(st, ctx) });
    default: return msg(`${lead}Em que posso ajudar?`, { chips: TOP_CHIPS });
  }
}

function resumeQuestion(st: ChatState, ctx: Ctx): Msg | null {
  if (["kind", "budget", "pay", "down", "need"].includes(st.step)) return ask(st, ctx, "Voltando ao que eu estava perguntando: ");
  return null;
}

// ---------- seleção e pontuação de veículos ----------
function budgetCap(st: ChatState, ctx: Ctx): number | undefined {
  const s = st.slots;
  let cap = s.budgetMax;
  if (s.parcelMax) {
    const months = Math.min(s.months ?? 48, 60);
    const fromParcel = s.down !== undefined
      ? priceFromParcel(s.parcelMax, s.down, months, ctx.rates.ref)
      : priceFromParcel(s.parcelMax, 0, months, ctx.rates.ref) / (1 - MIN_DOWN_PCT);
    cap = cap ? Math.min(cap, fromParcel) : fromParcel;
  }
  return cap ? Math.round(cap) : undefined;
}

type Scored = { v: VehicleLite; score: number; reasons: string[] };

function scoreForUse(v: VehicleLite, use: Use): [number, string] | null {
  const b = v.body;
  const moto = v.kind === "moto";
  const age = YEAR - v.year;
  const t: Record<Use, () => [number, string] | null> = {
    familia: () => (b === "SUV" ? [18, "Espaço e conforto para a família"] : b === "Sedã" ? [14, "Porta-malas e conforto para a família"] : b === "Picape" ? [6, "Cabine com espaço para passageiros"] : null),
    trabalho: () => (moto ? (["Street", "Scooter"].includes(b) ? [14, "Prática para o dia a dia de trabalho"] : null) : b === "Picape" ? [16, "Caçamba e robustez para o trabalho"] : b === "Sedã" ? [8, "Confortável para rodar bastante"] : null),
    app: () => (b === "Sedã" ? [16, "Quatro portas e porta-malas para rodar o dia todo"] : b === "Hatch" ? [9, "Compacto e fácil de manter"] : null),
    cidade: () => (moto ? (b === "Scooter" || b === "Street" ? [12, "Ágil no trânsito"] : null) : b === "Hatch" ? [16, "Compacto, fácil de estacionar"] : v.trans === "Automático" ? [8, "Câmbio automático ajuda no trânsito"] : null),
    viagem: () => (moto ? (b === "Trail" ? [16, "Confortável para estrada"] : null) : b === "Sedã" || b === "SUV" ? [12, "Conforto para estrada"] : v.fuel === "Diesel" ? [8, "Motor diesel para longas distâncias"] : null),
    trilha: () => (moto ? (b === "Trail" ? [18, "Trail: aguenta estrada de chão"] : null) : b === "Picape" ? [20, "Picape para estrada de chão e trabalho pesado"] : b === "SUV" ? [10, "Altura do solo e robustez"] : /4x4/i.test(v.version) ? [10, "Tração 4x4"] : null),
    entrega: () => (moto ? (/CG|Biz|Fazer|Titan/i.test(v.model) || b === "Scooter" || b === "Street" ? [18, "Econômica e prática para entregas"] : null) : null),
    primeiro: () => (v.price <= 60000 && !moto ? [14, "Boa para começar: valor mais acessível"] : moto && v.price <= 22000 ? [14, "Boa para começar: valor mais acessível"] : null),
    economia: () => (/\b1\.0\b|\b1\.3\b|\b1\.2\b|\b125cc\b|\b160cc\b|\b250cc\b/.test(v.engine) ? [12, `Motor ${v.engine.split(" ")[0]}: costuma gastar menos`] : null),
    esportivo: () => (moto ? (b === "Esportiva" ? [20, "Esportiva de verdade"] : null) : /turbo/i.test(v.engine) ? [14, "Motor turbo"] : null),
    luxo: () => (["BMW", "Audi", "Mercedes-Benz", "Volvo", "Porsche", "Land Rover"].includes(v.brand) ? [20, "Acabamento e conforto premium"] : age <= 4 && v.price > 100000 ? [6, "Mais recente e bem equipado"] : null),
  };
  return t[use]();
}

function scoreVehicle(v: VehicleLite, st: ChatState, ctx: Ctx, cap: number | undefined): Scored {
  const s = st.slots;
  let score = 0;
  const reasons: string[] = [];
  const age = Math.max(YEAR - v.year, 0);

  if (s.model && v.model === s.model) { score += 40; reasons.push(`${v.brand} ${v.model}, como você pediu`); }
  else if (s.brand && v.brand === s.brand) { score += 25; reasons.push(`Marca ${v.brand}`); }
  if (s.bodies?.length) {
    if (s.bodies.includes(v.body)) { score += 28; reasons.push(`${v.body}, como você pediu`); } else score -= 12;
  }
  if (s.use) { const u = scoreForUse(v, s.use); if (u) { score += u[0]; reasons.push(u[1]); } }
  if (s.trans) { if (v.trans.startsWith(s.trans.slice(0, 4))) { score += 14; reasons.push(`Câmbio ${s.trans.toLowerCase()}`); } else score -= 10; }
  if (s.fuel) { if (v.fuel === s.fuel) { score += 10; reasons.push(`Combustível: ${v.fuel}`); } else score -= 6; }
  if (s.yearMin) { if (v.year >= s.yearMin) { score += 10; reasons.push(`Ano ${v.year}`); } else score -= 16; }
  if (s.kmMax) { if (v.km <= s.kmMax) { score += 10; reasons.push(`${v.km.toLocaleString("pt-BR")} km rodados`); } else score -= 12; }
  if (s.lowKm || s.use === "primeiro") {
    const perYear = v.km / Math.max(age, 1);
    if (perYear < 10000) { score += s.lowKm ? 12 : 3; if (s.lowKm) reasons.push("Baixa quilometragem para o ano"); }
  }
  if (s.newer) score += (v.year - 2005) * 0.9;
  if (cap) {
    const ratio = v.price / cap;
    if (ratio <= 1) { score += ratio >= 0.8 ? 10 : ratio >= 0.6 ? 6 : 2; reasons.push(ratio >= 0.8 ? `Dentro do orçamento (${brl(v.price)})` : `Sobra folga no orçamento (${brl(v.price)})`); }
  }
  if (s.pay === "financiar" || s.parcelMax) {
    const months = Math.min(s.months ?? 48, maxMonths(age, v.kind));
    const down = s.down ?? roundTo(v.price * 0.3, 500);
    const sim = simulate({ price: v.price, down, trade: s.tradeValue ?? 0, months, rate: ctx.rates.ref });
    if (s.parcelMax) { if (sim.parcel <= s.parcelMax) { score += 14; reasons.push(`Parcela estimada de ${brl(sim.parcel)} em ${months}x`); } else score -= 14; }
    else reasons.push(`Parcela estimada de ${brl(sim.parcel)} em ${months}x`);
  }
  if (v.featured) score += 3;
  if (v.inspected) { score += 3; reasons.push("Vistoria realizada"); }
  if (v.single) { score += 2; reasons.push("Único dono"); }
  if (v.fipe && v.price < v.fipe * 0.98) { score += 3; reasons.push("Abaixo da tabela FIPE"); }
  if (v.warranty) reasons.push(`Garantia de fábrica até ${v.warranty}`);
  return { v, score, reasons };
}

function toCard(sc: Scored): Card {
  const v = sc.v;
  const tags: string[] = [];
  if (v.inspected) tags.push("Vistoria realizada");
  if (v.single) tags.push("Único dono");
  if (v.fipe && v.price < v.fipe * 0.98) tags.push("Abaixo da FIPE");
  const uniq = [...new Set(sc.reasons)];
  return {
    id: v.id, slug: v.slug, title: titleOf(v), year: v.year, km: v.km, trans: v.trans, fuel: v.fuel, price: v.price, photo: v.photo,
    tags: tags.slice(0, 2), reasons: uniq.slice(0, 3), fit: sc.score >= 45 ? "alta" : sc.score >= 20 ? "boa" : "aprox",
  };
}

type PickResult = { cards: Card[]; total: number; relaxed?: string; none?: boolean };

function recommend(st: ChatState, ctx: Ctx, opts: { reshow?: boolean } = {}): PickResult {
  const s = st.slots;
  let pool = ctx.vehicles.filter((v) => !s.kind || v.kind === s.kind);
  if (s.model) pool = pool.filter((v) => v.model === s.model);
  else if (s.brand) pool = pool.filter((v) => v.brand === s.brand);
  let cap = budgetCap(st, ctx);
  let relaxed: string | undefined;
  const within = (lim?: number) => pool.filter((v) => (!lim || v.price <= lim) && (!s.budgetMin || v.price >= s.budgetMin));
  let list = within(cap);
  if (!list.length && cap) {
    const wider = Math.round(cap * 1.2);
    list = within(wider);
    if (list.length) relaxed = `Não achei nada até ${brl(cap)}, então ampliei um pouco (até ${brl(wider)}).`;
    cap = wider;
  }
  if (!list.length && (s.model || s.brand)) {
    // modelo/marca fora do estoque: mostra o que existe do mesmo tipo
    const alt = ctx.vehicles.filter((v) => (!s.kind || v.kind === s.kind) && (!cap || v.price <= cap * 1.2));
    if (alt.length) { list = alt; relaxed = `No momento não tenho ${s.model ?? s.brand} nesse perfil. Veja o que tenho parecido.`; }
  }
  if (!list.length) return { cards: [], total: 0, none: true };
  let scored = list.map((v) => scoreVehicle(v, st, ctx, cap)).sort((a, b) => b.score - a.score || b.v.price - a.v.price);
  const total = scored.length;
  if (!opts.reshow) {
    const fresh = scored.filter((x) => !st.shown.includes(x.v.id));
    if (fresh.length) scored = fresh; else return { cards: [], total, relaxed: "all-shown" };
  }
  return { cards: scored.slice(0, 3).map(toCard), total, relaxed };
}

// ---------- orçamento ----------
function buildQuote(v: VehicleLite, st: ChatState, ctx: Ctx): Quote {
  const s = st.slots;
  const age = Math.max(YEAR - v.year, 0);
  const limit = maxMonths(age, v.kind);
  const mode: Quote["mode"] = s.pay === "avista" ? "avista" : "financiar";
  const down = mode === "avista" ? v.price : (s.down ?? roundTo(v.price * 0.3, 500));
  const trade = s.tradeValue ?? 0;
  const terms = TERMS.filter((t) => t <= limit && t >= 12);
  const chosen = terms.includes(s.months ?? 0) ? (s.months as number) : terms.includes(48) ? 48 : terms[terms.length - 1] ?? 12;
  const mk = (m: number, r: number) => simulate({ price: v.price, down: mode === "avista" ? v.price : down, trade, months: m, rate: r });
  const main = mk(chosen, ctx.rates.ref);
  const options = mode === "avista" ? [] : terms.map((m) => ({ months: m, parcel: mk(m, ctx.rates.ref).parcel, low: mk(m, ctx.rates.low).parcel, high: mk(m, ctx.rates.high).parcel, total: mk(m, ctx.rates.ref).total }));
  const notes = [
    mode === "avista" ? "Compra à vista: condições e formas de pagamento são combinadas com a equipe." : `Parcelas calculadas com ${pct(ctx.rates.ref)} a.m. (${rateLabel(ctx.rates)}), IOF estimado incluso.`,
    trade ? "O valor do seu veículo na troca é só uma estimativa sua: a avaliação é feita pela equipe." : "",
    "Valores sujeitos à confirmação de disponibilidade e, no financiamento, à análise de crédito do banco.",
  ].filter(Boolean);
  const waText = `Olá! Sou ${st.contact.name ?? "cliente"} e montei um orçamento no site: ${titleOf(v)} ${v.year}, ${brl(v.price)}. ${
    mode === "avista" ? "Pretendo pagar à vista." : `Entrada ${brl(down)}${trade ? ` + troca estimada ${brl(trade)}` : ""}, ${chosen}x de ${brl(main.parcel)}.`
  } Podemos seguir?`;
  return { vehicleId: v.id, slug: v.slug, title: titleOf(v), price: v.price, mode, entry: down, trade, financed: main.financed, iof: main.iof, options, chosenMonths: chosen, cetMonthly: main.cetMonthly, rateRef: ctx.rates.ref, rateLabel: rateLabel(ctx.rates), notes, waText };
}

// ---------- contato (nome e WhatsApp antes de fechar orçamento, visita etc.) ----------
function nextContactStep(st: ChatState): ChatState["step"] | null {
  if (!st.contact.name) return "ask_name";
  if (!st.contact.phone) return "ask_phone";
  if (st.contact.consent === undefined) return "ask_consent";
  return null;
}

const PENDING_LABEL: Record<NonNullable<ChatState["pending"]>, string> = {
  quote: "montar o seu orçamento", visit: "combinar a visita", notify: "avisar você quando chegar algo", trade: "avaliar o seu veículo", human: "te atender",
};

function askContact(st: ChatState): Msg {
  const step = nextContactStep(st);
  if (step === "ask_name") { st.step = "ask_name"; return msg(`Para ${PENDING_LABEL[st.pending ?? "quote"]}, como posso te chamar?`, { chips: ["Prefiro não informar"] }); }
  if (step === "ask_phone") { st.step = "ask_phone"; return msg(`Prazer, ${first(st.contact.name)}! Qual o seu WhatsApp com DDD? A equipe usa só para falar sobre isso.`, { chips: ["Prefiro não informar"] }); }
  st.step = "ask_consent";
  return msg(`Posso passar seu nome e WhatsApp para a equipe te chamar? Seus dados são usados só para esse atendimento (LGPD).`, { chips: ["Sim, pode", "Não, só quero ver aqui"] });
}

function leadEffect(st: ChatState, vehicleId: number | null, extra: string): Effect | undefined {
  if (!st.contact.consent || !st.contact.name || !st.contact.phone) return undefined;
  return { type: "lead", name: st.contact.name, phone: st.contact.phone, vehicleId, message: `[Chat] ${teamSummary(st, extra)}`.slice(0, 600) };
}

function complete(st: ChatState, ctx: Ctx): Reply {
  const p = st.pending;
  st.pending = undefined;
  st.step = "idle";
  const name = first(st.contact.name);
  const hi = name ? `, ${name}` : "";
  const consent = st.contact.consent === true;

  if (p === "quote") {
    const v = ctx.vehicles.find((x) => x.id === st.focus);
    if (!v) return { state: st, messages: [ask({ ...st, step: "kind" }, ctx)] };
    const q = buildQuote(v, st, ctx);
    const eff = leadEffect(st, v.id, q.mode === "avista" ? `Orçamento à vista do ${q.title} (${brl(q.price)}).` : `Orçamento do ${q.title}: entrada ${brl(q.entry)}, ${q.chosenMonths}x de ${brl(q.options.find((o) => o.months === q.chosenMonths)?.parcel ?? 0)}.`);
    const actions: Action[] = [waAction(ctx, "Enviar para a equipe no WhatsApp", q.waText), { label: "Ver o anúncio", href: `/veiculo/${v.slug}` }];
    return {
      state: st, effect: eff,
      messages: [msg(`Pronto${hi}! Montei o orçamento do ${q.title}.${consent ? " A equipe já recebeu seu contato e pode seguir com você." : ""}`, { quote: q, actions, chips: ["Combinar visita", "Mudar entrada", "Ver outras opções", "Tenho veículo na troca"] })],
    };
  }
  if (p === "visit") {
    const v = ctx.vehicles.find((x) => x.id === (st.focus ?? st.ctxVehicle));
    const what = v ? `ver o ${titleOf(v)}` : "conhecer a loja";
    const eff = leadEffect(st, v?.id ?? null, `Quer combinar uma visita para ${what}.`);
    return {
      state: st, effect: eff,
      messages: [msg(`Combinado${hi}! ${consent ? "Registrei seu pedido de visita e a equipe confirma dia e horário pelo WhatsApp." : "Sem problema: chame a equipe no WhatsApp para confirmar dia e horário."}`, {
        actions: [waAction(ctx, "Combinar visita no WhatsApp", `Olá! Sou ${st.contact.name ?? "cliente"} e quero combinar uma visita para ${what}.`), { label: "Como chegar", href: "/contato" }],
        chips: ["Ver opções de veículos", "Obrigado"],
      })],
    };
  }
  if (p === "notify") {
    const eff = leadEffect(st, null, "Quer ser avisado quando chegar algo com esse perfil.");
    return { state: st, effect: eff, messages: [msg(`Anotado${hi}! ${consent ? "A equipe vai te avisar quando chegar algo com esse perfil." : "Se mudar de ideia, é só chamar a equipe."}`, { chips: ["Ver outras opções", "Obrigado"] })] };
  }
  if (p === "trade") {
    const eff = leadEffect(st, null, `Quer avaliar o veículo para troca ou venda: ${st.slots.tradeDesc ?? "detalhes a informar"}.`);
    return {
      state: st, effect: eff,
      messages: [msg(`Obrigado${hi}! Já deixei os dados do seu veículo para a equipe. ${consent ? "Eles avaliam e te respondem pelo WhatsApp." : "Para agilizar, mande os dados direto no WhatsApp."} A avaliação final depende de uma olhada no veículo.`, {
        actions: [waAction(ctx, "Enviar dados no WhatsApp", `Olá! Sou ${st.contact.name ?? "cliente"} e quero avaliar meu veículo: ${st.slots.tradeDesc ?? ""}`)],
        chips: ["Ver opções de veículos", "Obrigado"],
      })],
    };
  }
  return { state: st, messages: [msg(`Certo${hi}! Em que mais posso ajudar?`, { chips: TOP_CHIPS })] };
}

function contactStep(st: ChatState, raw: string, n: string, ctx: Ctx): Reply | null {
  const intents = detectIntents(n);
  const decline = /^(prefiro nao|nao quero|agora nao|nao informar|nao, so quero ver|nao so quero ver|deixa|depois)/.test(n) || (st.step === "ask_consent" && intents.includes("no"));
  if (decline) {
    // segue sem contato: nada é enviado para a equipe
    st.contact.consent = false;
    return complete(st, ctx);
  }
  const ph = findPhone(raw);
  const nm = findName(raw);
  if (st.step === "ask_name") {
    const candidate = nm ?? raw.replace(/[^\p{L}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
    const words = candidate.split(" ").filter(Boolean);
    const notAName = /^(sim|nao|ok|okay|ta|ta bom|pode|claro|beleza|certo|aham|uhum|blz|valeu|oi|ola|obrigad[oa]|nenhum|nada|tanto faz|bom dia|boa tarde|boa noite|tudo bem)$/.test(n);
    const okName = !notAName && validName(candidate) && words.length <= 4 && !/\d/.test(raw.replace(ph ?? "", "")) && !intents.some((i) => ["human", "hours", "address", "finance"].includes(i)) && !/\?$/.test(raw.trim());
    if (!okName) return { state: st, messages: [msg("Pode me dizer só o seu primeiro nome? Se preferir não informar, tudo bem.", { chips: ["Prefiro não informar"] })] };
    st.contact.name = candidate.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    if (ph && normalizePhone(ph)) st.contact.phone = normalizePhone(ph) as string;
  } else if (st.step === "ask_phone") {
    const phone = normalizePhone(ph ?? raw);
    if (!phone) return { state: st, messages: [msg("Não consegui ler esse número. Pode mandar com DDD? Exemplo: (51) 99999-9999", { chips: ["Prefiro não informar"] })] };
    st.contact.phone = phone;
  } else if (st.step === "ask_consent") {
    if (intents.includes("yes") || /\b(pode|sim|autorizo|concordo)\b/.test(n)) st.contact.consent = true;
    else return { state: st, messages: [msg("Posso passar seu contato para a equipe? Responda sim ou não.", { chips: ["Sim, pode", "Não, só quero ver aqui"] })] };
  }
  const nxt = nextContactStep(st);
  if (nxt) return { state: st, messages: [askContact(st)] };
  return complete(st, ctx);
}

function beginPending(st: ChatState, ctx: Ctx, pending: NonNullable<ChatState["pending"]>): Reply {
  st.pending = pending;
  if (nextContactStep(st)) return { state: st, messages: [askContact(st)] };
  return complete(st, ctx);
}

// ---------- resultados ----------
function showResults(st: ChatState, ctx: Ctx, opts: { reshow?: boolean; lead?: string } = {}): Reply {
  const pick = recommend(st, ctx, opts);
  const d = describe(st.slots);
  st.step = "results";
  st.lastNeed = d;
  if (pick.none) {
    return { state: st, messages: [msg(`Não encontrei nada com esse perfil${d ? ` (${d})` : ""} no estoque agora. Quer que eu avise a equipe para procurar, ou prefere ajustar o valor?`, { chips: ["Avise-me quando chegar", "Mudar orçamento", "Ver todo o estoque", "Falar com a equipe"] })] };
  }
  if (pick.relaxed === "all-shown") {
    return { state: st, messages: [msg("Já te mostrei todas as opções desse perfil. Posso ajustar o valor, o tipo ou o câmbio, ou avisar a equipe para procurar outras para você.", { chips: ["Mudar orçamento", "Avise-me quando chegar", "Recomeçar", "Falar com a equipe"] })] };
  }
  st.shown = [...st.shown, ...pick.cards.map((c) => c.id)];
  const cap = budgetCap(st, ctx);
  const intro = [
    opts.lead ?? "",
    pick.relaxed && pick.relaxed !== "all-shown" ? pick.relaxed + " " : "",
    `Separei ${pick.cards.length === 1 ? "1 opção" : `${pick.cards.length} opções`}${d ? ` para ${d}` : ""}${pick.total > pick.cards.length ? ` (há mais ${pick.total - pick.cards.length} nesse perfil)` : ""}.`,
    st.slots.parcelMax && cap ? ` Com essa parcela dá para chegar em torno de ${brl(roundTo(cap, 1000))}.` : "",
  ].join("");
  return {
    state: st,
    messages: [msg(intro, { cards: pick.cards, chips: ["Montar orçamento do 1º", "Ver outras opções", "Mais barato", "Mais novo", "Falar com a equipe"] })],
  };
}

function advance(st: ChatState, ctx: Ctx, lead = ""): Reply {
  const s = st.slots;
  const kinds = new Set(ctx.vehicles.map((v) => v.kind));
  if (!s.kind && kinds.size > 1) { st.step = "kind"; return { state: st, messages: [ask(st, ctx, lead)] }; }
  if (!s.kind && kinds.size === 1) s.kind = [...kinds][0];
  const hasTarget = !!(s.model || s.brand);
  if (!hasTarget && s.budgetMax === undefined && s.budgetMin === undefined && s.parcelMax === undefined) { st.step = "budget"; return { state: st, messages: [ask(st, ctx, lead)] }; }
  if (s.pay === "financiar" && s.down === undefined && !s.parcelMax) { st.step = "down"; return { state: st, messages: [ask(st, ctx, lead)] }; }
  const narrowed = !!(s.bodies?.length || s.use || hasTarget || s.trans || s.fuel || s.skippedNeed);
  if (!narrowed) {
    const n = recommend(st, ctx, { reshow: true }).total;
    if (n > 5) { st.step = "need"; return { state: st, messages: [ask(st, ctx, lead)] }; }
  }
  return showResults(st, ctx, { lead });
}

// ---------- perguntas frequentes ----------
function stockInfo(ctx: Ctx): Msg {
  const cars = ctx.vehicles.filter((v) => v.kind === "carro");
  const motos = ctx.vehicles.filter((v) => v.kind === "moto");
  const range = (l: VehicleLite[]) => (l.length ? `de ${brl(Math.min(...l.map((v) => v.price)))} a ${brl(Math.max(...l.map((v) => v.price)))}` : "");
  const parts = [cars.length ? `${cars.length} carros (${range(cars)})` : "", motos.length ? `${motos.length} motos (${range(motos)})` : ""].filter(Boolean);
  return msg(`Hoje tenho ${comma(parts)}, todos usados. Quer ver por tipo, valor ou uso?`, { chips: ["Quero um carro", "Quero uma moto", "Ver destaques", "Falar com a equipe"], actions: [{ label: "Ver todo o estoque", href: "/estoque" }] });
}

function faq(intent: Intent, st: ChatState, ctx: Ctx): Msg | null {
  const S = ctx.store;
  const team = waAction(ctx, "Falar com a equipe no WhatsApp", `Olá! Estou no site da ${S.short}. ${teamSummary(st)}`.trim());
  switch (intent) {
    case "who": return msg(`Sou o assistente virtual da ${S.name}. Respondo por regras, sem inteligência artificial, e a equipe confirma tudo o que importa (preço final, disponibilidade e crédito). Posso te ajudar a achar um veículo, simular financiamento e montar um orçamento.`, { chips: TOP_CHIPS });
    case "hours": return msg(S.hours ? `Horário de atendimento: ${S.hours}.` : "Os horários de atendimento são confirmados pela equipe. Chame no WhatsApp ou ligue que eles te passam certinho.", { actions: [team, { label: "Ver contato e mapa", href: "/contato" }] });
    case "address": return msg(`Nossa loja fica em ${S.address}. Na página de contato tem o mapa e o botão "Como chegar".`, { actions: [{ label: "Ver mapa e como chegar", href: "/contato" }], chips: ["Combinar visita", "Ver opções de veículos"] });
    case "phone": return msg(`Telefone: ${S.phone}. WhatsApp: ${S.whatsappLabel}.`, { actions: [team], chips: ["Combinar visita", "Ver opções de veículos"] });
    case "warranty": return msg("As condições de garantia variam de veículo para veículo. Quando o anúncio mostra \"Garantia de fábrica até…\", é a garantia da montadora que ainda está no prazo. Para o veículo que te interessa, a equipe informa o que está incluído.", { actions: [team], chips: ["Ver opções de veículos", "Combinar visita"] });
    case "docs": return msg("Para comprar, costuma ser pedido RG ou CNH e CPF. Para financiar, os bancos costumam pedir também comprovante de residência e de renda. A lista final vem da loja e do banco no momento da proposta.", { chips: ["Quero financiar", "Combinar visita"] });
    case "inspection": return msg("Os anúncios com o selo \"Vistoria realizada\" têm uma vistoria feita e guardada pela loja. Para qualquer veículo você pode pedir à equipe o laudo e o histórico antes de fechar.", { actions: [team], chips: ["Ver opções de veículos", "Combinar visita"] });
    case "negotiate": return msg("Valores e condições são combinados com a equipe. Posso montar um orçamento com entrada e parcelas e enviar para eles já com o que você tem em mente.", { chips: ["Montar orçamento", "Falar com a equipe"], actions: [team] });
    case "payment": return msg(`A loja atende compra à vista${S.offers.financing ? ", financiamento" : ""}${S.offers.trade ? " e troca" : ""}. Para formas de pagamento específicas (Pix, cartão, etc.), a equipe confirma na hora.`, { chips: ["À vista", "Financiar", "Tenho veículo na troca"] });
    case "finance": return msg(`O financiamento é feito com bancos parceiros e depende da análise de crédito. Aqui no site eu simulo parcela, IOF e custo efetivo com taxas de referência do Banco Central (${pct(ctx.rates.ref)} a.m. em média). Para simular, me diga o valor do veículo e a entrada, ou a parcela que cabe no seu bolso.`, { chips: ["Parcela de R$ 1.500", "Entrada de R$ 15.000", "Sem entrada", "Ver opções de veículos"] });
    case "stock": return stockInfo(ctx);
    case "thanks": return msg("Por nada! Se precisar de mais alguma coisa, é só chamar.", { chips: TOP_CHIPS });
    case "bye": return msg("Até mais! Quando quiser voltar, estou por aqui. Se preferir, a equipe também atende no WhatsApp.", { actions: [team] });
    case "greeting": return msg(`Olá! Sou o assistente virtual da ${S.short}. Posso te ajudar a achar o veículo certo, simular financiamento e montar um orçamento. Por onde quer começar?`, { chips: TOP_CHIPS });
    case "trade": return null;
    default: return null;
  }
}

const QUESTION = /\b(como|qual|quais|quando|onde|posso|aceita|aceitam|tem|funciona|precisa|preciso|existe|e possivel|da pra|da para)\b|\?/;

// ---------- foco: qual veículo o cliente quer ----------
function findFocus(st: ChatState, ctx: Ctx, n: string, vocab: Vocab): VehicleLite | undefined {
  const ord = ordinalPick(n);
  if (ord !== undefined && st.shown.length) {
    const lastBatch = st.shown.slice(-3);
    const id = lastBatch[ord];
    const v = ctx.vehicles.find((x) => x.id === id);
    if (v) return v;
  }
  const m = detectModel(n, vocab);
  if (m.model) {
    const inShown = ctx.vehicles.find((v) => v.model === m.model && st.shown.includes(v.id));
    return inShown ?? ctx.vehicles.find((v) => v.model === m.model);
  }
  if (st.focus) return ctx.vehicles.find((v) => v.id === st.focus);
  if (st.ctxVehicle) return ctx.vehicles.find((v) => v.id === st.ctxVehicle);
  const lastShown = st.shown[st.shown.length - 3] ?? st.shown[st.shown.length - 1];
  return st.shown.length ? ctx.vehicles.find((v) => v.id === (st.shown.length >= 3 ? st.shown[st.shown.length - 3] : st.shown[0])) : ctx.vehicles.find((v) => v.id === lastShown);
}

// O orçamento precisa saber como o cliente vai pagar e, se financiar, quanto tem de entrada.
function quoteFlow(st: ChatState, ctx: Ctx): Reply {
  const s = st.slots;
  st.pending = "quote";
  if (!s.pay) { st.step = "pay"; return { state: st, messages: [ask(st, ctx, "Para montar o orçamento: ")] }; }
  if ((s.pay === "financiar" || s.pay === "troca") && s.down === undefined && !s.parcelMax && s.tradeValue === undefined) {
    st.step = "down";
    return { state: st, messages: [ask(st, ctx, "Para montar o orçamento: ")] };
  }
  return beginPending(st, ctx, "quote");
}

function startQuote(st: ChatState, ctx: Ctx, v: VehicleLite): Reply {
  st.focus = v.id;
  return quoteFlow(st, ctx);
}

function compare(st: ChatState, ctx: Ctx): Msg {
  const ids = st.shown.slice(-3);
  const vs = ids.map((id) => ctx.vehicles.find((v) => v.id === id)).filter((v): v is VehicleLite => !!v);
  if (vs.length < 2) return msg("Me mostre primeiro algumas opções (diga o que procura) que eu comparo para você.", { chips: TOP_CHIPS });
  const cheapest = [...vs].sort((a, b) => a.price - b.price)[0];
  const newest = [...vs].sort((a, b) => b.year - a.year)[0];
  const lowest = [...vs].sort((a, b) => a.km - b.km)[0];
  const lines = vs.map((v, i) => `${i + 1}) ${titleOf(v)}: ${brl(v.price)}, ${v.year}, ${v.km.toLocaleString("pt-BR")} km, ${v.trans.toLowerCase()}, ${v.fuel.toLowerCase()}.`);
  return msg(`${lines.join("\n")}\n\nMais em conta: ${titleOf(cheapest)}. Mais novo: ${titleOf(newest)}. Menos rodado: ${titleOf(lowest)}.`, { chips: ["Montar orçamento do 1º", "Ver outras opções", "Falar com a equipe"] });
}

function greetStart(st: ChatState, ctx: Ctx, path?: string): Reply {
  const S = ctx.store;
  const slug = path?.match(/^\/veiculo\/([a-z0-9-]+)/)?.[1];
  const v = slug ? ctx.vehicles.find((x) => x.slug === slug) : undefined;
  const hi = st.contact.name ? `Oi, ${first(st.contact.name)}!` : "Olá!";
  if (v) {
    st.ctxVehicle = v.id; st.focus = v.id; st.step = "idle";
    st.slots.kind = v.kind;
    return { state: st, messages: [msg(`${hi} Sou o assistente virtual da ${S.short}. Vi que você está olhando o ${titleOf(v)} ${v.year} (${brl(v.price)}). Quer que eu monte um orçamento ou simule a parcela?`, { chips: ["Montar orçamento", "Combinar visita", "Ver parecidos", "Falar com a equipe"] })] };
  }
  st.step = "start";
  return { state: st, messages: [msg(`${hi} Sou o assistente virtual da ${S.name}. Respondo por regras, sem IA, e a equipe confirma o que importa. Posso te ajudar a achar o veículo certo para o seu bolso, simular financiamento e montar um orçamento. Por onde quer começar?`, { chips: TOP_CHIPS })] };
}

// ---------- entrada principal ----------
export function reply(prev: ChatState, input: Input, ctx: Ctx): Reply {
  const st: ChatState = clone(prev ?? newState());
  st.turns++;
  if (input.type === "start") return greetStart(st, ctx, input.path);
  if (input.type === "pick") {
    const v = ctx.vehicles.find((x) => x.id === input.id);
    if (!v) return { state: st, messages: [msg("Não encontrei esse veículo agora. Quer ver outras opções?", { chips: TOP_CHIPS })] };
    return startQuote(st, ctx, v);
  }
  return handleText(st, input.text.slice(0, 300), ctx);
}

function handleText(st: ChatState, raw: string, ctx: Ctx): Reply {
  const vocab = buildVocab(ctx.vehicles);
  const n = normalize(raw);
  if (!n) return { state: st, messages: [msg("Pode escrever o que procura, ou escolher uma das opções abaixo.", { chips: stepChips(st, ctx).length ? stepChips(st, ctx) : TOP_CHIPS })] };

  if (st.step === "ask_name" || st.step === "ask_phone" || st.step === "ask_consent") {
    const r = contactStep(st, raw, n, ctx);
    if (r) return r;
  }

  const ex = extract(raw, st, ctx, vocab);
  const { intents } = ex;
  const isQuestion = QUESTION.test(n);
  const hasIntent = (...i: Intent[]) => i.some((x) => intents.includes(x));

  // telefone/nome soltos no meio da conversa
  const ph = findPhone(raw);
  if (ph && normalizePhone(ph) && !st.contact.phone) st.contact.phone = normalizePhone(ph) as string;
  const nm = findName(raw);
  if (nm && !st.contact.name) st.contact.name = nm;

  if (hasIntent("restart")) {
    const keep = st.contact;
    const fresh = newState(); fresh.contact = keep; fresh.turns = st.turns;
    return { state: fresh, messages: [msg("Tudo zerado! Vamos recomeçar. O que você procura?", { chips: TOP_CHIPS })] };
  }
  if (hasIntent("who")) return { state: st, messages: [faq("who", st, ctx)!] };

  // resposta ao "como vai pagar / quanto de entrada" no meio de um orçamento
  if (st.pending === "quote" && (st.step === "pay" || st.step === "down") && ex.changed) {
    st.slots = ex.slots;
    if (st.slots.pay === undefined && ex.slots.down !== undefined) st.slots.pay = "financiar";
    return quoteFlow(st, ctx);
  }

  // atendimento humano
  if (hasIntent("human") && !ex.changed) {
    const hi = st.contact.name ? `, ${first(st.contact.name)}` : "";
    return { state: st, messages: [msg(`Claro${hi}! A equipe atende pelo WhatsApp, com o resumo do que conversamos já preenchido.`, { actions: [waAction(ctx, "Falar com a equipe no WhatsApp", `Olá! Estou no site da ${ctx.store.short}. ${teamSummary(st)}`.trim())], chips: ["Continuar com o assistente"] })] };
  }

  // avaliar troca / vender
  const wantsEval = hasIntent("sell") || (hasIntent("trade") && /avali|quanto (vale|pagam|voces pagam|pagariam)|quero vender/.test(n));
  if (wantsEval && !st.slots.tradeDesc) {
    st.step = "trade_desc";
    return { state: st, messages: [msg(`Posso adiantar a avaliação para a equipe. Me diga marca, modelo, ano e quilometragem do seu veículo (ex.: "Gol 1.0 2014, 98 mil km").`, { chips: ["Prefiro falar no WhatsApp"] })] };
  }
  if (st.step === "trade_desc") {
    if (/whats|prefiro falar|equipe/.test(n)) return { state: st, messages: [msg("Sem problema! É só chamar a equipe.", { actions: [waAction(ctx, "Avaliar no WhatsApp", `Olá! Quero avaliar meu veículo para troca/venda na ${ctx.store.short}.`)] })] };
    st.slots.tradeDesc = raw.slice(0, 160); st.slots.trade = true;
    if (ex.parsed.tradeValue) st.slots.tradeValue = ex.parsed.tradeValue;
    return beginPending(st, ctx, "trade");
  }

  // ajustes sobre as opções já mostradas
  if (st.step === "results" || st.step === "idle") {
    if (hasIntent("cheaper")) {
      const shown = st.shown.map((id) => ctx.vehicles.find((v) => v.id === id)).filter((v): v is VehicleLite => !!v);
      const low = shown.length ? Math.min(...shown.slice(-3).map((v) => v.price)) : undefined;
      if (low) { st.slots.budgetMax = Math.round(low * 0.99); st.shown = []; }
      return showResults(st, ctx, { lead: "Certo, procurando opções mais em conta. " });
    }
    if (hasIntent("newer")) { st.slots.newer = true; st.shown = []; return showResults(st, ctx, { lead: "Priorizando os mais novos. " }); }
    if (hasIntent("lowkm")) { st.slots.lowKm = true; st.shown = []; return showResults(st, ctx, { lead: "Priorizando os menos rodados. " }); }
    if (hasIntent("more") && !ex.changed) return showResults(st, ctx);
    if (hasIntent("compare")) return { state: st, messages: [compare(st, ctx)] };
  }

  // orçamento / escolha
  const quoteWords = hasIntent("quote") || (hasIntent("select") && st.shown.length > 0) || /^montar orcamento/.test(n);
  if (quoteWords) {
    const v = findFocus(st, ctx, n, vocab);
    if (v) {
      if (ex.changed) st.slots = ex.slots;
      return startQuote(st, ctx, v);
    }
    if (!ex.changed) {
      const m = faq("finance", st, ctx)!;
      return { state: st, messages: [m] };
    }
  }

  // visita e aviso
  if (hasIntent("visit")) return beginPending({ ...st, focus: st.focus ?? st.ctxVehicle }, ctx, "visit");
  if (hasIntent("notify")) { if (ex.changed) st.slots = ex.slots; return beginPending(st, ctx, "notify"); }

  // com orçamento já montado, mudar entrada/prazo/troca recalcula
  if (st.step === "idle" && st.focus && ex.changed && (ex.parsed.down !== undefined || ex.parsed.months || ex.parsed.tradeValue || ex.parsed.downPct || ex.slots.pay !== st.slots.pay)) {
    st.slots = ex.slots;
    st.pending = "quote";
    return complete(st, ctx);
  }

  // perguntas frequentes (sem informação nova de busca)
  const faqOrder: Intent[] = ["hours", "address", "phone", "warranty", "docs", "inspection", "negotiate", "payment", "stock", "thanks", "bye"];
  for (const i of faqOrder) {
    if (hasIntent(i) && (!ex.changed || isQuestion)) {
      if (ex.changed) st.slots = ex.slots;
      const a = faq(i, st, ctx);
      if (a) return { state: st, messages: [a, ...(resumeQuestion(st, ctx) ? [resumeQuestion(st, ctx) as Msg] : [])] };
    }
  }
  if (hasIntent("finance") && isQuestion && !ex.parsed.money?.length) {
    if (ex.changed) st.slots = ex.slots;
    return { state: st, messages: [faq("finance", st, ctx)!] };
  }

  // novas informações: segue o fluxo de busca
  if (ex.changed) {
    const hadResults = st.step === "results" || st.step === "idle";
    st.slots = ex.slots;
    st.misses = 0;
    if (hadResults) st.shown = [];
    return advance(st, ctx);
  }

  // respostas contextuais
  if (st.step === "need" && hasIntent("skip")) { st.slots.skippedNeed = true; return advance(st, ctx); }
  if (hasIntent("greeting")) return { state: st, messages: [faq("greeting", st, ctx)!] };
  if (hasIntent("yes") && st.step === "results") return showResults(st, ctx);
  if (hasIntent("no") && st.step === "results") return { state: st, messages: [msg("Tudo bem! Posso ajustar o valor, o tipo ou o câmbio, ou chamar a equipe.", { chips: ["Mudar orçamento", "Recomeçar", "Falar com a equipe"] })] };
  if (hasIntent("select") || hasIntent("quote")) {
    const v = findFocus(st, ctx, n, vocab);
    if (v) return startQuote(st, ctx, v);
  }
  if (hasIntent("more")) return showResults(st, ctx);
  if (hasIntent("availability") && st.step !== "start") return advance(st, ctx);

  // não entendi
  st.misses++;
  if (st.misses >= 2) {
    st.misses = 0;
    return { state: st, messages: [msg("Acho que não estou conseguindo te ajudar do jeito certo. A equipe resolve isso rapidinho pelo WhatsApp, com o resumo da nossa conversa.", { actions: [waAction(ctx, "Falar com a equipe no WhatsApp", `Olá! Estou no site da ${ctx.store.short}. ${teamSummary(st)}`.trim())], chips: ["Recomeçar", ...stepChips(st, ctx).slice(0, 2)] })] };
  }
  const q = resumeQuestion(st, ctx);
  return { state: st, messages: [msg("Não entendi bem. Pode me dizer de outro jeito? Por exemplo: \"SUV automático até 120 mil\" ou \"quero financiar com parcela de 1.500\".", { chips: q?.chips ?? TOP_CHIPS })] };
}
