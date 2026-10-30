// Loja real (sem SEED_DEMO): nunca cair para um banco que se apaga sozinho. O erro tem de aparecer.
import { test } from "node:test";
import assert from "node:assert/strict";

Object.assign(process.env, { DATABASE_URL: "postgres://nao:existe@127.0.0.1:1/nada", NODE_ENV: "production" });
delete (process.env as Record<string, string | undefined>).SEED_DEMO;

test("na loja real, PostgreSQL fora do ar vira erro (e /saude 503), não banco de reserva", async () => {
  const { q } = await import("../lib/db");
  await assert.rejects(() => q("SELECT 1"));
  await assert.rejects(() => q("SELECT 1"), "tenta de novo e continua falhando, sem fingir que está tudo certo");
});
