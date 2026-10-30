// Cabeçalhos de segurança enviados em toda resposta (aplicados em next.config.ts).
// Protegem contra: o site ser embutido em outra página (clickjacking), o navegador "adivinhar" o tipo de
// um arquivo, o endereço completo vazar para sites de fora e scripts de terceiros rodarem na página.
// Este arquivo não importa nada do projeto porque é lido pelo next.config.ts, fora do servidor.

export type Header = { key: string; value: string };

// O mapa de /contato é um iframe do Google; as fotos dos veículos podem ser endereços de fora
// (o ERP aceita uma URL por linha). O resto vem só do próprio site.
const MAP_FRAMES = "https://www.google.com https://maps.google.com";

export function contentSecurityPolicy(dev: boolean): string {
  const rules: string[] = [
    "default-src 'self'",
    // O Next injeta scripts na página para a hidratação; em desenvolvimento ele ainda usa eval.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Em desenvolvimento o Next usa websocket para atualizar a página sozinho.
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    `frame-src ${MAP_FRAMES}`,
    "media-src 'self'",
    "object-src 'none'", // nada de Flash/applets
    "base-uri 'self'", // ninguém reescreve o endereço base das ligações
    "form-action 'self'", // formulários só enviam para o próprio site
    "frame-ancestors 'none'", // ninguém embute o site num iframe
  ];
  if (!dev) rules.push("upgrade-insecure-requests");
  return rules.join("; ");
}

export function securityHeaders(dev: boolean): Header[] {
  const headers: Header[] = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(dev) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), interest-cohort=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
  ];
  // HSTS só faz sentido onde o site já roda em https (no Render, sim; na máquina do dev, não).
  if (!dev) headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  return headers;
}

// Fotos e logotipos são arquivos fixos, mas o Next os entrega com "max-age=0": o navegador volta ao
// servidor para conferir cada um a cada página aberta. Numa página de estoque são dezenas de idas e
// voltas — e no plano grátis o servidor pode estar dormindo. Guardar por um tempo acelera a navegação.
// "stale-while-revalidate" ainda deixa o navegador mostrar a foto antiga enquanto busca a nova.
export function assetHeaders(seconds: number): Header[] {
  return [{ key: "Cache-Control", value: `public, max-age=${seconds}, stale-while-revalidate=604800` }];
}

// O ERP é interno: nunca deve aparecer em busca nem ficar guardado no cache do navegador.
export function erpHeaders(): Header[] {
  return [
    { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    { key: "Cache-Control", value: "no-store, must-revalidate" },
  ];
}
