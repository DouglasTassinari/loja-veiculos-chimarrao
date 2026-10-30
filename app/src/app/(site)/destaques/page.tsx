import type { Metadata } from "next";
import Link from "next/link";
import { store } from "@/lib/config";
import { publicVehicles } from "@/lib/data";
import { VehicleCard } from "../../components/site";
import { PageHero, Section } from "../../components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Destaques do estoque",
  description: `Os veículos em destaque da ${store.name}: seleção da equipe, oportunidades abaixo da FIPE e recém-chegados.`,
  alternates: { canonical: "/destaques" },
};

export default async function Destaques() {
  const all = (await publicVehicles()).filter((v) => v.status === "disponivel");
  const featured = all.filter((v) => v.featured);
  const deals = all
    .filter((v) => v.fipe_price && v.asking_price < v.fipe_price * 0.98 && !v.featured)
    .sort((a, b) => (a.asking_price / (a.fipe_price as number)) - (b.asking_price / (b.fipe_price as number)))
    .slice(0, 6);
  const fresh = [...all].filter((v) => !featured.includes(v) && !deals.includes(v)).sort((a, b) => (b.ready_date ?? "").localeCompare(a.ready_date ?? "")).slice(0, 6);
  return (
    <>
      <PageHero eyebrow="Destaques" title="A seleção da equipe">
        Veículos que a equipe separou para você olhar primeiro, e oportunidades com preço abaixo da tabela FIPE.
      </PageHero>
      <Section title="Seleção da equipe">
        {featured.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{featured.map((v) => <VehicleCard key={v.id} v={v} />)}</div> : <p className="text-slate-600">Em breve a equipe publica a seleção da semana.</p>}
      </Section>
      {deals.length > 0 && (
        <Section title="Abaixo da tabela FIPE">
          <p className="-mt-3 mb-5 text-sm text-slate-600">Preço do anúncio menor que a referência da tabela FIPE informada pela loja.</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{deals.map((v) => <VehicleCard key={v.id} v={v} />)}</div>
        </Section>
      )}
      {fresh.length > 0 && (
        <Section title="Chegaram há pouco">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{fresh.map((v) => <VehicleCard key={v.id} v={v} />)}</div>
        </Section>
      )}
      <div className="mx-auto mt-10 max-w-6xl px-4">
        <Link href="/estoque" className="inline-block rounded-lg bg-wa px-6 py-3 font-bold text-white hover:bg-wa-dark">Ver todo o estoque</Link>
      </div>
    </>
  );
}
