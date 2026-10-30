import { notFound } from "next/navigation";
import { leadById } from "@/lib/crm-data";
import { allVehicles } from "@/lib/data";
import { todayISO, vehicleTitle } from "@/lib/finance";
import SaleForm from "../../../SaleForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registrar venda" };

export default async function NovaVenda({ searchParams }: PageProps<"/erp/vendas/nova">) {
  const sp = await searchParams;
  const wanted = Number(typeof sp.vehicle === "string" ? sp.vehicle : "") || undefined;
  const leadId = Number(typeof sp.lead === "string" ? sp.lead : "") || undefined;
  const [vehicles, lead] = await Promise.all([allVehicles(), leadId ? leadById(leadId) : null]);
  const options = vehicles.filter((v) => v.status !== "vendido").map((v) => ({ id: v.id, title: `${vehicleTitle(v)} ${v.year_model}`, price: v.asking_price }));
  if (options.length === 0) notFound();
  // veículo já vendido (link antigo): abre o formulário sem ele, em vez de uma página de erro
  const vehicleId = wanted && options.some((o) => o.id === wanted) ? wanted : undefined;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-ink">Registrar venda</h1>
      <SaleForm vehicles={options} vehicleId={vehicleId} leadId={lead?.id} defaultName={lead?.name ?? ""} defaultPhone={lead?.phone ?? ""} today={todayISO()} error={!!sp.erro} />
    </div>
  );
}
