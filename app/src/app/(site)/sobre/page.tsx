import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { store } from "@/lib/config";
import { process as steps, values } from "@/lib/content";
import { publicVehicles } from "@/lib/data";
import { PageHero, Section } from "../../components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sobre a loja",
  description: `Conheça a ${store.name}, loja de seminovos e usados em ${store.city}/${store.state}: como atendemos e o que importa para nós.`,
  alternates: { canonical: "/sobre" },
};

export default async function Sobre() {
  const list = await publicVehicles();
  const stock = list.filter((v) => v.status !== "vendido");
  const cars = stock.filter((v) => v.kind === "carro").length;
  const bikes = stock.filter((v) => v.kind === "moto").length;
  return (
    <>
      <PageHero eyebrow={`${store.city} · ${store.state}`} title="Tradição que acolhe. Modernidade que move.">
        Uma loja de seminovos e usados que quer tornar a busca pelo próximo veículo mais clara, próxima e confiável.
      </PageHero>

      <Section title="O que nos move">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-4 text-slate-700">
            <p className="text-lg"><b className="text-brand">Propósito:</b> aproximar pessoas de novas jornadas por meio de uma experiência de compra mais simples e humana.</p>
            <p><b className="text-brand">Promessa:</b> confiança te leva mais longe. Ela une a segurança na hora de negociar à ideia de jornada e liberdade que um veículo representa.</p>
            <p>O nosso símbolo conta isso: a <b>cuia</b> representa as raízes; a <b>estrada</b> representa movimento, escolhas e novos caminhos.</p>
          </div>
          <div className="mx-auto rounded-3xl bg-brand p-6"><Image src="/brand/simbolo.png" alt="Símbolo da Chimarrão Veículos: cuia e estrada" width={180} height={180} className="h-36 w-36 md:h-44 md:w-44" /></div>
        </div>
      </Section>

      <Section title="Nosso jeito de atender">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => (
            <div key={v.t} className="rounded-2xl border border-sand bg-white p-5">
              <div className="mb-3 h-1 w-8 rounded bg-accent" />
              <p className="font-extrabold text-ink">{v.t}</p>
              <p className="mt-2 text-sm text-slate-600">{v.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Como funciona comprar aqui">
        <ol className="grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.t} className="rounded-2xl border border-sand bg-white p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">{i + 1}</span>
              <p className="mt-3 font-extrabold text-ink">{s.t}</p>
              <p className="mt-1 text-sm text-slate-600">{s.d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="O estoque hoje">
        <p className="text-slate-700">No momento temos <b>{cars} carros</b> e <b>{bikes} motos</b> disponíveis, todos usados. Cada anúncio mostra ano, quilometragem, câmbio, combustível, preço e disponibilidade atualizados.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/estoque" className="rounded-lg bg-wa px-6 py-3 font-bold text-white hover:bg-wa-dark">Ver estoque</Link>
          <Link href="/reconhecimento" className="rounded-lg border border-brand/30 px-6 py-3 font-bold text-brand hover:bg-sand/40">Reconhecimento e feirões</Link>
          <Link href="/certificacoes" className="rounded-lg border border-brand/30 px-6 py-3 font-bold text-brand hover:bg-sand/40">Certificações e licenças</Link>
          <Link href="/contato" className="rounded-lg border border-brand/30 px-6 py-3 font-bold text-brand hover:bg-sand/40">Como chegar</Link>
        </div>
      </Section>
    </>
  );
}
