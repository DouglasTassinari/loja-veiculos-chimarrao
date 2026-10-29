import type { MetadataRoute } from "next";
import { allVehicles } from "@/lib/data";
import { store } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = store.siteUrl;
  const pages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/estoque`, changeFrequency: "daily", priority: 0.9 },
    ...["SUV", "Hatch", "Sedã"].map((b) => ({ url: `${base}/estoque?body=${encodeURIComponent(b)}`, changeFrequency: "daily" as const, priority: 0.7 })),
  ];
  const cars = allVehicles()
    .filter((v) => v.published || v.status === "vendido")
    .map((v) => ({ url: `${base}/veiculo/${v.slug}`, changeFrequency: "weekly" as const, priority: v.status === "vendido" ? 0.3 : 0.8 }));
  return [...pages, ...cars];
}
