import type { Alert, Status } from "@/lib/finance";

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-sand bg-white p-5 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "good" | "bad" | "warn" }) {
  const c = { default: "text-ink", good: "text-emerald-700", bad: "text-red-600", warn: "text-amber-600" }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${c}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const statusStyle: Record<Status, string> = {
  preparacao: "bg-amber-100 text-amber-800", disponivel: "bg-emerald-100 text-emerald-800",
  reservado: "bg-sand text-ink", vendido: "bg-slate-200 text-slate-700",
};
export const statusLabel: Record<Status, string> = { preparacao: "Em preparação", disponivel: "Disponível", reservado: "Reservado", vendido: "Vendido" };

export function StatusPill({ s }: { s: Status }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[s]}`}>{statusLabel[s]}</span>;
}

export function AlertList({ items }: { items: Alert[] }) {
  if (!items.length) return null;
  const c = { info: "bg-slate-100 text-slate-700", warn: "bg-amber-50 text-amber-800", danger: "bg-red-50 text-red-700" };
  return (
    <ul className="space-y-1.5">
      {items.map((a, i) => <li key={i} className={`rounded-lg px-3 py-2 text-sm ${c[a.level]}`}>{a.text}</li>)}
    </ul>
  );
}

export const btn = "rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark";
export const btnGhost = "rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="lbl">{label}</span>{children}</label>;
}
