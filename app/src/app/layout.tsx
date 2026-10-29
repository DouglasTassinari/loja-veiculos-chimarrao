import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { store } from "@/lib/config";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(store.siteUrl),
  ...(store.preview ? { robots: { index: false, follow: false } } : {}),
  title: { default: `${store.name} — Seminovos em ${store.city}/${store.state}`, template: `%s | ${store.short}` },
  description: `Carros seminovos e usados em ${store.city}/${store.state}. Veja os detalhes, simule a parcela e fale com a equipe.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
