// Regras do CRM (puras): etapas do funil, tarefas automáticas de pós-venda e renovação, mensagens de WhatsApp.

export const STAGES = [
  { key: "novo", label: "Novo", hint: "Chegou agora" },
  { key: "contatado", label: "Contatado", hint: "Já falamos" },
  { key: "visita", label: "Visita", hint: "Visita marcada ou feita" },
  { key: "proposta", label: "Proposta", hint: "Proposta ou simulação enviada" },
  { key: "negociacao", label: "Negociação", hint: "Fechando condições" },
  { key: "ganho", label: "Ganho", hint: "Virou venda" },
  { key: "perdido", label: "Perdido", hint: "Não vai comprar" },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];
export const stageLabel = (k: string) => STAGES.find((s) => s.key === k)?.label ?? k;

const DAY = 86400000;

export function addDays(iso: string, n: number): string {
  const d = new Date(Date.parse(iso.slice(0, 10)) + n * DAY);
  return d.toISOString().slice(0, 10);
}

// Soma meses mantendo o dia (ou o último dia do mês, se o dia não existir).
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const total = m - 1 + n;
  const yy = y + Math.floor(total / 12);
  const mm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  return `${yy}-${String(mm + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export function daysUntil(iso: string, today: string): number {
  return Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(today.slice(0, 10))) / DAY);
}

export type TaskKind = "pos_venda_7" | "pos_venda_30" | "revisao_180" | "aniversario" | "renovacao_90" | "renovacao_15" | "renovacao_troca" | "retorno" | "visita" | "manual";

export const TASK_LABEL: Record<TaskKind, string> = {
  pos_venda_7: "Pós-venda · 7 dias",
  pos_venda_30: "Pós-venda · 30 dias",
  revisao_180: "Relacionamento · 6 meses",
  aniversario: "Aniversário da compra",
  renovacao_90: "Renovação · financiamento acaba em ~3 meses",
  renovacao_15: "Renovação · financiamento quase quitado",
  renovacao_troca: "Renovação · hora de pensar em trocar",
  retorno: "Retorno ao cliente",
  visita: "Visita",
  manual: "Tarefa",
};

export type SaleLike = {
  id?: number; sale_date: string; payment: string; months: number; vehicle_title: string; price: number;
};

export type NewTask = { kind: TaskKind; title: string; note: string; due_date: string };

export function financingEnd(s: Pick<SaleLike, "sale_date" | "months">): string | null {
  return s.months > 0 ? addMonths(s.sale_date, s.months) : null;
}

// Tarefas que nascem sozinhas quando uma venda é registrada.
export function buildSaleTasks(s: SaleLike): NewTask[] {
  const v = s.vehicle_title;
  const out: NewTask[] = [
    { kind: "pos_venda_7", due_date: addDays(s.sale_date, 7), title: `Pós-venda: o ${v} está tudo certo?`, note: "Ligar ou mandar mensagem: como foi a primeira semana, dúvidas, documentação, se precisa de algo." },
    { kind: "pos_venda_30", due_date: addDays(s.sale_date, 30), title: `Pós-venda 30 dias: satisfação com o ${v}`, note: "Perguntar se está satisfeito, pedir indicação e, se for o caso, uma avaliação no Google." },
    { kind: "revisao_180", due_date: addDays(s.sale_date, 180), title: `Relacionamento: como está o ${v} após 6 meses?`, note: "Lembrar da revisão, perguntar se precisa de algo e manter o contato em dia." },
    { kind: "aniversario", due_date: addDays(s.sale_date, 365), title: `1 ano do ${v}: parabenizar e conversar`, note: "Aniversário da compra: bom momento para saber se o cliente pensa em trocar ou indicar alguém." },
  ];
  const end = financingEnd(s);
  if (end) {
    out.push(
      { kind: "renovacao_90", due_date: addDays(end, -90), title: `Financiamento do ${v} acaba em ~3 meses (${end.split("-").reverse().join("/")})`, note: "Começar a conversa sobre o próximo veículo: o cliente está perto de quitar e tende a querer trocar. Oferecer avaliação do atual." },
      { kind: "renovacao_15", due_date: addDays(end, -15), title: `Financiamento do ${v} quase quitado`, note: "Última janela antes da quitação: levar proposta de troca ou novo veículo." },
    );
  } else {
    out.push({ kind: "renovacao_troca", due_date: addMonths(s.sale_date, 36), title: `Já faz 3 anos do ${v}: oferecer troca`, note: "Compra à vista há 3 anos: verificar se o cliente quer renovar o veículo." });
  }
  return out.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

type Who = { name: string; vehicle?: string; store: string; endDate?: string | null };

// Mensagens prontas de WhatsApp, editáveis pelo vendedor antes de enviar.
export function taskMessage(kind: TaskKind, w: Who): string {
  const first = w.name.split(" ")[0];
  const v = w.vehicle ?? "veículo";
  const end = w.endDate ? w.endDate.split("-").reverse().join("/") : "";
  switch (kind) {
    case "pos_venda_7": return `Oi, ${first}! Aqui é da ${w.store}. Passando para saber como está o seu ${v} depois dessa primeira semana. Está tudo certo? Qualquer dúvida é só falar comigo.`;
    case "pos_venda_30": return `Oi, ${first}! Aqui é da ${w.store}. Já faz um mês com o seu ${v}. Está satisfeito? Se puder, conta pra gente como tem sido. E se conhecer alguém procurando veículo, ficaremos felizes em atender.`;
    case "revisao_180": return `Oi, ${first}! Tudo bem? Aqui é da ${w.store}. Faz uns 6 meses que você está com o ${v}. Como ele está? Se precisar de indicação de revisão ou de qualquer coisa, estamos por aqui.`;
    case "aniversario": return `Oi, ${first}! Hoje faz 1 ano que você levou o ${v} aqui da ${w.store}. Parabéns pela caminhada! Como ele tem se comportado? Se estiver pensando em novidades, me chama.`;
    case "renovacao_90": return `Oi, ${first}! Aqui é da ${w.store}. Vi que o financiamento do seu ${v} termina por volta de ${end}. Que tal a gente já olhar com calma as opções para o seu próximo veículo e avaliar o atual? Sem compromisso.`;
    case "renovacao_15": return `Oi, ${first}! Aqui é da ${w.store}. Seu financiamento do ${v} está chegando ao fim (${end}). Separei algumas opções e posso avaliar o seu veículo na troca. Quer dar uma olhada?`;
    case "renovacao_troca": return `Oi, ${first}! Aqui é da ${w.store}. O seu ${v} já está com a gente há uns 3 anos. Posso avaliar para uma troca? Tenho novidades no estoque.`;
    case "visita": return `Oi, ${first}! Aqui é da ${w.store}. Passando para confirmar a sua visita. Qual horário fica melhor?`;
    default: return `Oi, ${first}! Aqui é da ${w.store}. Tudo bem?`;
  }
}

export function waLinkTo(phone: string, text: string): string {
  const d = phone.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : "55" + d}?text=${encodeURIComponent(text)}`;
}

export const PAYMENT_LABEL: Record<string, string> = {
  avista: "À vista", financiado: "Financiado", troca: "Com troca", troca_financiado: "Troca + financiamento",
};
