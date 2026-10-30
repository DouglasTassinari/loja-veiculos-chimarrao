import { dbMode, q } from "@/lib/db";
import { keepAliveEnabled } from "@/lib/keepalive";

export const dynamic = "force-dynamic";

const started = Date.now();
const noStore = { "Cache-Control": "no-store" };

// Verificação de saúde (Render e monitor do GitHub): responde 200 só se o banco responde.
// "banco" diz qual banco atende: "pg" (PostgreSQL), "sqlite" (local) ou "reserva" (demonstração sem o PostgreSQL).
// "versao" e "noArDesde" dizem qual publicação está rodando e há quanto tempo — é assim que se percebe
// que o serviço reiniciou sozinho ou que um deploy não subiu.
export async function GET() {
  try {
    const inicio = Date.now();
    await q("SELECT 1");
    return Response.json({
      ok: true,
      banco: await dbMode(),
      bancoMs: Date.now() - inicio,
      sempreOnline: keepAliveEnabled(process.env),
      versao: (process.env.RENDER_GIT_COMMIT ?? "local").slice(0, 7),
      noArHa: `${Math.round((Date.now() - started) / 60000)} min`,
    }, { headers: noStore });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: noStore });
  }
}
