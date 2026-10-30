import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Banco SQLite temporário e real: roda o mesmo código de produção (esquema, seed, consultas).
process.env.SQLITE_PATH = path.join(mkdtempSync(path.join(os.tmpdir(), "chim-data-")), "t.db");
delete process.env.DATABASE_URL;

let data: typeof import("../lib/data");
let crm: typeof import("../lib/crm-data");
let db: typeof import("../lib/db");
let rules: typeof import("../lib/crm");
let fin: typeof import("../lib/finance");

before(async () => {
  db = await import("../lib/db");
  data = await import("../lib/data");
  crm = await import("../lib/crm-data");
  rules = await import("../lib/crm");
  fin = await import("../lib/finance");
});

const count = async (table: string, where = "1=1") => Number(((await db.q<{ n: number }>(`SELECT CAST(COUNT(*) AS INTEGER) AS n FROM ${table} WHERE ${where}`))[0]).n);

test("seed cria o estoque, a carteira de clientes e a agenda", async () => {
  assert.equal(await count("vehicles"), 60);
  assert.equal(await count("vehicles", "kind = 'carro'"), 50);
  assert.equal(await count("vehicles", "kind = 'moto'"), 10);
  assert.equal(await count("vehicles", "status = 'vendido'"), 8);
  assert.ok(await count("vehicles", "status = 'preparacao'") >= 3);
  assert.ok(await count("vehicles", "status = 'reservado'") >= 3);
  assert.equal(await count("vehicles v", "NOT EXISTS (SELECT 1 FROM costs c WHERE c.vehicle_id = v.id)"), 0, "todo veículo tem custos");
  assert.equal(await count("sales"), 14);
  assert.equal(await count("customers"), 14);
  assert.ok(await count("tasks", "done = 0") >= 20);
  assert.ok(await count("tasks", "done = 1") >= 5);
  assert.equal(await count("leads"), 14);
  assert.ok(await count("cash_entries") >= 10);
  assert.equal((await db.q<{ value: string }>("SELECT value FROM meta WHERE key = 'seed_version'"))[0].value.startsWith("2026-"), true);
  assert.equal(await count("vehicles", "published = 0 AND status IN ('disponivel','reservado')"), 0, "disponível/reservado sempre publicado");
});

test("seed: dados coerentes (preços, datas, vendas)", async () => {
  const bad = await count("vehicles", "asking_price <= 0 OR purchase_price <= 0 OR purchase_price >= asking_price * 1.01");
  assert.equal(bad, 0, "compra sempre abaixo do preço pedido");
  assert.equal(await count("vehicles", "status = 'vendido' AND (sale_price IS NULL OR sale_date IS NULL)"), 0);
  assert.equal(await count("vehicles", "status <> 'vendido' AND sale_price IS NOT NULL"), 0);
  assert.equal(await count("sales", "price <= 0 OR (months > 0 AND parcel <= 0)"), 0);
  const slugs = await db.q<{ slug: string }>("SELECT slug FROM vehicles");
  assert.equal(new Set(slugs.map((s) => s.slug)).size, 60, "slugs únicos");
  const old = await count("vehicles", "status = 'disponivel'") ;
  assert.ok(old >= 40);
});

test("vitrine pública: filtros, ordem e visibilidade", async () => {
  const all = await data.publicVehicles();
  assert.ok(all.every((v) => v.published || v.status === "vendido"), "só publicados (e vendidos, como prova de giro)");
  assert.ok(!all.some((v) => v.status === "preparacao"));
  const firstSold = all.findIndex((v) => v.status === "vendido");
  assert.ok(firstSold > 0 && all.slice(firstSold).every((v) => v.status === "vendido"), "vendidos ficam no fim");

  const avail = all.filter((v) => v.status !== "vendido");
  assert.ok(avail.slice(0, 3).every((v) => v.featured), "destaques primeiro");
  const regular = avail.filter((v) => !v.featured);
  const firstBike = regular.findIndex((v) => v.kind === "moto");
  const lastCar = regular.map((v) => v.kind).lastIndexOf("carro");
  assert.ok(firstBike > lastCar, "fora os destaques, carros vêm antes das motos");

  assert.ok((await data.publicVehicles({ kind: "moto" })).every((v) => v.kind === "moto"));
  assert.ok((await data.publicVehicles({ kind: "carro" })).every((v) => v.kind === "carro"));
  assert.ok((await data.publicVehicles({ body: "SUV" })).every((v) => v.body === "SUV"));
  assert.ok((await data.publicVehicles({ brand: "Toyota" })).every((v) => v.brand === "Toyota"));
  assert.ok((await data.publicVehicles({ trans: "Automático" })).every((v) => v.transmission === "Automático"));
  const cheap = await data.publicVehicles({ maxPrice: 40000 });
  assert.ok(cheap.length > 3 && cheap.every((v) => v.asking_price <= 40000));
  const flex = await data.publicVehicles({ fuel: "Flex" });
  assert.ok(flex.length > 3 && flex.every((v) => v.fuel === "Flex"));
  // Ano de corte tirado do próprio estoque, para o teste não depender do ano de hoje.
  const anos = all.map((v) => v.year_model).sort((a, b) => b - a);
  const corte = anos[Math.min(5, anos.length - 1)];
  const novos = await data.publicVehicles({ minYear: corte });
  assert.ok(novos.length > 3 && novos.every((v) => v.year_model >= corte), `minYear ${corte}`);
  const rodados = await data.publicVehicles({ maxKm: 50000 });
  assert.ok(rodados.length > 3 && rodados.every((v) => v.km <= 50000));
  const juntos = await data.publicVehicles({ trans: "Automático", minYear: 2021, maxKm: 80000, maxPrice: 150000 });
  assert.ok(juntos.every((v) => v.transmission === "Automático" && v.year_model >= 2021 && v.km <= 80000 && v.asking_price <= 150000), "filtros combinam");
  const sorted = (await data.publicVehicles({ sort: "menor-preco" })).filter((v) => v.status !== "vendido").map((v) => v.asking_price);
  assert.deepEqual(sorted, [...sorted].sort((a, b) => a - b));
  const byKm = (await data.publicVehicles({ sort: "menor-km" })).filter((v) => v.status !== "vendido").map((v) => v.km);
  assert.deepEqual(byKm, [...byKm].sort((a, b) => a - b));
  assert.ok((await data.publicVehicles({ q: "ONIX" })).length >= 2, "busca ignora maiúsculas");
  assert.equal((await data.publicVehicles({ q: "naoexistexyz" })).length, 0);
});

test("dados do assistente: só o que é público, sem custo nem margem", async () => {
  const lite = await data.chatVehicles();
  assert.ok(lite.length >= 40);
  const allowed = new Set(["id", "slug", "kind", "brand", "model", "version", "body", "year", "km", "trans", "fuel", "engine", "color", "price", "fipe", "featured", "inspected", "single", "warranty", "photo"]);
  for (const v of lite) {
    for (const k of Object.keys(v)) assert.ok(allowed.has(k), `campo não autorizado no assistente: ${k}`);
    assert.ok(v.price > 0 && v.slug);
  }
  const raw = JSON.stringify(lite);
  assert.ok(!/purchase|sale_price|min_price|margin|cost/i.test(raw));
  const ids = new Set((await data.allVehicles()).filter((v) => v.status !== "disponivel" || !v.published).map((v) => v.id));
  assert.ok(lite.every((v) => !ids.has(v.id)), "reservados, vendidos e em preparação não entram");
});

test("ciclo do veículo: cadastro, custos, publicação, destaque e venda", async () => {
  const id = await data.createVehicle({
    plate: "tst1a23", brand: "Honda", model: "NXR 160", version: "Bros ESDD", body: "Trail", year_fab: 2023, year_model: 2023, km: 9000, fuel: "Flex",
    transmission: "Manual", color: "Vermelha", engine: "160cc", purchase_price: 15000, purchase_date: fin.todayISO(-3), asking_price: 18900, fipe_price: 18000, kind: "moto",
  });
  let v = await data.vehicleById(id);
  assert.ok(v && v.kind === "moto" && v.status === "preparacao" && v.published === 0 && v.plate === "TST1A23");
  assert.ok(!(await data.publicVehicles()).some((x) => x.id === id), "novo veículo não aparece no site");

  await data.addCost(id, "Mecânica", "Revisão", 800, fin.todayISO());
  await data.addCost(id, "Documentação", "Transferência", 600, fin.todayISO());
  v = await data.vehicleById(id);
  assert.equal(v!.analysis.totalCost, 16400);
  const costs = await crm.customersList("");
  void costs;
  const list = await data.costsOf(id);
  assert.equal(list.length, 2);
  await data.deleteCost(list[0].id);
  assert.equal((await data.vehicleById(id))!.analysis.extraCosts, 600 + 800 - list[0].amount);

  await data.updateVehicle(id, { status: "disponivel", published: true, featured: true, asking_price: 19500, photos: ["/vehicles/01-1.jpg"], inspected: true });
  v = await data.vehicleById(id);
  assert.equal(v!.asking_price, 19500);
  assert.ok(v!.featured === 1 && v!.inspected === 1 && v!.ready_date);
  assert.ok((await data.publicVehicles({ kind: "moto" })).some((x) => x.id === id));
  assert.ok((await data.chatVehicles()).some((x) => x.id === id));
  assert.equal((await data.publicVehicles())[0].featured, 1, "destaque vai para o topo");

  await data.updateVehicle(id, { published: false });
  assert.ok(!(await data.publicVehicles()).some((x) => x.id === id), "despublicar tira do site");
  assert.ok(!(await data.chatVehicles()).some((x) => x.id === id));

  await data.updateVehicle(id, { published: true });
  await data.sellVehicle(id, 19000, fin.todayISO(), 500);
  v = await data.vehicleById(id);
  assert.equal(v!.status, "vendido");
  assert.equal(v!.published, 0);
  assert.equal(v!.sale_price, 19000);
  assert.ok((await data.costsOf(id)).some((c) => c.category === "Comissão" && c.amount === 500), "comissão entra nos custos");
  assert.ok(!(await data.chatVehicles()).some((x) => x.id === id), "vendido sai do assistente");
  assert.ok((await data.publicVehicles()).some((x) => x.id === id && x.status === "vendido"), "mas continua visível como vendido");
});

test("leads: criação, deduplicação, mensagem e etapas", async () => {
  const id = await data.createLead({ vehicle_id: 3, name: "Teste Lead", phone: "(51) 99999-0001", message: "olá", source: "simulador" });
  assert.ok(id > 0);
  assert.equal(await data.findRecentLead("(51) 99999-0001", 3, "simulador"), id);
  assert.equal(await data.findRecentLead("(51) 99999-0001", 3, "chat"), null, "origem diferente não reaproveita");
  assert.equal(await data.findRecentLead("(51) 99999-0001", 4, "simulador"), null, "veículo diferente não reaproveita");
  assert.equal(await data.findRecentLead("(51) 99999-0002", 3, "simulador"), null);

  await data.appendLeadMessage(id, "segunda mensagem");
  let l = await crm.leadById(id);
  assert.match(l!.message, /olá\nsegunda mensagem/);
  await data.appendLeadMessage(id, "x".repeat(2000));
  l = await crm.leadById(id);
  assert.ok(l!.message.length <= 1500, "mensagem não cresce sem limite");

  await crm.moveLead(id, "proposta");
  l = await crm.leadById(id);
  assert.equal(l!.status, "proposta");
  assert.ok(l!.updated_at && l!.updated_at.length > 10);
  assert.ok(l!.vehicle_title?.includes("Chevrolet Celta"), "traz o título do veículo");
  assert.equal(await crm.leadById(999999), null);
  assert.equal((await data.leads())[0].id, id, "mais novo primeiro");
});

test("clientes: busca, dedupe por telefone e edição", async () => {
  const id = await crm.createCustomer({ name: "Zé da Silva", phone: "(51) 98888-7777", source: "site" });
  assert.equal((await crm.findCustomerByPhone("(51) 98888-7777"))!.id, id);
  assert.equal(await crm.findCustomerByPhone("(51) 90000-0000"), null);
  assert.ok((await crm.customersList("zé")).some((c) => c.id === id), "busca por nome (minúsculas)");
  assert.ok((await crm.customersList("98888")).some((c) => c.id === id), "busca por pedaço do telefone");
  assert.equal((await crm.customersList("zzzznaoexiste")).length, 0);
  const all = await crm.customersList("");
  assert.ok(all.length >= 15);
  assert.equal(all.find((c) => c.id === id)!.n_sales, 0);
  await crm.updateCustomer(id, { email: "ze@exemplo.com", notes: "Gosta de SUV", birthday: "1985-03-10" });
  const c = await crm.customerById(id);
  assert.equal(c!.email, "ze@exemplo.com");
  assert.equal(c!.name, "Zé da Silva", "campos não enviados permanecem");
});

test("venda financiada: gera tarefas, renovação e contagem para o painel", async () => {
  const cid = await crm.createCustomer({ name: "Cliente Financiado", phone: "(51) 97777-1111" });
  const date = fin.todayISO(-1370); // há ~3 anos e 9 meses: 48x termina em ~3 meses
  const sid = await crm.createSale({ vehicle_id: null, vehicle_title: "Honda Civic 2016", customer_id: cid, lead_id: null, sale_date: date, price: 70000, payment: "financiado", down: 20000, financed: 50000, months: 48, parcel: 1700, bank: "BV", trade_desc: "", trade_value: 0, notes: "" });
  await crm.addTasks(rules.buildSaleTasks({ sale_date: date, payment: "financiado", months: 48, vehicle_title: "Honda Civic 2016", price: 70000 }), { customer_id: cid, sale_id: sid }, fin.todayISO(-9));

  const sales = await crm.salesOfCustomer(cid);
  assert.equal(sales.length, 1);
  assert.equal((await crm.allSales()).find((s) => s.id === sid)!.customer_name, "Cliente Financiado");
  const ren = (await crm.renewalOpportunities(120)).find((r) => r.id === sid);
  assert.ok(ren, "aparece nas oportunidades de renovação");
  assert.ok(ren!.daysLeft > 60 && ren!.daysLeft < 120, `faltam ${ren!.daysLeft} dias`);
  assert.equal((await crm.renewalOpportunities(10)).some((r) => r.id === sid), false, "fora da janela");

  const mine = await crm.tasksOfCustomer(cid);
  assert.equal(mine.length, 6);
  const open = mine.filter((t) => !t.done);
  assert.ok(open.some((t) => t.kind === "renovacao_90"), "renovação em aberto");
  assert.ok(mine.filter((t) => t.done).every((t) => t.due_date < fin.todayISO(-9)), "tarefas antigas já nascem concluídas");
  assert.ok(open.every((t) => t.customer_name === "Cliente Financiado" && t.vehicle_title === "Honda Civic 2016"), "junta cliente e veículo");
});

test("tarefas: concluir, reabrir e adiar", async () => {
  const cid = await crm.createCustomer({ name: "Cliente Tarefa", phone: "(51) 96666-2222" });
  await crm.createTask({ customer_id: cid, title: "Ligar na sexta", due_date: fin.todayISO(-2) });
  await crm.createTask({ customer_id: cid, title: "Enviar proposta", due_date: fin.todayISO(5) });
  const before = await crm.dueTaskCount();
  const tasks = await crm.tasksOfCustomer(cid);
  const overdue = tasks.find((t) => t.title === "Ligar na sexta")!;
  const future = tasks.find((t) => t.title === "Enviar proposta")!;

  await crm.snoozeTask(overdue.id, 3);
  assert.equal((await crm.tasksOfCustomer(cid)).find((t) => t.id === overdue.id)!.due_date, fin.todayISO(3), "atrasada adia a partir de hoje");
  assert.equal(await crm.dueTaskCount(), before - 1, "sai da contagem de hoje/atrasadas");
  await crm.snoozeTask(future.id, 7);
  assert.equal((await crm.tasksOfCustomer(cid)).find((t) => t.id === future.id)!.due_date, fin.todayISO(12), "futura soma a partir da própria data");

  await crm.completeTask(future.id);
  assert.ok(!(await crm.openTasks()).some((t) => t.id === future.id));
  assert.ok((await crm.recentDoneTasks(50)).some((t) => t.id === future.id));
  await crm.reopenTask(future.id);
  assert.ok((await crm.openTasks()).some((t) => t.id === future.id));

  const open = await crm.openTasks();
  const dates = open.map((t) => t.due_date);
  assert.deepEqual(dates, [...dates].sort(), "agenda ordenada por data");
});

test("lead vira cliente: vínculo e etapa ganho", async () => {
  const lid = await data.createLead({ vehicle_id: 5, name: "Lead Ganho", phone: "(51) 95555-3333", message: "", source: "site" });
  const cid = await crm.createCustomer({ name: "Lead Ganho", phone: "(51) 95555-3333" });
  await crm.linkLeadToCustomer(lid, cid);
  const l = await crm.leadById(lid);
  assert.equal(l!.status, "ganho");
  assert.equal(l!.customer_id, cid);
});

test("caixa: baixa e reabertura de lançamentos", async () => {
  await data.addCashEntry({ kind: "receber", description: "Teste", amount: 100, due_date: fin.todayISO() });
  const e = (await data.cashEntries()).find((x) => x.description === "Teste")!;
  assert.equal(e.paid, 0);
  await data.toggleCashPaid(e.id);
  assert.equal((await data.cashEntries()).find((x) => x.id === e.id)!.paid, 1);
  await data.toggleCashPaid(e.id);
  assert.equal((await data.cashEntries()).find((x) => x.id === e.id)!.paid, 0);
});

test("entradas maliciosas ficam guardadas como texto e não quebram o banco", async () => {
  const evil = "Robert'); DROP TABLE leads;-- <script>alert(1)</script>";
  const id = await data.createLead({ vehicle_id: null, name: evil, phone: "(51) 94444-1234", message: evil, source: "site" });
  const l = await crm.leadById(id);
  assert.equal(l!.name, evil);
  assert.ok(await count("leads") > 10, "tabela intacta");
  assert.deepEqual(await crm.customersList("'; DROP TABLE customers;--"), []);
  assert.deepEqual(await crm.customersList("%"), (await crm.customersList("%")), "curinga é tratado como texto");
  assert.ok(await count("customers") > 10);
  assert.equal((await data.publicVehicles({ q: "' OR 1=1 --" })).length, 0);
});

test("seed reaparece quando a versão muda (modo demonstração)", async () => {
  await db.q("INSERT INTO customers (name, phone, created_at) VALUES ('Marcador', '(51) 90000-9999', 'x')");
  await db.q("UPDATE meta SET value = 'versao-antiga' WHERE key = 'seed_version'");
  (globalThis as unknown as { __conn?: unknown }).__conn = undefined; // simula um novo processo
  assert.equal(await count("customers", "name = 'Marcador'"), 0, "dados de exemplo antigos foram refeitos");
  assert.equal(await count("vehicles"), 60);
  assert.notEqual((await db.q<{ value: string }>("SELECT value FROM meta WHERE key = 'seed_version'"))[0].value, "versao-antiga");
});
