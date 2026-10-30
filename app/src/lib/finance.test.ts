import { test } from "node:test";
import assert from "node:assert/strict";
import { alerts, analyze, brl, brl2, daysBetween, fmtDate, hoursSince, km, nextAction, nowTs, parseCredits, parsePhotos, todayISO, vehicleTitle, type VehicleRow } from "./finance";

const base = (over: Partial<VehicleRow> = {}): VehicleRow => ({
  id: 1, slug: "x-1", plate: "ABC1D23", brand: "Fiat", model: "Argo", version: "Drive", body: "Hatch", year_fab: 2024, year_model: 2024, km: 30000,
  fuel: "Flex", transmission: "Manual", color: "Branca", doors: 4, engine: "1.3", description: "", status: "disponivel", published: 1, single_owner: 0,
  inspected: 0, factory_warranty_until: null, purchase_price: 70000, purchase_date: todayISO(-20), asking_price: 84900, fipe_price: 82000, min_price: null,
  sale_price: null, sale_date: null, ready_date: null, photos: "[]", created_at: "", kind: "carro", featured: 0, photo_credit: "[]", ...over,
});

test("datas no fuso de Brasília e formatação", () => {
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(fmtDate("2026-10-30"), "30/10/2026");
  assert.equal(fmtDate("2026-10-30 12:00:00"), "30/10/2026");
  assert.match(nowTs(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(daysBetween("2026-10-01", "2026-10-11"), 10);
  assert.equal(daysBetween("2026-10-11", "2026-10-01"), 0, "nunca negativo");
  assert.ok(Math.abs(hoursSince(nowTs(new Date(Date.now() - 5 * 3600e3))) - 5) < 0.1);
});

test("moeda e quilometragem em pt-BR", () => {
  assert.match(brl(84900), /R\$\s?84\.900/);
  assert.match(brl2(1234.5), /R\$\s?1\.234,50/);
  assert.equal(km(88000), "88.000");
  assert.equal(vehicleTitle({ brand: "Fiat", model: "Argo", version: "Drive 1.3" }), "Fiat Argo Drive 1.3");
  assert.equal(vehicleTitle({ brand: "Fiat", model: "Uno", version: "" }), "Fiat Uno");
});

test("fotos e créditos tolerantes a JSON inválido", () => {
  assert.deepEqual(parsePhotos({ photos: '["/a.jpg","/b.jpg"]' }), ["/a.jpg", "/b.jpg"]);
  assert.deepEqual(parsePhotos({ photos: "isso não é json" }), []);
  assert.deepEqual(parsePhotos({ photos: '{"a":1}' }), []);
  assert.deepEqual(parsePhotos({ photos: '[1,"/a.jpg"]' }), ["/a.jpg"]);
  assert.deepEqual(parseCredits({ photo_credit: "quebrado" }), []);
});

test("lucro, margem e custo do capital", () => {
  const a = analyze(base(), 2000);
  assert.equal(a.totalCost, 72000);
  assert.equal(a.days, 20);
  assert.ok(Math.abs(a.capitalCostPerDay - (72000 * 0.018) / 30) < 1e-6);
  assert.ok(Math.abs(a.capitalCost - a.capitalCostPerDay * 20) < 1e-6);
  assert.ok(Math.abs(a.profit - (84900 - 72000 - a.capitalCost)) < 1e-6);
  assert.ok(Math.abs(a.breakEven - (72000 + a.capitalCost)) < 1e-6);
  assert.ok(a.marginPct > 10 && a.marginPct < 15);
  assert.ok(a.vsFipePct! > 3 && a.vsFipePct! < 4);
});

test("veículo vendido usa preço e data reais da venda", () => {
  const v = base({ status: "vendido", sale_price: 80000, sale_date: todayISO(-5), purchase_date: todayISO(-35) });
  const a = analyze(v, 1000);
  assert.equal(a.days, 30, "dias contam até a venda, não até hoje");
  assert.equal(a.revenue, 80000);
  assert.deepEqual(alerts(v, a, 0), [], "vendido não gera alerta");
  assert.equal(nextAction(v, a, 0), null);
});

test("alertas: margem negativa, dias parado, FIPE e fotos", () => {
  const cheap = base({ asking_price: 71000, purchase_date: todayISO(-70) });
  const a = analyze(cheap, 1500);
  const texts = alerts(cheap, a, 0).map((x) => x.text).join(" | ");
  assert.match(texts, /Margem negativa/);
  assert.match(texts, /70 dias no pátio|dias no pátio/);
  assert.match(texts, /sem fotos/i);
  assert.ok(alerts(cheap, a, 0).some((x) => x.level === "danger"));

  const ok = base({ asking_price: 90000, fipe_price: 80000, purchase_date: todayISO(-5) });
  assert.match(alerts(ok, analyze(ok, 0), 3).map((x) => x.text).join(" "), /acima da FIPE/);
  assert.ok(!alerts(ok, analyze(ok, 0), 3).some((x) => /fotos/.test(x.text)));
});

test("próxima melhor ação segue a prioridade combinada", () => {
  const prep = base({ status: "preparacao", purchase_date: todayISO(-12) });
  assert.match(nextAction(prep, analyze(prep, 0), 0) ?? "", /Cobrar a oficina/);
  const reserved = base({ status: "reservado" });
  assert.match(nextAction(reserved, analyze(reserved, 0), 2) ?? "", /documentação|sinal/i);
  const noPhoto = base({ purchase_date: todayISO(-10), asking_price: 95000, fipe_price: 95000 });
  assert.match(nextAction(noPhoto, analyze(noPhoto, 0), 0) ?? "", /Fotografar/);
  const old = base({ purchase_date: todayISO(-90), asking_price: 90000 });
  assert.match(nextAction(old, analyze(old, 0), 0) ?? "", /baixar para perto de|piso sem prejuízo/, "carro muito parado: preço vem antes de foto");
  const healthy = base({ purchase_date: todayISO(-5), asking_price: 90000, fipe_price: 90000 });
  assert.equal(nextAction(healthy, analyze(healthy, 0), 4), null);
});
