import Link from "next/link";
import { store } from "@/lib/config";
import { WhatsAppIcon, waLink } from "./site";

// Conteúdo da página "não encontrado", usado tanto dentro do site (com cabeçalho e rodapé)
// quanto num endereço solto, que não passa pelo layout da loja.
export default function NotFoundContent() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-ink">Erro 404</p>
      <h1 className="mt-3 text-3xl font-extrabold text-brand md:text-4xl">Esta página não existe</h1>
      <p className="mt-3 text-slate-600">
        O endereço pode ter mudado, ou o veículo já foi vendido. Veja o estoque atual ou fale com a equipe:
        achamos o que combina com você.
      </p>

      <form action="/estoque" className="mx-auto mt-8 flex max-w-md gap-2">
        <input name="q" placeholder="Modelo, marca, tipo…" aria-label="Buscar no estoque" />
        <button className="shrink-0 rounded-lg bg-brand px-5 py-2 text-sm font-bold text-white hover:bg-brand-dark">Buscar</button>
      </form>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/estoque" className="rounded-lg bg-wa px-6 py-3 font-bold text-white hover:bg-wa-dark">Ver todo o estoque</Link>
        <Link href="/" className="rounded-lg border border-brand/30 px-6 py-3 font-bold text-brand hover:bg-sand/40">Ir para o início</Link>
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={waLink(`Olá! Procurei uma página no site da ${store.short} e não encontrei. Podem me ajudar?`)}
          className="inline-flex items-center gap-2 rounded-lg border border-brand/30 px-6 py-3 font-bold text-brand hover:bg-sand/40"
        >
          <WhatsAppIcon className="h-4 w-4" /> Falar no WhatsApp
        </a>
      </div>
    </div>
  );
}
