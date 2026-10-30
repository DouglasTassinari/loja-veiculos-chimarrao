import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { vehicleBySlug, publicVehicles } from "@/lib/data";
import { brl, km, parseCredits, todayISO, vehicleTitle } from "@/lib/finance";
import { store } from "@/lib/config";
import { getRates } from "@/lib/rates";
import { submitLead } from "../../../actions";
import Gallery from "../../../components/Gallery";
import Simulator from "../../../components/Simulator";
import { Seals, VehicleCard, WhatsAppIcon, carWa } from "../../../components/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/veiculo/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const v = await vehicleBySlug(slug);
  if (!v || (!v.published && v.status !== "vendido")) return {};
  const title = `${vehicleTitle(v)} ${v.year_model} — ${brl(v.asking_price)}`;
  return {
    title,
    description: `${vehicleTitle(v)} ${v.year_model}, ${km(v.km)} km, ${v.transmission.toLowerCase()}, ${v.fuel.toLowerCase()}. ${brl(v.asking_price)}. ${store.name}, ${store.city}/${store.state}.`,
    alternates: { canonical: `/veiculo/${v.slug}` },
    openGraph: { title, images: v.photoList.slice(0, 1) },
  };
}

export default async function VehiclePage({ params, searchParams }: PageProps<"/veiculo/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const v = await vehicleBySlug(slug);
  if (!v || (!v.published && v.status !== "vendido")) notFound();
  const sold = v.status === "vendido";
  const moto = v.kind === "moto";
  const [rates, pool] = await Promise.all([sold ? null : getRates(), publicVehicles({ kind: v.kind })]);
  const similar = pool.filter((x) => x.id !== v.id && x.status !== "vendido" && (x.body === v.body || Math.abs(x.asking_price - v.asking_price) < v.asking_price * 0.25)).slice(0, 3);
  const credits = parseCredits(v);
  const spec: [string, string][] = [
    ["Ano/modelo", `${v.year_fab}/${v.year_model}`], ["Quilometragem", `${km(v.km)} km`], ["Câmbio", v.transmission],
    ["Combustível", v.fuel], [moto ? "Cilindrada" : "Motor", v.engine || "—"], ["Cor", v.color || "—"],
    moto ? ["Tipo", v.body] : ["Portas", String(v.doors)], moto ? ["Categoria", "Moto"] : ["Carroceria", v.body],
  ];

  const url = `${store.siteUrl}/veiculo/${v.slug}`;
  // Preço anunciado vale por 30 dias; depois disso o Google volta a conferir o anúncio.
  const priceValidUntil = todayISO(30);
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": moto ? "Product" : "Car",
        "@id": `${url}#veiculo`,
        name: `${vehicleTitle(v)} ${v.year_model}`,
        description: v.description,
        brand: { "@type": "Brand", name: v.brand },
        model: v.model,
        ...(moto ? {} : { vehicleModelDate: String(v.year_model), mileageFromOdometer: { "@type": "QuantitativeValue", value: v.km, unitCode: "KMT" }, fuelType: v.fuel, vehicleTransmission: v.transmission, numberOfDoors: v.doors }),
        color: v.color,
        image: v.photoList.map((p) => (p.startsWith("http") ? p : `${store.siteUrl}${p}`)),
        offers: {
          "@type": "Offer", url, priceCurrency: "BRL", price: v.asking_price, priceValidUntil,
          itemCondition: "https://schema.org/UsedCondition",
          availability: sold ? "https://schema.org/SoldOut" : v.status === "reservado" ? "https://schema.org/PreOrder" : "https://schema.org/InStock",
          seller: { "@type": "AutoDealer", name: store.name, "@id": `${store.siteUrl}/#loja` },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: store.siteUrl },
          { "@type": "ListItem", position: 2, name: moto ? "Motos" : "Carros", item: `${store.siteUrl}/estoque?kind=${v.kind}` },
          { "@type": "ListItem", position: 3, name: `${vehicleTitle(v)} ${v.year_model}` },
        ],
      },
    ],
  };
  const word = moto ? "moto" : "carro";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 md:pb-6">
      {!sold && (
        <div data-sticky-cta className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-sand bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] md:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-500">{v.model} {v.version}</p>
            <p className="text-xl font-extrabold leading-tight text-brand">{brl(v.asking_price)}</p>
          </div>
          <a target="_blank" rel="noopener noreferrer" href={carWa(v, "quero falar com a equipe sobre este veículo")} className="flex items-center gap-2 rounded-lg bg-wa px-5 py-3 text-sm font-bold text-white hover:bg-wa-dark"><WhatsAppIcon className="h-4 w-4" /> Falar com a equipe</a>
        </div>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <nav className="mb-4 text-sm text-slate-500"><Link href="/" className="hover:text-brand">Início</Link> / <Link href={`/estoque?kind=${v.kind}`} className="hover:text-brand">{moto ? "Motos" : "Carros"}</Link> / {v.brand}</nav>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <Gallery photos={v.photoList} alt={`${vehicleTitle(v)} ${v.year_model}`} sold={sold} />
          {v.photoList.length > 0 && store.preview && <p className="mt-2 text-xs text-slate-500">Fotos ilustrativas do modelo, só para a demonstração. Na loja real, cada anúncio usa as fotos do próprio veículo.</p>}
          {credits.length > 0 && (
            <details className="mt-2 text-xs text-slate-500">
              <summary className="cursor-pointer font-semibold">Créditos das fotos</summary>
              <ul className="mt-1 space-y-1">
                {credits.map((c) => {
                  const [author, license, url] = c.split(" · ");
                  return <li key={c}>{author} · {license}{url && <> · <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Wikimedia Commons</a></>}</li>;
                })}
              </ul>
            </details>
          )}

          <section className="mt-8">
            <h2 className="text-xl font-extrabold text-ink">Resumo técnico</h2>
            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
              {spec.map(([k, val]) => (
                <div key={k} className="bg-white p-3"><dt className="text-[11px] font-semibold uppercase text-slate-500">{k}</dt><dd className="mt-0.5 font-semibold text-ink">{val}</dd></div>
              ))}
            </dl>
            <p className="mt-4 text-slate-700">{v.description}</p>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-sand bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-ink">{v.brand}</p>
            <h1 className="text-2xl font-extrabold leading-tight text-ink">{v.model} {v.version}</h1>
            <p className="mt-1 text-sm text-slate-600">{v.year_model} · {km(v.km)} km · {v.transmission}</p>
            <div className="mt-3"><Seals v={v} /></div>
            {sold ? (
              <p className="mt-5 rounded-lg bg-slate-100 p-3 text-sm font-medium text-slate-700">Este {word} já foi vendido. Veja similares abaixo ou peça uma busca para você.</p>
            ) : (
              <>
                <p className="mt-5 text-4xl font-extrabold text-brand">{brl(v.asking_price)}</p>
                {v.fipe_price && v.asking_price < v.fipe_price && <p className="text-sm font-semibold text-wa-dark">{brl(v.fipe_price - v.asking_price)} abaixo da tabela FIPE</p>}
              </>
            )}
            <div className="mt-5 grid gap-2">
              <a target="_blank" rel="noopener noreferrer" href={carWa(v, sold ? "quero algo parecido" : `quero falar sobre ${moto ? "esta moto" : "este carro"}`)} className="flex items-center justify-center gap-2 rounded-lg bg-wa py-3 font-bold text-white hover:bg-wa-dark"><WhatsAppIcon /> Falar com a equipe</a>
              {!sold && <>
                <a target="_blank" rel="noopener noreferrer" href={carWa(v, "quero combinar uma visita")} className="rounded-lg border border-brand/30 py-2.5 text-center text-sm font-bold text-brand hover:bg-sand/40">Combinar visita</a>
                <a target="_blank" rel="noopener noreferrer" href={carWa(v, "quero conversar sobre a troca do meu usado")} className="rounded-lg border border-brand/30 py-2.5 text-center text-sm font-bold text-brand hover:bg-sand/40">Conversar sobre a troca</a>
                <a target="_blank" rel="noopener noreferrer" href={carWa(v, "pode me enviar mais fotos e vídeo")} className="rounded-lg border border-brand/30 py-2.5 text-center text-sm font-bold text-brand hover:bg-sand/40">Pedir mais fotos ou vídeo</a>
              </>}
            </div>
          </div>

          {!sold && rates && <Simulator vehicleId={v.id} title={`${vehicleTitle(v)} ${v.year_model}`} price={v.asking_price} age={Math.max(new Date().getFullYear() - v.year_model, 0)} kind={v.kind} rates={rates} waNumber={store.whatsapp} />}

          {!sold && (
            <form action={submitLead} className="rounded-2xl border border-sand bg-white p-5">
              <h3 className="font-extrabold text-ink">Prefere que a gente ligue?</h3>
              <input type="hidden" name="vehicle_id" value={v.id} />
              <input type="hidden" name="back" value={`/veiculo/${v.slug}`} />
              <div className="mt-3 space-y-3">
                <label className="block"><span className="lbl">Nome</span><input name="name" required minLength={2} autoComplete="name" /></label>
                <label className="block"><span className="lbl">WhatsApp com DDD</span><input name="phone" required inputMode="tel" autoComplete="tel" placeholder="(51) 90000-0000" /></label>
                <label className="block"><span className="lbl">Mensagem (opcional)</span><textarea name="message" rows={2} maxLength={500} /></label>
                <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" name="consent" required className="!mt-0.5 !w-auto" /> Concordo em ser contatado sobre este veículo. Usamos seus dados só para isso (LGPD).</label>
              </div>
              <button className="mt-4 w-full rounded-lg bg-brand py-3 font-bold text-white hover:bg-brand-dark">Quero ser contatado</button>
              {sp.enviado && <p className="mt-3 rounded-lg bg-sand p-3 text-sm font-medium text-brand" role="status">Recebemos seu contato. A equipe vai falar com você.</p>}
              {sp.erro && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{sp.erro === "espera" ? "Muitos envios em pouco tempo. Espere alguns minutos ou chame no WhatsApp." : "Confira o nome, o WhatsApp com DDD e a autorização."}</p>}
            </form>
          )}
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-xl font-extrabold text-brand">Veja também</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{similar.map((s) => <VehicleCard key={s.id} v={s} />)}</div>
        </section>
      )}
    </div>
  );
}
