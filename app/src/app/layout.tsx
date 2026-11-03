import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { store } from "@/lib/config";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = `${store.name} — Seminovos em ${store.city}/${store.state}`;
const description = `Carros seminovos e usados em ${store.city}/${store.state}. Veja os detalhes, simule a parcela e fale com a equipe.`;

// Cor da barra do navegador/celular e da tela de abertura do app instalado (verde da marca).
export const viewport: Viewport = { themeColor: "#0f3d2e" };

export const metadata: Metadata = {
  metadataBase: new URL(store.siteUrl),
  ...(store.preview ? { robots: { index: false, follow: false } } : {}),
  title: { default: title, template: `%s | ${store.short}` },
  description,
  applicationName: store.name,
  // Ícone do iPhone/iPad e comportamento ao abrir pela tela inicial.
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: store.short, statusBarStyle: "default" },
  // Como o link do site aparece quando é mandado no WhatsApp ou postado numa rede social.
  openGraph: { type: "website", locale: "pt_BR", siteName: store.name, title, description },
  twitter: { card: "summary_large_image", title, description },
  formatDetection: { telephone: true, address: false, email: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
