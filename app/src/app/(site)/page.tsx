import Link from "next/link";
import { publicVehicles } from "@/lib/data";
import { store } from "@/lib/config";
import { VehicleCard, WhatsAppIcon, waLink } from "../components/site";

export const dynamic = "force-dynamic";

const categories = [
  { label: "SUVs", href: "/estoque?body=SUV" },
  { label: "Hatches", href: "/estoque?body=Hatch" },
  { label: "Sedãs", href: "/estoque?body=Sed%C3%A3" },
  { label: "Automáticos", href: "/estoque?trans=Autom%C3%A1tico" },
  { label: "Até R$ 70 mil", href: "/estoque?maxPrice=70000" },
  { label: "Até R$ 100 mil", href: "/estoque?maxPrice=100000" },
];

// Só informação que a loja pode sustentar. Nada de "revisado", "garantia" ou "procedência comprovada".
const info = [
  { t: "Fale com a equipe", d: "Tire dúvidas sobre qualquer veículo pelo WhatsApp ou por telefone." },
  { t: "Visite a loja", d: `Estamos em ${store.city}/${store.state}. Veja os detalhes e combine o próximo passo com a loja.` },
  { t: "Dados em cada anúncio", d: "Ano, quilometragem, câmbio, combustível, preço e disponibilidade em todas as páginas." },
  { t: "Troca e financiamento", d: "Consulte as condições com a equipe. A simulação no site é uma estimativa." },
];

export default async function Home() {
  const all = await publicVehicles();
  const featured = all.filter((v) => v.status === "disponivel").slice(0, 6);
  const total = all.filter((v) => v.status !== "vendido").length;
  return (
    <>
      <section className="relative overflow-hidden bg-brand text-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/estrada-textura.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-6 right-0 hidden w-[900px] max-w-none opacity-90 lg:block" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-20">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-accent-soft">{store.city} · {store.state}</p>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.05] md:text-6xl">Seu próximo caminho começa aqui.</h1>
          <p className="mt-4 max-w-xl text-lg text-sand">Encontre o veículo que combina com a sua próxima jornada. {total} veículos no estoque.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/estoque" className="rounded-lg bg-wa px-7 py-3.5 font-bold text-white hover:bg-wa-dark">Ver veículos</Link>
            <a target="_blank" rel="noopener noreferrer" href={waLink(`Olá! Quero falar com a equipe da ${store.short}.`)} className="inline-flex items-center gap-2 rounded-lg border border-sand/50 px-6 py-3.5 font-bold hover:bg-white/10"><WhatsAppIcon className="h-4 w-4" /> Falar no WhatsApp</a>
          </div>
          <form action="/estoque" className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input name="q" placeholder="Buscar: SUV automático, Compass, Onix…" className="!border-0 !py-3.5 text-ink" aria-label="Buscar no estoque" />
            <button className="rounded-lg bg-sand px-7 py-3.5 font-bold text-brand hover:brightness-95">Buscar</button>
          </form>
          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link key={c.label} href={c.href} className="rounded-full border border-sand/40 px-4 py-1.5 text-sm font-semibold hover:bg-white/10">{c.label}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold text-brand">Veículos em destaque</h2>
          <Link href="/estoque" className="text-sm font-bold text-wa hover:underline">Ver todos →</Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((v) => <VehicleCard key={v.id} v={v} />)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16">
        <h2 className="text-2xl font-extrabold text-brand">Como é falar com a {store.short}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {info.map((r) => (
            <div key={r.t} className="rounded-2xl border border-sand bg-white p-5">
              <div className="mb-3 h-1 w-8 rounded bg-accent" />
              <p className="font-extrabold text-ink">{r.t}</p>
              <p className="mt-2 text-sm text-slate-600">{r.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-sand p-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-extrabold text-brand">Tem um veículo para a troca?</h2>
            <p className="mt-2 text-ink/80">Envie as informações do seu carro e converse com a equipe.</p>
          </div>
          <a target="_blank" rel="noopener noreferrer" href={waLink(`Olá! Quero conversar sobre a troca do meu carro na ${store.short}.`)} className="inline-flex items-center gap-2 rounded-lg bg-wa px-6 py-3 font-bold text-white hover:bg-wa-dark">
            <WhatsAppIcon /> Conversar sobre a troca
          </a>
        </div>
      </section>
    </>
  );
}
