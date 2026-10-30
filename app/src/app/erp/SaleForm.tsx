"use client";

import { useState } from "react";
import { brl, brl2 } from "@/lib/finance";
import { FALLBACK_RATES, installment, iofRate } from "@/lib/financing";
import { registerSaleFull } from "../actions";

type Opt = { id: number; title: string; price: number };
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;

export default function SaleForm(props: {
  vehicles: Opt[]; vehicleId?: number; leadId?: number; defaultName: string; defaultPhone: string; today: string; error?: boolean;
}) {
  const [vid, setVid] = useState(props.vehicleId ?? props.vehicles[0]?.id ?? 0);
  const veh = props.vehicles.find((v) => v.id === vid);
  const [price, setPrice] = useState(String(veh?.price ?? ""));
  const [payment, setPayment] = useState("financiado");
  const [down, setDown] = useState("");
  const [trade, setTrade] = useState("");
  const [months, setMonths] = useState("48");

  const financing = payment === "financiado" || payment === "troca_financiado";
  const hasTrade = payment === "troca" || payment === "troca_financiado";
  const base = Math.max(num(price) - num(down) - (hasTrade ? num(trade) : 0), 0);
  const est = financing && base > 0 ? installment(base * (1 + iofRate(num(months) || 48)), FALLBACK_RATES.ref, num(months) || 48) : 0;

  return (
    <form action={registerSaleFull} className="mx-auto max-w-3xl space-y-5">
      <input type="hidden" name="lead_id" value={props.leadId ?? ""} />
      <section className="rounded-2xl border border-sand bg-white p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Veículo</h2>
        <label className="block"><span className="lbl">Veículo vendido</span>
          <select name="vehicle_id" value={vid} onChange={(e) => { const id = Number(e.target.value); setVid(id); const v = props.vehicles.find((x) => x.id === id); if (v) setPrice(String(v.price)); }}>
            {props.vehicles.map((v) => <option key={v.id} value={v.id}>{v.title} · {brl(v.price)}</option>)}
          </select>
        </label>
      </section>

      <section className="rounded-2xl border border-sand bg-white p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Cliente</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="lbl">Nome</span><input name="customer_name" defaultValue={props.defaultName} required minLength={2} /></label>
          <label className="block"><span className="lbl">WhatsApp com DDD</span><input name="customer_phone" defaultValue={props.defaultPhone} required inputMode="tel" placeholder="(51) 90000-0000" /></label>
        </div>
        <p className="mt-2 text-xs text-slate-500">Se o telefone já estiver cadastrado, a venda entra no cadastro desse cliente.</p>
      </section>

      <section className="rounded-2xl border border-sand bg-white p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Negócio</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block"><span className="lbl">Preço fechado (R$)</span><input name="sale_price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required /></label>
          <label className="block"><span className="lbl">Data da venda</span><input name="sale_date" type="date" defaultValue={props.today} required /></label>
          <label className="block"><span className="lbl">Comissão do vendedor (R$)</span><input name="commission" inputMode="decimal" defaultValue="0" /></label>
          <label className="block sm:col-span-3"><span className="lbl">Forma de pagamento</span>
            <select name="payment" value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="avista">À vista</option><option value="financiado">Financiado</option><option value="troca">Com troca</option><option value="troca_financiado">Troca + financiamento</option>
            </select>
          </label>
          {(financing || payment === "troca") && <label className="block"><span className="lbl">Entrada em dinheiro (R$)</span><input name="down" value={down} onChange={(e) => setDown(e.target.value)} inputMode="decimal" /></label>}
          {hasTrade && (<>
            <label className="block"><span className="lbl">Veículo recebido na troca</span><input name="trade_desc" placeholder="Ex.: Gol 1.0 2014" /></label>
            <label className="block"><span className="lbl">Valor da troca (R$)</span><input name="trade_value" value={trade} onChange={(e) => setTrade(e.target.value)} inputMode="decimal" /></label>
          </>)}
          {financing && (<>
            <label className="block"><span className="lbl">Prazo (meses)</span><input name="months" value={months} onChange={(e) => setMonths(e.target.value)} type="number" min={6} max={84} required /></label>
            <label className="block"><span className="lbl">Parcela (R$)</span><input name="parcel" inputMode="decimal" placeholder={est ? `estimada ${brl2(est)}` : "opcional"} /></label>
            <label className="block"><span className="lbl">Banco / financeira</span><input name="bank" placeholder="Ex.: BV, Santander, Itaú" /></label>
          </>)}
          <label className="block sm:col-span-3"><span className="lbl">Observações</span><textarea name="notes" rows={2} /></label>
        </div>
        {financing && base > 0 && <p className="mt-3 rounded-lg bg-paper p-3 text-sm">Valor financiado: <b>{brl(base)}</b>{est ? <> · parcela estimada <b>{brl2(est)}</b> (se você não informar a parcela real)</> : null}. O sistema vai avisar quando faltar ~3 meses para o fim do contrato.</p>}
      </section>

      {props.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">Confira o veículo, o preço, o nome e o WhatsApp do cliente.</p>}
      <button className="rounded-lg bg-brand px-6 py-3 font-bold text-white hover:bg-brand-dark">Registrar venda</button>
      <p className="text-xs text-slate-500">Ao registrar, o veículo sai do site, a comissão entra nos custos do carro e o sistema cria as tarefas de pós-venda e renovação do cliente.</p>
    </form>
  );
}
