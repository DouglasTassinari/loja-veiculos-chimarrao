import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Segredos e assinaturas. Em desenvolvimento há senha e segredo padrão; em produção, sem
// ERP_PASSWORD e ERP_SECRET definidos, o ERP fica fechado (ninguém entra).
export const isProd = process.env.NODE_ENV === "production";
// Sem ERP_SECRET (produção mal configurada) os tokens usam uma chave aleatória só deste processo.
const PROCESS_KEY = randomBytes(24).toString("hex");

export const secret = () => process.env.ERP_SECRET ?? (isProd ? "" : "dev-secret-troque-em-producao");
export const password = () => process.env.ERP_PASSWORD ?? (isProd ? "" : "admin123");
export const configured = () => secret().length >= 16 && password().length >= 8;

export function sign(value: string): string {
  return createHmac("sha256", secret() || PROCESS_KEY).update(value).digest("hex");
}

// Token que prova que quem atualiza um lead é quem o criou (o cliente guarda o token).
export function leadToken(id: number): string {
  return sign(`lead:${id}`).slice(0, 24);
}

export function validLeadToken(id: number, token: string): boolean {
  const a = Buffer.from(leadToken(id));
  const b = Buffer.from(String(token).padEnd(24, " ").slice(0, 24));
  return a.length === b.length && timingSafeEqual(a, b);
}
