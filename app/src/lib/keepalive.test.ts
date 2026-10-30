import { test } from "node:test";
import assert from "node:assert/strict";
import { brasiliaHour, inWindow, keepAliveEnabled, parseHours, publicUrl } from "./keepalive";

test("horário de funcionamento: padrão 8-20 e valores inválidos voltam ao padrão", () => {
  assert.deepEqual(parseHours(undefined), { from: 8, to: 20 });
  assert.deepEqual(parseHours("9-18"), { from: 9, to: 18 });
  assert.deepEqual(parseHours(" 0 - 24 "), { from: 0, to: 24 });
  for (const ruim of ["", "abc", "20-8", "10-10", "-5", "8-"]) assert.deepEqual(parseHours(ruim), { from: 8, to: 20 }, ruim);
  assert.deepEqual(parseHours("5-99"), { from: 5, to: 24 });
});

test("a janela usa o horário de Brasília (UTC-3), não o do servidor", () => {
  assert.equal(brasiliaHour(new Date("2026-10-30T11:05:00Z")), 8);
  assert.equal(brasiliaHour(new Date("2026-10-30T02:59:00Z")), 23);
  assert.equal(brasiliaHour(new Date("2026-10-30T03:00:00Z")), 0);
  const w = { from: 8, to: 20 };
  assert.equal(inWindow(new Date("2026-10-30T10:59:00Z"), w), false, "7h59");
  assert.equal(inWindow(new Date("2026-10-30T11:00:00Z"), w), true, "8h00");
  assert.equal(inWindow(new Date("2026-10-30T22:59:00Z"), w), true, "19h59");
  assert.equal(inWindow(new Date("2026-10-30T23:00:00Z"), w), false, "20h00");
});

test("liga no Render por padrão, KEEP_ALIVE=0 desliga, e só usa endereço público https", () => {
  assert.equal(keepAliveEnabled({}), false, "na máquina do desenvolvedor não liga");
  assert.equal(keepAliveEnabled({ RENDER: "true" }), true);
  assert.equal(keepAliveEnabled({ RENDER: "true", KEEP_ALIVE: "0" }), false);
  assert.equal(keepAliveEnabled({ KEEP_ALIVE: "0" }), false);
  assert.equal(keepAliveEnabled({ KEEP_ALIVE: "1" }), true);
  assert.equal(publicUrl({}), null);
  assert.equal(publicUrl({ RENDER_EXTERNAL_URL: "http://localhost:3000" }), null);
  assert.equal(publicUrl({ RENDER_EXTERNAL_URL: "https://chimarrao-veiculos.onrender.com/" }), "https://chimarrao-veiculos.onrender.com");
  assert.equal(publicUrl({ NEXT_PUBLIC_SITE_URL: "https://loja.com.br", RENDER_EXTERNAL_URL: "https://x.onrender.com" }), "https://loja.com.br");
});
