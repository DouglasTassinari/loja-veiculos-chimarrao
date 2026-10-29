import { finance } from "./config";

export type VehicleRow = {
  id: number; slug: string; plate: string; brand: string; model: string; version: string; body: string;
  year_fab: number; year_model: number; km: number; fuel: string; transmission: string; color: string;
  doors: number; engine: string; description: string; status: Status; published: number;
  single_owner: number; inspected: number; factory_warranty_until: number | null;
  purchase_price: number; purchase_date: string; asking_price: number; fipe_price: number | null;
  min_price: number | null; sale_price: number | null; sale_date: string | null; ready_date: string | null;
  photos: string; created_at: string;
};

export type Status = "preparacao" | "disponivel" | "reservado" | "vendido";

export type Analysis = {
  totalCost: number;        // compra + custos diretos
  extraCosts: number;
  days: number;             // dias em estoque (ou até a venda)
  capitalCostPerDay: number;
  capitalCost: number;      // custo do dinheiro parado até hoje
  revenue: number;          // preço de venda (real ou pedido)
  profit: number;           // lucro após custo de capital
  marginPct: number;
  breakEven: number;        // preço mínimo para não perder (com capital até hoje)
  vsFipePct: number | null;
};

export type Alert = { level: "info" | "warn" | "danger"; text: string };

const DAY = 86400000;

// Datas do sistema são "YYYY-MM-DD" no horário de Brasília, sem fuso embutido.
const TZ = "America/Sao_Paulo";

export function todayISO(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * DAY);
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

// Timestamp "YYYY-MM-DD HH:MM:SS" em UTC, igual nos dois bancos.
export function nowTs(d: Date = new Date()): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function daysBetween(from: string, to: string = todayISO()): number {
  const a = Date.parse(from.slice(0, 10));
  const b = Date.parse(to.slice(0, 10));
  return Math.max(0, Math.round((b - a) / DAY));
}

// Horas desde um timestamp do SQLite ("YYYY-MM-DD HH:MM:SS", em UTC).
export function hoursSince(sqliteTs: string): number {
  return (Date.now() - new Date(sqliteTs.replace(" ", "T") + "Z").getTime()) / 3600e3;
}

export function analyze(v: VehicleRow, extraCosts: number): Analysis {
  const totalCost = v.purchase_price + extraCosts;
  const sold = v.status === "vendido" && v.sale_price != null;
  const days = daysBetween(v.purchase_date, sold && v.sale_date ? v.sale_date : undefined);
  const capitalCostPerDay = (totalCost * finance.capitalCostMonthly) / 30;
  const capitalCost = capitalCostPerDay * days;
  const revenue = sold ? (v.sale_price as number) : v.asking_price;
  const profit = revenue - totalCost - capitalCost;
  return {
    totalCost, extraCosts, days, capitalCostPerDay, capitalCost, revenue, profit,
    marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
    breakEven: totalCost + capitalCost,
    vsFipePct: v.fipe_price ? ((v.asking_price - v.fipe_price) / v.fipe_price) * 100 : null,
  };
}

export function alerts(v: VehicleRow, a: Analysis, photoCount: number): Alert[] {
  if (v.status === "vendido") return [];
  const out: Alert[] = [];
  if (a.profit < 0) out.push({ level: "danger", text: `Margem negativa: no preço atual o carro dá prejuízo de ${brl(-a.profit)}.` });
  else if (a.marginPct < finance.targetMarginPct) out.push({ level: "warn", text: `Margem de ${a.marginPct.toFixed(1)}% abaixo da meta de ${finance.targetMarginPct}%.` });
  if (v.status === "preparacao" && a.days > finance.maxPrepDays) out.push({ level: "warn", text: `Em preparação há ${a.days} dias. Cada dia parado custa ${brl(a.capitalCostPerDay)}.` });
  if (a.days >= finance.alertDaysCritical) out.push({ level: "danger", text: `${a.days} dias no pátio. Reprecificar de forma agressiva ou repassar.` });
  else if (a.days >= finance.alertDaysLate) out.push({ level: "warn", text: `${a.days} dias no pátio. Rever preço e fotos.` });
  else if (a.days >= finance.alertDaysWarn) out.push({ level: "info", text: `${a.days} dias no pátio. Atenção ao giro.` });
  if (a.vsFipePct != null && a.vsFipePct > 3) out.push({ level: "warn", text: `Preço ${a.vsFipePct.toFixed(1)}% acima da FIPE. Pode estar travando a venda.` });
  if (v.published && photoCount === 0) out.push({ level: "info", text: "Publicado sem fotos reais. Anúncios com fotos recebem muito mais contatos." });
  return out;
}

// "Próxima melhor ação": uma frase objetiva por carro, em ordem de prioridade.
export function nextAction(v: VehicleRow, a: Analysis, photoCount: number): string | null {
  if (v.status === "vendido") return null;
  if (v.status === "preparacao") return a.days > finance.maxPrepDays ? "Cobrar a oficina e liberar o carro para venda." : "Concluir preparação e fotografar.";
  if (v.status === "reservado") return "Fechar documentação e cobrar o sinal/entrada.";
  if (photoCount === 0 && a.days < finance.alertDaysLate) return "Fotografar o carro e atualizar o anúncio.";
  if (a.days >= finance.alertDaysCritical) {
    const target = Math.max(a.breakEven, (v.fipe_price ?? v.asking_price) * 0.98);
    return `Oferecer a clientes do CRM e baixar para perto de ${brl(Math.ceil(target / 100) * 100)} (piso sem prejuízo: ${brl(a.breakEven)}).`;
  }
  if (a.days >= finance.alertDaysLate) return "Repostar o anúncio com foto nova e revisar o preço.";
  if (a.vsFipePct != null && a.vsFipePct > 3) return "Alinhar o preço com a FIPE.";
  if (a.profit < 0) return "Subir o preço ou renegociar custos: está dando prejuízo.";
  return null;
}

export function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function km(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function parsePhotos(v: Pick<VehicleRow, "photos">): string[] {
  try {
    const p = JSON.parse(v.photos);
    return Array.isArray(p) ? p.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function vehicleTitle(v: Pick<VehicleRow, "brand" | "model" | "version">): string {
  return `${v.brand} ${v.model} ${v.version}`.trim();
}

// Parcela (Price) para o simulador do site.
export function installment(principal: number, monthlyRate: number, months: number): number {
  if (principal <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}
