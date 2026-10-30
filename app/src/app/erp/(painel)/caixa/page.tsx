import { cashEntries } from "@/lib/data";
import { brl, fmtDate, todayISO } from "@/lib/finance";
import { newCashEntry, payCashEntry } from "../../../actions";
import { Card, Field, Stat, btn } from "../../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Caixa" };

export default async function Caixa() {
  const all = await cashEntries();
  const open = all.filter((e) => !e.paid);
  const today = todayISO();
  const within = (days: number) => {
    const lim = todayISO(days);
    return open.filter((e) => e.due_date <= lim);
  };
  const net = (list: typeof open) => list.reduce((s, e) => s + (e.kind === "receber" ? e.amount : -e.amount), 0);
  const overdue = open.filter((e) => e.due_date < today);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-ink">Fluxo de caixa</h1>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Saldo projetado 7 dias" value={brl(net(within(7)))} tone={net(within(7)) >= 0 ? "good" : "bad"} />
        <Stat label="Saldo projetado 30 dias" value={brl(net(within(30)))} tone={net(within(30)) >= 0 ? "good" : "bad"} />
        <Stat label="Saldo projetado 90 dias" value={brl(net(within(90)))} tone={net(within(90)) >= 0 ? "good" : "bad"} />
        <Stat label="Vencidos" value={String(overdue.length)} tone={overdue.length ? "bad" : "good"} hint={brl(Math.abs(net(overdue)))} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Contas a pagar e a receber">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Vencimento</th><th>Descrição</th><th className="text-right">Valor</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {all.map((e) => (
                <tr key={e.id} className={e.paid ? "bg-slate-50 text-slate-500" : ""}>
                  <td className={`py-2 ${!e.paid && e.due_date < today ? "font-bold text-red-600" : ""}`}>{fmtDate(e.due_date)}</td>
                  <td>{e.description}</td>
                  <td className={`text-right font-semibold ${e.paid ? "text-slate-500" : e.kind === "receber" ? "text-emerald-700" : "text-red-600"}`}>{e.kind === "receber" ? "+" : "−"}{brl(e.amount)}</td>
                  <td className="pl-3 text-right">
                    <form action={payCashEntry}><input type="hidden" name="id" value={e.id} /><button className="text-xs font-semibold text-brand hover:underline">{e.paid ? "reabrir" : e.kind === "receber" ? "recebido" : "pago"}</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Novo lançamento">
          <form action={newCashEntry} className="space-y-3">
            <Field label="Tipo"><select name="kind"><option value="pagar">A pagar</option><option value="receber">A receber</option></select></Field>
            <Field label="Descrição"><input name="description" required /></Field>
            <Field label="Valor (R$)"><input name="amount" inputMode="decimal" required /></Field>
            <Field label="Vencimento"><input name="due_date" type="date" defaultValue={today} required /></Field>
            <button className={btn}>Lançar</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
