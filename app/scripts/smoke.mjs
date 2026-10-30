#!/usr/bin/env node
// Verificação de saúde de ponta a ponta (sem dependências). Serve para:
//   - o monitor do GitHub (vigia o site publicado);
//   - rodar na própria máquina:  node scripts/smoke.mjs http://localhost:3000
// Sai com código 1 se algo essencial falhar. Mostra aviso (sem falhar) para lentidão.
const base = (process.argv[2] || process.env.SITE || "http://localhost:3000").replace(/\/$/, "");
const COLD_MS = 90_000; // o plano grátis do Render dorme e leva ~1 min para acordar
const SLOW_MS = 4_000;

const results = [];
let failed = 0;

async function timed(url, init = {}, timeout = 30_000) {
  const t0 = Date.now();
  const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(timeout), ...init });
  return { res, ms: Date.now() - t0 };
}

async function check(name, fn, { critical = true } = {}) {
  const t0 = Date.now();
  try {
    const note = await fn();
    const ms = Date.now() - t0;
    results.push({ name, ok: true, ms, note: note || "", slow: ms > SLOW_MS });
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, note: e.message, critical });
    if (critical) failed++;
  }
}

const must = (cond, msg) => { if (!cond) throw new Error(msg); };

// 1) acorda o serviço (tenta de novo enquanto dorme) e confere o banco
let banco = "";
await check("saúde do banco (/saude)", async () => {
  let last = "";
  for (let i = 0; i < 3; i++) {
    try {
      const { res, ms } = await timed(`${base}/saude`, {}, COLD_MS);
      const j = await res.json().catch(() => ({}));
      banco = j.banco ?? "";
      if (res.status === 200 && j.ok === true) return `${ms} ms · banco: ${j.banco ?? "?"}${j.banco === "reserva" ? " (PostgreSQL fora do ar: dados temporários!)" : ""} · sempre online: ${j.sempreOnline ? "sim" : "não"} · versão ${j.versao ?? "?"} · no ar há ${j.noArHa ?? "?"}`;
      last = `HTTP ${res.status} ${JSON.stringify(j)}`;
    } catch (e) { last = e.message; }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(last);
});
if (failed) { report(); process.exit(1); }

// O banco de reserva mantém o site de pé quando o PostgreSQL some, mas o que for gravado nele
// desaparece no próximo reinício. Isso tem que gerar e-mail, não só uma linha no relatório.
await check("banco definitivo (não o de reserva)", async () => {
  must(banco !== "reserva", "PostgreSQL fora do ar: o site está servindo dados temporários, que somem no próximo reinício. Confira o banco no Render (o grátis expira 30 dias depois de criado).");
  return `banco: ${banco || "?"}`;
});

let vehiclePath = "";
await check("home abre com a marca e o chamado", async () => {
  const { res } = await timed(base + "/");
  const html = await res.text();
  must(res.status === 200, `HTTP ${res.status}`);
  must(/Seu próximo caminho começa aqui/.test(html), "texto principal ausente");
  must(/Chimarrão/.test(html), "nome da loja ausente");
});
await check("estoque lista veículos com preço e foto", async () => {
  const { res } = await timed(base + "/estoque");
  const html = await res.text();
  must(res.status === 200, `HTTP ${res.status}`);
  const links = [...html.matchAll(/href="(\/veiculo\/[a-z0-9-]+)"/g)].map((m) => m[1]);
  must(new Set(links).size >= 12, `só ${new Set(links).size} veículos`);
  must(/R\$\s?[\d.]+/.test(html), "sem preços");
  must(/\/vehicles\/[\w-]+\.jpg|_next\/image/.test(html), "sem fotos");
  vehiclePath = links[0];
  return `${new Set(links).size} veículos`;
});
await check("página do veículo: título, preço e dados estruturados", async () => {
  must(vehiclePath, "sem veículo para abrir");
  const { res } = await timed(base + vehiclePath);
  const html = await res.text();
  must(res.status === 200, `HTTP ${res.status}`);
  must(/application\/ld\+json/.test(html), "sem JSON-LD");
  must(/<h1[^>]*>[^<]{4,}/.test(html), "sem título");
  must(/R\$\s?[\d.]+/.test(html), "sem preço");
  must(/Resumo técnico/.test(html), "sem ficha técnica");
  must(/Falar com a equipe/.test(html), "sem botão de contato");
});
await check("veículo inexistente dá 404 com saída para o estoque", async () => {
  const { res } = await timed(base + "/veiculo/nao-existe-xyz");
  must(res.status === 404, `HTTP ${res.status}`);
  const html = await res.text();
  must(/Esta página não existe/.test(html), "404 sem a página da loja");
  must(/Ver todo o estoque/.test(html), "404 sem saída para o estoque");
});
await check("endereço desconhecido cai na página 404 da loja", async () => {
  const { res } = await timed(base + "/pagina-que-nao-existe-xyz");
  must(res.status === 404, `HTTP ${res.status}`);
  must(/Esta página não existe/.test(await res.text()), "404 sem a página da loja");
});
for (const [path, re] of [["/destaques", /seleção da equipe/i], ["/sobre", /Tradição que acolhe/], ["/contato", /Como chegar/], ["/reconhecimento", /Feirões|Reconhecimento/], ["/certificacoes", /Certificações|licenças/]]) {
  await check(`página ${path}`, async () => {
    const { res } = await timed(base + path);
    must(res.status === 200, `HTTP ${res.status}`);
    must(re.test(await res.text()), "conteúdo esperado ausente");
  });
}
await check("sitemap.xml e robots.txt", async () => {
  const s = await timed(base + "/sitemap.xml");
  must(s.res.status === 200, `sitemap HTTP ${s.res.status}`);
  const r = await timed(base + "/robots.txt");
  must(r.res.status === 200, `robots HTTP ${r.res.status}`);
  return /Disallow: \/\s*$/m.test(await r.res.text()) ? "demonstração: bloqueado para o Google" : "indexável";
});
await check("cabeçalhos de segurança no ar", async () => {
  const { res } = await timed(base + "/");
  const h = (n) => res.headers.get(n) || "";
  must(/nosniff/.test(h("x-content-type-options")), "sem X-Content-Type-Options");
  must(/DENY|SAMEORIGIN/i.test(h("x-frame-options")), "sem X-Frame-Options");
  must(h("referrer-policy"), "sem Referrer-Policy");
  must(/frame-ancestors/.test(h("content-security-policy")), "sem política de conteúdo (CSP)");
  must(!res.headers.get("x-powered-by"), "revela a tecnologia no cabeçalho (x-powered-by)");
  const https = base.startsWith("https");
  if (https) must(/max-age=\d+/.test(h("strict-transport-security")), "sem HSTS");
  return https ? "com HSTS" : "sem HSTS (site em http)";
});
await check("imagem de compartilhamento (link no WhatsApp)", async () => {
  const { res } = await timed(base + "/");
  const m = /<meta property="og:image" content="([^"]+)"/.exec(await res.text());
  must(m, "sem og:image");
  const url = m[1].startsWith("http") ? m[1] : base + m[1];
  const img = await timed(url, {}, 30_000);
  must(img.res.status === 200, `og:image HTTP ${img.res.status}`);
  must(/^image\//.test(img.res.headers.get("content-type") || ""), "og:image não é uma imagem");
  const bytes = (await img.res.arrayBuffer()).byteLength;
  must(bytes > 1024, "og:image vazia");
  return `${Math.round(bytes / 1024)} KB`;
});
await check("assistente virtual entende o pedido e sugere veículos", async () => {
  const say = async (state, text) => {
    const { res } = await timed(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state, input: { type: "text", text } }) });
    const j = await res.json();
    must(res.status === 200 && j.ok, `HTTP ${res.status}`);
    return j;
  };
  const a = await say(null, "quero um carro até 150 mil");
  const b = await say(a.state, "para a família");
  const cards = b.messages.flatMap((m) => m.cards ?? []);
  must(cards.length >= 1, "nenhuma sugestão");
  must(cards.every((c) => c.price <= 150_000), "sugeriu acima do orçamento");
  must(!/purchase_price|sale_price|min_price|margem/i.test(JSON.stringify(b)), "vazou dado interno");
  return `${cards.length} sugestões`;
});
await check("API de lead recusa pedido sem consentimento", async () => {
  const { res } = await timed(base + "/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Monitor", phone: "(51) 99999-0000", consent: false }) });
  must(res.status === 400, `HTTP ${res.status}`);
});
await check("ERP exige login e não é indexável", async () => {
  const { res } = await timed(base + "/erp");
  must([302, 303, 307, 308].includes(res.status), `HTTP ${res.status}`);
  must((res.headers.get("location") || "").includes("/erp/login"), "não redirecionou ao login");
  const l = await timed(base + "/erp/login");
  must(l.res.status === 200, `login HTTP ${l.res.status}`);
  must(/noindex/.test(await l.res.text()), "login sem noindex");
  must(/noindex/.test(l.res.headers.get("x-robots-tag") || ""), "login sem X-Robots-Tag");
  must(/no-store/.test(l.res.headers.get("cache-control") || ""), "login guardado em cache");
});
// Aviso antes de o banco vencer (o PostgreSQL grátis do Render expira 30 dias depois de criado).
// Só roda se DB_EXPIRA_EM estiver definido, no formato AAAA-MM-DD.
if (process.env.DB_EXPIRA_EM) {
  await check("prazo do banco", async () => {
    const dias = Math.ceil((Date.parse(`${process.env.DB_EXPIRA_EM}T12:00:00Z`) - Date.now()) / 864e5);
    must(Number.isFinite(dias), `DB_EXPIRA_EM inválido: ${process.env.DB_EXPIRA_EM}`);
    must(dias > 7, `o banco vence em ${dias} dia(s) (${process.env.DB_EXPIRA_EM}): troque por um que não expire antes que os dados sumam`);
    return `vence em ${dias} dias`;
  });
}
await check("telas internas não abrem sem sessão", async () => {
  for (const p of ["/erp/clientes", "/erp/tarefas", "/erp/leads", "/erp/vendas", "/erp/caixa", "/erp/veiculos"]) {
    const { res } = await timed(base + p);
    must([302, 303, 307, 308].includes(res.status), `${p}: HTTP ${res.status}`);
  }
});

report();
process.exit(failed ? 1 : 0);

function report() {
  const w = Math.max(...results.map((r) => r.name.length));
  console.log(`\nVerificação de ${base}\n`);
  for (const r of results) {
    const icon = r.ok ? (r.slow ? "⚠" : "✔") : "✖";
    console.log(`${icon} ${r.name.padEnd(w)}  ${String(r.ms).padStart(5)} ms  ${r.note}`);
  }
  const slow = results.filter((r) => r.ok && r.slow).length;
  console.log(`\n${results.length - failed - results.filter((r) => !r.ok && !r.critical).length} de ${results.length} verificações ok${slow ? `, ${slow} lenta(s)` : ""}${failed ? `, ${failed} FALHA(S)` : ""}.`);
}
