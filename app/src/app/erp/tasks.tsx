import Link from "next/link";
import { store } from "@/lib/config";
import { TASK_LABEL, daysUntil, financingEnd, taskMessage, waLinkTo } from "@/lib/crm";
import { fmtDate, todayISO } from "@/lib/finance";
import type { TaskRow } from "@/lib/crm-data";
import { completeTaskAction, reopenTaskAction, snoozeTaskAction } from "../actions";

export function dueLabel(due: string): { text: string; tone: string } {
  const d = daysUntil(due, todayISO());
  if (d < 0) return { text: `Atrasada há ${-d} dia${d === -1 ? "" : "s"}`, tone: "text-red-600" };
  if (d === 0) return { text: "Hoje", tone: "text-amber-700" };
  if (d === 1) return { text: "Amanhã", tone: "text-slate-600" };
  return { text: `Em ${d} dias (${fmtDate(due)})`, tone: "text-slate-600" };
}

export function TaskItem({ t, next }: { t: TaskRow; next: string }) {
  const due = dueLabel(t.due_date);
  const end = t.sale_date && t.sale_months ? financingEnd({ sale_date: t.sale_date, months: t.sale_months }) : null;
  const wa = t.customer_phone && t.customer_name
    ? waLinkTo(t.customer_phone, taskMessage(t.kind, { name: t.customer_name, vehicle: t.vehicle_title ?? undefined, store: store.short, endDate: end }))
    : null;
  return (
    <li className="rounded-xl border border-sand bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent-ink">{TASK_LABEL[t.kind] ?? "Tarefa"}</p>
          <p className="font-bold text-ink">{t.title}</p>
          {t.customer_name && <p className="text-sm text-slate-600">{t.customer_id ? <Link href={`/erp/clientes/${t.customer_id}`} className="font-semibold text-brand hover:underline">{t.customer_name}</Link> : t.customer_name} · {t.customer_phone}</p>}
          {t.note && <p className="mt-1 text-xs text-slate-500">{t.note}</p>}
        </div>
        <p className={`shrink-0 text-sm font-bold ${due.tone}`}>{due.text}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-wa px-3 py-1.5 text-xs font-bold text-white hover:bg-wa-dark">Chamar no WhatsApp</a>}
        <form action={completeTaskAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="next" value={next} /><button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark">Feito</button></form>
        {[3, 7, 30].map((d) => (
          <form key={d} action={snoozeTaskAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="days" value={d} /><input type="hidden" name="next" value={next} /><button className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">+{d}d</button></form>
        ))}
      </div>
    </li>
  );
}

export function DoneItem({ t, next }: { t: TaskRow; next: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
      <span className="min-w-0 truncate"><s>{t.title}</s> {t.customer_name && <>· {t.customer_name}</>}</span>
      <form action={reopenTaskAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="next" value={next} /><button className="text-xs font-semibold text-brand hover:underline">reabrir</button></form>
    </li>
  );
}
