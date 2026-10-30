import type { NextConfig } from "next";
import { assetHeaders, erpHeaders, securityHeaders } from "./src/lib/headers";

const dev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false, // não anunciar qual tecnologia roda o site
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders(dev) },
      { source: "/erp/:path*", headers: erpHeaders() },
      { source: "/vehicles/:path*", headers: assetHeaders(86_400) }, // fotos: 1 dia
      { source: "/brand/:path*", headers: assetHeaders(604_800) }, // marca: 7 dias
    ];
  },
};

export default nextConfig;
