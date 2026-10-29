import type { DatabaseSync } from "node:sqlite";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Seed = {
  plate: string; brand: string; model: string; version: string; body: string;
  yf: number; ym: number; km: number; fuel: string; trans: string; color: string;
  engine: string; status: string; published: number; single: number; inspected: number;
  warranty: number | null; buy: number; buyAgo: number; ask: number; fipe: number;
  costs: [string, string, number][];
};

const vehicles: Seed[] = [
  { plate: "JDN1A85", brand: "Peugeot", model: "2008", version: "Active T200 Turbo", body: "SUV", yf: 2025, ym: 2025, km: 18000, fuel: "Flex", trans: "Automático", color: "Preta", engine: "1.0 Turbo 130cv", status: "disponivel", published: 1, single: 1, inspected: 1, warranty: 2028, buy: 96000, buyAgo: 12, ask: 109900, fipe: 112300, costs: [["Documentação", "Transferência + vistoria", 900], ["Estética", "Polimento e higienização", 450]] },
  { plate: "RTA2B33", brand: "Fiat", model: "Argo", version: "Drive 1.3", body: "Hatch", yf: 2024, ym: 2024, km: 32000, fuel: "Flex", trans: "Manual", color: "Branca", engine: "1.3 Firefly 107cv", status: "disponivel", published: 1, single: 0, inspected: 1, warranty: null, buy: 71500, buyAgo: 38, ask: 84900, fipe: 82900, costs: [["Mecânica", "Troca de pastilhas e fluido", 780], ["Documentação", "Transferência", 600], ["Estética", "Lavagem técnica", 300]] },
  { plate: "IXY4C21", brand: "Jeep", model: "Compass", version: "Longitude T270 Turbo", body: "SUV", yf: 2022, ym: 2023, km: 54000, fuel: "Flex", trans: "Automático", color: "Cinza", engine: "1.3 Turbo 185cv", status: "disponivel", published: 1, single: 1, inspected: 1, warranty: null, buy: 118000, buyAgo: 71, ask: 133900, fipe: 128500, costs: [["Mecânica", "Revisão completa", 1850], ["Funilaria", "Reparo para-choque", 1400], ["Documentação", "Transferência", 700]] },
  { plate: "QWE5D77", brand: "Volkswagen", model: "T-Cross", version: "Highline 250 TSI", body: "SUV", yf: 2024, ym: 2024, km: 44000, fuel: "Flex", trans: "Automático", color: "Prata", engine: "1.4 TSI 150cv", status: "disponivel", published: 1, single: 0, inspected: 0, warranty: null, buy: 118500, buyAgo: 22, ask: 132900, fipe: 131200, costs: [["Documentação", "Transferência", 650], ["Estética", "Polimento", 500]] },
  { plate: "KLM6E90", brand: "Honda", model: "City", version: "EXL 1.5", body: "Sedã", yf: 2023, ym: 2023, km: 53000, fuel: "Flex", trans: "Automático", color: "Branca", engine: "1.5 i-VTEC 126cv", status: "disponivel", published: 1, single: 1, inspected: 1, warranty: null, buy: 94000, buyAgo: 9, ask: 105900, fipe: 108000, costs: [["Documentação", "Transferência", 600]] },
  { plate: "BRA7F12", brand: "Hyundai", model: "HB20", version: "Comfort 1.0", body: "Hatch", yf: 2016, ym: 2016, km: 88000, fuel: "Flex", trans: "Manual", color: "Vermelha", engine: "1.0 Flex 80cv", status: "disponivel", published: 1, single: 0, inspected: 0, warranty: null, buy: 46000, buyAgo: 94, ask: 52900, fipe: 49800, costs: [["Mecânica", "Embreagem", 1900], ["Estética", "Reparo de pintura", 1100], ["Documentação", "Transferência + multas", 1350]] },
  { plate: "CHV8G45", brand: "Chevrolet", model: "Onix", version: "Premier Plus Turbo", body: "Sedã", yf: 2024, ym: 2024, km: 60000, fuel: "Flex", trans: "Automático", color: "Preta", engine: "1.0 Turbo 116cv", status: "preparacao", published: 0, single: 0, inspected: 0, warranty: null, buy: 80500, buyAgo: 11, ask: 93900, fipe: 92500, costs: [["Mecânica", "Orçamento oficina (pendente)", 1200]] },
  { plate: "TOY9H08", brand: "Toyota", model: "Yaris", version: "XS Connect Multidrive", body: "Hatch", yf: 2024, ym: 2024, km: 65000, fuel: "Flex", trans: "Automático", color: "Cinza", engine: "1.5 Dual VVT-i 110cv", status: "reservado", published: 1, single: 0, inspected: 1, warranty: null, buy: 84000, buyAgo: 17, ask: 97900, fipe: 96800, costs: [["Documentação", "Transferência", 600], ["Estética", "Higienização", 350]] },
  { plate: "NSN1J66", brand: "Nissan", model: "Kicks", version: "Exclusive", body: "SUV", yf: 2022, ym: 2022, km: 30000, fuel: "Flex", trans: "Automático", color: "Branca", engine: "1.6 CVT 114cv", status: "vendido", published: 0, single: 1, inspected: 1, warranty: null, buy: 83000, buyAgo: 40, ask: 97900, fipe: 95000, costs: [["Documentação", "Transferência", 600], ["Mecânica", "Revisão", 900], ["Comissão", "Comissão vendedor", 1200]] },
];

export function seed(db: DatabaseSync): void {
  const insV = db.prepare(`
    INSERT INTO vehicles (slug, plate, brand, model, version, body, year_fab, year_model, km, fuel,
      transmission, color, doors, engine, description, status, published, single_owner, inspected,
      factory_warranty_until, purchase_price, purchase_date, asking_price, fipe_price, min_price,
      sale_price, sale_date, ready_date, photos)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,4,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'[]')
  `);
  const insC = db.prepare(
    "INSERT INTO costs (vehicle_id, category, description, amount, date) VALUES (?,?,?,?,?)",
  );
  vehicles.forEach((v, i) => {
    const sold = v.status === "vendido";
    const r = insV.run(
      `${slugify(`${v.brand} ${v.model} ${v.version} ${v.ym}`)}-${i + 1}`, v.plate, v.brand, v.model, v.version, v.body,
      v.yf, v.ym, v.km, v.fuel, v.trans, v.color, v.engine,
      `${v.brand} ${v.model} ${v.version}, ${v.km.toLocaleString("pt-BR")} km, ${v.trans.toLowerCase()}. Fale com a equipe para ver os detalhes e combinar uma visita.`,
      v.status, v.published, v.single, v.inspected, v.warranty,
      v.buy, daysAgo(v.buyAgo), v.ask, v.fipe, Math.round(v.ask * 0.96),
      sold ? v.ask - 1500 : null, sold ? daysAgo(5) : null,
      v.status === "preparacao" ? null : daysAgo(Math.max(v.buyAgo - 4, 0)),
    );
    const id = Number(r.lastInsertRowid);
    v.costs.forEach(([cat, desc, amt]) => insC.run(id, cat, desc, amt, daysAgo(Math.max(v.buyAgo - 2, 0))));
  });
  const insL = db.prepare("INSERT INTO leads (vehicle_id, name, phone, message, source, status, created_at) VALUES (?,?,?,?,?,?,?)");
  insL.run(1, "Carlos Silva", "(51) 98888-1111", "Aceita meu Gol na troca?", "site", "novo", new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19).replace("T", " "));
  insL.run(2, "Marina Souza", "(51) 97777-2222", "Qual a entrada mínima?", "webmotors", "contatado", new Date(Date.now() - 30 * 3600e3).toISOString().slice(0, 19).replace("T", " "));
  insL.run(8, "João Pereira", "(51) 96666-3333", "Quero fechar hoje.", "site", "negociacao", new Date(Date.now() - 52 * 3600e3).toISOString().slice(0, 19).replace("T", " "));

  const insE = db.prepare("INSERT INTO cash_entries (kind, description, amount, due_date, paid, vehicle_id) VALUES (?,?,?,?,?,?)");
  const inDays = (n: number) => daysAgo(-n);
  insE.run("receber", "Venda Kicks — retorno financiamento", 3200, inDays(6), 0, 9);
  insE.run("receber", "Venda Kicks — saldo restante", 12000, inDays(2), 0, 9);
  insE.run("pagar", "Compra Onix Premier (parcela)", 20000, inDays(4), 0, 7);
  insE.run("pagar", "Aluguel do pátio", 6500, inDays(9), 0, null);
  insE.run("pagar", "Folha / comissões", 11000, inDays(14), 0, null);
  insE.run("pagar", "Anúncios (portais + Meta)", 3800, inDays(20), 0, null);
  insE.run("receber", "Entrada reserva Yaris", 5000, inDays(1), 0, 8);
}
