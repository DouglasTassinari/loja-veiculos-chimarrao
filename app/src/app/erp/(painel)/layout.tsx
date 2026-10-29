import Image from "next/image";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { store } from "@/lib/config";
import { logout } from "../../actions";

export const metadata = { title: { default: "ERP", template: "%s | ERP" }, robots: { index: false, follow: false } };

const nav = [
  { href: "/erp", label: "Painel" },
  { href: "/erp/veiculos", label: "Estoque" },
  { href: "/erp/leads", label: "Leads" },
  { href: "/erp/caixa", label: "Caixa" },
];

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-brand text-paper">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/erp" className="flex items-center gap-2 font-extrabold">
            <Image src="/brand/simbolo.png" alt="" width={32} height={32} className="h-8 w-8" />
            {store.short} <span className="font-normal text-accent">ERP</span>
          </Link>
          <nav className="flex flex-1 gap-1 text-sm">
            {nav.map((n) => <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 hover:bg-white/10">{n.label}</Link>)}
          </nav>
          <Link href="/" target="_blank" className="text-sm text-slate-300 hover:text-white">Ver site ↗</Link>
          <form action={logout}><button className="text-sm text-slate-300 hover:text-white">Sair</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
