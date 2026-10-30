import type { Metadata } from "next";
import Link from "next/link";
import { publicVehicles } from "@/lib/data";
import { store } from "@/lib/config";
import { VehicleCard } from "../../components/site";

export const dynamic = "force-dynamic";
const PAGE = 24;

export async function generateMetadata({ searchParams }: PageProps<"/estoque">): Promise<Metadata> {
  const sp = await searchParams;
  const body = typeof sp.body === "string" ? sp.body : "";
  const brand = typeof sp.brand === "string" ? sp.brand : "";
  const kind = sp.kind === "moto" ? "motos" : sp.kind === "carro" ? "carros" : "";
  const what = [kind || (body ? `${body}s` : ""), brand].filter(Boolean).join(" ") || "carros e motos";
  return {
    title: `${what[0].toUpperCase()}${what.slice(1)} seminovos e usados em ${store.city}/${store.state}`,
    description: `Veja ${what} seminovos e usados em ${store.city}/${store.state}, com ano, quilometragem e preço. Simule a parcela e fale com a equipe.`,
    alternates: { canonical: "/estoque" },
  };
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function Estoque({ searchParams }: PageProps<"/estoque">) {
  const sp = await searchParams;
  const q = one(sp.q), brand = one(sp.brand), body = one(sp.body), trans = one(sp.trans), sort = one(sp.sort);
  const kind = one(sp.kind) === "moto" ? "moto" : one(sp.kind) === "carro" ? "carro" : "";
  const maxPrice = Number(one(sp.maxPrice)) || undefined;
  const page = Math.max(Number(one(sp.page)) || 1, 1);

  const universe = (await publicVehicles({ kind })).filter((v) => v.status !== "vendido");
  const list = await publicVehicles({ q, brand, body, trans, maxPrice, sort, kind });
  const brands = [...new Set(universe.map((v) => v.brand))].sort();
  const bodies = [...new Set(universe.map((v) => v.body))].sort();
  const available = list.filter((v) => v.status !== "vendido").length;
  const pages = Math.max(Math.ceil(list.length / PAGE), 1);
  const slice = list.slice((page - 1) * PAGE, page * PAGE);
  const prices = kind === "moto" ? [15000, 20000, 30000, 40000] : [30000, 60000, 90000, 130000, 200000];

  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = { q, brand, body, trans, sort, kind, maxPrice, ...over };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return `/estoque${s ? `?${s}` : ""}`;
  };
  const tab = (label: string, k: string) => (
    <Link key={label} href={qs({ kind: k, body: undefined, brand: undefined, page: undefined })} className={`rounded-full px-5 py-2 text-sm font-bold ${kind === k ? "bg-brand text-white" : "border border-sand bg-white text-brand hover:bg-sand/40"}`}>{label}</Link>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-extrabold text-brand">{kind === "moto" ? "Motos usadas" : kind === "carro" ? "Carros seminovos e usados" : "Carros e motos usados"}</h1>
      <p className="mt-1 text-slate-600">Encontre o veículo que combina com a sua próxima jornada. {available} disponíveis.</p>

      <div className="mt-5 flex flex-wrap gap-2">{tab("Todos", "")}{tab("Carros", "carro")}{tab("Motos", "moto")}</div>

      <form className="mt-4 grid gap-3 rounded-2xl border border-sand bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        {kind && <input type="hidden" name="kind" value={kind} />}
        <label className="lg:col-span-2"><span className="lbl">Busca</span><input name="q" defaultValue={q} placeholder="Modelo, marca, tipo…" /></label>
        <label><span className="lbl">Marca</span>
          <select name="brand" defaultValue={brand ?? ""}><option value="">Todas</option>{brands.map((b) => <option key={b}>{b}</option>)}</select></label>
        <label><span className="lbl">Tipo</span>
          <select name="body" defaultValue={body ?? ""}><option value="">Todos</option>{bodies.map((b) => <option key={b}>{b}</option>)}</select></label>
        <label><span className="lbl">Preço até</span>
          <select name="maxPrice" defaultValue={String(maxPrice ?? "")}>
            <option value="">Qualquer</option>
            {prices.map((p) => <option key={p} value={p}>R$ {p.toLocaleString("pt-BR")}</option>)}
          </select></label>
        <label><span className="lbl">Ordenar</span>
          <select name="sort" defaultValue={sort ?? ""}>
            <option value="">Recomendados</option><option value="menor-preco">Menor preço</option><option value="maior-preco">Maior preço</option>
            <option value="mais-novos">Mais novos</option><option value="menor-km">Menor km</option>
          </select></label>
        {trans && <input type="hidden" name="trans" value={trans} />}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button className="rounded-lg bg-brand px-6 py-2 text-sm font-bold text-white hover:bg-brand-dark">Filtrar</button>
          <Link href="/estoque" className="rounded-lg border border-brand/30 px-4 py-2 text-sm font-semibold text-brand hover:bg-sand/40">Limpar</Link>
        </div>
      </form>

      {list.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-white p-10 text-center text-slate-600">Nenhum veículo com esses filtros. <Link href="/estoque" className="font-semibold text-brand">Ver todo o estoque</Link></p>
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{slice.map((v) => <VehicleCard key={v.id} v={v} />)}</div>
          {pages > 1 && (
            <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Páginas">
              {page > 1 && <Link href={qs({ page: page - 1 })} className="rounded-lg border border-sand bg-white px-4 py-2 text-sm font-bold text-brand hover:bg-sand/40">‹ Anterior</Link>}
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={qs({ page: p })} aria-current={p === page ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-bold ${p === page ? "bg-brand text-white" : "border border-sand bg-white text-brand hover:bg-sand/40"}`}>{p}</Link>
              ))}
              {page < pages && <Link href={qs({ page: page + 1 })} className="rounded-lg border border-sand bg-white px-4 py-2 text-sm font-bold text-brand hover:bg-sand/40">Próxima ›</Link>}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
