import Link from "next/link";
import { notFound } from "next/navigation";
import { store } from "@/lib/config";
import { PAYMENT_LABEL, daysUntil, financingEnd, waLinkTo } from "@/lib/crm";
import { customerById, salesOfCustomer, tasksOfCustomer } from "@/lib/crm-data";
import { brl, fmtDate, todayISO } from "@/lib/finance";
import { addTaskAction, saveCustomerAction } from "../../../../actions";
import { Card, Field, btn } from "../../../ui";
import { DoneItem, TaskItem } from "../../../tasks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cliente" };

export default async function ClientePage({ params, searchParams }: PageProps<"/erp/clientes/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const c = await customerById(Number(id));
  if (!c) notFound();
  const [sales, tasks] = await Promise.all([salesOfCustomer(c.id), tasksOfCustomer(c.id)]);
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done).slice(-8).reverse();
  const today = todayISO();
  const next = `/erp/clientes/${c.id}`;
  const total = sales.reduce((s, x) => s + x.price, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/erp/clientes" className="text-sm text-slate-500 hover:text-brand">← Clientes</Link>
          <h1 className="text-2xl font-extrabold text-ink">{c.name}</h1>
          <p className="text-sm text-slate-600">{c.phone}{c.email ? ` · ${c.email}` : ""}{c.birthday ? ` · aniversário ${fmtDate(c.birthday)}` : ""} · cliente desde {fmtDate(c.created_at)}</p>
        </div>
        <a href={waLinkTo(c.phone, `Oi, ${c.name.split(" ")[0]}! Aqui é da ${store.short}. Tudo bem?`)} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-wa px-5 py-2.5 text-sm font-bold text-white hover:bg-wa-dark">Chamar no WhatsApp</a>
      </div>
      {sp.venda && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">Venda registrada. O sistema já criou as tarefas de pós-venda{sales[0]?.months ? " e o aviso de fim do financiamento" : ""}.</p>}
      {sp.salvo && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">Dados salvos.</p>}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title={`Compras · ${sales.length} (${brl(total)})`}>
            {sales.length === 0 ? <p className="text-sm text-slate-500">Ainda sem compras registradas.</p> : (
              <ul className="space-y-3">
                {sales.map((s) => {
                  const end = financingEnd(s);
                  const left = end ? daysUntil(end, today) : null;
                  return (
                    <li key={s.id} className="rounded-xl border border-sand p-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="font-bold text-ink">{s.vehicle_title}</p>
                        <p className="font-bold text-brand">{brl(s.price)}</p>
                      </div>
                      <p className="text-xs text-slate-600">{fmtDate(s.sale_date)} · {PAYMENT_LABEL[s.payment] ?? s.payment}{s.down && s.payment !== "avista" ? ` · entrada ${brl(s.down)}` : ""}{s.trade_value ? ` · troca ${brl(s.trade_value)}` : ""}</p>
                      {end && (
                        <p className="mt-2 rounded-lg bg-paper p-2 text-xs">
                          <b>Financiamento:</b> {s.months}x{s.parcel ? ` de ${brl(s.parcel)}` : ""}{s.bank ? ` · ${s.bank}` : ""} · termina em <b>{fmtDate(end)}</b>{" "}
                          {left !== null && (left < 0 ? <span className="font-bold text-slate-500">(quitado há {Math.round(-left / 30)} meses)</span> : <span className={`font-bold ${left <= 120 ? "text-red-600" : "text-slate-600"}`}>(faltam {left > 60 ? `${Math.round(left / 30)} meses` : `${left} dias`})</span>)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <section>
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">Tarefas abertas · {open.length}</h2>
            {open.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">Nada pendente com este cliente.</p> : <ul className="space-y-2">{open.map((t) => <TaskItem key={t.id} t={t} next={next} />)}</ul>}
            {done.length > 0 && (
              <details className="mt-3 rounded-xl border border-sand bg-white p-3"><summary className="cursor-pointer text-sm font-bold text-slate-600">Concluídas ({done.length})</summary>
                <ul className="mt-2 space-y-1.5">{done.map((t) => <DoneItem key={t.id} t={t} next={next} />)}</ul></details>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <Card title="Dados e observações">
            <form action={saveCustomerAction} className="space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Nome"><input name="name" defaultValue={c.name} required /></Field>
              <Field label="E-mail"><input name="email" type="email" defaultValue={c.email} /></Field>
              <Field label="Aniversário"><input name="birthday" type="date" defaultValue={c.birthday} /></Field>
              <Field label="Observações (preferências, família, o que gosta)"><textarea name="notes" rows={4} defaultValue={c.notes} /></Field>
              <button className={btn}>Salvar</button>
            </form>
          </Card>
          <Card title="Agendar contato">
            <form action={addTaskAction} className="space-y-3">
              <input type="hidden" name="next" value={next} />
              <input type="hidden" name="customer_id" value={c.id} />
              <Field label="O que fazer"><input name="title" required maxLength={140} placeholder="Ex.: ligar na sexta" /></Field>
              <Field label="Quando"><input name="due_date" type="date" defaultValue={today} required /></Field>
              <button className={btn}>Criar tarefa</button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
