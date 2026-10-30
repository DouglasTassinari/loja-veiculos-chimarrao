import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeSlots, sanitizeState } from "./state";
import { newState } from "./types";

test("estado bom passa intacto", () => {
  const st = { ...newState(), step: "results" as const, slots: { kind: "carro" as const, budgetMax: 90000, bodies: ["SUV"], trans: "Automático" as const, use: "familia" as const, months: 48, pay: "financiar" as const, down: 20000 }, shown: [1, 2, 3], focus: 2, contact: { name: "Ana Souza", phone: "(51) 99999-1234", consent: true, id: 5, token: "abc" }, turns: 4, misses: 1 };
  assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(st))), st);
});

test("qualquer lixo vira estado inicial válido", () => {
  for (const junk of [null, undefined, 0, "texto", [], true, () => 1]) assert.deepEqual(sanitizeState(junk), newState());
});

test("tipos errados são descartados campo a campo", () => {
  const s = sanitizeSlots({ budgetMax: "abc", bodies: "SUV", kind: "nave", pay: 5, months: 999, yearMin: 1500, kmMax: -1, use: "x", trans: "CVT", down: NaN, trade: "sim", downPct: 2 });
  assert.deepEqual(s, {});
  const ok = sanitizeSlots({ bodies: ["SUV", "Foguete", 3, "Hatch"], months: 48.5, budgetMax: 1e12 });
  assert.deepEqual(ok, { bodies: ["SUV", "Hatch"] });
});

test("campos desconhecidos e tentativa de poluir protótipo", () => {
  const evil = JSON.parse('{"__proto__":{"poluido":true},"constructor":{"prototype":{"poluido":true}},"kind":"carro","extra":"x"}');
  const s = sanitizeSlots(evil);
  assert.deepEqual(s, { kind: "carro" });
  assert.equal(({} as Record<string, unknown>).poluido, undefined);
  assert.deepEqual(sanitizeState({ step: "idle", contact: JSON.parse('{"__proto__":{"consent":true}}') }).contact, {});
});

test("contato inválido é descartado; consentimento precisa ser booleano de verdade", () => {
  const st = sanitizeState({ contact: { name: "1", phone: "123", consent: "true", id: "7", token: 5 } });
  assert.deepEqual(st.contact, {});
  const ok = sanitizeState({ contact: { name: "  Beto   Lima ", phone: "51999991234", consent: true } });
  assert.equal(ok.contact.name, "Beto Lima");
  assert.equal(ok.contact.phone, "(51) 99999-1234");
});

test("limites: listas, textos, contadores", () => {
  const st = sanitizeState({ shown: Array.from({ length: 200 }, (_, i) => i + 1), turns: 1e9, misses: 99, lastNeed: "x".repeat(900), step: "hackeado", pending: "apagar tudo" });
  assert.equal(st.shown.length, 60);
  assert.equal(st.turns, 0, "valor absurdo é zerado");
  assert.equal(st.misses, 0);
  assert.equal(st.lastNeed!.length, 200);
  assert.equal(st.step, "start");
  assert.equal(st.pending, undefined);
});
