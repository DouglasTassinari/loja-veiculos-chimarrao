import Link from "next/link";
import { notFound } from "next/navigation";
import { costsOf, vehicleById } from "@/lib/data";
import { brl, fmtDate, km, todayISO, vehicleTitle } from "@/lib/finance";
import { addVehicleCost, removeCost, saveVehicle } from "../../../../actions";
import { AlertList, Card, Field, Stat, StatusPill, btn, btnGhost } from "../../../ui";

export const dynamic = "force-dynamic";

const categories = ["Mecânica", "Estética", "Funilaria", "Documentação", "Transporte", "Comissão", "Anúncio", "Outros"];

export default async function Ficha({ params, searchParams }: PageProps<"/erp/veiculos/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const v = await vehicleById(Number(id));
  if (!v) notFound();
  const costs = await costsOf(v.id);
  const a = v.analysis;
  const sold = v.status === "vendido";
  const today = todayISO();
  const byCat = costs.reduce<Record<string, number>>((m, c) => ((m[c.category] = (m[c.category] ?? 0) + c.amount), m), {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/erp/veiculos" className="text-sm text-slate-500 hover:text-brand">← Estoque</Link>
          <h1 className="text-2xl font-extrabold text-ink">{vehicleTitle(v)} <span className="font-normal text-slate-500">{v.year_model}</span></h1>
          <p className="text-sm text-slate-600">{v.plate} · {km(v.km)} km · {v.transmission} · {v.color}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill s={v.status} />
          {(v.published || sold) && <Link href={`/veiculo/${v.slug}`} target="_blank" className={btnGhost}>Ver no site ↗</Link>}
        </div>
      </div>

      {sp.salvo && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Alterações salvas.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Custo total" value={brl(a.totalCost)} hint={`Compra ${brl(v.purchase_price)} + custos ${brl(a.extraCosts)}`} />
        <Stat label="Dias no estoque" value={`${a.days}`} tone={a.days >= 60 ? "bad" : a.days >= 45 ? "warn" : "default"} hint={`Compra em ${fmtDate(v.purchase_date)}`} />
        <Stat label="Custo do capital" value={brl(a.capitalCost)} hint={`${brl(a.capitalCostPerDay)} por dia parado`} tone="warn" />
        <Stat label={sold ? "Lucro realizado" : "Lucro estimado"} value={brl(a.profit)} tone={a.profit >= 0 ? "good" : "bad"} hint={`${sold ? "Venda" : "Preço"} ${brl(a.revenue)}`} />
        <Stat label="Margem líquida" value={`${a.marginPct.toFixed(1)}%`} tone={a.marginPct >= 8 ? "good" : a.marginPct >= 0 ? "warn" : "bad"} hint={`Piso sem prejuízo: ${brl(a.breakEven)}`} />
      </div>

      {(v.action || v.alertList.length > 0) && (
        <Card title="Atenção">
          {v.action && <p className="mb-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-900">Próxima ação: {v.action}</p>}
          <AlertList items={v.alertList} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Custos do veículo">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-2 font-semibold">Compra</td><td className="py-2 text-slate-500">{fmtDate(v.purchase_date)}</td><td className="py-2 text-right font-semibold">{brl(v.purchase_price)}</td><td /></tr>
              {costs.map((c) => (
                <tr key={c.id}>
                  <td className="py-2"><span className="font-medium">{c.category}</span><br /><span className="text-xs text-slate-500">{c.description}</span></td>
                  <td className="py-2 text-slate-500">{fmtDate(c.date)}</td>
                  <td className="py-2 text-right">{brl(c.amount)}</td>
                  <td className="py-2 pl-2 text-right">
                    <form action={removeCost}><input type="hidden" name="cost_id" value={c.id} /><input type="hidden" name="vehicle_id" value={v.id} /><button className="text-xs text-red-600 hover:underline" aria-label="Remover custo">remover</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {Object.keys(byCat).length > 0 && <p className="mt-3 text-xs text-slate-500">{Object.entries(byCat).map(([k, n]) => `${k}: ${brl(n)}`).join(" · ")}</p>}
          <form action={addVehicleCost} className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_110px_auto]">
            <input type="hidden" name="vehicle_id" value={v.id} />
            <select name="category" aria-label="Categoria">{categories.map((c) => <option key={c}>{c}</option>)}</select>
            <input name="description" placeholder="Descrição" aria-label="Descrição" />
            <input name="amount" inputMode="decimal" placeholder="Valor" required aria-label="Valor" />
            <button className={btn}>Lançar</button>
            <input name="date" type="date" defaultValue={today} className="sm:col-span-4" aria-label="Data" />
          </form>
        </Card>

        <Card title="Preço, status e publicação no site">
          <form action={saveVehicle} className="space-y-4">
            <input type="hidden" name="id" value={v.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Preço de venda (R$)"><input name="asking_price" inputMode="decimal" defaultValue={v.asking_price} /></Field>
              <Field label="FIPE (R$)"><input name="fipe_price" inputMode="decimal" defaultValue={v.fipe_price ?? ""} /></Field>
              <Field label="Piso de negociação"><input name="min_price" inputMode="decimal" defaultValue={v.min_price ?? ""} /></Field>
            </div>
            {v.fipe_price && <p className="text-xs text-slate-500">Preço {a.vsFipePct! >= 0 ? "acima" : "abaixo"} da FIPE em {Math.abs(a.vsFipePct!).toFixed(1)}%.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status"><select name="status" defaultValue={v.status}><option value="preparacao">Em preparação</option><option value="disponivel">Disponível</option><option value="reservado">Reservado</option>{sold && <option value="vendido">Vendido</option>}</select></Field>
              <Field label="Garantia de fábrica até (ano) — só se confirmada"><input name="factory_warranty_until" type="number" defaultValue={v.factory_warranty_until ?? ""} /></Field>
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={!!v.published} className="!w-auto" /> Publicar no site</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={!!v.featured} className="!w-auto" /> Destaque no site</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="single_owner" defaultChecked={!!v.single_owner} className="!w-auto" /> Único dono</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="inspected" defaultChecked={!!v.inspected} className="!w-auto" /> Vistoria realizada (laudo guardado)</label>
            </div>
            <Field label="Descrição do anúncio"><textarea name="description" rows={3} defaultValue={v.description} /></Field>
            <Field label="Fotos (uma URL por linha; a primeira é a capa)"><textarea name="photos" rows={3} defaultValue={v.photoList.join("\n")} placeholder="https://..." /></Field>
            <button className={btn}>Salvar</button>
          </form>
        </Card>
      </div>

      {!sold && (
        <Card title="Vender este veículo">
          <p className="text-sm text-slate-600">Registre o cliente, a forma de pagamento e, se for financiado, o prazo e a parcela. O sistema cria o cadastro do cliente e agenda o pós-venda e o aviso de fim do financiamento.</p>
          <Link href={`/erp/vendas/nova?vehicle=${v.id}`} className={`${btn} mt-3 inline-block`}>Registrar venda</Link>
          <p className="mt-2 text-xs text-slate-500">O carro sai da vitrine (a página continua no ar como “vendido”, para SEO) e a comissão entra nos custos.</p>
        </Card>
      )}
    </div>
  );
}
