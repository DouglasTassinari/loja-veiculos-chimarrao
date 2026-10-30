import Image from "next/image";
import Link from "next/link";
import { developer, store } from "@/lib/config";
import ChatWidget from "../components/ChatWidget";
import { WhatsAppIcon, waLink } from "../components/site";

const nav = [
  { href: "/estoque", label: "Estoque" },
  { href: "/destaques", label: "Destaques" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  // Ficha da loja para o Google (busca local) e caixa de busca do site. Só entram dados confirmados:
  // o horário, por exemplo, fica de fora enquanto a loja não informar.
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AutoDealer",
        "@id": `${store.siteUrl}/#loja`,
        name: store.name,
        url: store.siteUrl,
        logo: `${store.siteUrl}/brand/logo-horizontal.png`,
        image: `${store.siteUrl}/brand/logo-horizontal.png`,
        telephone: store.phoneLabel,
        address: { "@type": "PostalAddress", streetAddress: store.address, addressLocality: store.city, addressRegion: store.state, addressCountry: "BR" },
        areaServed: { "@type": "City", name: `${store.city}, ${store.state}` },
        knowsLanguage: "pt-BR",
        ...(store.hours ? { openingHours: store.hours } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${store.siteUrl}/#site`,
        url: store.siteUrl,
        name: store.name,
        inLanguage: "pt-BR",
        publisher: { "@id": `${store.siteUrl}/#loja` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${store.siteUrl}/estoque?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
  const hello = waLink(`Olá! Estava olhando o site da ${store.short} e quero falar com a equipe.`);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      {store.preview && (
        <p className="bg-sand px-4 py-2 text-center text-xs font-semibold text-brand">
          Versão de demonstração: veículos, preços, fotos e contatos são exemplos e ainda não representam a loja.
        </p>
      )}
      <header className="sticky top-0 z-30 bg-brand text-paper shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
          <Link href="/" aria-label={`${store.name} — página inicial`} className="shrink-0">
            <Image src="/brand/logo-horizontal-negativo.png" alt={store.name} width={691} height={201} priority className="h-14 w-auto" />
          </Link>
          <nav className="ml-auto hidden items-center gap-7 text-sm font-semibold md:flex" aria-label="Principal">
            {nav.map((n) => <Link key={n.href} href={n.href} className="hover:text-sand">{n.label}</Link>)}
          </nav>
          <details className="relative ml-auto md:hidden">
            <summary className="cursor-pointer list-none rounded-lg border border-sand/40 px-3 py-2 text-sm font-bold">Menu</summary>
            <div className="absolute right-0 top-full z-40 mt-2 w-48 rounded-xl border border-sand bg-white p-2 text-ink shadow-xl">
              {nav.map((n) => <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-sand/50">{n.label}</Link>)}
            </div>
          </details>
          <a target="_blank" rel="noopener noreferrer" href={hello} aria-label="Falar no WhatsApp" className="inline-flex items-center gap-2 rounded-lg bg-wa px-4 py-2 text-sm font-bold text-white hover:bg-wa-dark">
            <WhatsAppIcon className="h-4 w-4" /> <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer id="contato" className="mt-16 bg-brand text-sand">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
          <div>
            <Image src="/brand/logo-horizontal-negativo.png" alt={store.name} width={691} height={201} className="h-14 w-auto" />
            <p className="mt-3 text-sm">Seminovos e usados em {store.city}/{store.state}.</p>
          </div>
          <div className="text-sm">
            <p className="font-bold text-paper">Fale com a gente</p>
            <p className="mt-2">{store.address}</p>
            <p>Telefone: {store.phoneLabel}</p>
            <p>WhatsApp: {store.whatsappLabel}</p>
            <Link href="/contato" className="mt-2 inline-block underline hover:text-paper">Mapa e como chegar</Link>
          </div>
          <div className="text-sm">
            <p className="font-bold text-paper">Estoque</p>
            <ul className="mt-2 space-y-1">
              <li><Link href="/estoque" className="hover:text-paper">Todo o estoque</Link></li>
              <li><Link href="/destaques" className="hover:text-paper">Destaques</Link></li>
              <li><Link href="/estoque?kind=carro" className="hover:text-paper">Carros</Link></li>
              <li><Link href="/estoque?kind=moto" className="hover:text-paper">Motos</Link></li>
              <li><Link href="/estoque?body=SUV" className="hover:text-paper">SUVs</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-bold text-paper">A loja</p>
            <ul className="mt-2 space-y-1">
              <li><Link href="/sobre" className="hover:text-paper">Sobre nós</Link></li>
              <li><Link href="/reconhecimento" className="hover:text-paper">Reconhecimento e feirões</Link></li>
              <li><Link href="/certificacoes" className="hover:text-paper">Certificações e licenças</Link></li>
              <li><Link href="/creditos" className="hover:text-paper">Créditos das fotos</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-sand/70">
          <p>© {new Date().getFullYear()} {store.name}. Financiamento sujeito à análise de crédito.</p>
          <p className="mt-1">
            Site e sistema de gestão desenvolvidos pela{" "}
            <a href={developer.url} target="_blank" rel="noopener noreferrer" className="font-bold text-sand underline hover:text-paper">{developer.name}</a>
            {" "}· {developer.tagline}
          </p>
        </div>
      </footer>
      <ChatWidget />
      <a target="_blank" rel="noopener noreferrer" href={hello} aria-label="Falar no WhatsApp" className="wa-float fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-wa text-white shadow-lg hover:bg-wa-dark">
        <WhatsAppIcon className="h-7 w-7" />
      </a>
    </>
  );
}
