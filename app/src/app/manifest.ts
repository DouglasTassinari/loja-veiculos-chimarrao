import type { MetadataRoute } from "next";
import { store } from "@/lib/config";

// Faz o site poder ser salvo na tela inicial do celular, abrindo como um app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: store.name,
    short_name: store.short,
    description: `Carros seminovos e usados em ${store.city}/${store.state}.`,
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0f3d2e",
    theme_color: "#0f3d2e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
