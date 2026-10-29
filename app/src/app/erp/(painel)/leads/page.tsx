import { leads } from "@/lib/data";
import { changeLead } from "../../../actions";
import { Card } from "../../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads" };

const stages: [string, string][] = [["novo", "Novo"], ["contatado", "Contatado"], ["negociacao", "Negociação"], ["ganho", "Ganho"], ["perdido", "Perdido"]];

function ago(created: string): string {
  const h = Math.floor((Date.now() - new Date(created.replace(" ", "T") + "Z").getTime()) / 3600e3);
  return h < 1 ? "agora há pouco" : h < 24 ? `há ${h}h` : `há ${Math.floor(h / 24)}d`;
}

export default async function Leads() {
  const all = await leads();
  const sources = Object.entries(all.reduce<Record<string, number>>((m, l) => ((m[l.source] = (m[l.source] ?? 0) + 1), m), {}));
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-ink">Leads</h1>
      <p className="text-sm text-slate-600">Origem: {sources.map(([s, n]) => `${s} (${n})`).join(" · ") || "—"}</p>
      <div className="grid gap-4 lg:grid-cols-5">
        {stages.map(([k, label]) => {
          const col = all.filter((l) => l.status === k);
          return (
            <Card key={k} title={`${label} · ${col.length}`} className="!p-3">
              <div className="space-y-3">
                {col.map((l) => (
                  <div key={l.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <p className="font-bold text-ink">{l.name}</p>
                    <a href={`https://wa.me/55${l.phone.replace(/\D/g, "")}`} target="_blank" className="text-brand hover:underline">{l.phone}</a>
                    {l.vehicle_title && <p className="mt-1 text-xs text-slate-600">{l.vehicle_title}</p>}
                    {l.message && <p className="mt-1 text-xs italic text-slate-500">“{l.message}”</p>}
                    <p className="mt-1 text-[11px] text-slate-400">{l.source} · {ago(l.created_at)}</p>
                    <form action={changeLead} className="mt-2">
                      <input type="hidden" name="id" value={l.id} />
                      <select name="status" defaultValue={l.status} className="!py-1 text-xs" aria-label="Mover lead">
                        {stages.map(([s, n]) => <option key={s} value={s}>{n}</option>)}
                      </select>
                      <button className="mt-1 w-full rounded-md bg-slate-100 py-1 text-xs font-semibold hover:bg-slate-200">Mover</button>
                    </form>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
