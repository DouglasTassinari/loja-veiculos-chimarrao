import type { Metadata } from "next";
import { allVehicles } from "@/lib/data";
import { parseCredits, vehicleTitle } from "@/lib/finance";
import { PageHero, Section } from "../../components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Créditos das fotos", robots: { index: false } };

export default async function Creditos() {
  const list = (await allVehicles()).filter((v) => parseCredits(v).length > 0 && (v.published || v.status === "vendido"));
  return (
    <>
      <PageHero eyebrow="Transparência" title="Créditos das fotos">
        As fotos desta versão de demonstração vêm do Wikimedia Commons, com licença livre. Aqui estão os autores e as licenças.
      </PageHero>
      <Section title="Fotos por veículo">
        <div className="space-y-6">
          {list.map((v) => (
            <article key={v.id} className="rounded-2xl border border-sand bg-white p-5">
              <h2 className="font-extrabold text-ink">{vehicleTitle(v)} {v.year_model}</h2>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {parseCredits(v).map((c) => {
                  const [author, license, url] = c.split(" · ");
                  return <li key={c}>{author} · {license}{url && <> · <a href={url} target="_blank" rel="noopener noreferrer" className="underline">ver no Wikimedia Commons</a></>}</li>;
                })}
              </ul>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
