import { appendLeadMessage, createLead, findRecentLead } from "@/lib/data";
import { leadToken, validLeadToken } from "@/lib/token";
import { normalizePhone, validName } from "@/lib/phone";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const SOURCES = new Set(["simulador", "chat", "contato", "site"]);
const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

// Cria (ou reaproveita) um lead. Usado pelo simulador e pelo chat depois do nome e WhatsApp.
export async function POST(req: Request) {
  if (!allow(`lead:${clientIp(req)}`, 12, 10 * 60e3)) return bad("Muitas tentativas. Tente de novo em alguns minutos.", 429);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return bad("Requisição inválida."); }
  const name = validName(String(b.name ?? ""));
  const phone = normalizePhone(String(b.phone ?? ""));
  if (!name) return bad("Informe seu nome.");
  if (!phone) return bad("Informe um WhatsApp válido com DDD.");
  if (b.consent !== true) return bad("É preciso concordar em ser contatado.");
  const source = SOURCES.has(String(b.source)) ? String(b.source) : "site";
  const vehicleId = Number(b.vehicleId) > 0 ? Number(b.vehicleId) : null;
  const message = String(b.message ?? "").slice(0, 600);

  const existing = await findRecentLead(phone, vehicleId, source);
  const id = existing ?? (await createLead({ vehicle_id: vehicleId, name, phone, message, source }));
  if (existing && message) await appendLeadMessage(id, message);
  return Response.json({ ok: true, id, token: leadToken(id), name, phone });
}

// Acrescenta informações ao lead (ex.: resumo da simulação enviada à equipe).
export async function PATCH(req: Request) {
  if (!allow(`leadp:${clientIp(req)}`, 30, 10 * 60e3)) return bad("Muitas tentativas.", 429);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return bad("Requisição inválida."); }
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0 || !validLeadToken(id, String(b.token ?? ""))) return bad("Não autorizado.", 403);
  const message = String(b.message ?? "").slice(0, 600);
  if (message) await appendLeadMessage(id, message);
  return Response.json({ ok: true });
}
