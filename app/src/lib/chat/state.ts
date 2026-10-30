// O estado da conversa vem do navegador, então nunca é confiável: este validador só deixa passar
// campos conhecidos, com tipo e faixa corretos. Qualquer outra coisa é descartada.
import { normalizePhone, validName } from "../phone";
import { newState, type ChatState, type Slots, type Step, type Use } from "./types";

const STEPS: Step[] = ["start", "kind", "budget", "pay", "down", "need", "results", "ask_name", "ask_phone", "ask_consent", "trade_desc", "visit", "idle"];
const USES: Use[] = ["familia", "trabalho", "app", "cidade", "viagem", "trilha", "entrega", "primeiro", "economia", "esportivo", "luxo"];
const BODIES = ["Hatch", "Sedã", "SUV", "Picape", "Scooter", "Trail", "Esportiva", "Street"];
const PENDING = ["quote", "visit", "notify", "trade", "human"] as const;

const own = (o: unknown, k: string): unknown => (o && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k) ? (o as Record<string, unknown>)[k] : undefined);
const num = (v: unknown, min: number, max: number): number | undefined => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const int = (v: unknown, min: number, max: number): number | undefined => {
  const n = num(v, min, max);
  return n !== undefined && Number.isInteger(n) ? n : undefined;
};
const str = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.length > 0 ? v.slice(0, max) : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

export function sanitizeSlots(raw: unknown): Slots {
  const g = (k: string) => own(raw, k);
  const bodies = Array.isArray(g("bodies")) ? (g("bodies") as unknown[]).filter((b): b is string => typeof b === "string" && BODIES.includes(b)).slice(0, 4) : undefined;
  const s: Slots = {
    kind: oneOf(g("kind"), ["carro", "moto"] as const),
    budgetMax: num(g("budgetMax"), 0, 5_000_000), budgetMin: num(g("budgetMin"), 0, 5_000_000),
    down: num(g("down"), 0, 5_000_000), parcelMax: num(g("parcelMax"), 0, 100_000),
    pay: oneOf(g("pay"), ["avista", "financiar", "troca"] as const), trade: bool(g("trade")),
    tradeDesc: str(g("tradeDesc"), 160), tradeValue: num(g("tradeValue"), 0, 5_000_000),
    bodies: bodies && bodies.length ? bodies : undefined,
    brand: str(g("brand"), 40), model: str(g("model"), 40),
    trans: oneOf(g("trans"), ["Automático", "Manual"] as const), fuel: str(g("fuel"), 20),
    yearMin: int(g("yearMin"), 1980, 2030), kmMax: num(g("kmMax"), 0, 1_000_000), lowKm: bool(g("lowKm")),
    use: oneOf(g("use"), USES), months: int(g("months"), 12, 60),
    skippedNeed: bool(g("skippedNeed")), newer: bool(g("newer")), downPct: num(g("downPct"), 0, 0.9),
  };
  for (const k of Object.keys(s) as (keyof Slots)[]) if (s[k] === undefined) delete s[k];
  return s;
}

export function sanitizeState(raw: unknown): ChatState {
  const base = newState();
  if (!raw || typeof raw !== "object") return base;
  const c = own(raw, "contact");
  const name = typeof own(c, "name") === "string" ? validName(own(c, "name") as string) : null;
  const phone = typeof own(c, "phone") === "string" ? normalizePhone(own(c, "phone") as string) : null;
  const shown = own(raw, "shown");
  const clean: ChatState = {
    v: 1,
    step: oneOf(own(raw, "step"), STEPS) ?? "start",
    slots: sanitizeSlots(own(raw, "slots")),
    shown: Array.isArray(shown) ? shown.filter((x): x is number => Number.isInteger(x) && (x as number) > 0).slice(-60) : [],
    focus: int(own(raw, "focus"), 1, 1_000_000), ctxVehicle: int(own(raw, "ctxVehicle"), 1, 1_000_000),
    contact: {
      name: name ?? undefined, phone: phone ?? undefined,
      id: int(own(c, "id"), 1, 1_000_000_000), token: str(own(c, "token"), 40), consent: bool(own(c, "consent")),
    },
    pending: oneOf(own(raw, "pending"), PENDING),
    misses: int(own(raw, "misses"), 0, 5) ?? 0,
    turns: int(own(raw, "turns"), 0, 500) ?? 0,
    lastNeed: str(own(raw, "lastNeed"), 200),
  };
  return JSON.parse(JSON.stringify(clean)); // tira as chaves indefinidas
}
