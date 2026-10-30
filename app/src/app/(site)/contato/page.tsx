import type { Metadata } from "next";
import { store } from "@/lib/config";
import { mapDirectionsUrl, mapEmbedUrl } from "@/lib/content";
import { submitLead } from "../../actions";
import { WhatsAppIcon, waLink } from "../../components/site";
import { PageHero } from "../../components/ui";

export const metadata: Metadata = {
  title: "Contato e como chegar",
  description: `Endereço, telefone e WhatsApp da ${store.name} em ${store.city}/${store.state}. Veja o mapa e fale com a equipe.`,
  alternates: { canonical: "/contato" },
};

export default async function Contato({ searchParams }: PageProps<"/contato">) {
  const sp = await searchParams;
  return (
    <>
      <PageHero eyebrow="Contato" title="Fale com a equipe ou venha nos visitar">
        Veja os detalhes e combine o próximo passo com a loja.
      </PageHero>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-sand bg-white p-6">
            <h2 className="text-lg font-extrabold text-brand">Onde estamos</h2>
            <address className="mt-2 not-italic text-slate-700">{store.address}</address>
            <a target="_blank" rel="noopener noreferrer" href={mapDirectionsUrl()} className="mt-4 inline-flex rounded-lg border border-brand/30 px-4 py-2 text-sm font-bold text-brand hover:bg-sand/40">Como chegar (abre o mapa)</a>
          </section>

          <section className="rounded-2xl border border-sand bg-white p-6">
            <h2 className="text-lg font-extrabold text-brand">Canais de atendimento</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="text-slate-500">Telefone</dt><dd className="font-semibold text-ink"><a href={`tel:+55${store.phoneLabel.replace(/\D/g, "")}`} className="hover:text-brand">{store.phoneLabel}</a></dd></div>
              <div><dt className="text-slate-500">WhatsApp</dt><dd className="font-semibold text-ink">{store.whatsappLabel}</dd></div>
              <div><dt className="text-slate-500">Horário de atendimento</dt><dd className="font-semibold text-ink">{store.hours ?? "Confirme com a equipe pelo WhatsApp ou telefone."}</dd></div>
            </dl>
            <a target="_blank" rel="noopener noreferrer" href={waLink(`Olá! Estava no site da ${store.short} e quero falar com a equipe.`)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-wa px-5 py-3 font-bold text-white hover:bg-wa-dark"><WhatsAppIcon /> Chamar no WhatsApp</a>
          </section>

          <form action={submitLead} className="rounded-2xl border border-sand bg-white p-6">
            <h2 className="text-lg font-extrabold text-brand">Prefere que a gente retorne?</h2>
            <input type="hidden" name="back" value="/contato" />
            <input type="hidden" name="source" value="contato" />
            <div className="mt-3 space-y-3">
              <label className="block"><span className="lbl">Nome</span><input name="name" required minLength={2} autoComplete="name" /></label>
              <label className="block"><span className="lbl">WhatsApp com DDD</span><input name="phone" required inputMode="tel" autoComplete="tel" placeholder="(51) 90000-0000" /></label>
              <label className="block"><span className="lbl">Como podemos ajudar?</span><textarea name="message" rows={3} maxLength={500} /></label>
              <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" name="consent" required className="!mt-0.5 !w-auto" /> Concordo em ser contatado pela loja. Usamos seus dados só para isso (LGPD).</label>
            </div>
            <button className="mt-4 w-full rounded-lg bg-brand py-3 font-bold text-white hover:bg-brand-dark">Enviar</button>
            {sp.enviado && <p className="mt-3 rounded-lg bg-sand p-3 text-sm font-medium text-brand" role="status">Recebemos seu contato. A equipe vai falar com você.</p>}
            {sp.erro && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">Confira o nome, o WhatsApp com DDD e a autorização.</p>}
          </form>
        </div>

        <div className="overflow-hidden rounded-2xl border border-sand bg-white lg:sticky lg:top-24 lg:self-start">
          <iframe title={`Mapa: ${store.address}`} src={mapEmbedUrl()} className="h-96 w-full border-0 lg:h-[34rem]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <p className="p-3 text-xs text-slate-500">Mapa do Google. Se não carregar, use o botão “Como chegar”.</p>
        </div>
      </div>
    </>
  );
}
