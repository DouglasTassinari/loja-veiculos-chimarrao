import "server-only";

// Limite simples por IP, em memória (suficiente para o MVP; em várias instâncias cada uma conta separado).
const hits = new Map<string, { n: number; reset: number }>();

// Tentativas de senha do ERP permitidas por IP antes de bloquear, e por quanto tempo a contagem vale.
// Impede que alguém fique chutando senha até acertar.
export const LOGIN_TRIES = 8;
export const LOGIN_WINDOW_MS = 15 * 60e3;

export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return true;
  }
  h.n++;
  return h.n <= max;
}

// Zera a contagem de uma chave (ex.: o login certo apaga as tentativas erradas anteriores).
export function reset(key: string): void {
  hits.delete(key);
}

// Quantos pedidos ainda cabem na janela desta chave (0 = bloqueado).
export function remaining(key: string, max: number): number {
  const h = hits.get(key);
  if (!h || h.reset < Date.now()) return max;
  return Math.max(max - h.n, 0);
}

type HeaderBag = { get(name: string): string | null };

export function ipFromHeaders(h: HeaderBag): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function clientIp(req: Request): string {
  return ipFromHeaders(req.headers);
}
