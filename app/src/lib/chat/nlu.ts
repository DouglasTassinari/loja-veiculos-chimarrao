// Entendimento de texto em português por regras: nada de IA, só normalização, dicionários e expressões regulares.
import type { Kind, Slots, Use, VehicleLite } from "./types";

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9$.,%\s/+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const has = (n: string, re: RegExp) => re.test(n);

// ---------- dinheiro, ano e quilometragem ----------
type Money = { value: number; start: number; end: number; unit: boolean };

const MONEY_RE = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(milhoes|milhao|mil|k|reais|real|contos|conto)?(?![\d])/g;

export function findMoney(n: string): Money[] {
  const out: Money[] = [];
  for (const m of n.matchAll(MONEY_RE)) {
    const intPart = Number(m[1].replace(/\./g, ""));
    const dec = m[2] ? Number(`0.${m[2]}`) : 0;
    const unit = m[3] ?? "";
    let v = intPart + dec;
    if (/^(mil|k)$/.test(unit)) v *= 1000;
    else if (/^milh/.test(unit)) v *= 1_000_000;
    out.push({ value: v, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, unit: !!unit });
  }
  return out;
}

function around(n: string, m: Money) {
  return { before: n.slice(Math.max(0, m.start - 32), m.start), after: n.slice(m.end, m.end + 22) };
}

export type Parsed = {
  budgetMax?: number; budgetMin?: number; down?: number; parcelMax?: number; tradeValue?: number;
  yearMin?: number; kmMax?: number; noDown?: boolean; months?: number; downPct?: number; money?: number[];
};

// Interpreta cada valor pelo que vem antes/depois ("entrada de 20 mil", "parcela de 1500", "até 80 mil").
// `expect` diz o que o robô acabou de perguntar: uma resposta curta como "80" vale pelo contexto.
export function parseNumbers(n: string, expect: "budget" | "down" | "parcel" | "none"): Parsed {
  const r: Parsed = {};
  if (has(n, /\b(sem entrada|nao tenho entrada|zero de entrada|sem dar entrada)\b/)) { r.noDown = true; r.down = 0; }

  // faixa: "entre 40 e 60 mil", "de 40 a 60 mil"
  const range = n.match(/(?:entre|de)\s+(?:r\$\s*)?(\d[\d.]*)(?:\s*(mil|k))?\s+(?:e|a|ate)\s+(?:r\$\s*)?(\d[\d.]*)\s*(mil|k)?/);
  if (range && !has(n, /parcela|entrada/)) {
    const unit = range[4] || range[2] ? 1000 : 1;
    const a = Number(range[1].replace(/\./g, "")) * (range[2] ? 1000 : unit);
    const b = Number(range[3].replace(/\./g, "")) * (range[4] ? 1000 : unit);
    if (a > 0 && b > a) { r.budgetMin = a; r.budgetMax = b; }
  }

  const all = findMoney(n);
  const used: number[] = [];
  for (const m of all) {
    const { before, after } = around(n, m);
    const ctx = before + " " + after;
    // prazo: "48x", "60 meses", "em 36 parcelas"
    if (/^\s*(x\b|vezes|meses|mes\b|parcelas|anos)/.test(after) && m.value <= 120 && !m.unit) {
      r.months = /anos/.test(after) ? m.value * 12 : m.value;
      continue;
    }
    // porcentagem: "30% de entrada"
    if (/^\s*%/.test(after)) { if (m.value > 0 && m.value <= 90 && /entrada/.test(ctx)) r.downPct = m.value / 100; continue; }
    const asKm = /^\s*(km|quilometros)/.test(after) || (/^\s*mil\b/.test(after) && /km/.test(after));
    if (asKm) { r.kmMax = m.value < 1000 ? m.value * 1000 : m.value; used.push(m.value); continue; }
    const isYear = m.value >= 1990 && m.value <= 2027 && !m.unit && !/\b(reais|r\$)/.test(ctx);
    if (isYear) { if (/(pra cima|em diante|ou mais novo|a partir|apartir|acima|modelo|ano)/.test(ctx)) r.yearMin = m.value; used.push(m.value); continue; }

    let v = m.value;
    // pistas coladas ao número valem mais do que a frase inteira
    const nearBefore = before.slice(-18);
    const nearAfter = after.slice(0, 16);
    const isDown = /(entrada|dar de entrada|dou de|tenho de)\b/.test(nearBefore) || /^\s*(de |como |pra )?entrada/.test(nearAfter);
    const parcelCtx = !isDown && (/(parcela|prestacao|mensal|por mes|\/mes|ao mes)/.test(nearBefore) || /^\s*(de )?(por mes|\/mes|ao mes|mensais|mensal|a mes)/.test(nearAfter));
    // "80" sem unidade, num contexto de preço de veículo ou logo após a pergunta do robô, quer dizer 80 mil
    if (!m.unit && v >= 8 && v < 1000 && !parcelCtx) {
      const cue = /(ate|carro de|moto de|orcamento|uns|por volta|teto|maximo|entre|valor|entrada de|dou|abaixo de|menos de|cerca|mais de|acima de)/.test(before);
      if (cue || expect === "budget" || expect === "down") v *= 1000;
    }
    if (v < 100) continue;
    if (isDown) r.down = v;
    else if (parcelCtx && v <= 20000) r.parcelMax = v;
    else if (/(meu carro vale|minha moto vale|vale uns|vale cerca|avaliado|troca de)/.test(before)) r.tradeValue = v;
    else if (/(a partir de|acima de|mais de|no minimo|minimo|pelo menos)/.test(before)) r.budgetMin = r.budgetMin ?? v;
    else if (/(ate|no maximo|maximo|orcamento|teto|carro de|moto de|valor|uns|por volta|cerca|abaixo de|menos de)/.test(before) || (expect === "budget" && r.budgetMax === undefined)) r.budgetMax = r.budgetMax ?? v;
    else if (expect === "down") r.down = v;
    else if (expect === "parcel" && v <= 20000) r.parcelMax = v;
    else if (all.length === 1 && v >= 5000 && expect === "none") r.budgetMax = v;
    used.push(v);
  }
  r.money = used;

  const km = n.match(/(\d[\d.]*)\s*(mil)?\s*km/);
  if (km && r.kmMax === undefined) { const x = Number(km[1].replace(/\./g, "")); r.kmMax = km[2] || x < 1000 ? x * 1000 : x; }
  const yr2 = n.match(/\b(20[0-2]\d)\s*(pra cima|em diante|ou mais novo|ou superior)/);
  if (yr2) r.yearMin = Number(yr2[1]);
  const yr = n.match(/(?:a partir de|apartir de)\s*(?:ano\s*)?(20[0-2]\d|199\d)\b/);
  if (yr && r.yearMin === undefined) r.yearMin = Number(yr[1]);
  return r;
}

// ---------- dicionários ----------
const BODY_WORDS: [RegExp, string[]][] = [
  [/\b(suv|utilitario esportivo|crossover)\b/, ["SUV"]],
  [/\b(sedan|seda|sedas|sedans)\b/, ["Sedã"]],
  [/\b(hatch|hatchback|compacto)\b/, ["Hatch"]],
  [/\b(picape|pickup|pick up|caminhonete|camionete|cabine dupla)\b/, ["Picape"]],
  [/\b(scooter|biz|pop)\b/, ["Scooter"]],
  [/\b(trail|big trail|aventureira|off road de moto)\b/, ["Trail"]],
  [/\b(esportiva|sport bike|carenada)\b/, ["Esportiva"]],
  [/\b(street|naked|urbana)\b/, ["Street"]],
];

const USE_WORDS: [RegExp, Use][] = [
  [/\b(familia|filhos|crianca|criancas|esposa|bebe|cadeirinha|espacoso|espaco|porta[- ]?malas)\b/, "familia"],
  [/\b(uber|99|aplicativo|app\b|motorista de app|rodar de app|indriver)\b/, "app"],
  [/\b(ifood|entrega|entregador|motoboy|delivery|moto taxi|mototaxi)\b/, "entrega"],
  [/\b(trabalho|trabalhar|obra|carga|ferramenta|empresa|representante|vendas)\b/, "trabalho"],
  [/\b(trilha|off ?road|fazenda|sitio|chacara|terra|estrada de chao|4x4|tracao|campo|lama)\b/, "trilha"],
  [/\b(viagem|viagens|viajar|viajo|estrada|rodovia|longas distancias|litoral)\b/, "viagem"],
  [/\b(cidade|transito|urbano|dia a dia|estacionar|manobra|pequeno)\b/, "cidade"],
  [/\b(primeiro (carro|veiculo|moto)|iniciante|comecando|habilitacao nova|recem habilitado)\b/, "primeiro"],
  [/\b(economico|economia|gastar pouco|beber pouco|consumo|economizar|barato de manter|manutencao barata)\b/, "economia"],
  [/\b(esportivo|esportiva|potente|rapido|velocidade|turbo|adrenalina)\b/, "esportivo"],
  [/\b(luxo|premium|conforto|requintado|sofisticado|executivo|status)\b/, "luxo"],
];

export function detectKind(n: string): Kind | undefined {
  if (has(n, /\b(moto|motos|motocicleta|motocicletas|scooter|motoqueiro|biz|cg|titan|fazer|ninja|mt-?03|xre|lander|twister)\b/)) return "moto";
  if (has(n, /\b(carro|carros|automovel|veiculo de quatro rodas|4 rodas|suv|sedan|sedas?|hatch|picape|pickup|caminhonete)\b/)) return "carro";
  return undefined;
}

export function detectBodies(n: string): string[] | undefined {
  const out = new Set<string>();
  for (const [re, b] of BODY_WORDS) if (re.test(n)) b.forEach((x) => out.add(x));
  return out.size ? [...out] : undefined;
}

export function detectUse(n: string): Use | undefined {
  for (const [re, u] of USE_WORDS) if (re.test(n)) return u;
  return undefined;
}

export function detectTrans(n: string): Slots["trans"] | undefined {
  if (has(n, /\b(automatico|automatica|cambio automatico|cvt|automatizado)\b/)) return "Automático";
  if (has(n, /\b(manual|cambio manual|mecanico)\b/)) return "Manual";
  return undefined;
}

export function detectFuel(n: string): string | undefined {
  if (has(n, /\b(diesel)\b/)) return "Diesel";
  if (has(n, /\b(flex|etanol|alcool)\b/)) return "Flex";
  if (has(n, /\b(gasolina)\b/)) return "Gasolina";
  if (has(n, /\b(hibrido|hibrida|eletrico|eletrica)\b/)) return "Híbrido";
  return undefined;
}

export function detectLowKm(n: string): boolean {
  return has(n, /\b(pouco rodado|baixa km|baixa quilometragem|poucos km|rodou pouco|km baixa|pouca km)\b/);
}

export function detectNewer(n: string): boolean {
  return has(n, /\b(mais novo|mais nova|recente|ano mais novo|seminovo|quase novo|zerinho)\b/);
}

// ---------- marca e modelo a partir do estoque ----------
const squash = (s: string) => normalize(s).replace(/[\s-]+/g, "");

export type Vocab = { brands: string[]; models: { brand: string; model: string; key: string; spaced: string }[] };

export function buildVocab(vs: VehicleLite[]): Vocab {
  const brands = [...new Set(vs.map((v) => v.brand))];
  const seen = new Set<string>();
  const models: Vocab["models"] = [];
  for (const v of vs) {
    const id = `${v.brand}|${v.model}`;
    if (seen.has(id)) continue;
    seen.add(id);
    models.push({ brand: v.brand, model: v.model, key: squash(v.model), spaced: normalize(v.model).replace(/-/g, " ") });
  }
  models.sort((a, b) => b.key.length - a.key.length); // "onix plus" antes de "onix"
  return { brands, models };
}

export function detectModel(n: string, vocab: Vocab): { brand?: string; model?: string } {
  const spaced = ` ${n.replace(/-/g, " ")} `;
  const tight = squash(n);
  for (const m of vocab.models) {
    if (spaced.includes(` ${m.spaced} `) || (m.key.length >= 4 && tight.includes(m.key))) return { brand: m.brand, model: m.model };
  }
  for (const b of vocab.brands) {
    const nb = normalize(b).replace(/-/g, " ");
    if (spaced.includes(` ${nb} `)) return { brand: b };
  }
  return {};
}

// ---------- intenções (perguntas frequentes e comandos) ----------
export type Intent =
  | "greeting" | "thanks" | "bye" | "human" | "hours" | "address" | "phone" | "finance" | "trade" | "sell" | "warranty" | "docs"
  | "visit" | "inspection" | "negotiate" | "payment" | "compare" | "more" | "cheaper" | "newer" | "lowkm" | "select" | "quote"
  | "restart" | "who" | "stock" | "yes" | "no" | "skip" | "notify" | "availability" | "changebudget";

const INTENTS: [Intent, RegExp][] = [
  ["restart", /\b(recomecar|comecar de novo|reiniciar|nova busca|limpar tudo|zerar)\b/],
  ["who", /\b(quem (e|eh) (voce|vc)|voce e (um |uma )?(robo|bot|humano|pessoa|ia|inteligencia)|e robo|e bot|e um robo|com quem (eu )?falo|seu nome)\b/],
  ["human", /\b(atendente|humano|vendedor|consultor|falar com (alguem|uma pessoa|a equipe|o dono|gente)|chama (alguem|a equipe)|ligar pra mim|me liga|ligacao)\b/],
  ["hours", /\b(horario|horarios|que horas|funcionamento|abre|abrem|fecha|fecham|aberto|aberta|sabado|domingo|feriado|atendem)\b/],
  ["address", /\b(onde (fica|voces ficam|e a loja)|endereco|localizacao|como chego|como chegar|mapa|fica onde|bairro|rua|em que cidade)\b/],
  ["phone", /\b(telefone|numero da loja|numero de voces|whats ?app|zap|contato)\b/],
  ["warranty", /\b(garantia|garantido)\b/],
  ["docs", /\b(documento|documentos|documentacao|papelada|burocracia|o que (eu )?preciso levar|o que preciso|transferencia|ipva|licenciamento)\b/],
  ["inspection", /\b(laudo|vistoria|procedencia|leilao|sinistro|batido|historico|revisado|revisao|cautelar|chassi|gravame)\b/],
  ["visit", /\b(test ?drive|testar|visita|ver (o|a) (carro|moto|veiculo) (pessoalmente|ai)|ir ai|passar ai|agendar|marcar (uma )?visita|conhecer a loja)\b/],
  ["sell", /\b(quero vender|vender (meu|minha)|voces compram|compram (meu|carro|moto)|comprar o meu|comprar meu carro)\b/],
  ["trade", /\b(troca|trocar|dar na troca|usado na troca|meu carro|minha moto|tenho um carro|tenho uma moto|aceita (meu|minha))\b/],
  ["finance", /\b(financ\w*|parcel\w*|entrada|juros|taxa|cet|prestacao|prestacoes|a prazo|carne|score|aprovacao|aprova|nome sujo|negativado|serasa|spc)\b/],
  ["negotiate", /\b(desconto|negoci\w*|ultimo preco|menor preco|melhor preco|abaixa|abaixar|faz por|fecha por|valor final|pechincha|barato pra mim)\b/],
  ["payment", /\b(pix|cartao|boleto|dinheiro|cheque|consorcio|a vista|avista|formas? de pagamento)\b/],
  ["compare", /\b(compar\w+|diferenca entre|qual (e )?melhor|melhor entre|vs\b)\b/],
  ["quote", /\b(orcamento|proposta|simular|simulacao|quanto fica|quanto sai|montar|fecha pra mim|quanto (eu )?pago)\b/],
  ["notify", /\b(avisa|avisar|me avise|quando chegar|lista de espera|encomenda|encomendar|procurar pra mim|buscar pra mim)\b/],
  ["more", /\b(mais opcoes|outras opcoes|outros|outras|mais um|diferente|ver mais|proximas|proximos|mais alguma|tem mais)\b/],
  ["cheaper", /\b(mais barato|mais em conta|mais baratos|menor preco|menos caro|abaixo disso|algo mais barato)\b/],
  ["newer", /\b(mais novo|mais nova|mais recente|ano mais novo)\b/],
  ["lowkm", /\b(menos km|menor km|menos rodado|pouco rodado|menos quilometragem)\b/],
  ["select", /\b(gostei|quero (esse|essa|o primeiro|a primeira|o segundo|a segunda|o terceiro|a terceira)|esse mesmo|essa mesma|o (1|2|3)\b|numero (1|2|3)|(primeiro|segundo|terceiro|1o|2o|3o))\b/],
  ["stock", /\b(quantos|que (carros|motos|veiculos) (tem|voces tem|vcs tem)|o que (voces )?tem|estoque|catalogo|tudo que tem)\b/],
  ["availability", /\b(tem (um|uma)?\s*\w+|voces (tem|possuem)|vcs tem|possui|ainda tem|disponivel|disponiveis)\b/],
  ["changebudget", /\b(mudar (o )?(valor|orcamento|preco)|outro (valor|orcamento)|aumentar|subir o orcamento|posso gastar mais|tenho mais)\b/],
  ["skip", /\b(pular|tanto faz|qualquer um|indiferente|nao importa|sem preferencia|nenhuma preferencia|qualquer)\b/],
  ["thanks", /\b(obrigado|obrigada|valeu|agradeco|brigado|thanks)\b/],
  ["bye", /\b(tchau|ate mais|ate logo|flw|falou|encerrar|so isso|era isso|nada mais)\b/],
  ["greeting", /^(oi+|ola+|bom dia|boa tarde|boa noite|e ai|eai|opa|salve|hello|hey|tudo bem|oie?)\b/],
  ["no", /^(nao|nao quero|agora nao|depois|nunca|negativo|prefiro nao|nem)\b/],
  ["yes", /^(sim|isso|claro|pode|quero|ok|okay|beleza|certo|aham|uhum|com certeza|pode ser|bora|vamos|fechado|positivo|s)\b/],
];

export function detectIntents(n: string): Intent[] {
  const out: Intent[] = [];
  for (const [i, re] of INTENTS) if (re.test(n)) out.push(i);
  return out;
}

export function ordinalPick(n: string): number | undefined {
  if (has(n, /\b(primeiro|primeira|1o|1a|numero 1|o 1)\b/)) return 0;
  if (has(n, /\b(segundo|segunda|2o|2a|numero 2|o 2)\b/)) return 1;
  if (has(n, /\b(terceiro|terceira|3o|3a|numero 3|o 3)\b/)) return 2;
  return undefined;
}

// ---------- contato no meio da frase ----------
export function findPhone(raw: string): string | undefined {
  const m = raw.match(/(?:\+?55\s*)?\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]*\d{4}/);
  return m?.[0];
}

export function findName(raw: string): string | undefined {
  const m = raw.match(/(?:meu nome (?:e|é)|me chamo|sou (?:o|a)?|aqui (?:e|é) (?:o|a)?)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,40})/i);
  if (!m) return undefined;
  const nm = m[1].trim().split(/\s+(?:e|do|da|tenho|quero|moro|procuro)\b/i)[0].trim();
  return nm.length >= 2 ? nm.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : undefined;
}
