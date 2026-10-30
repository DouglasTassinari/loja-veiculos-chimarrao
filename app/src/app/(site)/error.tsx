"use client";

import { useEffect } from "react";
import Link from "next/link";

// Falha ao montar uma página do site (banco fora do ar, por exemplo). O visitante vê um recado em
// português com saída, nunca a tela de erro do Next nem detalhes internos.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Falha ao abrir a página", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-ink">Ops</p>
      <h1 className="mt-3 text-3xl font-extrabold text-brand md:text-4xl">Esta página não carregou</h1>
      <p className="mt-3 text-slate-600">
        Foi uma falha nossa, não sua. Tente de novo em um instante — se continuar, fale com a equipe pelo WhatsApp
        que a gente resolve por lá.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="rounded-lg bg-brand px-6 py-3 font-bold text-white hover:bg-brand-dark">Tentar de novo</button>
        <Link href="/estoque" className="rounded-lg border border-brand/30 px-6 py-3 font-bold text-brand hover:bg-sand/40">Ver o estoque</Link>
        <Link href="/" className="rounded-lg border border-brand/30 px-6 py-3 font-bold text-brand hover:bg-sand/40">Ir para o início</Link>
      </div>
      {error.digest && <p className="mt-8 text-xs text-slate-400">Código da falha: {error.digest}</p>}
    </div>
  );
}
