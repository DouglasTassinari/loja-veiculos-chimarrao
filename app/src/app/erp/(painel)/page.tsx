import Link from "next/link";
import { allVehicles, cashEntries, leads } from "@/lib/data";
import { brl, hoursSince, todayISO, vehicleTitle } from "@/lib/finance";
import { Card, Stat, StatusPill } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel" };

export default async function Painel() {
  const [all, cashAll, leadsAll] = await Promise.all([allVehicles(), cashEntries(), leads()]);
  const stock = all.filter((v) => v.status !== "vendido");
  const month = todayISO().slice(0, 7);
  const soldMonth = all.filter((v) => v.status === "vendido" && v.sale_date?.startsWith(month));

  const capital = stock.reduce((s, v) => s + v.analysis.totalCost, 0);
  const idleDay = stock.reduce((s, v) => s + v.analysis.capitalCostPerDay, 0);
  const avgDays = stock.length ? Math.round(stock.reduce((s, v) => s + v.analysis.days, 0) / stock.length) : 0;
  const profitMonth = soldMonth.reduce((s, v) => s + v.analysis.profit, 0);
  const revenueMonth = soldMonth.reduce((s, v) => s + v.analysis.revenue, 0);
  const marginMonth = revenueMonth ? (profitMonth / revenueMonth) * 100 : 0;
  const potential = stock.filter((v) => v.status !== "preparacao").reduce((s, v) => s + v.analysis.profit, 0);

  const horizon = todayISO(30);
  const cash = cashAll.filter((e) => !e.paid && e.due_date <= horizon);
  const receber = cash.filter((e) => e.kind === "receber").reduce((s, e) => s + e.amount, 0);
  const pagar = cash.filter((e) => e.kind === "pagar").reduce((s, e) => s + e.amount, 0);

  const risk = stock
    .filter((v) => v.alertList.some((a) => a.level !== "info") || v.action)
    .sort((a, b) => Number(b.alertList.some((x) => x.level === "danger")) - Number(a.alertList.some((x) => x.level === "danger")) || b.analysis.days - a.analysis.days)
    .slice(0, 6);

  const newLeads = leadsAll.filter((l) => l.status === "novo");
  const lateLeads = newLeads.filter((l) => hoursSince(l.created_at) > 2);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-ink">Painel do dono</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Capital parado em estoque" value={brl(capital)} hint={`${stock.length} carros · custando ${brl(idleDay)}/dia`} />
        <Stat label="Giro médio" value={`${avgDays} dias`} tone={avgDays > 45 ? "bad" : avgDays > 35 ? "warn" : "good"} hint="Meta: até 35 dias" />
        <Stat label="Lucro do mês" value={brl(profitMonth)} tone={profitMonth >= 0 ? "good" : "bad"} hint={`${soldMonth.length} vendas · margem ${marginMonth.toFixed(1)}%`} />
        <Stat label="Caixa próximos 30 dias" value={brl(receber - pagar)} tone={receber - pagar >= 0 ? "good" : "bad"} hint={`Entra ${brl(receber)} · Sai ${brl(pagar)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Carros que precisam de ação">
          {risk.length === 0 ? <p className="text-sm text-slate-500">Nenhum carro em risco. Estoque saudável.</p> : (
            <ul className="divide-y divide-slate-100">
              {risk.map((v) => (
                <li key={v.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/erp/veiculos/${v.id}`} className="font-bold text-ink hover:text-brand">{vehicleTitle(v)} <span className="font-normal text-slate-500">{v.year_model}</span></Link>
                    <div className="flex items-center gap-3 text-sm">
                      <StatusPill s={v.status} />
                      <span className="text-slate-600">{v.analysis.days}d</span>
                      <span className={v.analysis.profit < 0 ? "font-bold text-red-600" : "font-semibold text-slate-700"}>{brl(v.analysis.profit)}</span>
                    </div>
                  </div>
                  {v.action && <p className="mt-1 text-sm text-slate-700"><span className="font-semibold text-brand">Próxima ação:</span> {v.action}</p>}
                  {v.alertList[0] && <p className="mt-0.5 text-xs text-slate-500">{v.alertList[0].text}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Vendas e funil">
            <p className="text-sm text-slate-700"><b>{newLeads.length}</b> {newLeads.length === 1 ? "lead novo" : "leads novos"}{lateLeads.length > 0 && <span className="font-semibold text-red-600">· {lateLeads.length} sem resposta há mais de 2h</span>}</p>
            <Link href="/erp/leads" className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">Abrir CRM →</Link>
          </Card>
          <Card title="Potencial no estoque">
            <p className="text-2xl font-extrabold text-ink">{brl(potential)}</p>
            <p className="text-xs text-slate-500">Lucro estimado dos carros disponíveis e reservados, já descontando o custo do capital até hoje.</p>
          </Card>
          <Card title="Atalhos">
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/erp/veiculos/novo" className="rounded-lg bg-brand px-3 py-2 font-bold text-white">+ Novo veículo</Link>
              <Link href="/erp/caixa" className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700">Contas a pagar/receber</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
