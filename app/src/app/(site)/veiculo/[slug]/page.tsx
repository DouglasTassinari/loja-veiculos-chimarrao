import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { vehicleBySlug, publicVehicles } from "@/lib/data";
import { brl, km, vehicleTitle } from "@/lib/finance";
import { store } from "@/lib/config";
import { submitLead } from "../../../actions";
import Simulator from "../../../components/Simulator";
import { CarImage, Seals, VehicleCard, WhatsAppIcon, carWa } from "../../../components/site";

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
  const similar = (await publicVehicles({ body: v.body })).filter((x) => x.id !== v.id && x.status !== "vendido").slice(0, 3);
  const spec: [string, string][] = [
    ["Ano/modelo", `${v.year_fab}/${v.year_model}`], ["Quilometragem", `${km(v.km)} km`], ["Câmbio", v.transmission],
    ["Combustível", v.fuel], ["Motor", v.engine || "—"], ["Cor", v.color || "—"], ["Portas", String(v.doors)], ["Carroceria", v.body],
  ];

  const ld = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: vehicleTitle(v),
    brand: { "@type": "Brand", name: v.brand },
    model: v.model,
    vehicleModelDate: String(v.year_model),
    mileageFromOdometer: { "@type": "QuantitativeValue", value: v.km, unitCode: "KMT" },
    fuelType: v.fuel,
    vehicleTransmission: v.transmission,
    color: v.color,
    image: v.photoList,
    offers: {
      "@type": "Offer", priceCurrency: "BRL", price: v.asking_price,
      availability: sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      seller: { "@type": "AutoDealer", name: store.name },
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 md:pb-6">
      {!sold && (
        <div data-sticky-cta className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-sand bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] md:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-500">{v.model} {v.version}</p>
            <p className="text-xl font-extrabold leading-tight text-brand">{brl(v.asking_price)}</p>
          </div>
          <a href={carWa(v, "quero falar com a equipe sobre este veículo")} className="flex items-center gap-2 rounded-lg bg-wa px-5 py-3 text-sm font-bold text-white hover:bg-wa-dark"><WhatsAppIcon className="h-4 w-4" /> Falar com a equipe</a>
        </div>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <nav className="mb-4 text-sm text-slate-500"><Link href="/" className="hover:text-brand">Início</Link> / <Link href="/estoque" className="hover:text-brand">Estoque</Link> / {v.brand}</nav>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="relative overflow-hidden rounded-2xl border border-sand">
            <CarImage v={v} priority className="aspect-[4/3] w-full" />
            {sold && <div className="absolute inset-0 flex items-center justify-center bg-ink/60 text-4xl font-extrabold tracking-widest text-white">VENDIDO</div>}
          </div>
          {v.photoList.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {v.photoList.slice(1, 9).map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p} src={p} alt="" className="aspect-[4/3] rounded-lg object-cover" loading="lazy" />
              ))}
            </div>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{v.brand}</p>
            <h1 className="text-2xl font-extrabold leading-tight text-ink">{v.model} {v.version}</h1>
            <p className="mt-1 text-sm text-slate-600">{v.year_model} · {km(v.km)} km · {v.transmission}</p>
            <div className="mt-3"><Seals v={v} /></div>
            {sold ? (
              <p className="mt-5 rounded-lg bg-slate-100 p-3 text-sm font-medium text-slate-700">Este carro já foi vendido. Veja similares abaixo ou peça uma busca para você.</p>
            ) : (
              <>
                <p className="mt-5 text-4xl font-extrabold text-brand">{brl(v.asking_price)}</p>
                {v.fipe_price && v.asking_price < v.fipe_price && <p className="text-sm font-semibold text-wa-dark">{brl(v.fipe_price - v.asking_price)} abaixo da tabela FIPE</p>}
              </>
            )}
            <div className="mt-5 grid gap-2">
              <a href={carWa(v, sold ? "quero algo parecido" : "quero falar sobre este carro")} className="flex items-center justify-center gap-2 rounded-lg bg-wa py-3 font-bold text-white hover:bg-wa-dark"><WhatsAppIcon /> Falar com a equipe</a>
              {!sold && <>
                <a href={carWa(v, "quero combinar uma visita")} className="rounded-lg border border-brand/30 py-2.5 text-center text-sm font-bold text-brand hover:bg-sand/40">Combinar visita</a>
                <a href={carWa(v, "quero conversar sobre a troca do meu usado")} className="rounded-lg border border-brand/30 py-2.5 text-center text-sm font-bold text-brand hover:bg-sand/40">Conversar sobre a troca</a>
                <a href={carWa(v, "pode me enviar mais fotos e vídeo")} className="rounded-lg border border-brand/30 py-2.5 text-center text-sm font-bold text-brand hover:bg-sand/40">Pedir mais fotos ou vídeo</a>
              </>}
            </div>
          </div>

          {!sold && <Simulator price={v.asking_price} waNumber={store.whatsapp} waBase={`Olá! Vi o ${vehicleTitle(v)} ${v.year_model} no site.`} />}

          {!sold && (
            <form action={submitLead} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-ink">Prefere que a gente ligue?</h3>
              <input type="hidden" name="vehicle_id" value={v.id} />
              <input type="hidden" name="back" value={`/veiculo/${v.slug}`} />
              <div className="mt-3 space-y-3">
                <label className="block"><span className="lbl">Nome</span><input name="name" required minLength={2} autoComplete="name" /></label>
                <label className="block"><span className="lbl">WhatsApp / telefone</span><input name="phone" required inputMode="tel" autoComplete="tel" placeholder="(51) 90000-0000" /></label>
                <label className="block"><span className="lbl">Mensagem (opcional)</span><textarea name="message" rows={2} maxLength={500} /></label>
              </div>
              <button className="mt-4 w-full rounded-lg bg-brand py-3 font-bold text-white hover:bg-brand-dark">Quero ser contatado</button>
              {sp.enviado && <p className="mt-3 rounded-lg bg-sand p-3 text-sm font-medium text-brand">Recebemos seu contato. A equipe vai falar com você.</p>}
              {sp.erro && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Confira o nome e o telefone com DDD.</p>}
              <p className="mt-3 text-[11px] text-slate-500">Usamos seus dados apenas para retornar o contato sobre este veículo (LGPD).</p>
            </form>
          )}
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-xl font-extrabold text-ink">Veja também</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{similar.map((s) => <VehicleCard key={s.id} v={s} />)}</div>
        </section>
      )}
    </div>
  );
}
