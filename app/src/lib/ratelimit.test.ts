import { test } from "node:test";
import assert from "node:assert/strict";
import { LOGIN_TRIES, LOGIN_WINDOW_MS, allow, clientIp, ipFromHeaders, remaining, reset } from "./ratelimit";
import { normalizePhone, validName } from "./phone";

test("limite por chave: bloqueia depois do máximo e chaves são independentes", () => {
  const k = `t-${Math.random()}`;
  for (let i = 0; i < 5; i++) assert.equal(allow(k, 5, 60_000), true);
  assert.equal(allow(k, 5, 60_000), false);
  assert.equal(allow(k, 5, 60_000), false);
  assert.equal(allow(`${k}-outra`, 5, 60_000), true);
});

test("a janela reinicia depois do tempo", async () => {
  const k = `w-${Math.random()}`;
  assert.equal(allow(k, 1, 20), true);
  assert.equal(allow(k, 1, 20), false);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(allow(k, 1, 20), true);
});

test("IP vem do primeiro item de x-forwarded-for", () => {
  assert.equal(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } })), "1.2.3.4");
  assert.equal(clientIp(new Request("http://x")), "local");
  // Nas server actions o IP vem da lista de cabeçalhos, não de um Request.
  assert.equal(ipFromHeaders(new Headers({ "x-forwarded-for": " 9.9.9.9 , 10.0.0.1" })), "9.9.9.9");
  assert.equal(ipFromHeaders(new Headers()), "local");
});

test("acerto apaga as tentativas: quem erra e depois acerta não fica bloqueado", () => {
  const k = `r-${Math.random()}`;
  for (let i = 0; i < 3; i++) allow(k, 5, 60_000);
  assert.equal(remaining(k, 5), 2);
  reset(k);
  assert.equal(remaining(k, 5), 5);
  for (let i = 0; i < 5; i++) assert.equal(allow(k, 5, 60_000), true);
  assert.equal(allow(k, 5, 60_000), false);
});

test("senha do ERP: bloqueia depois das tentativas combinadas e o acerto zera", () => {
  const k = `login:${Math.random()}`;
  // Quem fica chutando senha é barrado na tentativa seguinte ao limite.
  for (let i = 0; i < LOGIN_TRIES; i++) assert.equal(allow(k, LOGIN_TRIES, LOGIN_WINDOW_MS), true, `tentativa ${i + 1}`);
  assert.equal(allow(k, LOGIN_TRIES, LOGIN_WINDOW_MS), false, "passou do limite");
  // Quem acerta a senha recomeça do zero (o login chama reset).
  reset(k);
  assert.equal(allow(k, LOGIN_TRIES, LOGIN_WINDOW_MS), true);
  assert.ok(LOGIN_TRIES >= 5 && LOGIN_TRIES <= 10, "limite nem frouxo nem irritante");
  assert.ok(LOGIN_WINDOW_MS >= 10 * 60e3, "janela de pelo menos 10 minutos");
});

test("telefone brasileiro: formatos aceitos e rejeitados", () => {
  const ok = ["51999991234", "(51) 99999-1234", "+55 51 99999-1234", "55 (51) 99999 1234", "51 3499-9999", "(11) 91234-5678"];
  for (const p of ok) assert.ok(normalizePhone(p), p);
  assert.equal(normalizePhone("51999991234"), "(51) 99999-1234");
  assert.equal(normalizePhone("5134999999"), "(51) 3499-9999");
  const bad = ["", "123", "5199999123", "519999912345", "(51) 89999-1234", "(00) 99999-1234", "(10) 99999-1234", "abcdefghijk", "51 9999-99999 9"];
  for (const p of bad) assert.equal(normalizePhone(p), null, p);
});

test("nome: tamanho, letras e espaços", () => {
  assert.equal(validName("  Maria   da Silva "), "Maria da Silva");
  assert.equal(validName("João"), "João");
  assert.equal(validName("A"), null);
  assert.equal(validName("12345"), null);
  assert.equal(validName(""), null);
  assert.equal(validName("x".repeat(81)), null);
  assert.equal(validName("José D'Ávila"), "José D'Ávila");
});
