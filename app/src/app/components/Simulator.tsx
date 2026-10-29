"use client";

import { useState } from "react";
import { brl, installment } from "@/lib/finance";

// Simulador indicativo. A taxa real depende da análise do banco.
export default function Simulator({ price, waBase, waNumber }: { price: number; waBase: string; waNumber: string }) {
  const [down, setDown] = useState(Math.round((price * 0.3) / 1000) * 1000);
  const [months, setMonths] = useState(48);
  const rate = 0.0199;
  const financed = Math.max(price - down, 0);
  const parcel = installment(financed, rate, months);
  const msg = `${waBase} Simulei entrada de ${brl(down)} em ${months}x (parcela aprox. ${brl(parcel)}). Pode me passar as condições reais?`;

  return (
    <div className="rounded-2xl border border-sand bg-white p-5">
      <h3 className="font-bold text-ink">Simule o financiamento</h3>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="lbl">Entrada: {brl(down)}</span>
          <input type="range" min={0} max={price} step={1000} value={down} onChange={(e) => setDown(Number(e.target.value))} className="!border-0 !p-0" />
        </label>
        <div>
          <span className="lbl">Prazo</span>
          <div className="flex gap-2">
            {[24, 36, 48, 60].map((m) => (
              <button key={m} type="button" onClick={() => setMonths(m)} className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${months === m ? "border-brand bg-brand text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>{m}x</button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-5 text-sm text-slate-600">Parcela estimada</p>
      <p className="text-3xl font-extrabold text-ink">{brl(parcel)}<span className="text-base font-medium text-slate-500">/mês</span></p>
      <p className="mt-2 text-xs text-slate-500">Estimativa com taxa de 1,99% a.m. Sujeito à análise de crédito e às condições do banco.</p>
      <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`} className="mt-4 block rounded-lg bg-wa py-3 text-center font-bold text-white hover:bg-wa-dark">Pedir condições à equipe</a>
    </div>
  );
}
