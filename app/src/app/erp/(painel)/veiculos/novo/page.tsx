import { todayISO } from "@/lib/finance";
import { newVehicle } from "../../../../actions";
import { Card, Field, btn } from "../../../ui";

export const metadata = { title: "Novo veículo" };

export default function Novo() {
  const year = new Date().getFullYear();
  const today = todayISO();
  return (
    <form action={newVehicle} className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-extrabold text-ink">Novo veículo (entrada no estoque)</h1>
      <Card title="Identificação">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Placa"><input name="plate" required maxLength={8} /></Field>
          <Field label="Marca"><input name="brand" required /></Field>
          <Field label="Modelo"><input name="model" required /></Field>
          <Field label="Versão" className="sm:col-span-2"><input name="version" /></Field>
          <Field label="Carroceria"><select name="body">{["Hatch", "Sedã", "SUV", "Picape", "Utilitário", "Outro"].map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Ano fabricação"><input name="year_fab" type="number" defaultValue={year} required /></Field>
          <Field label="Ano modelo"><input name="year_model" type="number" defaultValue={year} required /></Field>
          <Field label="Km"><input name="km" type="number" min={0} required /></Field>
          <Field label="Câmbio"><select name="transmission"><option>Manual</option><option>Automático</option></select></Field>
          <Field label="Combustível"><select name="fuel">{["Flex", "Gasolina", "Diesel", "Híbrido", "Elétrico"].map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Cor"><input name="color" /></Field>
          <Field label="Motor"><input name="engine" placeholder="1.0 Turbo 130cv" /></Field>
        </div>
      </Card>
      <Card title="Compra e preço">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Valor de compra (R$)"><input name="purchase_price" inputMode="decimal" required /></Field>
          <Field label="Data da compra"><input name="purchase_date" type="date" defaultValue={today} required /></Field>
          <Field label="Preço de venda (R$)"><input name="asking_price" inputMode="decimal" required /></Field>
          <Field label="FIPE (R$)"><input name="fipe_price" inputMode="decimal" /></Field>
        </div>
        <p className="mt-3 text-xs text-slate-500">O carro entra como “Em preparação” e fora do site. Lance os custos na ficha e publique quando estiver pronto.</p>
      </Card>
      <button className={btn}>Salvar e abrir ficha</button>
    </form>
  );
}
