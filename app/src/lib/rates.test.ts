import { test } from "node:test";
import assert from "node:assert/strict";

// Roda com --conditions=react-server (o pacote "server-only" vira vazio fora do Next).
const realFetch = globalThis.fetch;

type Row = { InicioPeriodo: string; FimPeriodo: string; cnpj8: string; InstituicaoFinanceira: string; TaxaJurosAoMes: number };
const row = (cnpj8: string, name: string, rate: number, start = "2026-10-09"): Row => ({ InicioPeriodo: start, FimPeriodo: "2026-10-16", cnpj8, InstituicaoFinanceira: name, TaxaJurosAoMes: rate });

function stub(handler: (url: string) => unknown) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const out = handler(String(input));
    if (out instanceof Error) throw out;
    return new Response(JSON.stringify({ value: out }), { status: 200 });
  }) as typeof fetch;
}

test("usa só bancos de referência e calcula quartis", async () => {
  const { getRates, clearRatesCache } = await import("./rates");
  clearRatesCache();
  stub((url) => {
    if (url.includes("ConsultaDatas")) return [{ inicioPeriodo: "2026-10-09" }];
    return [
      row("92702067", "BCO DO ESTADO DO RS S.A.", 1.8), row("07707650", "SANTANDER SCFI S.A.", 1.9), row("60872504", "ITAÚ UNIBANCO", 2.0),
      row("07207996", "BCO BRADESCO FINANC. S.A.", 2.1), row("59588111", "BCO VOTORANTIM S.A.", 2.2),
      row("59274605", "BCO GM S.A.", 0.5), row("60814191", "BCO MERCEDES-BENZ S.A.", 0.6), row("00360305", "CAIXA", 0.9),
    ];
  });
  const r = await getRates();
  assert.equal(r.source, "bcb");
  assert.equal(r.periodStart, "2026-10-09");
  assert.ok(Math.abs(r.ref - 0.02) < 1e-9, `mediana ${r.ref}`);
  assert.ok(r.low < r.ref && r.ref < r.high);
  assert.ok(r.low >= 0.018 && r.high <= 0.022, "bancos de montadora e públicos ficam de fora");
});

test("pula período sem dados suficientes e usa o anterior", async () => {
  const { getRates, clearRatesCache } = await import("./rates");
  clearRatesCache();
  stub((url) => {
    if (url.includes("ConsultaDatas")) return [{ inicioPeriodo: "2026-10-16" }, { inicioPeriodo: "2026-10-09" }];
    if (url.includes("2026-10-16")) return [];
    return [row("92702067", "BANRISUL", 1.8), row("07707650", "SANTANDER", 1.9), row("60872504", "ITAU", 2.0), row("59588111", "BV", 2.2)];
  });
  const r = await getRates();
  assert.equal(r.source, "bcb");
  assert.equal(r.periodStart, "2026-10-09");
});

test("Banco Central fora do ar: cai na referência fixa sem quebrar", async () => {
  const { getRates, clearRatesCache } = await import("./rates");
  clearRatesCache();
  const { FALLBACK_RATES } = await import("./financing");
  stub(() => new Error("offline"));
  assert.deepEqual(await getRates(), FALLBACK_RATES);
});

test("resposta com poucos bancos também cai na referência", async () => {
  const { getRates, clearRatesCache } = await import("./rates");
  clearRatesCache();
  const { FALLBACK_RATES } = await import("./financing");
  stub((url) => (url.includes("ConsultaDatas") ? [{ inicioPeriodo: "2026-10-09" }] : [row("92702067", "BANRISUL", 1.8)]));
  assert.equal((await getRates()).source, FALLBACK_RATES.source);
});

test("a taxa fica guardada: a segunda visita não volta ao Banco Central", async () => {
  const { getRates, clearRatesCache } = await import("./rates");
  clearRatesCache();
  let chamadas = 0;
  stub((url) => {
    chamadas++;
    if (url.includes("ConsultaDatas")) return [{ inicioPeriodo: "2026-10-09" }];
    return [row("92702067", "BANRISUL", 1.8), row("07707650", "SANTANDER", 1.9), row("60872504", "ITAU", 2.0), row("59588111", "BV", 2.2)];
  });
  const primeira = await getRates();
  const depois = chamadas;
  assert.ok(depois >= 2, "a primeira consulta vai ao Banco Central");

  // Visitas seguintes usam o que já foi consultado.
  assert.deepEqual(await getRates(), primeira);
  assert.deepEqual(await getRates(), primeira);
  assert.equal(chamadas, depois, "não voltou ao Banco Central");

  // Várias visitas ao mesmo tempo com o cache vazio fazem uma consulta só.
  clearRatesCache();
  chamadas = 0;
  const juntas = await Promise.all([getRates(), getRates(), getRates()]);
  assert.equal(juntas[0].source, "bcb");
  assert.equal(chamadas, depois, "três visitas juntas deveriam render uma consulta só");
});

test.after(() => { globalThis.fetch = realFetch; });
