import Image from "next/image";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { dueTaskCount } from "@/lib/crm-data";
import { developer, store } from "@/lib/config";
import { TazzinMark } from "@/app/components/TazzinMark";
import { logout } from "../../actions";

export const metadata = { title: { default: "ERP", template: "%s | ERP" }, robots: { index: false, follow: false } };

const nav = [
  { href: "/erp", label: "Painel" },
  { href: "/erp/veiculos", label: "Estoque" },
  { href: "/erp/leads", label: "Funil" },
  { href: "/erp/clientes", label: "Clientes" },
  { href: "/erp/tarefas", label: "Tarefas" },
  { href: "/erp/vendas", label: "Vendas" },
  { href: "/erp/caixa", label: "Caixa" },
];

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const due = await dueTaskCount();
  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-brand text-paper">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/erp" className="flex items-center gap-2 font-extrabold">
            <Image src="/brand/simbolo.png" alt="" width={32} height={32} className="h-8 w-8" />
            {store.short} <span className="font-normal text-accent-soft">ERP</span>
          </Link>
          <nav className="order-last flex w-full gap-1 overflow-x-auto text-sm md:order-none md:w-auto md:flex-1" aria-label="Menu do ERP">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 hover:bg-white/10">
                {n.label}
                {n.href === "/erp/tarefas" && due > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white" aria-label={`${due} tarefas para hoje ou atrasadas`}>{due}</span>}
              </Link>
            ))}
          </nav>
          <Link href="/" target="_blank" className="text-sm text-slate-300 hover:text-white">Ver site ↗</Link>
          <form action={logout}><button className="text-sm text-slate-300 hover:text-white">Sair</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-center text-xs text-slate-500">
        ERP e CRM desenvolvidos pela{" "}
        <a href={developer.url} target="_blank" rel="noopener noreferrer" aria-label="Tazzin" className="inline-flex items-center gap-1.5 align-middle font-bold tracking-wider text-brand"><TazzinMark />{developer.name}</a>
        {" "}· {developer.tagline}
      </footer>
    </div>
  );
}
