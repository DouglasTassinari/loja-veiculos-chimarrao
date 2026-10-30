import Image from "next/image";
import Link from "next/link";
import { store } from "@/lib/config";
import { brl, km, vehicleTitle } from "@/lib/finance";
import type { VehicleView } from "@/lib/data";

export function waLink(text: string): string {
  return `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function carWa(v: Pick<VehicleView, "brand" | "model" | "version" | "year_model">, intent = "quero mais informações"): string {
  return waLink(`Olá! Vi o ${vehicleTitle(v)} ${v.year_model} no site da ${store.short} e ${intent}.`);
}

export function CarImage({ v, className = "", priority = false }: { v: VehicleView; className?: string; priority?: boolean }) {
  const src = v.photoList[0];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`${vehicleTitle(v)} ${v.year_model}`} className={`object-cover ${className}`} loading={priority ? "eager" : "lazy"} />;
  }
  return (
    <div className={`flex flex-col items-center justify-center gap-2 bg-brand ${className}`} role="img" aria-label={`${vehicleTitle(v)}: foto em breve`}>
      <Image src="/brand/simbolo.png" alt="" width={96} height={96} className="h-1/3 w-auto opacity-90" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sand/80">Fotos em breve</span>
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "blue" | "amber" | "red" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-brand/10 text-brand",
    blue: "bg-sand text-ink",
    amber: "bg-accent/15 text-wa-dark",
    red: "bg-red-100 text-red-800",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

// Selos calculados a partir dos dados do ERP, não digitados no site.
export function Seals({ v }: { v: VehicleView }) {
  const seals: { t: string; tone: "green" | "blue" | "amber" }[] = [];
  if (v.inspected) seals.push({ t: "Vistoria realizada", tone: "green" });
  if (v.single_owner) seals.push({ t: "Único dono", tone: "blue" });
  if (v.factory_warranty_until) seals.push({ t: `Garantia de fábrica até ${v.factory_warranty_until}`, tone: "blue" });
  if (v.fipe_price && v.asking_price < v.fipe_price * 0.98) seals.push({ t: "Abaixo da FIPE", tone: "amber" });
  const age = new Date().getFullYear() - v.year_model;
  if (age >= 3 && v.km / Math.max(age, 1) < 10000) seals.push({ t: "Baixa km por ano", tone: "green" });
  if (!seals.length) return null;
  return <div className="flex flex-wrap gap-1.5">{seals.map((s) => <Badge key={s.t} tone={s.tone}>{s.t}</Badge>)}</div>;
}

export function VehicleCard({ v }: { v: VehicleView }) {
  const sold = v.status === "vendido";
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-sand bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/veiculo/${v.slug}`} className="flex flex-1 flex-col">
        <div className="relative">
          <CarImage v={v} className="aspect-[4/3] w-full" />
          {sold && <div className="absolute inset-0 flex items-center justify-center bg-ink/60 text-2xl font-extrabold tracking-widest text-white">VENDIDO</div>}
          {v.status === "reservado" && <span className="absolute left-3 top-3 rounded-full bg-sand px-3 py-1 text-xs font-bold text-ink">RESERVADO</span>}
          {v.kind === "moto" && <span className="absolute right-3 top-3 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">MOTO</span>}
          {v.photoList.length > 1 && !sold && <span className="absolute bottom-2 right-2 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-semibold text-white">{v.photoList.length} fotos</span>}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-ink">{v.brand}</p>
          <h3 className="line-clamp-2 text-base font-extrabold leading-tight text-ink group-hover:text-brand">{v.model} {v.version}</h3>
          <p className="text-sm text-slate-600">{v.year_model} · {km(v.km)} km · {v.transmission}</p>
          <Seals v={v} />
          <div className="mt-auto pt-2">
            {sold ? <p className="text-sm font-medium text-slate-500">Indisponível · ver similares</p> : <p className="text-2xl font-extrabold text-brand">{brl(v.asking_price)}</p>}
          </div>
        </div>
      </Link>
      {!sold && (
        <a target="_blank" rel="noopener noreferrer" href={carWa(v, "quero saber mais sobre este veículo")} className="mx-4 mb-4 flex items-center justify-center gap-2 rounded-lg bg-wa py-2.5 text-sm font-bold text-white hover:bg-wa-dark">
          <WhatsAppIcon className="h-4 w-4" /> Falar com a equipe
        </a>
      )}
    </article>
  );
}

export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.4 2.5 1.5.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.8-.2 1.5Z" />
    </svg>
  );
}
