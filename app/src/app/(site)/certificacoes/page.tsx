import type { Metadata } from "next";
import { store } from "@/lib/config";
import { certifications, visible } from "@/lib/content";
import { EmptyNote, ExampleBadge, LinkButton, PageHero, Section } from "../../components/ui";

export const metadata: Metadata = {
  title: "Certificações e licenças",
  description: `Cadastros, licenças e certificações da ${store.name}.`,
  alternates: { canonical: "/certificacoes" },
};

export default function Certificacoes() {
  const items = visible(certifications);
  return (
    <>
      <PageHero eyebrow="Transparência" title="Certificações e licenças">
        Os documentos que permitem à loja funcionar e vender veículos, para você conferir com tranquilidade.
      </PageHero>
      <Section title="Documentos da loja">
        {items.length === 0 ? (
          <EmptyNote>Estamos organizando os documentos da loja para publicar aqui. Enquanto isso, a equipe pode mostrar qualquer um deles na visita.</EmptyNote>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((c) => (
              <article key={c.title} className="rounded-2xl border border-sand bg-white p-5">
                <p className="font-extrabold text-ink">{c.title}<ExampleBadge confirmed={c.confirmed} /></p>
                <p className="text-xs font-semibold text-accent-ink">{c.issuer}</p>
                <p className="mt-2 text-sm text-slate-600">{c.text}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-slate-500">Número</dt><dd className="font-semibold text-ink">{c.confirmed && c.number ? c.number : "a informar"}</dd></div>
                  <div><dt className="text-slate-500">Validade</dt><dd className="font-semibold text-ink">{c.confirmed && c.validUntil ? c.validUntil : "a informar"}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        )}
        {store.preview && <p className="mt-4 text-xs text-slate-500">Versão de demonstração: os números e validades são preenchidos pela loja com os documentos reais. Itens marcados como exemplo não aparecem na versão final até serem confirmados.</p>}
      </Section>
      <Section title="Quer ver os documentos?">
        <p className="mb-4 text-slate-700">Peça à equipe para ver os originais na loja antes de fechar negócio.</p>
        <LinkButton href="/contato">Falar com a loja</LinkButton>
      </Section>
    </>
  );
}
