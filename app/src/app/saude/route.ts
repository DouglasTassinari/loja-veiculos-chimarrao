import { dbMode, q } from "@/lib/db";
import { keepAliveEnabled } from "@/lib/keepalive";

export const dynamic = "force-dynamic";

// Verificação de saúde (Render e monitor do GitHub): responde 200 só se o banco responde.
// "banco" diz qual banco atende: "pg" (PostgreSQL), "sqlite" (local) ou "reserva" (demonstração sem o PostgreSQL).
export async function GET() {
  try {
    await q("SELECT 1");
    return Response.json({ ok: true, banco: await dbMode(), sempreOnline: keepAliveEnabled(process.env) });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
