import { leads } from "@/lib/data";
import { hoursSince } from "@/lib/finance";
import { store } from "@/lib/config";
import { waLinkTo } from "@/lib/crm";
import Kanban, { type KCard } from "../../Kanban";

export const dynamic = "force-dynamic";
export const metadata = { title: "Funil de leads" };

function age(ts: string): string {
  const h = Math.floor(hoursSince(ts));
  return h < 1 ? "agora há pouco" : h < 24 ? `há ${h}h` : `há ${Math.floor(h / 24)}d`;
}

export default async function Leads() {
  const all = await leads();
  const sources = Object.entries(all.reduce<Record<string, number>>((m, l) => ((m[l.source] = (m[l.source] ?? 0) + 1), m), {}));
  const cards: KCard[] = all.map((l) => {
    const since = l.updated_at || l.created_at;
    const hours = hoursSince(since);
    return {
      id: l.id, name: l.name, phone: l.phone, vehicle: l.vehicle_title ?? null, vehicleId: l.vehicle_id, message: l.message.slice(0, 120), source: l.source, status: l.status,
      wa: waLinkTo(l.phone, `Oi, ${l.name.split(" ")[0]}! Aqui é da ${store.short}. Recebi o seu contato${l.vehicle_title ? ` sobre o ${l.vehicle_title}` : ""}. Como posso te ajudar?`),
      age: age(since), stale: !["ganho", "perdido"].includes(l.status) && hours > 48,
    };
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Funil de leads</h1>
        <p className="text-sm text-slate-600">Origem: {sources.map(([s, n]) => `${s} (${n})`).join(" · ") || "—"} · {all.length} no total</p>
      </div>
      <Kanban cards={cards} />
    </div>
  );
}
