import Link from "next/link";
import { daysUntil } from "@/lib/crm";
import { openTasks, recentDoneTasks, renewalOpportunities, customersList } from "@/lib/crm-data";
import { brl, fmtDate, todayISO } from "@/lib/finance";
import { addTaskAction } from "../../../actions";
import { Card, Field, Stat, btn } from "../../ui";
import { DoneItem, TaskItem } from "../../tasks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tarefas e relacionamento" };

export default async function Tarefas() {
  const [tasks, done, renewals, customers] = await Promise.all([openTasks(), recentDoneTasks(10), renewalOpportunities(120), customersList()]);
  const today = todayISO();
  const days = (t: { due_date: string }) => daysUntil(t.due_date, today);
  const overdue = tasks.filter((t) => days(t) < 0);
  const now = tasks.filter((t) => days(t) === 0);
  const week = tasks.filter((t) => days(t) > 0 && days(t) <= 7);
  const later = tasks.filter((t) => days(t) > 7 && days(t) <= 45);
  const next = "/erp/tarefas";
  const sections: [string, typeof tasks, string][] = [
    ["Atrasadas", overdue, "text-red-600"], ["Hoje", now, "text-amber-700"], ["Próximos 7 dias", week, "text-ink"], ["Próximos 45 dias", later, "text-ink"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Tarefas e relacionamento</h1>
        <p className="text-sm text-slate-600">O sistema cria sozinho o pós-venda (7 dias, 30 dias, 6 meses, 1 ano) e avisa quando um financiamento está terminando. Cada tarefa já traz a mensagem pronta de WhatsApp.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Atrasadas" value={String(overdue.length)} tone={overdue.length ? "bad" : "good"} />
        <Stat label="Para hoje" value={String(now.length)} tone={now.length ? "warn" : "good"} />
        <Stat label="Próximos 7 dias" value={String(week.length)} />
        <Stat label="Renovações em 120 dias" value={String(renewals.length)} hint="Financiamentos terminando" tone={renewals.length ? "warn" : "default"} />
      </div>

      {renewals.length > 0 && (
        <Card title="Oportunidades de renovação (financiamentos terminando)">
          <ul className="divide-y divide-slate-100">
            {renewals.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/erp/clientes/${s.customer_id}`} className="font-bold text-brand hover:underline">{s.customer_name}</Link>
                  <p className="text-xs text-slate-600">{s.vehicle_title} · {s.months}x{s.parcel ? ` de ${brl(s.parcel)}` : ""}{s.bank ? ` · ${s.bank}` : ""}</p>
                </div>
                <p className={`text-sm font-bold ${s.daysLeft <= 30 ? "text-red-600" : "text-amber-700"}`}>
                  {s.daysLeft < 0 ? `Quitou há ${-s.daysLeft} dias` : s.daysLeft === 0 ? "Quita hoje" : `Quita em ${s.daysLeft} dias (${fmtDate(s.end)})`}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {sections.map(([title, list, tone]) => list.length > 0 && (
        <section key={title}>
          <h2 className={`mb-2 text-sm font-extrabold uppercase tracking-wide ${tone}`}>{title} · {list.length}</h2>
          <ul className="space-y-2">{list.map((t) => <TaskItem key={t.id} t={t} next={next} />)}</ul>
        </section>
      ))}
      {tasks.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-slate-600">Nenhuma tarefa aberta. Bom trabalho!</p>}

      <Card title="Nova tarefa">
        <form action={addTaskAction} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
          <input type="hidden" name="next" value={next} />
          <Field label="O que fazer"><input name="title" required maxLength={140} placeholder="Ex.: ligar para confirmar visita" /></Field>
          <Field label="Cliente (opcional)">
            <select name="customer_id" defaultValue=""><option value="">—</option>{customers.slice(0, 80).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </Field>
          <Field label="Quando"><input name="due_date" type="date" defaultValue={today} required /></Field>
          <div className="flex items-end"><button className={btn}>Criar</button></div>
        </form>
      </Card>

      {done.length > 0 && (
        <details className="rounded-2xl border border-sand bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-600">Concluídas recentemente ({done.length})</summary>
          <ul className="mt-3 space-y-1.5">{done.map((t) => <DoneItem key={t.id} t={t} next={next} />)}</ul>
        </details>
      )}
    </div>
  );
}
