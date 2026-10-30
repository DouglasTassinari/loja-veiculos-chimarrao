// Tipos do assistente virtual (robô por regras, sem IA). Tudo aqui é serializável: o estado
// da conversa fica no navegador e viaja a cada mensagem; o servidor não guarda nada.
import type { Rates } from "../financing";

export type Kind = "carro" | "moto";
export type Use = "familia" | "trabalho" | "app" | "cidade" | "viagem" | "trilha" | "entrega" | "primeiro" | "economia" | "esportivo" | "luxo";
export type Pay = "avista" | "financiar" | "troca";

export type Slots = {
  kind?: Kind;
  budgetMax?: number;
  budgetMin?: number;
  down?: number;
  parcelMax?: number;
  pay?: Pay;
  trade?: boolean;
  tradeDesc?: string;
  tradeValue?: number;
  bodies?: string[];
  brand?: string;
  model?: string;
  trans?: "Automático" | "Manual";
  fuel?: string;
  yearMin?: number;
  kmMax?: number;
  lowKm?: boolean;
  use?: Use;
  months?: number;
  skippedNeed?: boolean;
  newer?: boolean;
  downPct?: number;
};

export type Step = "start" | "kind" | "budget" | "pay" | "down" | "need" | "results" | "ask_name" | "ask_phone" | "ask_consent" | "trade_desc" | "visit" | "idle";

export type ChatState = {
  v: 1;
  step: Step;
  slots: Slots;
  shown: number[];            // ids já mostrados
  focus?: number;             // veículo em foco (orçamento)
  ctxVehicle?: number;        // veículo da página em que o cliente está
  contact: { name?: string; phone?: string; id?: number; token?: string; consent?: boolean };
  pending?: "quote" | "visit" | "notify" | "human" | "trade";
  misses: number;
  turns: number;
  lastNeed?: string;          // última descrição do que o cliente procura (resumo para a equipe)
};

export type VehicleLite = {
  id: number; slug: string; kind: Kind; brand: string; model: string; version: string; body: string;
  year: number; km: number; trans: string; fuel: string; engine: string; color: string; price: number;
  fipe: number | null; featured: boolean; inspected: boolean; single: boolean; warranty: number | null; photo: string | null;
};

export type Card = {
  id: number; slug: string; title: string; year: number; km: number; trans: string; fuel: string;
  price: number; photo: string | null; tags: string[]; reasons: string[]; fit: "alta" | "boa" | "aprox";
};

export type Quote = {
  vehicleId: number; slug: string; title: string; price: number; mode: "avista" | "financiar";
  entry: number; trade: number; financed: number; iof: number;
  options: { months: number; parcel: number; low: number; high: number; total: number }[];
  chosenMonths: number; cetMonthly: number; rateRef: number; rateLabel: string; notes: string[]; waText: string;
};

export type Action = { label: string; href: string; external?: boolean };

export type Msg = { text: string; cards?: Card[]; quote?: Quote; chips?: string[]; actions?: Action[] };

export type Effect = { type: "lead"; name: string; phone: string; vehicleId: number | null; message: string };

export type Input =
  | { type: "start"; path?: string }
  | { type: "text"; text: string }
  | { type: "pick"; id: number };

export type StoreInfo = {
  name: string; short: string; city: string; state: string; address: string; phone: string; whatsapp: string; whatsappLabel: string;
  hours?: string | null; offers: { trade: boolean; financing: boolean };
};

export type Ctx = { vehicles: VehicleLite[]; rates: Rates; store: StoreInfo };

export type Reply = { state: ChatState; messages: Msg[]; effect?: Effect };

export const newState = (): ChatState => ({ v: 1, step: "start", slots: {}, shown: [], contact: {}, misses: 0, turns: 0 });
