import { appendLeadMessage, chatVehicles, createLead, findRecentLead } from "@/lib/data";
import { leadToken } from "@/lib/token";
import { store } from "@/lib/config";
import { reply } from "@/lib/chat/engine";
import { sanitizeState } from "@/lib/chat/state";
import type { Input } from "@/lib/chat/types";
import { getRates } from "@/lib/rates";
import { normalizePhone, validName } from "@/lib/phone";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

function parseInput(raw: unknown): Input | null {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Record<string, unknown>;
  if (i.type === "start") return { type: "start", path: typeof i.path === "string" ? i.path.slice(0, 120) : undefined };
  if (i.type === "text" && typeof i.text === "string") return { type: "text", text: i.text.slice(0, 300) };
  if (i.type === "pick" && Number.isInteger(i.id)) return { type: "pick", id: Number(i.id) };
  return null;
}

export async function POST(req: Request) {
  if (!allow(`chat:${clientIp(req)}`, 80, 10 * 60e3)) return Response.json({ ok: false, error: "Muitas mensagens em pouco tempo. Aguarde um instante." }, { status: 429 });
  let body: { state?: unknown; input?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Requisição inválida." }, { status: 400 }); }
  const input = parseInput(body.input);
  if (!input) return Response.json({ ok: false, error: "Mensagem inválida." }, { status: 400 });

  const [vehicles, rates] = await Promise.all([chatVehicles(), getRates()]);
  const out = reply(sanitizeState(body.state), input, {
    vehicles, rates,
    store: { name: store.name, short: store.short, city: store.city, state: store.state, address: store.address, phone: store.phoneLabel, whatsapp: store.whatsapp, whatsappLabel: store.whatsappLabel, hours: store.hours, offers: store.offers },
  });

  // Efeito: registrar o lead no ERP (só com nome, WhatsApp válido e consentimento).
  if (out.effect && allow(`chatlead:${clientIp(req)}`, 10, 10 * 60e3)) {
    const { name, phone, vehicleId, message } = out.effect;
    const nm = validName(name), ph = normalizePhone(phone);
    if (nm && ph) {
      const existing = await findRecentLead(ph, vehicleId, "chat");
      const id = existing ?? (await createLead({ vehicle_id: vehicleId, name: nm, phone: ph, message, source: "chat" }));
      if (existing) await appendLeadMessage(id, message);
      out.state.contact.id = id;
      out.state.contact.token = leadToken(id);
    }
  }
  return Response.json({ ok: true, state: out.state, messages: out.messages });
}
