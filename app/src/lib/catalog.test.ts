import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import catalog from "./catalog.json" with { type: "json" };

// Integridade do estoque de exemplo: preços, fotos, créditos e licenças.
type Item = { k: string; b: string; m: string; v: string; y: number; km: number; p: number; st: string; photos?: string[]; credits?: string[] };
const items = catalog as Item[];
const cars = items.filter((i) => i.k === "c");
const bikes = items.filter((i) => i.k === "m");
const pub = path.join(process.cwd(), "public");

test("estoque de exemplo: 40+ carros usados de R$ 15 mil a R$ 250 mil e motos", () => {
  assert.ok(cars.length >= 40, `${cars.length} carros`);
  assert.ok(bikes.length >= 8, `${bikes.length} motos`);
  assert.ok(Math.min(...cars.map((c) => c.p)) <= 16000 && Math.min(...cars.map((c) => c.p)) >= 15000);
  assert.ok(Math.max(...cars.map((c) => c.p)) <= 250000 && Math.max(...cars.map((c) => c.p)) >= 230000);
  assert.ok(cars.every((c) => c.p >= 15000 && c.p <= 250000), "todos os carros dentro da faixa");
});

test("todos são usados e plausíveis (ano, km e preço)", () => {
  for (const i of items) {
    assert.ok(i.y >= 2005 && i.y <= 2026, `${i.b} ${i.m}: ano ${i.y}`);
    assert.ok(i.km > 0 && i.km < 300000, `${i.b} ${i.m}: km ${i.km}`);
    assert.ok(i.p >= 9000, `${i.b} ${i.m}: preço ${i.p}`);
    assert.ok(i.km >= 5000 || i.y >= 2025, `${i.b} ${i.m}: "usado" com km muito baixo`);
  }
});

test("sem veículos repetidos", () => {
  const keys = items.map((i) => `${i.b}|${i.m}|${i.v}|${i.y}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("cada veículo tem fotos, no máximo 5, e os arquivos existem", () => {
  for (const i of items) {
    const ph = i.photos ?? [];
    assert.ok(ph.length >= 1 && ph.length <= 5, `${i.b} ${i.m}: ${ph.length} fotos`);
    for (const p of ph) {
      assert.ok(p.startsWith("/vehicles/") && p.endsWith(".jpg"), p);
      const f = path.join(pub, p);
      assert.ok(existsSync(f), `arquivo ausente: ${p}`);
      assert.ok(statSync(f).size > 15000, `foto muito pequena (corrompida?): ${p}`);
    }
    assert.equal(new Set(ph).size, ph.length, `${i.b} ${i.m}: foto repetida`);
  }
});

test("a maioria dos veículos tem as 5 fotos pedidas", () => {
  const full = items.filter((i) => (i.photos ?? []).length === 5).length;
  assert.ok(full / items.length >= 0.85, `${full}/${items.length} com 5 fotos`);
});

test("créditos: autor, licença livre e link para a origem em todas as fotos", () => {
  const allowed = /^(cc[ -]by([ -]sa)?([ -][0-9.]+)?|cc0.*|public domain|pd.*)$/i;
  for (const i of items) {
    assert.equal((i.credits ?? []).length, (i.photos ?? []).length, `${i.b} ${i.m}: créditos != fotos`);
    for (const c of i.credits ?? []) {
      const [author, license, url] = c.split(" · ");
      assert.ok(author && author.length > 1, `${i.m}: sem autor`);
      assert.match(license, allowed, `${i.m}: licença não livre (${license})`);
      assert.match(url, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, `${i.m}: sem link de origem`);
    }
  }
});

test("peso total das fotos fica razoável para o repositório e para o site", () => {
  let total = 0;
  for (const i of items) for (const p of i.photos ?? []) total += statSync(path.join(pub, p)).size;
  assert.ok(total < 60 * 1024 * 1024, `${(total / 1048576).toFixed(1)} MB`);
  for (const i of items) for (const p of i.photos ?? []) assert.ok(statSync(path.join(pub, p)).size < 600 * 1024, `foto pesada: ${p}`);
});

test("catálogo não vaza dados de compra", () => {
  const raw = JSON.stringify(catalog);
  assert.ok(!/purchase|compra|margem|custo/i.test(raw.replace(/Compass|compasso/gi, "")));
});
