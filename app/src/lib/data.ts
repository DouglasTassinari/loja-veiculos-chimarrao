import "server-only";
import { q, q1 } from "./db";
import { analyze, alerts, nextAction, nowTs, parsePhotos, todayISO, type VehicleRow, type Analysis, type Alert, type Status } from "./finance";

export type CostRow = { id: number; vehicle_id: number; category: string; description: string; amount: number; date: string };
export type LeadRow = {
  id: number; vehicle_id: number | null; name: string; phone: string; message: string;
  source: string; status: string; created_at: string; vehicle_title?: string | null;
};
export type CashRow = { id: number; kind: "receber" | "pagar"; description: string; amount: number; due_date: string; paid: number; vehicle_id: number | null };

export type VehicleView = VehicleRow & {
  photoList: string[];
  analysis: Analysis;
  alertList: Alert[];
  action: string | null;
};

async function extraCostMap(): Promise<Map<number, number>> {
  const rows = await q<{ vehicle_id: number; s: number }>("SELECT vehicle_id, SUM(amount) AS s FROM costs GROUP BY vehicle_id");
  return new Map(rows.map((r) => [Number(r.vehicle_id), Number(r.s)]));
}

function toView(v: VehicleRow, extra: number): VehicleView {
  const photoList = parsePhotos(v);
  const analysis = analyze(v, extra);
  return { ...v, photoList, analysis, alertList: alerts(v, analysis, photoList.length), action: nextAction(v, analysis, photoList.length) };
}

export async function allVehicles(): Promise<VehicleView[]> {
  const [extra, rows] = await Promise.all([extraCostMap(), q<VehicleRow>("SELECT * FROM vehicles ORDER BY id DESC")]);
  return rows.map((v) => toView(v, extra.get(v.id) ?? 0));
}

export async function vehicleById(id: number): Promise<VehicleView | null> {
  const v = await q1<VehicleRow>("SELECT * FROM vehicles WHERE id = $1", [id]);
  if (!v) return null;
  return toView(v, (await extraCostMap()).get(id) ?? 0);
}

export async function vehicleBySlug(slug: string): Promise<VehicleView | null> {
  const v = await q1<VehicleRow>("SELECT * FROM vehicles WHERE slug = $1", [slug]);
  if (!v) return null;
  return toView(v, (await extraCostMap()).get(v.id) ?? 0);
}

export type StoreFilter = { q?: string; brand?: string; body?: string; maxPrice?: number; trans?: string; sort?: string };

// Vitrine pública: só o que está publicado. Vendidos ficam visíveis (prova de giro), sem preço.
export async function publicVehicles(f: StoreFilter = {}): Promise<VehicleView[]> {
  let list = (await allVehicles()).filter((v) => v.published || v.status === "vendido");
  if (f.q) {
    const term = f.q.toLowerCase();
    list = list.filter((v) => `${v.brand} ${v.model} ${v.version} ${v.body} ${v.year_model}`.toLowerCase().includes(term));
  }
  if (f.brand) list = list.filter((v) => v.brand === f.brand);
  if (f.body) list = list.filter((v) => v.body === f.body);
  if (f.trans) list = list.filter((v) => v.transmission === f.trans);
  if (f.maxPrice) list = list.filter((v) => v.asking_price <= f.maxPrice!);
  const avail = (v: VehicleView) => (v.status === "vendido" ? 1 : 0);
  const sorters: Record<string, (a: VehicleView, b: VehicleView) => number> = {
    "menor-preco": (a, b) => a.asking_price - b.asking_price,
    "maior-preco": (a, b) => b.asking_price - a.asking_price,
    "mais-novos": (a, b) => b.year_model - a.year_model,
    "menor-km": (a, b) => a.km - b.km,
  };
  const s = sorters[f.sort ?? ""];
  return list.sort((a, b) => avail(a) - avail(b) || (s ? s(a, b) : b.id - a.id));
}

export function costsOf(vehicleId: number): Promise<CostRow[]> {
  return q<CostRow>("SELECT * FROM costs WHERE vehicle_id = $1 ORDER BY date DESC, id DESC", [vehicleId]);
}

export async function addCost(vehicleId: number, category: string, description: string, amount: number, date: string) {
  await q("INSERT INTO costs (vehicle_id, category, description, amount, date) VALUES ($1,$2,$3,$4,$5)", [vehicleId, category, description, amount, date]);
}

export async function deleteCost(id: number) {
  await q("DELETE FROM costs WHERE id = $1", [id]);
}

export type NewVehicle = {
  plate: string; brand: string; model: string; version: string; body: string; year_fab: number; year_model: number;
  km: number; fuel: string; transmission: string; color: string; engine: string; purchase_price: number;
  purchase_date: string; asking_price: number; fipe_price: number | null;
};

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createVehicle(v: NewVehicle): Promise<number> {
  const slug = `${slugify(`${v.brand} ${v.model} ${v.version} ${v.year_model}`)}-${Date.now().toString(36)}`;
  const [row] = await q<{ id: number }>(
    `INSERT INTO vehicles (slug, plate, brand, model, version, body, year_fab, year_model, km, fuel, transmission, color, engine,
       description, status, published, purchase_price, purchase_date, asking_price, fipe_price, min_price, photos, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'preparacao',0,$15,$16,$17,$18,$19,'[]',$20)
     RETURNING id`,
    [
      slug, v.plate.toUpperCase(), v.brand, v.model, v.version, v.body, v.year_fab, v.year_model, v.km, v.fuel,
      v.transmission, v.color, v.engine, `${v.brand} ${v.model} ${v.version}, ${v.km.toLocaleString("pt-BR")} km.`,
      v.purchase_price, v.purchase_date, v.asking_price, v.fipe_price, Math.round(v.asking_price * 0.96), nowTs(),
    ],
  );
  return Number(row.id);
}

export async function updateVehicle(id: number, f: { asking_price?: number; fipe_price?: number | null; min_price?: number | null; status?: Status; published?: boolean; description?: string; photos?: string[]; single_owner?: boolean; inspected?: boolean; factory_warranty_until?: number | null }) {
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  const add = (col: string, val: string | number | null) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
  if (f.asking_price !== undefined) add("asking_price", f.asking_price);
  if (f.fipe_price !== undefined) add("fipe_price", f.fipe_price);
  if (f.min_price !== undefined) add("min_price", f.min_price);
  if (f.status !== undefined) {
    add("status", f.status);
    if (f.status === "disponivel") { vals.push(todayISO()); sets.push(`ready_date = COALESCE(ready_date, $${vals.length})`); }
  }
  if (f.published !== undefined) add("published", f.published ? 1 : 0);
  if (f.description !== undefined) add("description", f.description);
  if (f.photos !== undefined) add("photos", JSON.stringify(f.photos));
  if (f.single_owner !== undefined) add("single_owner", f.single_owner ? 1 : 0);
  if (f.inspected !== undefined) add("inspected", f.inspected ? 1 : 0);
  if (f.factory_warranty_until !== undefined) add("factory_warranty_until", f.factory_warranty_until);
  if (!sets.length) return;
  vals.push(id);
  await q(`UPDATE vehicles SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);
}

export async function sellVehicle(id: number, price: number, date: string, commission: number) {
  await q("UPDATE vehicles SET status='vendido', published=0, sale_price=$1, sale_date=$2 WHERE id=$3", [price, date, id]);
  if (commission > 0) await addCost(id, "Comissão", "Comissão do vendedor", commission, date);
}

export async function createLead(l: { vehicle_id: number | null; name: string; phone: string; message: string; source: string }) {
  await q("INSERT INTO leads (vehicle_id, name, phone, message, source, created_at) VALUES ($1,$2,$3,$4,$5,$6)", [l.vehicle_id, l.name, l.phone, l.message, l.source, nowTs()]);
}

export function leads(): Promise<LeadRow[]> {
  return q<LeadRow>(`
    SELECT l.*, TRIM(v.brand || ' ' || v.model || ' ' || v.version) AS vehicle_title
    FROM leads l LEFT JOIN vehicles v ON v.id = l.vehicle_id ORDER BY l.id DESC
  `);
}

export async function setLeadStatus(id: number, status: string) {
  await q("UPDATE leads SET status = $1 WHERE id = $2", [status, id]);
}

export function cashEntries(): Promise<CashRow[]> {
  return q<CashRow>("SELECT * FROM cash_entries ORDER BY due_date ASC, id ASC");
}

export async function addCashEntry(e: { kind: "receber" | "pagar"; description: string; amount: number; due_date: string }) {
  await q("INSERT INTO cash_entries (kind, description, amount, due_date) VALUES ($1,$2,$3,$4)", [e.kind, e.description, e.amount, e.due_date]);
}

export async function toggleCashPaid(id: number) {
  await q("UPDATE cash_entries SET paid = 1 - paid WHERE id = $1", [id]);
}

export async function leadsByVehicle(): Promise<Map<number, number>> {
  const rows = await q<{ vehicle_id: number; n: number }>("SELECT vehicle_id, CAST(COUNT(*) AS INTEGER) AS n FROM leads WHERE vehicle_id IS NOT NULL GROUP BY vehicle_id");
  return new Map(rows.map((r) => [Number(r.vehicle_id), Number(r.n)]));
}
