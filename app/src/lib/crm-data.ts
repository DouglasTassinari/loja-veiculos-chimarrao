import "server-only";
import { q, q1 } from "./db";
import { nowTs, todayISO } from "./finance";
import { addDays, daysUntil, financingEnd, type NewTask, type TaskKind } from "./crm";
import type { LeadRow } from "./data";

// CRM: clientes, vendas (com financiamento) e tarefas de relacionamento.
export type CustomerRow = {
  id: number; name: string; phone: string; email: string; birthday: string; notes: string; source: string; created_at: string;
  n_sales?: number; last_sale?: string | null; total?: number; next_due?: string | null;
};
export type SaleRow = {
  id: number; vehicle_id: number | null; vehicle_title: string; customer_id: number; lead_id: number | null; sale_date: string; price: number;
  payment: string; down: number; financed: number; months: number; parcel: number; bank: string; trade_desc: string; trade_value: number;
  notes: string; created_at: string; customer_name?: string; customer_phone?: string;
};
export type TaskRow = {
  id: number; customer_id: number | null; vehicle_id: number | null; sale_id: number | null; lead_id: number | null; kind: TaskKind;
  title: string; note: string; due_date: string; done: number; done_at: string | null; created_at: string;
  customer_name?: string | null; customer_phone?: string | null; vehicle_title?: string | null; sale_months?: number | null; sale_date?: string | null;
};

export function customersList(search = ""): Promise<CustomerRow[]> {
  const s = search.trim().toLowerCase();
  const like = `%${s}%`;
  return q<CustomerRow>(
    `SELECT c.*,
       (SELECT CAST(COUNT(*) AS INTEGER) FROM sales s WHERE s.customer_id = c.id) AS n_sales,
       (SELECT MAX(sale_date) FROM sales s WHERE s.customer_id = c.id) AS last_sale,
       (SELECT COALESCE(SUM(price), 0) FROM sales s WHERE s.customer_id = c.id) AS total,
       (SELECT MIN(due_date) FROM tasks t WHERE t.customer_id = c.id AND t.done = 0) AS next_due
     FROM customers c
     WHERE $1 = '' OR LOWER(c.name) LIKE $2 OR c.phone LIKE $2
     ORDER BY c.id DESC`,
    [s, like],
  );
}

export function customerById(id: number): Promise<CustomerRow | null> {
  return q1<CustomerRow>("SELECT * FROM customers WHERE id = $1", [id]);
}

export function findCustomerByPhone(phone: string): Promise<CustomerRow | null> {
  return q1<CustomerRow>("SELECT * FROM customers WHERE phone = $1", [phone]);
}

export async function createCustomer(c: { name: string; phone: string; email?: string; birthday?: string; notes?: string; source?: string }): Promise<number> {
  const [row] = await q<{ id: number }>(
    "INSERT INTO customers (name, phone, email, birthday, notes, source, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [c.name, c.phone, c.email ?? "", c.birthday ?? "", c.notes ?? "", c.source ?? "loja", nowTs()],
  );
  return Number(row.id);
}

export async function updateCustomer(id: number, f: { name?: string; email?: string; birthday?: string; notes?: string }) {
  const c = await customerById(id);
  if (!c) return;
  await q("UPDATE customers SET name = $1, email = $2, birthday = $3, notes = $4 WHERE id = $5", [f.name ?? c.name, f.email ?? c.email, f.birthday ?? c.birthday, f.notes ?? c.notes, id]);
}

export function salesOfCustomer(id: number): Promise<SaleRow[]> {
  return q<SaleRow>("SELECT * FROM sales WHERE customer_id = $1 ORDER BY sale_date DESC, id DESC", [id]);
}

export function allSales(): Promise<SaleRow[]> {
  return q<SaleRow>(
    `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
     FROM sales s JOIN customers c ON c.id = s.customer_id ORDER BY s.sale_date DESC, s.id DESC`,
  );
}

export type NewSale = Omit<SaleRow, "id" | "created_at" | "customer_name" | "customer_phone">;

export async function createSale(s: NewSale): Promise<number> {
  const [row] = await q<{ id: number }>(
    `INSERT INTO sales (vehicle_id, vehicle_title, customer_id, lead_id, sale_date, price, payment, down, financed, months, parcel, bank, trade_desc, trade_value, notes, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
    [s.vehicle_id, s.vehicle_title, s.customer_id, s.lead_id, s.sale_date, s.price, s.payment, s.down, s.financed, s.months, s.parcel, s.bank, s.trade_desc, s.trade_value, s.notes, nowTs()],
  );
  return Number(row.id);
}

// `doneBefore`: tarefas com data anterior já nascem concluídas (usado na carga de exemplo e em vendas antigas).
export async function addTasks(
  tasks: NewTask[],
  ref: { customer_id: number | null; vehicle_id?: number | null; sale_id?: number | null; lead_id?: number | null },
  doneBefore?: string,
) {
  for (const t of tasks) {
    const done = doneBefore && t.due_date < doneBefore ? 1 : 0;
    await q(
      "INSERT INTO tasks (customer_id, vehicle_id, sale_id, lead_id, kind, title, note, due_date, done, done_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [ref.customer_id, ref.vehicle_id ?? null, ref.sale_id ?? null, ref.lead_id ?? null, t.kind, t.title, t.note, t.due_date, done, done ? `${t.due_date} 12:00:00` : null, nowTs()],
    );
  }
}

const TASK_SELECT = `SELECT t.*, c.name AS customer_name, c.phone AS customer_phone, s.vehicle_title AS vehicle_title, s.months AS sale_months, s.sale_date AS sale_date
  FROM tasks t LEFT JOIN customers c ON c.id = t.customer_id LEFT JOIN sales s ON s.id = t.sale_id`;

export function openTasks(): Promise<TaskRow[]> {
  return q<TaskRow>(`${TASK_SELECT} WHERE t.done = 0 ORDER BY t.due_date ASC, t.id ASC`);
}

export function recentDoneTasks(limit = 15): Promise<TaskRow[]> {
  return q<TaskRow>(`${TASK_SELECT} WHERE t.done = 1 ORDER BY t.done_at DESC, t.id DESC LIMIT ${Math.min(Math.max(limit, 1), 50)}`);
}

export function tasksOfCustomer(customerId: number): Promise<TaskRow[]> {
  return q<TaskRow>(`${TASK_SELECT} WHERE t.customer_id = $1 ORDER BY t.done ASC, t.due_date ASC`, [customerId]);
}

export async function dueTaskCount(): Promise<number> {
  const row = await q1<{ n: number }>("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM tasks WHERE done = 0 AND due_date <= $1", [todayISO()]);
  return Number(row?.n ?? 0);
}

export async function completeTask(id: number) {
  await q("UPDATE tasks SET done = 1, done_at = $1 WHERE id = $2", [nowTs(), id]);
}

export async function reopenTask(id: number) {
  await q("UPDATE tasks SET done = 0, done_at = NULL WHERE id = $1", [id]);
}

export async function snoozeTask(id: number, days: number) {
  const t = await q1<{ due_date: string }>("SELECT due_date FROM tasks WHERE id = $1", [id]);
  if (!t) return;
  const base = t.due_date < todayISO() ? todayISO() : t.due_date;
  await q("UPDATE tasks SET due_date = $1 WHERE id = $2", [addDays(base, days), id]);
}

export async function createTask(t: { customer_id: number | null; title: string; note?: string; due_date: string; kind?: TaskKind }) {
  await addTasks([{ kind: t.kind ?? "manual", title: t.title, note: t.note ?? "", due_date: t.due_date }], { customer_id: t.customer_id });
}

export async function moveLead(id: number, status: string) {
  await q("UPDATE leads SET status = $1, updated_at = $2 WHERE id = $3", [status, nowTs(), id]);
}

export function leadById(id: number): Promise<LeadRow | null> {
  return q1<LeadRow>(
    `SELECT l.*, TRIM(v.brand || ' ' || v.model || ' ' || v.version) AS vehicle_title FROM leads l LEFT JOIN vehicles v ON v.id = l.vehicle_id WHERE l.id = $1`,
    [id],
  );
}

export async function linkLeadToCustomer(leadId: number, customerId: number) {
  await q("UPDATE leads SET customer_id = $1, status = 'ganho', updated_at = $2 WHERE id = $3", [customerId, nowTs(), leadId]);
}

// Vendas financiadas cujo contrato termina dentro da janela: oportunidade de renovação.
export async function renewalOpportunities(windowDays: number): Promise<(SaleRow & { end: string; daysLeft: number })[]> {
  const today = todayISO();
  return (await allSales())
    .filter((s) => s.months > 0)
    .map((s) => { const end = financingEnd(s) as string; return { ...s, end, daysLeft: daysUntil(end, today) }; })
    .filter((s) => s.daysLeft <= windowDays && s.daysLeft >= -30)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
