import Link from "next/link";
import { customersList } from "@/lib/crm-data";
import { brl, fmtDate } from "@/lib/finance";
import { btn } from "../../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes" };

export default async function Clientes({ searchParams }: PageProps<"/erp/clientes">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const list = await customersList(q);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-ink">Clientes</h1>
        <Link href="/erp/clientes/novo" className={btn}>+ Novo cliente</Link>
      </div>
      <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Buscar por nome ou telefone" aria-label="Buscar cliente" className="max-w-sm" /><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Buscar</button></form>
      <div className="overflow-x-auto rounded-2xl border border-sand bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-sand bg-paper text-xs uppercase text-slate-500">
            <tr>{["Cliente", "Telefone", "Compras", "Última compra", "Total", "Próximo contato"].map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-paper">
                <td className="px-3 py-3"><Link href={`/erp/clientes/${c.id}`} className="font-bold text-ink hover:text-brand">{c.name}</Link></td>
                <td className="px-3 py-3">{c.phone}</td>
                <td className="px-3 py-3">{c.n_sales ?? 0}</td>
                <td className="px-3 py-3">{c.last_sale ? fmtDate(c.last_sale) : "—"}</td>
                <td className="px-3 py-3">{c.total ? brl(c.total) : "—"}</td>
                <td className="px-3 py-3">{c.next_due ? fmtDate(c.next_due) : "—"}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Nenhum cliente encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
