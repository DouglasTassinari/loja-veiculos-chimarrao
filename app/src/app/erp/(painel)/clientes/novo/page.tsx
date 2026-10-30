import { newCustomerAction } from "../../../../actions";
import { Card, Field, btn } from "../../../ui";

export const metadata = { title: "Novo cliente" };

export default async function NovoCliente({ searchParams }: PageProps<"/erp/clientes/novo">) {
  const sp = await searchParams;
  return (
    <form action={newCustomerAction} className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-extrabold text-ink">Novo cliente</h1>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome"><input name="name" required minLength={2} /></Field>
          <Field label="WhatsApp com DDD"><input name="phone" required inputMode="tel" placeholder="(51) 90000-0000" /></Field>
          <Field label="E-mail (opcional)"><input name="email" type="email" /></Field>
          <Field label="Aniversário (opcional)"><input name="birthday" type="date" /></Field>
          <Field label="Observações" className="sm:col-span-2"><textarea name="notes" rows={3} /></Field>
        </div>
        {sp.erro && <p className="mt-3 text-sm text-red-700" role="alert">Confira o nome e o WhatsApp com DDD.</p>}
      </Card>
      <button className={btn}>Salvar cliente</button>
    </form>
  );
}
