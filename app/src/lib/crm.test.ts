import { test } from "node:test";
import assert from "node:assert/strict";
import { PAYMENT_LABEL, STAGES, TASK_LABEL, addDays, addMonths, buildSaleTasks, daysUntil, financingEnd, stageLabel, taskMessage, waLinkTo } from "./crm";

test("addDays e daysUntil", () => {
  assert.equal(addDays("2026-10-30", 7), "2026-11-06");
  assert.equal(addDays("2026-12-28", 7), "2027-01-04");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysUntil("2026-11-06", "2026-10-30"), 7);
  assert.equal(daysUntil("2026-10-25", "2026-10-30"), -5);
  assert.equal(daysUntil("2026-10-30", "2026-10-30"), 0);
});

test("addMonths respeita fim de mês, ano bissexto e virada de ano", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonths("2026-11-15", 3), "2027-02-15");
  assert.equal(addMonths("2026-10-30", 48), "2030-10-30");
  assert.equal(addMonths("2026-10-30", 0), "2026-10-30");
  assert.equal(addMonths("2026-05-31", 1), "2026-06-30");
  assert.equal(addMonths("2026-12-31", 2), "2027-02-28");
});

test("fim do financiamento só existe com parcelas", () => {
  assert.equal(financingEnd({ sale_date: "2026-10-30", months: 48 }), "2030-10-30");
  assert.equal(financingEnd({ sale_date: "2026-10-30", months: 0 }), null);
});

test("venda financiada cria pós-venda, aniversário e avisos de renovação nas datas certas", () => {
  const tasks = buildSaleTasks({ sale_date: "2026-10-30", payment: "financiado", months: 48, vehicle_title: "Fiat Argo 2024", price: 80000 });
  const by = Object.fromEntries(tasks.map((t) => [t.kind, t]));
  assert.equal(by.pos_venda_7.due_date, "2026-11-06");
  assert.equal(by.pos_venda_30.due_date, "2026-11-29");
  assert.equal(by.revisao_180.due_date, "2027-04-28");
  assert.equal(by.aniversario.due_date, "2027-10-30");
  assert.equal(by.renovacao_90.due_date, addDays("2030-10-30", -90), "avisa 90 dias antes do fim");
  assert.equal(by.renovacao_15.due_date, addDays("2030-10-30", -15));
  assert.ok(!by.renovacao_troca, "financiado não recebe o lembrete de troca de 3 anos");
  assert.ok(by.renovacao_90.title.includes("30/10/2030"), "mostra a data de quitação");
  assert.equal(tasks.length, 6);
  const sorted = [...tasks].map((t) => t.due_date).sort();
  assert.deepEqual(tasks.map((t) => t.due_date), sorted, "ordenadas por data");
  for (const t of tasks) assert.ok(t.title.includes("Fiat Argo 2024") && t.note.length > 10);
});

test("compra à vista recebe lembrete de troca em 3 anos", () => {
  const tasks = buildSaleTasks({ sale_date: "2026-05-31", payment: "avista", months: 0, vehicle_title: "Honda CG 160", price: 15000 });
  const troca = tasks.find((t) => t.kind === "renovacao_troca");
  assert.ok(troca);
  assert.equal(troca!.due_date, "2029-05-31");
  assert.ok(!tasks.some((t) => t.kind === "renovacao_90"));
  assert.equal(tasks.length, 5);
});

test("financiamento curto: o aviso de 90 dias pode cair antes do pós-venda de 6 meses", () => {
  const tasks = buildSaleTasks({ sale_date: "2026-10-30", payment: "financiado", months: 6, vehicle_title: "X", price: 1 });
  const r90 = tasks.find((t) => t.kind === "renovacao_90")!;
  assert.equal(r90.due_date, addDays("2027-04-30", -90));
});

test("mensagens de WhatsApp por tipo: nome, veículo, loja e data, sem sobras de modelo", () => {
  const who = { name: "Maria da Silva", vehicle: "Jeep Compass 2020", store: "Chimarrão", endDate: "2030-10-30" };
  for (const kind of Object.keys(TASK_LABEL) as (keyof typeof TASK_LABEL)[]) {
    const m = taskMessage(kind, who);
    assert.ok(m.includes("Maria"), `${kind} usa o primeiro nome`);
    assert.ok(!m.includes("Silva"), `${kind} não repete o sobrenome`);
    assert.ok(!/undefined|null|\{|\}/.test(m), `${kind} sem sobras`);
  }
  assert.match(taskMessage("renovacao_90", who), /30\/10\/2030/);
  assert.match(taskMessage("pos_venda_7", who), /Jeep Compass 2020/);
  assert.match(taskMessage("pos_venda_30", { name: "Ana", store: "Chimarrão" }), /veículo/, "sem veículo usa texto genérico");
});

test("link de WhatsApp do cliente adiciona o 55 e codifica o texto", () => {
  assert.equal(waLinkTo("(51) 99999-0000", "olá & tchau"), "https://wa.me/5551999990000?text=ol%C3%A1%20%26%20tchau");
  assert.ok(waLinkTo("5551999990000", "x").startsWith("https://wa.me/5551999990000"), "não duplica o 55");
});

test("etapas do funil e rótulos", () => {
  assert.deepEqual(STAGES.map((s) => s.key), ["novo", "contatado", "visita", "proposta", "negociacao", "ganho", "perdido"]);
  assert.equal(stageLabel("negociacao"), "Negociação");
  assert.equal(stageLabel("inexistente"), "inexistente");
  assert.equal(PAYMENT_LABEL.troca_financiado, "Troca + financiamento");
});
