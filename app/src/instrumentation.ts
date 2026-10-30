// Roda uma vez quando o servidor sobe. Liga o "sempre online" (ver lib/keepalive.ts) se KEEP_ALIVE=1.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Busca a taxa de referência do Banco Central já na subida: são várias idas e voltas e leva segundos.
  // Sem isso, quem abre o primeiro anúncio depois de o servidor subir espera por ela. Falhar aqui não
  // atrapalha: getRates cai sozinho na referência fixa e tenta de novo depois.
  void import("./lib/rates").then((m) => m.getRates()).catch(() => {});

  const { PING_EVERY_MS, inWindow, keepAliveEnabled, parseHours, publicUrl } = await import("./lib/keepalive");
  if (!keepAliveEnabled(process.env)) return;
  const url = publicUrl(process.env);
  if (!url) return;
  const hours = parseHours(process.env.KEEP_ALIVE_HOURS);
  const ping = async () => {
    if (!inWindow(new Date(), hours)) return;
    try {
      await fetch(`${url}/saude`, { cache: "no-store", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "chimarrao-keepalive" } });
    } catch {
      /* sem rede agora: tenta de novo no próximo ciclo */
    }
  };
  const timer = setInterval(ping, PING_EVERY_MS);
  timer.unref?.(); // não impede o servidor de encerrar
  void ping();
}
