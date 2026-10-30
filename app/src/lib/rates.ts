import "server-only";
import { FALLBACK_RATES, type Rates } from "./financing";

// Taxas médias de "Aquisição de veículos - Prefixado" (pessoa física) por instituição,
// publicadas toda semana pelo Banco Central (dados abertos, serviço Olinda/taxaJuros).
// Usamos só bancos que financiam veículos usados em lojas multimarcas; bancos de montadora
// (que só financiam a própria marca) e bancos públicos de nicho ficam de fora.
const BASE = "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/";
const REFERENCE_BANKS = new Set([
  "92702067", // Banrisul
  "07707650", // Santander Financiamentos
  "60872504", // Itaú
  "07207996", // Bradesco Financiamentos
  "59588111", // BV
  "45437547", // Safra
  "00416968", // Inter
  "31872495", // C6
  "59285411", // Pan
]);

type Row = { InicioPeriodo: string; FimPeriodo: string; cnpj8: string; InstituicaoFinanceira: string; TaxaJurosAoMes: number };

async function odata<T>(entity: string, params: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams({ $format: "json", ...params }).toString().replace(/\+/g, "%20");
  const res = await fetch(`${BASE}${entity}?${qs}`, { next: { revalidate: 6 * 3600 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`BCB ${res.status}`);
  return ((await res.json()) as { value: T[] }).value;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  return sorted[base] + (sorted[Math.min(base + 1, sorted.length - 1)] - sorted[base]) * (pos - base);
}

export async function getRates(): Promise<Rates> {
  try {
    const periods = await odata<{ inicioPeriodo: string }>("ConsultaDatas", { $filter: "tipoModalidade eq 'D'", $orderby: "inicioPeriodo desc", $top: "4" });
    for (const p of periods) {
      const rows = await odata<Row>("TaxasJurosDiariaPorInicioPeriodo", {
        $filter: `InicioPeriodo eq '${p.inicioPeriodo}' and Modalidade eq 'Aquisição de veículos - Prefixado'`,
        $top: "100",
      });
      const picked = rows.filter((r) => REFERENCE_BANKS.has(r.cnpj8) || /\bPAN\b/.test(r.InstituicaoFinanceira));
      if (picked.length < 4) continue;
      const v = picked.map((r) => r.TaxaJurosAoMes / 100).sort((a, b) => a - b);
      return {
        low: quantile(v, 0.25), ref: quantile(v, 0.5), high: quantile(v, 0.75),
        periodStart: picked[0].InicioPeriodo, periodEnd: picked[0].FimPeriodo, source: "bcb",
      };
    }
  } catch {
    // Banco Central fora do ar: cai na referência fixa abaixo.
  }
  return FALLBACK_RATES;
}
