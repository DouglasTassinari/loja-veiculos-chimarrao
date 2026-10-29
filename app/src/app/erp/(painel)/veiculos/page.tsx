import Link from "next/link";
import { allVehicles, leadsByVehicle } from "@/lib/data";
import { brl, km, vehicleTitle } from "@/lib/finance";
import { StatusPill, btn } from "../../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estoque" };

export default async function Estoque({ searchParams }: PageProps<"/erp/veiculos">) {
  const sp = await searchParams;
  const filter = typeof sp.s === "string" ? sp.s : "ativos";
  const lc = leadsByVehicle();
  let list = allVehicles();
  if (filter === "ativos") list = list.filter((v) => v.status !== "vendido");
  else if (filter !== "todos") list = list.filter((v) => v.status === filter);
  list = [...list].sort((a, b) => b.analysis.days - a.analysis.days);

  const tabs = [["ativos", "Em estoque"], ["preparacao", "Preparação"], ["disponivel", "Disponíveis"], ["reservado", "Reservados"], ["vendido", "Vendidos"], ["todos", "Todos"]];
  const totalCost = list.reduce((s, v) => s + v.analysis.totalCost, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-ink">Estoque</h1>
        <Link href="/erp/veiculos/novo" className={btn}>+ Novo veículo</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/erp/veiculos?s=${k}`} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${filter === k ? "bg-ink text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"}`}>{l}</Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Veículo", "Status", "Dias", "Custo total", "Preço", "Lucro est.", "Margem", "Leads", "Alertas"].map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((v) => {
              const a = v.analysis;
              return (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <Link href={`/erp/veiculos/${v.id}`} className="font-bold text-ink hover:text-brand">{vehicleTitle(v)}</Link>
                    <p className="text-xs text-slate-500">{v.year_model} · {km(v.km)} km · {v.plate}</p>
                  </td>
                  <td className="px-3 py-3"><StatusPill s={v.status} /></td>
                  <td className={`px-3 py-3 font-semibold ${a.days >= 60 ? "text-red-600" : a.days >= 45 ? "text-amber-600" : "text-slate-700"}`}>{a.days}</td>
                  <td className="px-3 py-3">{brl(a.totalCost)}</td>
                  <td className="px-3 py-3">{brl(a.revenue)}</td>
                  <td className={`px-3 py-3 font-semibold ${a.profit < 0 ? "text-red-600" : "text-emerald-700"}`}>{brl(a.profit)}</td>
                  <td className="px-3 py-3">{a.marginPct.toFixed(1)}%</td>
                  <td className="px-3 py-3">{lc.get(v.id) ?? 0}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{v.alertList.length ? `${v.alertList.length}` : "—"}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">Nenhum veículo.</td></tr>}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
            <tr><td className="px-3 py-3" colSpan={3}>{list.length} veículos</td><td className="px-3 py-3">{brl(totalCost)}</td><td colSpan={5} /></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
