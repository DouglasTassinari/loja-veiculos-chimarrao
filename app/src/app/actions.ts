"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkPassword, endSession, requireSession, startSession } from "@/lib/auth";
import {
  addCashEntry, addCost, createLead, createVehicle, deleteCost, sellVehicle, setLeadStatus,
  toggleCashPaid, updateVehicle,
} from "@/lib/data";
import { todayISO, type Status } from "@/lib/finance";

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
  const back = /^\/veiculo\/[a-z0-9-]+$/.test(raw) ? raw : "/estoque"; // evita redirecionamento aberto
  if (name.length < 2 || phone.replace(/\D/g, "").length < 10) redirect(`${back}?erro=1`);
  const vid = Number(str(f, "vehicle_id")) || null;
  createLead({ vehicle_id: vid, name: name.slice(0, 100), phone: phone.slice(0, 30), message: str(f, "message").slice(0, 500), source: "site" });
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
  const id = createVehicle({
    plate: str(f, "plate"), brand: str(f, "brand"), model: str(f, "model"), version: str(f, "version"),
    body: str(f, "body") || "Hatch", year_fab: num(f, "year_fab"), year_model: num(f, "year_model"),
    km: num(f, "km"), fuel: str(f, "fuel") || "Flex", transmission: str(f, "transmission") || "Manual",
    color: str(f, "color"), engine: str(f, "engine"), purchase_price: num(f, "purchase_price"),
    purchase_date: str(f, "purchase_date") || today(), asking_price: num(f, "asking_price"),
    fipe_price: num(f, "fipe_price") || null,
  });
  revalidatePath("/erp");
  redirect(`/erp/veiculos/${id}`);
}

export async function saveVehicle(f: FormData) {
  await requireSession();
  const id = Number(str(f, "id"));
  updateVehicle(id, {
    asking_price: num(f, "asking_price"),
    fipe_price: num(f, "fipe_price") || null,
    min_price: num(f, "min_price") || null,
    status: str(f, "status") as Status,
    published: f.get("published") === "on",
    single_owner: f.get("single_owner") === "on",
    inspected: f.get("inspected") === "on",
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
  if (amount > 0) addCost(id, str(f, "category") || "Outros", str(f, "description"), amount, str(f, "date") || today());
  revalidatePath("/erp", "layout");
  redirect(`/erp/veiculos/${id}`);
}

export async function removeCost(f: FormData) {
  await requireSession();
  deleteCost(Number(str(f, "cost_id")));
  revalidatePath("/erp", "layout");
  redirect(`/erp/veiculos/${str(f, "vehicle_id")}`);
}

export async function registerSale(f: FormData) {
  await requireSession();
  const id = Number(str(f, "vehicle_id"));
  const price = num(f, "sale_price");
  if (price > 0) sellVehicle(id, price, str(f, "sale_date") || today(), num(f, "commission"));
  revalidatePath("/erp", "layout");
  revalidatePath("/", "layout");
  redirect(`/erp/veiculos/${id}`);
}

export async function changeLead(f: FormData) {
  await requireSession();
  setLeadStatus(Number(str(f, "id")), str(f, "status"));
  revalidatePath("/erp/leads");
  redirect("/erp/leads");
}

export async function newCashEntry(f: FormData) {
  await requireSession();
  const amount = num(f, "amount");
  if (amount > 0) {
    addCashEntry({
      kind: str(f, "kind") === "receber" ? "receber" : "pagar",
      description: str(f, "description") || "Lançamento", amount, due_date: str(f, "due_date") || today(),
    });
  }
  revalidatePath("/erp", "layout");
  redirect("/erp/caixa");
}

export async function payCashEntry(f: FormData) {
  await requireSession();
  toggleCashPaid(Number(str(f, "id")));
  revalidatePath("/erp", "layout");
  redirect("/erp/caixa");
}
