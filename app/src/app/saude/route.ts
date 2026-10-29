import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

// Verificação de saúde (Render e monitor do GitHub): responde 200 só se o banco responde.
export async function GET() {
  try {
    await q("SELECT 1");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
