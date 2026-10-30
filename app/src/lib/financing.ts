// Cálculo de financiamento (puro: roda no servidor e no navegador).
// É uma simulação da loja, não uma oferta de crédito: aprovação, taxa final e tarifas dependem do banco.

export type Rates = {
  low: number;   // taxa mensal (decimal, ex.: 0.0163 = 1,63% a.m.) — 1º quartil dos bancos de referência
  ref: number;   // mediana
  high: number;  // 3º quartil
  periodStart: string | null; // AAAA-MM-DD
  periodEnd: string | null;
  source: "bcb" | "referencia";
};

// Referência de segurança caso o Banco Central esteja fora do ar (semana de 09 a 16/10/2026).
export const FALLBACK_RATES: Rates = { low: 0.0163, ref: 0.0189, high: 0.0198, periodStart: "2026-10-09", periodEnd: "2026-10-16", source: "referencia" };

export const MIN_DOWN_PCT = 0.2; // entrada sugerida para usados

export function installment(principal: number, monthlyRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

// IOF de pessoa física em financiamento: 0,38% fixo + 0,0082% ao dia (limite de 365 dias).
export function iofRate(months: number): number {
  return 0.0038 + 0.000082 * Math.min(months * 30, 365);
}

// Prazo máximo estimado: os bancos limitam o prazo conforme a idade do veículo.
export function maxMonths(age: number, kind: "carro" | "moto" = "carro"): number {
  const cap = kind === "moto" ? 48 : 60;
  if (age <= 8) return cap;
  if (age <= 12) return Math.min(cap, 48);
  if (age <= 15) return Math.min(cap, 36);
  return 24;
}

export const TERMS = [12, 24, 36, 48, 60];

export type Sim = {
  price: number;
  entry: number;       // entrada em dinheiro + valor da troca
  base: number;        // valor líquido a financiar (sem IOF)
  iof: number;         // IOF estimado, financiado junto
  financed: number;    // base + IOF
  months: number;
  rate: number;
  parcel: number;
  total: number;       // entrada + todas as parcelas
  interest: number;    // total de juros e IOF
  cetMonthly: number;  // custo efetivo total (juros + IOF) ao mês
  cetYearly: number;
};

export function simulate(p: { price: number; down: number; trade?: number; months: number; rate: number }): Sim {
  const entry = Math.min(Math.max(p.down, 0) + Math.max(p.trade ?? 0, 0), p.price);
  const base = Math.max(p.price - entry, 0);
  const iof = base * iofRate(p.months);
  const financed = base + iof;
  const parcel = installment(financed, p.rate, p.months);
  const paid = parcel * p.months;
  const cetMonthly = base > 0 ? solveRate(base, parcel, p.months) : 0;
  return {
    price: p.price, entry, base, iof, financed, months: p.months, rate: p.rate, parcel,
    total: entry + paid, interest: Math.max(paid - base, 0), cetMonthly, cetYearly: Math.pow(1 + cetMonthly, 12) - 1,
  };
}

// Taxa mensal que iguala o valor liberado ao valor presente das parcelas (bisseção).
function solveRate(pv: number, pmt: number, n: number): number {
  let lo = 0, hi = 0.2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const val = mid === 0 ? pmt * n : (pmt * (1 - Math.pow(1 + mid, -n))) / mid;
    if (val > pv) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export const pct = (n: number, d = 2) => `${(n * 100).toFixed(d).replace(".", ",")}%`;

export function rateLabel(r: Rates): string {
  const fmt = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
  const when = r.periodStart && r.periodEnd ? `, semana de ${fmt(r.periodStart)} a ${fmt(r.periodEnd)}` : "";
  return r.source === "bcb" ? `taxas médias publicadas pelo Banco Central${when}` : `taxas de referência${when}`;
}

// Quanto dá para pagar de veículo, dada a parcela mensal desejada e a entrada.
export function priceFromParcel(parcel: number, down: number, months: number, rate: number): number {
  const base = rate === 0 ? parcel * months : (parcel * (1 - Math.pow(1 + rate, -months))) / rate;
  return base / (1 + iofRate(months)) + down;
}
