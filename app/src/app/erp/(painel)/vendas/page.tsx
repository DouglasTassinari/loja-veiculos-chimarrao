import Link from "next/link";
import { PAYMENT_LABEL, daysUntil, financingEnd } from "@/lib/crm";
import { allSales } from "@/lib/crm-data";
import { brl, fmtDate, todayISO } from "@/lib/finance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendas" };

export default async function Vendas() {
  const sales = await allSales();
  const today = todayISO();
  const month = today.slice(0, 7);
  const monthSales = sales.filter((s) => s.sale_date.startsWith(month));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Vendas</h1>
          <p className="text-sm text-slate-600">{sales.length} vendas registradas · {monthSales.length} neste mês ({brl(monthSales.reduce((s, x) => s + x.price, 0))})</p>
        </div>
        <Link href="/erp/veiculos" className="text-sm font-semibold text-brand hover:underline">Para vender, abra um veículo do estoque →</Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-sand bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-sand bg-paper text-xs uppercase text-slate-500">
            <tr>{["Data", "Cliente", "Veículo", "Valor", "Pagamento", "Financiamento termina"].map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.map((s) => {
              const end = financingEnd(s);
              const left = end ? daysUntil(end, today) : null;
              return (
                <tr key={s.id} className="hover:bg-paper">
                  <td className="px-3 py-3">{fmtDate(s.sale_date)}</td>
                  <td className="px-3 py-3"><Link href={`/erp/clientes/${s.customer_id}`} className="font-bold text-ink hover:text-brand">{s.customer_name}</Link></td>
                  <td className="px-3 py-3">{s.vehicle_title}</td>
                  <td className="px-3 py-3 font-semibold">{brl(s.price)}</td>
                  <td className="px-3 py-3">{PAYMENT_LABEL[s.payment] ?? s.payment}{s.months ? ` · ${s.months}x` : ""}</td>
                  <td className="px-3 py-3">{end && left !== null ? <span className={left >= 0 && left <= 120 ? "font-bold text-red-600" : "text-slate-600"}>{fmtDate(end)}{left >= 0 && left <= 120 ? ` · faltam ${left} dias` : ""}</span> : "—"}</td>
                </tr>
              );
            })}
            {sales.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Nenhuma venda ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
