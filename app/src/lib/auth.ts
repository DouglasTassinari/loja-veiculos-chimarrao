import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";

// Acesso simples ao ERP por senha única (MVP). Trocar por login com usuários e
// perfis (admin, vendedor, financeiro) na fase seguinte.
//
// Em desenvolvimento há senha e segredo padrão. Em produção, sem ERP_PASSWORD e
// ERP_SECRET definidos o ERP fica fechado: ninguém entra.
const COOKIE = "erp_session";
const isProd = process.env.NODE_ENV === "production";
const secret = () => process.env.ERP_SECRET ?? (isProd ? "" : "dev-secret-troque-em-producao");
const password = () => process.env.ERP_PASSWORD ?? (isProd ? "" : "admin123");
const configured = () => secret().length >= 16 && password().length >= 8;

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function checkPassword(input: string): boolean {
  if (!configured()) return false;
  const a = Buffer.from(sign(input));
  const b = Buffer.from(sign(password()));
  return timingSafeEqual(a, b);
}

export async function startSession() {
  const exp = String(Date.now() + 1000 * 60 * 60 * 12);
  const jar = await cookies();
  jar.set(COOKIE, `${exp}.${sign(exp)}`, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function requireSession() {
  if (!configured()) redirect("/erp/login");
  const raw = (await cookies()).get(COOKIE)?.value ?? "";
  const [exp, sig] = raw.split(".");
  const ok = !!exp && !!sig && sig.length === 64 && timingSafeEqual(Buffer.from(sig), Buffer.from(sign(exp))) && Number(exp) > Date.now();
  if (!ok) redirect("/erp/login");
}
