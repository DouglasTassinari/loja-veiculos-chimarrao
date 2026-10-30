"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { brl, brl2, km } from "@/lib/finance";
import { pct } from "@/lib/financing";
import { newState, type Action, type Card, type ChatState, type Msg, type Quote } from "@/lib/chat/types";

type Line = { who: "bot"; msg: Msg } | { who: "me"; text: string };
const STORE_KEY = "chimarrao_chat";
const CONTACT_KEY = "chimarrao_contato";

function readJson<T>(storage: Storage, key: string): T | null {
  try { return JSON.parse(storage.getItem(key) ?? "null") as T | null; } catch { return null; }
}

function ActionButton({ a }: { a: Action }) {
  const cls = "flex items-center justify-center rounded-lg bg-wa px-3 py-2 text-sm font-bold text-white hover:bg-wa-dark";
  return a.external
    ? <a href={a.href} target="_blank" rel="noopener noreferrer" className={cls}>{a.label}</a>
    : <Link href={a.href} className="flex items-center justify-center rounded-lg border border-brand/30 px-3 py-2 text-sm font-bold text-brand hover:bg-sand/40">{a.label}</Link>;
}

function VehicleCardView({ c, onQuote }: { c: Card; onQuote: (id: number) => void }) {
  const fit = { alta: "Combina muito", boa: "Combina", aprox: "Aproximado" }[c.fit];
  return (
    <div className="w-60 shrink-0 overflow-hidden rounded-xl border border-sand bg-white">
      {c.photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={c.photo} alt={c.title} className="h-32 w-full object-cover" loading="lazy" />
        : <div className="flex h-32 items-center justify-center bg-brand text-[11px] font-semibold uppercase tracking-widest text-sand/80">Fotos em breve</div>}
      <div className="space-y-1 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-accent-ink">{fit}</p>
        <p className="line-clamp-2 text-sm font-extrabold leading-tight text-ink">{c.title}</p>
        <p className="text-xs text-slate-600">{c.year} · {km(c.km)} km · {c.trans}</p>
        <p className="text-lg font-extrabold text-brand">{brl(c.price)}</p>
        {c.reasons.length > 0 && <ul className="space-y-0.5 text-[11px] text-slate-600">{c.reasons.map((r) => <li key={r}>• {r}</li>)}</ul>}
        <div className="grid gap-1.5 pt-1">
          <button type="button" onClick={() => onQuote(c.id)} className="rounded-lg bg-brand py-2 text-xs font-bold text-white hover:bg-brand-dark">Montar orçamento</button>
          <Link href={`/veiculo/${c.slug}`} className="rounded-lg border border-brand/30 py-2 text-center text-xs font-bold text-brand hover:bg-sand/40">Ver anúncio</Link>
        </div>
      </div>
    </div>
  );
}

function QuoteView({ q }: { q: Quote }) {
  const main = q.options.find((o) => o.months === q.chosenMonths);
  return (
    <div className="mt-2 rounded-xl border border-sand bg-white p-3 text-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-accent-ink">Orçamento</p>
      <p className="font-extrabold text-ink">{q.title}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-500">Valor</dt><dd className="text-right font-semibold">{brl(q.price)}</dd>
        {q.mode === "financiar" ? (
          <>
            <dt className="text-slate-500">Entrada</dt><dd className="text-right font-semibold">{brl(q.entry)}</dd>
            {q.trade > 0 && (<><dt className="text-slate-500">Troca (estimativa)</dt><dd className="text-right font-semibold">{brl(q.trade)}</dd></>)}
            <dt className="text-slate-500">Valor financiado</dt><dd className="text-right font-semibold">{brl(q.financed)}</dd>
            <dt className="text-slate-500">IOF estimado</dt><dd className="text-right font-semibold">{brl(q.iof)}</dd>
            <dt className="text-slate-500">CET estimado</dt><dd className="text-right font-semibold">{pct(q.cetMonthly)} a.m.</dd>
          </>
        ) : (<><dt className="text-slate-500">Pagamento</dt><dd className="text-right font-semibold">À vista</dd></>)}
      </dl>
      {q.mode === "financiar" && (
        <>
          <p className="mt-3 text-xs text-slate-500">Parcela por prazo</p>
          <div className="mt-1 overflow-hidden rounded-lg border border-sand">
            {q.options.map((o) => (
              <div key={o.months} className={`flex items-center justify-between px-2 py-1.5 text-xs ${o.months === q.chosenMonths ? "bg-sand/60 font-bold" : ""}`}>
                <span>{o.months}x</span>
                <span>{brl2(o.parcel)} <span className="font-normal text-slate-500">({brl2(o.low)} a {brl2(o.high)})</span></span>
              </div>
            ))}
          </div>
          {main && <p className="mt-2 text-[11px] text-slate-500">Total pago em {q.chosenMonths}x: {brl(main.total)}</p>}
        </>
      )}
      <ul className="mt-2 space-y-1 text-[11px] text-slate-500">{q.notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}

function BotBubble({ m, onChip, onQuote, last }: { m: Msg; onChip: (t: string) => void; onQuote: (id: number) => void; last: boolean }) {
  return (
    <div className="max-w-[92%] space-y-2">
      <div className="whitespace-pre-line rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-ink shadow-sm">{m.text}</div>
      {m.cards && m.cards.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="list" aria-label="Veículos sugeridos">
          {m.cards.map((c) => <div key={c.id} role="listitem"><VehicleCardView c={c} onQuote={onQuote} /></div>)}
        </div>
      )}
      {m.quote && <QuoteView q={m.quote} />}
      {m.actions && m.actions.length > 0 && <div className="grid gap-1.5">{m.actions.map((a) => <ActionButton key={a.href + a.label} a={a} />)}</div>}
      {last && m.chips && m.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {m.chips.map((c) => (
            <button key={c} type="button" onClick={() => onChip(c)} className="rounded-full border border-brand/40 bg-white px-3 py-1 text-xs font-semibold text-brand hover:bg-sand/50">{c}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [state, setState] = useState<ChatState>(newState());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Restaura a conversa da sessão (sobrevive à troca de página) e o contato já informado no simulador.
  useEffect(() => {
    const saved = readJson<{ lines: Line[]; state: ChatState; open: boolean }>(sessionStorage, STORE_KEY);
    const contact = readJson<{ name?: string; phone?: string; id?: number; token?: string }>(localStorage, CONTACT_KEY);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (saved?.lines?.length) {
      setLines(saved.lines);
      setState(contact?.phone && !saved.state.contact.phone ? { ...saved.state, contact: { ...saved.state.contact, ...contact, consent: true } } : saved.state);
      setOpen(!!saved.open);
    } else if (contact?.name && contact.phone) {
      setState({ ...newState(), contact: { name: contact.name, phone: contact.phone, id: contact.id, token: contact.token, consent: true } });
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ lines: lines.slice(-40), state, open })); } catch { /* sem armazenamento */ }
  }, [lines, state, open, ready]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lines, busy, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const call = useCallback(async (input: unknown, shown?: string) => {
    if (shown) setLines((l) => [...l, { who: "me", text: shown }]);
    setBusy(true);
    const t0 = Date.now();
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: stateRef.current, input }) });
      const j = await res.json();
      await new Promise((r) => setTimeout(r, Math.max(0, 450 - (Date.now() - t0)))); // pausa curta, como quem digita
      if (!j.ok) { setLines((l) => [...l, { who: "bot", msg: { text: j.error ?? "Não consegui responder agora. Tente de novo." } }]); return; }
      const next = j.state as ChatState;
      setState(next);
      setLines((l) => [...l, ...(j.messages as Msg[]).map((m) => ({ who: "bot" as const, msg: m }))]);
      if (next.contact.id && next.contact.token && next.contact.name && next.contact.phone) {
        try { localStorage.setItem(CONTACT_KEY, JSON.stringify({ name: next.contact.name, phone: next.contact.phone, id: next.contact.id, token: next.contact.token })); } catch { /* sem armazenamento */ }
      }
    } catch {
      setLines((l) => [...l, { who: "bot", msg: { text: "Sem conexão no momento. Verifique a internet e tente de novo.", actions: [] } }]);
    } finally {
      setBusy(false);
    }
  }, []);

  function openChat() {
    setOpen(true);
    if (!lines.length) void call({ type: "start", path: window.location.pathname });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function send(t: string) {
    const v = t.trim();
    if (!v || busy) return;
    setText("");
    void call({ type: "text", text: v }, v);
  }

  function reset() {
    setLines([]);
    const c = stateRef.current.contact;
    setState({ ...newState(), contact: c });
    stateRef.current = { ...newState(), contact: c };
    void call({ type: "start", path: window.location.pathname });
  }

  const lastBot = (() => { for (let i = lines.length - 1; i >= 0; i--) if (lines[i].who === "bot") return i; return -1; })();

  return (
    <>
      {!open && (
        <button type="button" onClick={openChat} aria-label="Abrir o assistente virtual" className="chat-float fixed bottom-5 left-4 z-40 flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-brand-dark">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /></svg>
          Assistente
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Assistente virtual" aria-modal="false" className="fixed inset-0 z-50 flex flex-col bg-paper md:inset-auto md:bottom-5 md:left-4 md:h-[38rem] md:max-h-[calc(100vh-2.5rem)] md:w-[26rem] md:overflow-hidden md:rounded-2xl md:border md:border-sand md:shadow-2xl">
          <header className="flex items-center justify-between gap-2 bg-brand px-4 py-3 text-paper">
            <div>
              <p className="text-sm font-extrabold">Assistente virtual</p>
              <p className="text-[11px] text-sand">Responde por regras, sem IA. A equipe confirma o que importa.</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={reset} className="rounded-md px-2 py-1 text-xs hover:bg-white/10">Recomeçar</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar o assistente" className="rounded-md px-2 py-1 text-lg leading-none hover:bg-white/10">×</button>
            </div>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
            {lines.map((l, i) =>
              l.who === "me"
                ? <div key={i} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-white">{l.text}</div></div>
                : <BotBubble key={i} m={l.msg} last={i === lastBot && !busy} onChip={send} onQuote={(id) => void call({ type: "pick", id }, "Montar orçamento")} />,
            )}
            {busy && <div className="flex"><div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-slate-500 shadow-sm" aria-label="Digitando">•••</div></div>}
            <div ref={endRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2 border-t border-sand bg-white p-2">
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Escreva aqui…" aria-label="Sua mensagem" autoComplete="off" />
            <button disabled={busy || !text.trim()} className="rounded-lg bg-brand px-4 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50">Enviar</button>
          </form>
        </div>
      )}
    </>
  );
}
