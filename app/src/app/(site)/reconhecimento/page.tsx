import type { Metadata } from "next";
import { store } from "@/lib/config";
import { recognitions, visible } from "@/lib/content";
import { EmptyNote, ExampleBadge, LinkButton, PageHero, Section } from "../../components/ui";

export const metadata: Metadata = {
  title: "Reconhecimento e feirões",
  description: `Feirões, eventos e reconhecimentos da ${store.name}.`,
  alternates: { canonical: "/reconhecimento" },
};

export default function Reconhecimento() {
  const items = visible(recognitions);
  return (
    <>
      <PageHero eyebrow="Reconhecimento" title="Feirões, eventos e reconhecimentos">
        Onde a loja esteve presente e o que foi reconhecido pelo mercado e pelos clientes.
      </PageHero>
      <Section title="Linha do tempo">
        {items.length === 0 ? (
          <EmptyNote>Estamos reunindo os registros de feirões e reconhecimentos. Em breve eles aparecem aqui.</EmptyNote>
        ) : (
          <ol className="space-y-4">
            {items.map((r) => (
              <li key={r.title} className="grid gap-3 rounded-2xl border border-sand bg-white p-5 sm:grid-cols-[7rem_1fr]">
                <div>
                  <p className="text-2xl font-extrabold text-brand">{r.year}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-accent-ink">{r.kind}</p>
                </div>
                <div>
                  <p className="font-extrabold text-ink">{r.title}<ExampleBadge confirmed={r.confirmed} /></p>
                  <p className="mt-1 text-sm text-slate-600">{r.text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        {store.preview && <p className="mt-4 text-xs text-slate-500">Na versão de demonstração os itens marcados como exemplo mostram como a página fica. Na versão real, só aparecem os registros confirmados pela loja.</p>}
      </Section>
      <Section title="Quer conhecer a loja?">
        <LinkButton href="/contato">Ver contato e como chegar</LinkButton>
      </Section>
    </>
  );
}
