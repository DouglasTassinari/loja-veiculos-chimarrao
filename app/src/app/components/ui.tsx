import Link from "next/link";
import { store } from "@/lib/config";

export function PageHero({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="bg-brand text-paper">
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        {eyebrow && <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-accent-soft">{eyebrow}</p>}
        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">{title}</h1>
        {children && <div className="mt-4 max-w-2xl text-lg text-sand">{children}</div>}
      </div>
    </section>
  );
}

// Selo de item de exemplo: só aparece na versão de demonstração.
export function ExampleBadge({ confirmed }: { confirmed: boolean }) {
  if (confirmed || !store.preview) return null;
  return <span className="ml-2 inline-block rounded-full bg-sand px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-wa-dark">Exemplo</span>;
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-sand bg-white p-8 text-center text-slate-600">{children}</p>;
}

export function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-4 pt-12">
      <h2 className="mb-5 text-2xl font-extrabold text-brand">{title}</h2>
      {children}
    </section>
  );
}

export function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-block rounded-lg bg-wa px-6 py-3 font-bold text-white hover:bg-wa-dark">{children}</Link>;
}
