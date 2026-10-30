"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkPassword, endSession, requireSession, startSession } from "@/lib/auth";
import {
  addCashEntry, addCost, appendLeadMessage, createLead, createVehicle, deleteCost, findRecentLead, sellVehicle,
  toggleCashPaid, updateVehicle, vehicleById,
} from "@/lib/data";
import {
  addTasks, completeTask, createCustomer, createSale, createTask, findCustomerByPhone, linkLeadToCustomer, moveLead, reopenTask,
  snoozeTask, updateCustomer,
} from "@/lib/crm-data";
import { STAGES, buildSaleTasks } from "@/lib/crm";
import { FALLBACK_RATES, installment, iofRate } from "@/lib/financing";
import { normalizePhone, validName } from "@/lib/phone";
import { todayISO, vehicleTitle, type Status } from "@/lib/finance";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const raw = str(f, k).replace(/\./g, "").replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};
const today = () => todayISO();

// ---------- público ----------
export async function submitLead(f: FormData) {
  const name = str(f, "name");
  const phone = str(f, "phone");
  const raw = str(f, "back");
  const back = /^\/(veiculo\/[a-z0-9-]+|contato)$/.test(raw) ? raw : "/estoque"; // evita redirecionamento aberto
  const nm = validName(name);
  const ph = normalizePhone(phone);
  if (!nm || !ph || f.get("consent") !== "on") redirect(`${back}?erro=1`);
  const vid = Number(str(f, "vehicle_id")) || null;
  const source = str(f, "source") === "contato" ? "contato" : "site";
  const existing = await findRecentLead(ph, vid, source);
  const message = str(f, "message").slice(0, 500);
  if (existing) await appendLeadMessage(existing, message || "Enviou o formulário de novo.");
  else await createLead({ vehicle_id: vid, name: nm, phone: ph, message, source });
  revalidatePath("/erp/leads");
  redirect(`${back}?enviado=1`);
}

// ---------- ERP ----------
export async function login(f: FormData) {
  if (!checkPassword(str(f, "password"))) redirect("/erp/login?erro=1");
  await startSession();
  redirect("/erp");
}

export async function logout() {
  await endSession();
  redirect("/erp/login");
}

export async function newVehicle(f: FormData) {
  await requireSession();
  const id = await createVehicle({
    plate: str(f, "plate"), brand: str(f, "brand"), model: str(f, "model"), version: str(f, "version"),
    body: str(f, "body") || "Hatch", year_fab: num(f, "year_fab"), year_model: num(f, "year_model"),
    km: num(f, "km"), fuel: str(f, "fuel") || "Flex", transmission: str(f, "transmission") || "Manual",
    color: str(f, "color"), engine: str(f, "engine"), purchase_price: num(f, "purchase_price"),
    purchase_date: str(f, "purchase_date") || today(), asking_price: num(f, "asking_price"),
    fipe_price: num(f, "fipe_price") || null, kind: str(f, "kind") === "moto" ? "moto" : "carro",
  });
  revalidatePath("/erp");
  redirect(`/erp/veiculos/${id}`);
}

export async function saveVehicle(f: FormData) {
  await requireSession();
  const id = Number(str(f, "id"));
  await updateVehicle(id, {
    asking_price: num(f, "asking_price"),
    fipe_price: num(f, "fipe_price") || null,
    min_price: num(f, "min_price") || null,
    status: str(f, "status") as Status,
    published: f.get("published") === "on",
    single_owner: f.get("single_owner") === "on",
    inspected: f.get("inspected") === "on",
    featured: f.get("featured") === "on",
    factory_warranty_until: num(f, "factory_warranty_until") || null,
    description: str(f, "description"),
    photos: str(f, "photos").split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
  });
  revalidatePath("/erp", "layout");
  revalidatePath("/", "layout");
  redirect(`/erp/veiculos/${id}?salvo=1`);
}

export async function addVehicleCost(f: FormData) {
  await requireSession();
  const id = Number(str(f, "vehicle_id"));
  const amount = num(f, "amount");
  if (amount > 0) await addCost(id, str(f, "category") || "Outros", str(f, "description"), amount, str(f, "date") || today());
  revalidatePath("/erp", "layout");
  redirect(`/erp/veiculos/${id}`);
}

export async function removeCost(f: FormData) {
  await requireSession();
  await deleteCost(Number(str(f, "cost_id")));
  revalidatePath("/erp", "layout");
  redirect(`/erp/veiculos/${str(f, "vehicle_id")}`);
}

// ---------- CRM ----------
const STAGE_KEYS = new Set<string>(STAGES.map((s) => s.key));

// Chamada direta do quadro (arrastar e soltar), sem formulário.
export async function moveLeadAction(id: number, status: string): Promise<{ ok: boolean }> {
  await requireSession();
  if (!Number.isInteger(id) || !STAGE_KEYS.has(status)) return { ok: false };
  await moveLead(id, status);
  revalidatePath("/erp", "layout");
  return { ok: true };
}

// Só volta para páginas internas conhecidas (evita redirecionamento aberto).
const safeNext = (raw: string, fallback: string) => (/^\/erp(\/(tarefas|clientes(\/\d+)?|vendas|leads))?$/.test(raw) ? raw : fallback);

export async function registerSaleFull(f: FormData) {
  await requireSession();
  const vehicleId = Number(str(f, "vehicle_id"));
  const v = await vehicleById(vehicleId);
  const price = num(f, "sale_price");
  const name = validName(str(f, "customer_name"));
  const phone = normalizePhone(str(f, "customer_phone"));
  const back = `/erp/vendas/nova?vehicle=${vehicleId}${str(f, "lead_id") ? `&lead=${Number(str(f, "lead_id"))}` : ""}`;
  if (!v || v.status === "vendido" || price <= 0 || !name || !phone) redirect(`${back}&erro=1`);

  const date = str(f, "sale_date") || today();
  const payment = ["avista", "financiado", "troca", "troca_financiado"].includes(str(f, "payment")) ? str(f, "payment") : "avista";
  const financing = payment === "financiado" || payment === "troca_financiado";
  const down = financing || payment === "troca" ? num(f, "down") : price;
  const tradeValue = payment.startsWith("troca") ? num(f, "trade_value") : 0;
  const months = financing ? Math.min(Math.max(Math.round(num(f, "months")), 6), 84) : 0;
  const base = financing ? Math.max(price - down - tradeValue, 0) : 0;
  let parcel = financing ? num(f, "parcel") : 0;
  if (financing && parcel <= 0 && base > 0) parcel = installment(base * (1 + iofRate(months)), FALLBACK_RATES.ref, months);

  const customer = (await findCustomerByPhone(phone)) ?? { id: await createCustomer({ name, phone, source: str(f, "lead_id") ? "site" : "loja" }) };
  await sellVehicle(vehicleId, price, date, num(f, "commission"));
  const title = `${vehicleTitle(v)} ${v.year_model}`;
  const saleId = await createSale({
    vehicle_id: vehicleId, vehicle_title: title, customer_id: customer.id, lead_id: Number(str(f, "lead_id")) || null, sale_date: date, price,
    payment, down, financed: base, months, parcel, bank: financing ? str(f, "bank").slice(0, 60) : "",
    trade_desc: payment.startsWith("troca") ? str(f, "trade_desc").slice(0, 160) : "", trade_value: tradeValue, notes: str(f, "notes").slice(0, 400),
  });
  await addTasks(buildSaleTasks({ sale_date: date, payment, months, vehicle_title: title, price }), { customer_id: customer.id, vehicle_id: vehicleId, sale_id: saleId });
  const leadId = Number(str(f, "lead_id"));
  if (leadId) await linkLeadToCustomer(leadId, customer.id);
  revalidatePath("/erp", "layout");
  revalidatePath("/", "layout");
  redirect(`/erp/clientes/${customer.id}?venda=1`);
}

export async function newCustomerAction(f: FormData) {
  await requireSession();
  const name = validName(str(f, "name"));
  const phone = normalizePhone(str(f, "phone"));
  if (!name || !phone) redirect("/erp/clientes/novo?erro=1");
  const existing = await findCustomerByPhone(phone);
  const id = existing?.id ?? (await createCustomer({ name, phone, email: str(f, "email").slice(0, 120), birthday: str(f, "birthday"), notes: str(f, "notes").slice(0, 600), source: "loja" }));
  revalidatePath("/erp", "layout");
  redirect(`/erp/clientes/${id}`);
}

export async function saveCustomerAction(f: FormData) {
  await requireSession();
  const id = Number(str(f, "id"));
  await updateCustomer(id, { name: validName(str(f, "name")) ?? undefined, email: str(f, "email").slice(0, 120), birthday: str(f, "birthday"), notes: str(f, "notes").slice(0, 1200) });
  revalidatePath("/erp", "layout");
  redirect(`/erp/clientes/${id}?salvo=1`);
}

export async function addTaskAction(f: FormData) {
  await requireSession();
  const title = str(f, "title").slice(0, 140);
  const cid = Number(str(f, "customer_id")) || null;
  if (title) await createTask({ customer_id: cid, title, note: str(f, "note").slice(0, 400), due_date: str(f, "due_date") || today() });
  revalidatePath("/erp", "layout");
  redirect(safeNext(str(f, "next"), "/erp/tarefas"));
}

export async function completeTaskAction(f: FormData) {
  await requireSession();
  await completeTask(Number(str(f, "id")));
  revalidatePath("/erp", "layout");
  redirect(safeNext(str(f, "next"), "/erp/tarefas"));
}

export async function reopenTaskAction(f: FormData) {
  await requireSession();
  await reopenTask(Number(str(f, "id")));
  revalidatePath("/erp", "layout");
  redirect(safeNext(str(f, "next"), "/erp/tarefas"));
}

export async function snoozeTaskAction(f: FormData) {
  await requireSession();
  await snoozeTask(Number(str(f, "id")), Math.min(Math.max(Number(str(f, "days")) || 1, 1), 365));
  revalidatePath("/erp", "layout");
  redirect(safeNext(str(f, "next"), "/erp/tarefas"));
}

export async function newCashEntry(f: FormData) {
  await requireSession();
  const amount = num(f, "amount");
  if (amount > 0) {
    await addCashEntry({
      kind: str(f, "kind") === "receber" ? "receber" : "pagar",
      description: str(f, "description") || "Lançamento", amount, due_date: str(f, "due_date") || today(),
    });
  }
  revalidatePath("/erp", "layout");
  redirect("/erp/caixa");
}

export async function payCashEntry(f: FormData) {
  await requireSession();
  await toggleCashPaid(Number(str(f, "id")));
  revalidatePath("/erp", "layout");
  redirect("/erp/caixa");
}
