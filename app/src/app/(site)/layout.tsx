import Image from "next/image";
import Link from "next/link";
import { store } from "@/lib/config";
import { WhatsAppIcon, waLink } from "../components/site";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: store.name,
    url: store.siteUrl,
    telephone: store.phoneLabel,
    address: { "@type": "PostalAddress", streetAddress: store.address, addressLocality: store.city, addressRegion: store.state, addressCountry: "BR" },
  };
  const hello = waLink(`Olá! Estava olhando o site da ${store.short} e quero falar com a equipe.`);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <header className="sticky top-0 z-30 bg-brand text-paper shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
          <Link href="/" aria-label={`${store.name} — página inicial`} className="shrink-0">
            <Image src="/brand/logo-horizontal-negativo.png" alt={store.name} width={691} height={201} priority className="h-14 w-auto" />
          </Link>
          <nav className="ml-auto hidden items-center gap-7 text-sm font-semibold md:flex">
            <Link href="/estoque" className="hover:text-sand">Estoque</Link>
            <a href={waLink(`Olá! Quero avaliar meu carro para a troca na ${store.short}.`)} className="hover:text-sand">Avaliar meu carro</a>
            <a href="#contato" className="hover:text-sand">Contato</a>
          </nav>
          <Link href="/estoque" className="ml-auto text-sm font-bold md:hidden">Estoque</Link>
          <a href={hello} className="inline-flex items-center gap-2 rounded-lg bg-wa px-4 py-2 text-sm font-bold text-white hover:bg-wa-dark">
            <WhatsAppIcon className="h-4 w-4" /> <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer id="contato" className="mt-16 bg-brand text-sand">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
          <div>
            <Image src="/brand/logo-horizontal-negativo.png" alt={store.name} width={691} height={201} className="h-14 w-auto" />
            <p className="mt-3 text-sm">Seminovos e usados em {store.city}/{store.state}.</p>
          </div>
          <div className="text-sm">
            <p className="font-bold text-paper">Fale com a gente</p>
            <p className="mt-2">{store.address}</p>
            <p>Telefone: {store.phoneLabel}</p>
            <p>WhatsApp: {store.whatsappLabel}</p>
          </div>
          <div className="text-sm">
            <p className="font-bold text-paper">Navegue</p>
            <ul className="mt-2 space-y-1">
              <li><Link href="/estoque" className="hover:text-paper">Todo o estoque</Link></li>
              <li><Link href="/estoque?body=SUV" className="hover:text-paper">SUVs</Link></li>
              <li><Link href="/estoque?body=Hatch" className="hover:text-paper">Hatches</Link></li>
              <li><Link href="/estoque?body=Sed%C3%A3" className="hover:text-paper">Sedãs</Link></li>
            </ul>
          </div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs text-sand/70">© {new Date().getFullYear()} {store.name}. Financiamento sujeito à análise de crédito.</p>
      </footer>
      <a href={hello} aria-label="Falar no WhatsApp" className="wa-float fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-wa text-white shadow-lg hover:bg-wa-dark">
        <WhatsAppIcon className="h-7 w-7" />
      </a>
    </>
  );
}
