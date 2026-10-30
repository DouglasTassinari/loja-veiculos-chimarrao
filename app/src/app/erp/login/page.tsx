import Image from "next/image";
import { login } from "../../actions";
import { store } from "@/lib/config";

export const metadata = { title: "Entrar no ERP", robots: { index: false } };

export default async function Login({ searchParams }: PageProps<"/erp/login">) {
  const sp = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand px-4">
      <form action={login} className="w-full max-w-sm rounded-2xl bg-paper p-8 shadow-xl">
        <Image src="/brand/logo-horizontal.png" alt={store.name} width={691} height={201} className="h-14 w-auto" />
        <h1 className="mt-5 text-2xl font-extrabold text-brand">Entrar no ERP</h1>
        <label className="mt-5 block"><span className="lbl">Senha</span><input name="password" type="password" required autoFocus autoComplete="current-password" /></label>
        {sp.erro === "espera" ? (
          <p className="mt-3 text-sm font-medium text-red-700" role="alert">Muitas tentativas deste computador. Espere alguns minutos e tente de novo.</p>
        ) : sp.erro ? (
          <p className="mt-3 text-sm font-medium text-red-700" role="alert">Senha incorreta.</p>
        ) : null}
        <button className="mt-5 w-full rounded-lg bg-brand py-3 font-bold text-white hover:bg-brand-dark">Acessar</button>
      </form>
    </div>
  );
}
