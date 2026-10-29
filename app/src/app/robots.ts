import type { MetadataRoute } from "next";
import { store } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  if (store.preview) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/erp" },
    sitemap: `${store.siteUrl}/sitemap.xml`,
  };
}
