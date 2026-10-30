import { strict as assert } from "node:assert";
import test from "node:test";
import { assetHeaders, contentSecurityPolicy, erpHeaders, securityHeaders } from "./headers";

const map = (dev: boolean) => new Map(securityHeaders(dev).map((h) => [h.key, h.value]));

test("os cabeçalhos de segurança essenciais estão presentes", () => {
  const h = map(false);
  assert.equal(h.get("X-Content-Type-Options"), "nosniff");
  assert.equal(h.get("X-Frame-Options"), "DENY");
  assert.equal(h.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(h.get("Permissions-Policy")!, /camera=\(\)/);
  assert.ok(h.has("Content-Security-Policy"));
});

test("HSTS só em produção (na máquina do dev o site é http)", () => {
  assert.match(map(false).get("Strict-Transport-Security")!, /max-age=\d+/);
  assert.equal(map(true).has("Strict-Transport-Security"), false);
});

test("a política de conteúdo fecha o que precisa e libera o que o site usa", () => {
  const p = contentSecurityPolicy(false);
  assert.match(p, /frame-ancestors 'none'/); // ninguém embute o site
  assert.match(p, /object-src 'none'/);
  assert.match(p, /base-uri 'self'/);
  assert.match(p, /form-action 'self'/);
  assert.match(p, /upgrade-insecure-requests/);
  assert.match(p, /frame-src [^;]*https:\/\/www\.google\.com/); // mapa da página de contato
  assert.match(p, /img-src [^;]*https:/); // fotos de veículos podem vir de fora
  assert.doesNotMatch(p, /'unsafe-eval'/); // eval só em desenvolvimento
});

test("em desenvolvimento a política libera o recarregamento automático do Next", () => {
  const p = contentSecurityPolicy(true);
  assert.match(p, /'unsafe-eval'/);
  assert.match(p, /connect-src [^;]*ws:/);
  assert.doesNotMatch(p, /upgrade-insecure-requests/); // o dev roda em http
});

test("fotos e logotipos ficam guardados no navegador", () => {
  const [h] = assetHeaders(86_400);
  assert.equal(h.key, "Cache-Control");
  assert.match(h.value, /public/);
  assert.match(h.value, /max-age=86400/);
  assert.match(h.value, /stale-while-revalidate/);
});

test("o ERP nunca é indexado nem guardado em cache", () => {
  const h = new Map(erpHeaders().map((x) => [x.key, x.value]));
  assert.match(h.get("X-Robots-Tag")!, /noindex/);
  assert.match(h.get("Cache-Control")!, /no-store/);
});
