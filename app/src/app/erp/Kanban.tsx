"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STAGES } from "@/lib/crm";
import { moveLeadAction } from "../actions";

export type KCard = {
  id: number; name: string; phone: string; wa: string; vehicle: string | null; vehicleId: number | null; message: string; source: string;
  status: string; age: string; stale: boolean;
};

const stageStyle: Record<string, string> = {
  novo: "border-t-slate-400", contatado: "border-t-sky-500", visita: "border-t-violet-500", proposta: "border-t-amber-500",
  negociacao: "border-t-orange-500", ganho: "border-t-emerald-600", perdido: "border-t-red-500",
};

export default function Kanban({ cards }: { cards: KCard[] }) {
  const router = useRouter();
  const [items, setItems] = useState(cards);
  const [over, setOver] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function move(id: number, status: string) {
    const card = items.find((c) => c.id === id);
    if (!card || card.status === status) return;
    setItems(items.map((c) => (c.id === id ? { ...c, status, age: "agora", stale: false } : c)));
    setError("");
    start(async () => {
      try {
        const r = await moveLeadAction(id, status);
        if (!r.ok) throw new Error("recusado");
        router.refresh();
      } catch {
        // sem rede ou servidor fora do ar: o cartão volta para onde estava e o usuário é avisado
        setItems((cur) => cur.map((c) => (c.id === id ? card : c)));
        setError("Não foi possível mover o lead. Tente de novo.");
      }
    });
  }

  return (
    <div>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-3" aria-busy={pending}>
        {STAGES.map((s) => {
          const col = items.filter((c) => c.status === s.key);
          return (
            <section
              key={s.key}
              aria-label={`${s.label}: ${col.length} leads`}
              onDragOver={(e) => { e.preventDefault(); setOver(s.key); }}
              onDragLeave={() => setOver((o) => (o === s.key ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = drag ?? Number(e.dataTransfer.getData("text/plain")); if (id) move(id, s.key); setDrag(null); }}
              className={`w-64 shrink-0 rounded-2xl border border-t-4 border-sand bg-white p-2.5 ${stageStyle[s.key]} ${over === s.key ? "ring-2 ring-brand" : ""}`}
            >
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-extrabold text-ink">{s.label}</h2>
                <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-bold text-brand">{col.length}</span>
              </div>
              <p className="mb-2 px-1 text-[11px] text-slate-500">{s.hint}</p>
              <div className="min-h-16 space-y-2">
                {col.map((c) => (
                  <article
                    key={c.id}
                    draggable
                    onDragStart={(e) => { setDrag(c.id); e.dataTransfer.setData("text/plain", String(c.id)); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => setDrag(null)}
                    className={`cursor-grab rounded-xl border bg-paper p-2.5 text-sm active:cursor-grabbing ${c.stale ? "border-red-300" : "border-sand"} ${drag === c.id ? "opacity-50" : ""}`}
                  >
                    <p className="font-extrabold text-ink">{c.name}</p>
                    <a href={c.wa} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand hover:underline">{c.phone}</a>
                    {c.vehicle && <p className="mt-1 text-xs text-slate-600">{c.vehicle}</p>}
                    {c.message && <p className="mt-1 line-clamp-2 text-xs italic text-slate-500">“{c.message}”</p>}
                    <p className={`mt-1 text-[11px] ${c.stale ? "font-bold text-red-600" : "text-slate-500"}`}>{c.source} · {c.age}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <select aria-label={`Mover ${c.name} para outra etapa`} value={c.status} onChange={(e) => move(c.id, e.target.value)} className="!w-auto flex-1 !py-1 text-xs">
                        {STAGES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </select>
                    </div>
                    {c.vehicleId && ["visita", "proposta", "negociacao", "ganho"].includes(c.status) && (
                      <Link href={`/erp/vendas/nova?vehicle=${c.vehicleId}&lead=${c.id}`} className="mt-2 block rounded-md bg-brand py-1.5 text-center text-xs font-bold text-white hover:bg-brand-dark">Registrar venda</Link>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-slate-500">Arraste os cartões entre as etapas (no celular, use a lista “mover”). Cartões com borda vermelha estão parados há mais de 2 dias.</p>
    </div>
  );
}
