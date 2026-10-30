// "Sempre online" no plano grátis do Render: o serviço dorme após 15 min sem visitas, então, no horário da loja,
// o próprio servidor faz uma visita a si mesmo (pelo endereço público) a cada poucos minutos.
// Fora do horário ele pode dormir: as horas grátis do Render (750 por mês, somadas entre todos os serviços
// grátis da conta) não dariam para o mês inteiro ligado.
export const PING_EVERY_MS = 9 * 60_000;

export type Window = { from: number; to: number };

// "8-20" = das 8h às 20h (horário de Brasília). "0-24" = o dia todo.
export function parseHours(v: string | undefined): Window {
  const m = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec((v ?? "").trim());
  if (!m) return { from: 8, to: 20 };
  const from = Math.min(Number(m[1]), 24), to = Math.min(Number(m[2]), 24);
  return from < to ? { from, to } : { from: 8, to: 20 };
}

export function brasiliaHour(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(now)) % 24;
}

export function inWindow(now: Date, w: Window): boolean {
  const h = brasiliaHour(now);
  return h >= w.from && h < w.to;
}

// Ligado por padrão quando o servidor roda no Render (que define RENDER=true); KEEP_ALIVE=0 desliga, KEEP_ALIVE=1 força.
export function keepAliveEnabled(env: Record<string, string | undefined>): boolean {
  if (env.KEEP_ALIVE === "0") return false;
  return env.KEEP_ALIVE === "1" || env.RENDER === "true";
}

// Endereço público do próprio serviço (nunca localhost: a visita precisa entrar pela internet para contar).
export function publicUrl(env: Record<string, string | undefined>): string | null {
  const u = env.NEXT_PUBLIC_SITE_URL ?? env.RENDER_EXTERNAL_URL;
  return u && /^https:\/\//.test(u) ? u.replace(/\/$/, "") : null;
}
