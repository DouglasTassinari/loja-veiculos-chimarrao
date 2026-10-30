"use client";

import { useEffect } from "react";
import Link from "next/link";

// Falha dentro do ERP: o dono vê o que fazer, não a tela de erro do Next.
export default function ErpError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Falha no ERP", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-extrabold text-brand">Esta tela não carregou</h1>
      <p className="mt-3 text-slate-600">
        Nenhum dado foi perdido. Tente de novo; se continuar, o banco pode estar fora do ar — confira em
        <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">/saude</code>.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="rounded-lg bg-brand px-6 py-3 font-bold text-white hover:bg-brand-dark">Tentar de novo</button>
        <Link href="/erp" className="rounded-lg border border-brand/30 px-6 py-3 font-bold text-brand hover:bg-sand/40">Voltar ao painel</Link>
      </div>
      {error.digest && <p className="mt-8 text-xs text-slate-400">Código da falha: {error.digest}</p>}
    </div>
  );
}
