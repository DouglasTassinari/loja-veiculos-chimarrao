import { test } from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_RATES, TERMS, installment, iofRate, maxMonths, pct, priceFromParcel, rateLabel, simulate } from "./financing";

test("parcela (tabela Price) bate com valores conhecidos", () => {
  // R$ 10.000 em 12x a 2% a.m.: parcela clássica de 945,60
  assert.ok(Math.abs(installment(10000, 0.02, 12) - 945.6) < 0.01);
  assert.equal(installment(0, 0.02, 12), 0);
  assert.equal(installment(1200, 0, 12), 100);
  assert.equal(installment(1000, 0.02, 0), 0);
});

test("IOF: 0,38% fixo + 0,0082% ao dia, limitado a 365 dias", () => {
  assert.ok(Math.abs(iofRate(12) - (0.0038 + 0.000082 * 360)) < 1e-9);
  const cap = 0.0038 + 0.000082 * 365;
  assert.ok(Math.abs(iofRate(60) - cap) < 1e-9, "acima de 12 meses o IOF não cresce");
  assert.ok(Math.abs(iofRate(48) - iofRate(60)) < 1e-12);
  assert.ok(iofRate(6) < iofRate(12));
});

test("prazo máximo cai com a idade do veículo e moto tem limite menor", () => {
  assert.equal(maxMonths(2), 60);
  assert.equal(maxMonths(8), 60);
  assert.equal(maxMonths(10), 48);
  assert.equal(maxMonths(14), 36);
  assert.equal(maxMonths(20), 24);
  assert.equal(maxMonths(2, "moto"), 48);
  assert.equal(maxMonths(14, "moto"), 36);
  assert.deepEqual(TERMS, [12, 24, 36, 48, 60]);
});

test("simulação financiada: valores internamente consistentes", () => {
  const s = simulate({ price: 100000, down: 30000, months: 48, rate: 0.0189 });
  assert.equal(s.entry, 30000);
  assert.equal(s.base, 70000);
  assert.ok(Math.abs(s.iof - 70000 * iofRate(48)) < 0.01);
  assert.ok(Math.abs(s.financed - (s.base + s.iof)) < 0.01);
  assert.ok(Math.abs(s.parcel - installment(s.financed, 0.0189, 48)) < 0.01);
  assert.ok(Math.abs(s.total - (30000 + s.parcel * 48)) < 0.01);
  assert.ok(Math.abs(s.interest - (s.parcel * 48 - s.base)) < 0.01);
  assert.ok(s.cetMonthly > 0.0189 && s.cetMonthly < 0.025, `CET ${s.cetMonthly}`);
  assert.ok(Math.abs(s.cetYearly - (Math.pow(1 + s.cetMonthly, 12) - 1)) < 1e-9);
});

test("entrada + troca nunca passam do preço; sem saldo não há parcela", () => {
  const all = simulate({ price: 50000, down: 40000, trade: 20000, months: 36, rate: 0.02 });
  assert.equal(all.entry, 50000);
  assert.equal(all.base, 0);
  assert.equal(all.parcel, 0);
  assert.equal(all.cetMonthly, 0);
  const neg = simulate({ price: 50000, down: -500, trade: -10, months: 36, rate: 0.02 });
  assert.equal(neg.entry, 0, "valores negativos são ignorados");
});

test("mais entrada baixa a parcela; mais prazo baixa a parcela e sobe o total", () => {
  const a = simulate({ price: 80000, down: 10000, months: 48, rate: 0.019 });
  const b = simulate({ price: 80000, down: 30000, months: 48, rate: 0.019 });
  assert.ok(b.parcel < a.parcel);
  const c = simulate({ price: 80000, down: 10000, months: 24, rate: 0.019 });
  const d = simulate({ price: 80000, down: 10000, months: 60, rate: 0.019 });
  assert.ok(d.parcel < c.parcel && d.total > c.total);
});

test("taxa maior sempre encarece (monotonia)", () => {
  let prev = 0;
  for (const r of [0.01, 0.015, 0.02, 0.025, 0.03]) {
    const s = simulate({ price: 90000, down: 20000, months: 48, rate: r });
    assert.ok(s.parcel > prev);
    prev = s.parcel;
  }
});

test("priceFromParcel é o inverso da simulação", () => {
  for (const [price, down, months] of [[60000, 10000, 36], [120000, 40000, 60], [35000, 0, 24]] as const) {
    const s = simulate({ price, down, months, rate: 0.0189 });
    assert.ok(Math.abs(priceFromParcel(s.parcel, down, months, 0.0189) - price) < 5, `${price}/${down}/${months}`);
  }
});

test("formatação de taxa e rótulo da fonte", () => {
  assert.equal(pct(0.0189), "1,89%");
  assert.equal(pct(0.2841, 1), "28,4%");
  assert.match(rateLabel(FALLBACK_RATES), /referência.*09\/10 a 16\/10/);
  assert.match(rateLabel({ ...FALLBACK_RATES, source: "bcb" }), /Banco Central/);
  assert.equal(rateLabel({ ...FALLBACK_RATES, periodStart: null, periodEnd: null }), "taxas de referência");
});

test("taxas de referência são coerentes", () => {
  assert.ok(FALLBACK_RATES.low <= FALLBACK_RATES.ref && FALLBACK_RATES.ref <= FALLBACK_RATES.high);
  assert.ok(FALLBACK_RATES.low > 0.005 && FALLBACK_RATES.high < 0.05);
});
