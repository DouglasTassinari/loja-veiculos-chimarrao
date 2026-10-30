import type { QueryFn } from "./db";
import { todayISO, nowTs } from "./finance";
import rawCatalog from "./catalog.json";
import { buildSaleTasks } from "./crm";
import { installment, iofRate } from "./financing";

// Muda quando o catálogo de exemplo muda: o banco de demonstração é refeito sozinho.
export const SEED_VERSION = "2026-10-30-crm-2";

type Item = {
  k: "c" | "m"; b: string; m: string; v: string; body: string; y: number; km: number; fu: string; tr: string;
  col: string; en: string; p: number; st: string; q: string; photos?: string[]; credits?: string[];
};
const catalog = rawCatalog as Item[];

// Gerador pseudoaleatório fixo: os dados de exemplo saem iguais a cada vez.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const SOLD = new Set([3, 9, 14, 21, 28, 35, 42, 47]);
const RESERVED = new Set([5, 18, 31, 44]);
const PREP = new Set([7, 25, 38, 52]);
const FEATURED = ["Toyota Hilux", "Jeep Commander", "Honda Civic", "Toyota Corolla Cross", "Volkswagen T-Cross", "Hyundai Creta", "Fiat Toro", "Honda CB 500X", "Yamaha MT-03", "BMW 320i"];

const round = (n: number, to: number) => Math.round(n / to) * to;

// Dados de exemplo para demonstração. Em produção real, não semear (SEED_DEMO != 1).
export async function seed(q: QueryFn): Promise<void> {
  const r = rng(20261030);
  const between = (a: number, b: number) => a + r() * (b - a);
  const letters = "ABCDEFGHJKLMNPRSTUVWXYZ";
  const L = () => letters[Math.floor(r() * letters.length)];
  const D = () => Math.floor(r() * 10);

  const ids: { id: number; status: string; price: number; title: string }[] = [];
  const soldInfo: { id: number; title: string; price: number; date: string }[] = [];

  for (let i = 0; i < catalog.length; i++) {
    const c = catalog[i];
    const n = i + 1;
    const status = SOLD.has(n) ? "vendido" : RESERVED.has(n) ? "reservado" : PREP.has(n) ? "preparacao" : "disponivel";
    const age = 2026 - c.y;
    const slowMover = c.p < 45000 && !SOLD.has(n) && n % 2 === 0;
    const buyAgo = status === "vendido" ? Math.round(between(32, 62)) : status === "preparacao" ? Math.round(between(3, 11)) : status === "reservado" ? Math.round(between(12, 40)) : slowMover ? Math.round(between(66, 112)) : Math.round(between(4, 58));
    const price = c.p;
    const buy = round(price * between(0.84, 0.935), 100);
    const fipe = round(price * between(0.97, 1.05), 100);
    const published = status === "disponivel" || status === "reservado" ? 1 : 0;
    const featured = status === "disponivel" && FEATURED.includes(`${c.b} ${c.m}`) ? 1 : 0;
    const inspected = r() < 0.6 ? 1 : 0;
    const single = r() < 0.35 ? 1 : 0;
    const warranty = c.y >= 2022 && c.k === "c" && r() < 0.7 ? c.y + 3 : null;
    const sold = status === "vendido";
    const saleAgo = sold ? Math.round(between(2, Math.min(buyAgo - 6, 33))) : 0;
    const saleDate = sold ? todayISO(-saleAgo) : null;
    const salePrice = sold ? round(price * between(0.95, 0.99), 100) : null;
    const plate = `${L()}${L()}${L()}${D()}${L()}${D()}${D()}`;
    const photos = c.photos ?? [];
    const title = `${c.b} ${c.m} ${c.v}`.trim();

    const [row] = (await q(
      `INSERT INTO vehicles (slug, plate, kind, brand, model, version, body, year_fab, year_model, km, fuel,
        transmission, color, doors, engine, description, status, published, featured, single_owner, inspected,
        factory_warranty_until, purchase_price, purchase_date, asking_price, fipe_price, min_price,
        sale_price, sale_date, ready_date, photos, photo_credit, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
       RETURNING id`,
      [
        `${slugify(`${title} ${c.y}`)}-${n}`, plate, c.k === "m" ? "moto" : "carro", c.b, c.m, c.v, c.body,
        n % 3 === 0 ? c.y - 1 : c.y, c.y, c.km, c.fu, c.tr, c.col, c.k === "m" ? 0 : c.body === "Picape" && age > 6 ? 2 : 4, c.en,
        `${title} ${c.y}, ${c.km.toLocaleString("pt-BR")} km, ${c.tr.toLowerCase()}, ${c.fu.toLowerCase()}. Fale com a equipe para ver os detalhes e combinar uma visita.`,
        status, published, featured, single, inspected, warranty,
        buy, todayISO(-buyAgo), price, fipe, round(price * 0.96, 100),
        salePrice, saleDate, status === "preparacao" ? null : todayISO(-Math.max(buyAgo - 4, 0)),
        JSON.stringify(photos), JSON.stringify(c.credits ?? []), nowTs(),
      ],
    )) as { id: number }[];
    ids.push({ id: row.id, status, price, title });
    if (sold && salePrice && saleDate) soldInfo.push({ id: row.id, title: `${title} ${c.y}`, price: salePrice, date: saleDate });

    // Custos de preparação: crescem com a idade e a quilometragem.
    const costs: [string, string, number][] = [["Documentação", "Transferência e vistoria", round(between(450, 900), 10)]];
    if (r() < 0.75) costs.push(["Estética", "Polimento e higienização", round(between(200, 800), 10)]);
    if (r() < 0.35 + Math.min(age * 0.04, 0.4)) costs.push(["Mecânica", "Revisão e peças", round(between(300, 600 + age * 160 + c.km / 90), 10)]);
    if (r() < 0.2) costs.push(["Funilaria", "Reparo de pintura", round(between(600, 2200), 10)]);
    if (sold) costs.push(["Comissão", "Comissão do vendedor", round((salePrice ?? price) * 0.01, 10)]);
    for (const [cat, desc, amt] of costs) {
      await q("INSERT INTO costs (vehicle_id, category, description, amount, date) VALUES ($1,$2,$3,$4,$5)", [row.id, cat, desc, amt, todayISO(-Math.max(buyAgo - 2, 0))]);
    }
  }

  const avail = ids.filter((v) => v.status === "disponivel" || v.status === "reservado");
  const sold = ids.filter((v) => v.status === "vendido");

  const hoursAgo = (h: number) => nowTs(new Date(Date.now() - h * 3600e3));
  const L_ = "INSERT INTO leads (vehicle_id, name, phone, message, source, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)";
  const people = ["Carlos Silva", "Marina Souza", "João Pereira", "Ana Lima", "Rafael Costa", "Patrícia Alves", "Bruno Martins", "Fernanda Rocha", "Diego Oliveira", "Camila Duarte", "Lucas Ferreira", "Juliana Mendes", "Tiago Ribeiro", "Aline Barros"];
  const msgs = ["Aceita meu carro na troca?", "Qual a entrada mínima?", "Ainda está disponível?", "Quero ver o carro amanhã.", "Dá para parcelar em 48x?", "Tem mais fotos?", "Faz financiamento?", "Qual o menor valor à vista?"];
  const sources = ["site", "site", "chat", "webmotors", "olx", "instagram", "site", "chat"];
  const stages = ["novo", "novo", "novo", "contatado", "contatado", "visita", "proposta", "negociacao", "ganho", "perdido", "novo", "contatado", "proposta", "visita"];
  for (let i = 0; i < people.length; i++) {
    const v = avail[Math.floor(r() * avail.length)];
    await q(L_, [v.id, people[i], `(51) 9${D()}${D()}${D()}${D()}-${D()}${D()}${D()}${D()}`, msgs[i % msgs.length], sources[i % sources.length], stages[i % stages.length], hoursAgo(Math.round(between(1, 150)))]);
  }

  // --- CRM: clientes, vendas (algumas financiadas) e as tarefas que nascem delas ---
  type Hist = { name: string; title: string; ago: number; pay: string; months: number; price: number; id?: number };
  const buyers = ["Eduardo Nunes", "Priscila Moraes", "Fábio Antunes", "Larissa Pinto", "Henrique Dias", "Vanessa Cardoso", "Rogério Lemos", "Tatiane Freitas"];
  const payPattern = ["financiado", "avista", "troca_financiado", "financiado", "avista", "financiado", "troca", "financiado"];
  const monthsPattern = [48, 0, 36, 60, 0, 48, 0, 24];
  const sales: Hist[] = [
    ...soldInfo.map((s, i) => ({ name: buyers[i % buyers.length], title: s.title, ago: Math.max(Math.round((Date.parse(todayISO()) - Date.parse(s.date)) / 86400000), 1), pay: payPattern[i % 8], months: monthsPattern[i % 8], price: s.price, id: s.id })),
    { name: "Ricardo Almeida", title: "Honda Civic LXR 2016", ago: 1370, pay: "financiado", months: 48, price: 78900 },
    { name: "Luciana Prado", title: "Fiat Argo Drive 2018", ago: 1065, pay: "financiado", months: 36, price: 56900 },
    { name: "Marcelo Teixeira", title: "Fiat Argo Trekking 2023", ago: 335, pay: "financiado", months: 60, price: 88900 },
    { name: "Sérgio Vargas", title: "Toyota Corolla XEi 2019", ago: 183, pay: "avista", months: 0, price: 101900 },
    { name: "Débora Klein", title: "Jeep Renegade Sport 2020", ago: 27, pay: "financiado", months: 48, price: 92900 },
    { name: "Gustavo Melo", title: "Honda CG 160 Titan 2023", ago: 8, pay: "avista", months: 0, price: 15900 },
  ];
  const banks = ["Banco BV", "Santander", "Itaú", "Banrisul", "Bradesco"];
  for (let i = 0; i < sales.length; i++) {
    const s = sales[i];
    const date = todayISO(-s.ago);
    const phone = `(51) 9${D()}${D()}${D()}${D()}-${D()}${D()}${D()}${D()}`;
    const birth = `19${70 + Math.floor(r() * 30)}-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-${String(1 + Math.floor(r() * 27)).padStart(2, "0")}`;
    const [cust] = (await q("INSERT INTO customers (name, phone, email, birthday, notes, source, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [s.name, phone, "", birth, i % 3 === 0 ? "Prefere contato por WhatsApp à tarde." : "", i % 2 ? "loja" : "site", nowTs(new Date(Date.parse(date)))])) as { id: number }[];
    const financed = s.months > 0;
    const down = financed ? round(s.price * 0.3, 500) : s.pay === "troca" ? round(s.price * 0.4, 500) : s.price;
    const base = financed ? s.price - down : 0;
    const parcel = financed ? installment(base * (1 + iofRate(s.months)), 0.0189, s.months) : 0;
    const tradeValue = s.pay.startsWith("troca") ? round(s.price * 0.25, 500) : 0;
    const [sale] = (await q(
      `INSERT INTO sales (vehicle_id, vehicle_title, customer_id, lead_id, sale_date, price, payment, down, financed, months, parcel, bank, trade_desc, trade_value, notes, created_at)
       VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'',$14) RETURNING id`,
      [s.id ?? null, s.title, cust.id, date, s.price, s.pay, down, financed ? base : 0, s.months, parcel, financed ? banks[i % banks.length] : "", tradeValue ? "Veículo usado na troca" : "", tradeValue, nowTs()],
    )) as { id: number }[];
    for (const t of buildSaleTasks({ sale_date: date, payment: s.pay, months: s.months, vehicle_title: s.title, price: s.price })) {
      // tarefas antigas já feitas; as de hoje para a frente (e algumas atrasadas) ficam abertas para mostrar a agenda
      const done = t.due_date < todayISO(-9) ? 1 : 0;
      await q(
        "INSERT INTO tasks (customer_id, vehicle_id, sale_id, lead_id, kind, title, note, due_date, done, done_at, created_at) VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10)",
        [cust.id, s.id ?? null, sale.id, t.kind, t.title, t.note, t.due_date, done, done ? `${t.due_date} 12:00:00` : null, nowTs()],
      );
    }
  }

  const E = "INSERT INTO cash_entries (kind, description, amount, due_date, paid, vehicle_id) VALUES ($1,$2,$3,$4,$5,$6)";
  for (const v of sold.slice(0, 5)) {
    await q(E, ["receber", `Retorno de financiamento — ${v.title}`, round(v.price * 0.03, 100), todayISO(Math.round(between(1, 18))), 0, v.id]);
  }
  for (const v of avail.filter((x) => x.status === "reservado")) {
    await q(E, ["receber", `Entrada da reserva — ${v.title}`, round(v.price * 0.1, 100), todayISO(Math.round(between(1, 6))), 0, v.id]);
  }
  const fixed: [string, number, number][] = [
    ["Aluguel do pátio", 6500, 9], ["Folha e comissões", 11800, 14], ["Anúncios (portais + Meta)", 3800, 20],
    ["Energia e água", 1250, 12], ["Contador", 1800, 25], ["Seguro do pátio", 2100, 28],
  ];
  for (const [d, a, days] of fixed) await q(E, ["pagar", d, a, todayISO(days), 0, null]);
  for (const v of avail.slice(0, 3)) await q(E, ["pagar", `Parcela de compra — ${v.title}`, round(v.price * 0.18, 100), todayISO(Math.round(between(3, 22))), 0, v.id]);
}
