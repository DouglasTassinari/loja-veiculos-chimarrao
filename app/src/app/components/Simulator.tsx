"use client";

import { useEffect, useMemo, useState } from "react";
import { brl, brl2 } from "@/lib/finance";
import { MIN_DOWN_PCT, TERMS, maxMonths, pct, rateLabel, simulate, type Rates } from "@/lib/financing";
import { normalizePhone } from "@/lib/phone";

type Contact = { name: string; phone: string; id?: number; token?: string };
const KEY = "chimarrao_contato";

function readContact(): Contact | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return c && typeof c.name === "string" && typeof c.phone === "string" ? c : null;
  } catch {
    return null;
  }
}

const num = (s: string) => Number(s.replace(/\D/g, "")) || 0;

export default function Simulator(props: {
  vehicleId: number; title: string; price: number; age: number; kind: "carro" | "moto"; rates: Rates; waNumber: string;
}) {
  const { vehicleId, title, price, age, kind, rates } = props;
  const [contact, setContact] = useState<Contact | null>(null);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", consent: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const limit = maxMonths(age, kind);
  const [down, setDown] = useState(Math.round((price * 0.3) / 500) * 500);
  const [months, setMonths] = useState(Math.min(48, limit));
  const [hasTrade, setHasTrade] = useState(false);
  const [trade, setTrade] = useState(0);
  const [income, setIncome] = useState(0);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    // Lê o contato guardado no navegador (já informado antes); precisa rodar depois da hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContact(readContact());
    setReady(true);
  }, []);

  const tradeValue = hasTrade ? trade : 0;
  const sims = useMemo(() => {
    const mk = (m: number, r: number) => simulate({ price, down, trade: tradeValue, months: m, rate: r });
    return { main: mk(months, rates.ref), low: mk(months, rates.low), high: mk(months, rates.high), rows: TERMS.filter((t) => t <= limit).map((t) => mk(t, rates.ref)) };
  }, [price, down, tradeValue, months, rates, limit]);
  const s = sims.main;
  const cash = s.base <= 0;
  const downPct = price > 0 ? (down + tradeValue) / price : 0;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!form.consent) return setErr("Marque a autorização para continuar.");
    if (!normalizePhone(form.phone)) return setErr("Informe um WhatsApp válido com DDD.");
    setBusy(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone, vehicleId, source: "simulador", consent: true, message: `Iniciou a simulação de financiamento do ${title}.` }),
      });
      const j = await res.json();
      if (!j.ok) return setErr(j.error ?? "Não foi possível iniciar. Tente de novo.");
      const c: Contact = { name: j.name, phone: j.phone, id: j.id, token: j.token };
      try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* navegador sem armazenamento */ }
      setContact(c);
    } catch {
      setErr("Sem conexão. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  function summary() {
    const parts = [
      `Simulação do ${title}: valor ${brl(price)}, entrada ${brl(down)}${tradeValue ? `, troca estimada ${brl(tradeValue)}` : ""}`,
      cash ? "compra sem financiamento" : `${months}x de ${brl2(s.parcel)} (faixa ${brl2(sims.low.parcel)} a ${brl2(sims.high.parcel)}), CET estimado ${pct(s.cetMonthly)} a.m.`,
    ];
    if (income) parts.push(`renda informada ${brl(income)}`);
    return parts.join("; ") + ".";
  }

  async function sendToTeam() {
    const text = summary();
    // Abre o WhatsApp em nova aba antes de qualquer espera (evita bloqueio de pop-up).
    window.open(`https://wa.me/${props.waNumber}?text=${encodeURIComponent(`Olá! Sou ${contact?.name}. ${text} Pode me ajudar a seguir?`)}`, "_blank", "noopener,noreferrer");
    setSent(true);
    if (contact?.id && contact.token) {
      fetch("/api/lead", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: contact.id, token: contact.token, message: text }) }).catch(() => {});
    }
  }

  if (!ready) return <div className="h-40 animate-pulse rounded-2xl border border-sand bg-white" />;

  if (!contact) {
    return (
      <form onSubmit={start} className="rounded-2xl border border-sand bg-white p-5">
        <h3 className="font-extrabold text-ink">Simule o financiamento</h3>
        <p className="mt-1 text-sm text-slate-600">Informe seu nome e WhatsApp para ver parcela, IOF, custo efetivo e comparar prazos. A equipe pode te ajudar a seguir com a proposta.</p>
        <div className="mt-4 space-y-3">
          <label className="block"><span className="lbl">Nome</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} autoComplete="name" /></label>
          <label className="block"><span className="lbl">WhatsApp com DDD</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required inputMode="tel" autoComplete="tel" placeholder="(51) 90000-0000" /></label>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="!mt-0.5 !w-auto" />
            Concordo em ser contatado pela loja sobre este veículo. Usamos seus dados só para isso (LGPD).
          </label>
        </div>
        {err && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{err}</p>}
        <button disabled={busy} className="mt-4 w-full rounded-lg bg-brand py-3 font-bold text-white hover:bg-brand-dark disabled:opacity-60">{busy ? "Iniciando…" : "Iniciar simulação"}</button>
      </form>
    );
  }

  return (
    <div className="rounded-2xl border border-sand bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-extrabold text-ink">Simulação de financiamento</h3>
        <button type="button" onClick={() => { try { localStorage.removeItem(KEY); } catch {} setContact(null); }} className="text-[11px] text-slate-500 underline">Não sou {contact.name.split(" ")[0]}</button>
      </div>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="lbl">Entrada</span>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={Math.round((price * 0.9) / 500) * 500} step={500} value={down} onChange={(e) => setDown(Number(e.target.value))} aria-label="Valor da entrada" />
          </div>
          <input inputMode="numeric" value={down ? brl(down) : ""} onChange={(e) => setDown(Math.min(num(e.target.value), price))} placeholder="R$ 0" className="mt-2" aria-label="Entrada em reais" />
          <span className="mt-1 block text-[11px] text-slate-500">{Math.round(downPct * 100)}% do valor{downPct < MIN_DOWN_PCT ? " · abaixo de 20%, a análise do banco costuma ser mais exigente" : ""}</span>
        </label>

        <div>
          <span className="lbl">Prazo</span>
          <div className="flex flex-wrap gap-2">
            {TERMS.map((t) => (
              <button key={t} type="button" disabled={t > limit} onClick={() => setMonths(t)} className={`min-w-14 flex-1 rounded-lg border py-2 text-sm font-semibold ${months === t ? "border-brand bg-brand text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"} disabled:cursor-not-allowed disabled:opacity-40`}>{t}x</button>
            ))}
          </div>
          {limit < 60 && <span className="mt-1 block text-[11px] text-slate-500">Prazo máximo estimado para este veículo: {limit}x (os bancos limitam pela idade).</span>}
        </div>

        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasTrade} onChange={(e) => setHasTrade(e.target.checked)} className="!w-auto" /> Tenho {kind === "moto" ? "uma moto" : "um carro"} para a troca</label>
        {hasTrade && (
          <label className="block"><span className="lbl">Quanto você acha que vale o seu veículo?</span>
            <input inputMode="numeric" value={trade ? brl(trade) : ""} onChange={(e) => setTrade(num(e.target.value))} placeholder="R$ 0" />
            <span className="mt-1 block text-[11px] text-slate-500">Só uma estimativa sua. A avaliação real é feita pela equipe.</span>
          </label>
        )}
        <label className="block"><span className="lbl">Renda mensal (opcional)</span>
          <input inputMode="numeric" value={income ? brl(income) : ""} onChange={(e) => setIncome(num(e.target.value))} placeholder="R$ 0" />
        </label>
      </div>

      {cash ? (
        <p className="mt-5 rounded-lg bg-sand p-3 text-sm font-semibold text-brand">Com essa entrada não há valor a financiar. Fale com a equipe para combinar o pagamento.</p>
      ) : (
        <>
          <div className="mt-5 rounded-xl bg-paper p-4">
            <p className="text-sm text-slate-600">Parcela estimada</p>
            <p className="text-4xl font-extrabold text-brand">{brl2(s.parcel)}<span className="text-base font-medium text-slate-500"> × {months}</span></p>
            <p className="mt-1 text-xs text-slate-600">Faixa de referência: {brl2(sims.low.parcel)} a {brl2(sims.high.parcel)} ({pct(rates.low)} a {pct(rates.high)} ao mês)</p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Valor financiado</dt><dd className="text-right font-semibold">{brl(s.financed)}</dd>
            <dt className="text-slate-500">IOF estimado (incluso)</dt><dd className="text-right font-semibold">{brl(s.iof)}</dd>
            <dt className="text-slate-500">Taxa de referência</dt><dd className="text-right font-semibold">{pct(rates.ref)} a.m.</dd>
            <dt className="text-slate-500">CET estimado</dt><dd className="text-right font-semibold">{pct(s.cetMonthly)} a.m. · {pct(s.cetYearly, 1)} a.a.</dd>
            <dt className="text-slate-500">Juros + IOF no total</dt><dd className="text-right font-semibold">{brl(s.interest)}</dd>
            <dt className="text-slate-500">Total pago (com entrada)</dt><dd className="text-right font-semibold">{brl(s.total)}</dd>
          </dl>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-sand" aria-hidden>
            <div className="bg-brand" style={{ width: `${(s.entry / s.total) * 100}%` }} />
            <div className="bg-accent/70" style={{ width: `${(s.base / s.total) * 100}%` }} />
            <div className="bg-wa" style={{ width: `${(s.interest / s.total) * 100}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Entrada · valor financiado · juros e IOF</p>
          {income > 0 && (
            <p className={`mt-3 rounded-lg p-2 text-xs ${s.parcel / income > 0.3 ? "bg-red-50 text-red-700" : "bg-sand text-brand"}`}>
              A parcela representa {Math.round((s.parcel / income) * 100)}% da renda informada.{s.parcel / income > 0.3 ? " Os bancos costumam preferir até cerca de 30%." : ""}
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <caption className="pb-1 text-left font-semibold text-slate-600">Compare os prazos (mesma entrada)</caption>
              <thead className="text-left text-slate-500"><tr><th className="py-1">Prazo</th><th>Parcela</th><th className="text-right">Total pago</th></tr></thead>
              <tbody>
                {sims.rows.map((r) => (
                  <tr key={r.months} className={r.months === months ? "bg-sand/60 font-semibold" : ""}>
                    <td className="py-1.5 pl-1">{r.months}x</td><td>{brl2(r.parcel)}</td><td className="pr-1 text-right">{brl(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <button type="button" onClick={sendToTeam} className="mt-5 flex w-full items-center justify-center rounded-lg bg-wa py-3 font-bold text-white hover:bg-wa-dark">Enviar esta simulação para a equipe</button>
      {sent && <p className="mt-2 rounded-lg bg-sand p-2 text-xs font-medium text-brand">Enviado. A equipe recebeu sua simulação e vai falar com você, {contact.name.split(" ")[0]}.</p>}

      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        Simulação da loja, sem compromisso, com {rateLabel(rates)}. A taxa final, o CET e as tarifas (como cadastro e registro do contrato) dependem da análise de crédito do banco e podem ser diferentes. Não é oferta nem aprovação de crédito.
      </p>
    </div>
  );
}
