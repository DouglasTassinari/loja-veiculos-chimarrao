import "server-only";
import { getDb } from "./db";
import { analyze, alerts, nextAction, parsePhotos, type VehicleRow, type Analysis, type Alert, type Status } from "./finance";

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

function extraCostMap(): Map<number, number> {
  const rows = getDb().prepare("SELECT vehicle_id, SUM(amount) AS s FROM costs GROUP BY vehicle_id").all() as { vehicle_id: number; s: number }[];
  return new Map(rows.map((r) => [r.vehicle_id, r.s]));
}

function toView(v: VehicleRow, extra: number): VehicleView {
  const photoList = parsePhotos(v);
  const analysis = analyze(v, extra);
  return { ...v, photoList, analysis, alertList: alerts(v, analysis, photoList.length), action: nextAction(v, analysis, photoList.length) };
}

export function allVehicles(): VehicleView[] {
  const extra = extraCostMap();
  const rows = getDb().prepare("SELECT * FROM vehicles ORDER BY id DESC").all() as unknown as VehicleRow[];
  return rows.map((v) => toView(v, extra.get(v.id) ?? 0));
}

export function vehicleById(id: number): VehicleView | null {
  const v = getDb().prepare("SELECT * FROM vehicles WHERE id = ?").get(id) as unknown as VehicleRow | undefined;
  if (!v) return null;
  return toView(v, extraCostMap().get(id) ?? 0);
}

export function vehicleBySlug(slug: string): VehicleView | null {
  const v = getDb().prepare("SELECT * FROM vehicles WHERE slug = ?").get(slug) as unknown as VehicleRow | undefined;
  if (!v) return null;
  return toView(v, extraCostMap().get(v.id) ?? 0);
}

export type StoreFilter = { q?: string; brand?: string; body?: string; maxPrice?: number; trans?: string; sort?: string };

// Vitrine pública: só o que está publicado. Vendidos ficam visíveis (prova de giro), sem preço.
export function publicVehicles(f: StoreFilter = {}): VehicleView[] {
  let list = allVehicles().filter((v) => v.published || v.status === "vendido");
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter((v) => `${v.brand} ${v.model} ${v.version} ${v.body} ${v.year_model}`.toLowerCase().includes(q));
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

export function costsOf(vehicleId: number): CostRow[] {
  return getDb().prepare("SELECT * FROM costs WHERE vehicle_id = ? ORDER BY date DESC, id DESC").all(vehicleId) as unknown as CostRow[];
}

export function addCost(vehicleId: number, category: string, description: string, amount: number, date: string) {
  getDb().prepare("INSERT INTO costs (vehicle_id, category, description, amount, date) VALUES (?,?,?,?,?)").run(vehicleId, category, description, amount, date);
}

export function deleteCost(id: number) {
  getDb().prepare("DELETE FROM costs WHERE id = ?").run(id);
}

export type NewVehicle = {
  plate: string; brand: string; model: string; version: string; body: string; year_fab: number; year_model: number;
  km: number; fuel: string; transmission: string; color: string; engine: string; purchase_price: number;
  purchase_date: string; asking_price: number; fipe_price: number | null;
};

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function createVehicle(v: NewVehicle): number {
  const db = getDb();
  const slug = `${slugify(`${v.brand} ${v.model} ${v.version} ${v.year_model}`)}-${Date.now().toString(36)}`;
  const r = db.prepare(`
    INSERT INTO vehicles (slug, plate, brand, model, version, body, year_fab, year_model, km, fuel, transmission, color, engine,
      description, status, published, purchase_price, purchase_date, asking_price, fipe_price, min_price, photos)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'preparacao',0,?,?,?,?,?,'[]')
  `).run(
    slug, v.plate.toUpperCase(), v.brand, v.model, v.version, v.body, v.year_fab, v.year_model, v.km, v.fuel,
    v.transmission, v.color, v.engine, `${v.brand} ${v.model} ${v.version}, ${v.km.toLocaleString("pt-BR")} km.`,
    v.purchase_price, v.purchase_date, v.asking_price, v.fipe_price, Math.round(v.asking_price * 0.96),
  );
  return Number(r.lastInsertRowid);
}

export function updateVehicle(id: number, f: { asking_price?: number; fipe_price?: number | null; min_price?: number | null; status?: Status; published?: boolean; description?: string; photos?: string[]; single_owner?: boolean; inspected?: boolean; factory_warranty_until?: number | null }) {
  const db = getDb();
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  const add = (col: string, val: string | number | null) => { sets.push(`${col} = ?`); vals.push(val); };
  if (f.asking_price !== undefined) add("asking_price", f.asking_price);
  if (f.fipe_price !== undefined) add("fipe_price", f.fipe_price);
  if (f.min_price !== undefined) add("min_price", f.min_price);
  if (f.status !== undefined) {
    add("status", f.status);
    if (f.status === "disponivel") sets.push("ready_date = COALESCE(ready_date, date('now'))");
  }
  if (f.published !== undefined) add("published", f.published ? 1 : 0);
  if (f.description !== undefined) add("description", f.description);
  if (f.photos !== undefined) add("photos", JSON.stringify(f.photos));
  if (f.single_owner !== undefined) add("single_owner", f.single_owner ? 1 : 0);
  if (f.inspected !== undefined) add("inspected", f.inspected ? 1 : 0);
  if (f.factory_warranty_until !== undefined) add("factory_warranty_until", f.factory_warranty_until);
  if (!sets.length) return;
  db.prepare(`UPDATE vehicles SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

export function sellVehicle(id: number, price: number, date: string, commission: number) {
  const db = getDb();
  db.prepare("UPDATE vehicles SET status='vendido', published=0, sale_price=?, sale_date=? WHERE id=?").run(price, date, id);
  if (commission > 0) addCost(id, "Comissão", "Comissão do vendedor", commission, date);
}

export function createLead(l: { vehicle_id: number | null; name: string; phone: string; message: string; source: string }) {
  getDb().prepare("INSERT INTO leads (vehicle_id, name, phone, message, source) VALUES (?,?,?,?,?)").run(l.vehicle_id, l.name, l.phone, l.message, l.source);
}

export function leads(): LeadRow[] {
  return getDb().prepare(`
    SELECT l.*, TRIM(v.brand || ' ' || v.model || ' ' || v.version) AS vehicle_title
    FROM leads l LEFT JOIN vehicles v ON v.id = l.vehicle_id ORDER BY l.id DESC
  `).all() as unknown as LeadRow[];
}

export function setLeadStatus(id: number, status: string) {
  getDb().prepare("UPDATE leads SET status = ? WHERE id = ?").run(status, id);
}

export function cashEntries(): CashRow[] {
  return getDb().prepare("SELECT * FROM cash_entries ORDER BY due_date ASC, id ASC").all() as unknown as CashRow[];
}

export function addCashEntry(e: { kind: "receber" | "pagar"; description: string; amount: number; due_date: string }) {
  getDb().prepare("INSERT INTO cash_entries (kind, description, amount, due_date) VALUES (?,?,?,?)").run(e.kind, e.description, e.amount, e.due_date);
}

export function toggleCashPaid(id: number) {
  getDb().prepare("UPDATE cash_entries SET paid = 1 - paid WHERE id = ?").run(id);
}

export function leadsByVehicle(): Map<number, number> {
  const rows = getDb().prepare("SELECT vehicle_id, COUNT(*) AS n FROM leads WHERE vehicle_id IS NOT NULL GROUP BY vehicle_id").all() as { vehicle_id: number; n: number }[];
  return new Map(rows.map((r) => [r.vehicle_id, r.n]));
}
