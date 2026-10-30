import { store } from "./config";

// Conteúdo institucional. Regra do manual da marca: só afirmar o que a loja pode comprovar.
// Itens com confirmed:false são EXEMPLOS: aparecem (marcados) apenas na versão de demonstração
// e somem na versão real até alguém trocar para confirmed:true e preencher os dados verdadeiros.
export type Item<T> = T & { confirmed: boolean };

export const visible = <T,>(items: Item<T>[]): Item<T>[] => items.filter((i) => i.confirmed || store.preview);

export const values = [
  { t: "Próxima", d: "Fala com clareza, como uma equipe acessível. Sem distanciamento e sem formalidade exagerada." },
  { t: "Segura", d: "Apresenta dados objetivos e só promete o que a loja pode comprovar." },
  { t: "Direta", d: "Vai ao ponto: modelo, ano, preço, condição e como conversar." },
  { t: "Autêntica", d: "Com o calor da nossa região, sem exagero e sem clichê." },
];

export const process = [
  { t: "Escolha", d: "Navegue pelo estoque ou converse com o assistente: ele sugere veículos para o seu valor e uso.", confirmed: true },
  { t: "Simule", d: "Veja parcela, IOF e custo efetivo estimados, comparando prazos e entradas.", confirmed: true },
  { t: "Fale com a equipe", d: "Envie a simulação ou o orçamento pelo WhatsApp e tire as dúvidas.", confirmed: true },
  { t: "Conheça o veículo", d: "Combine uma visita à loja para ver o veículo de perto.", confirmed: true },
];

export type Recognition = Item<{ kind: "Feirão" | "Evento" | "Prêmio" | "Parceria"; title: string; year: string; text: string }>;
export const recognitions: Recognition[] = [
  { kind: "Feirão", title: "Participação em feirão regional de seminovos", year: "2025", text: "Espaço para registrar os feirões em que a loja participou, com data, local e resultado.", confirmed: false },
  { kind: "Evento", title: "Evento de relacionamento com clientes", year: "2025", text: "Espaço para entregas coletivas, encontros e ações com a comunidade.", confirmed: false },
  { kind: "Prêmio", title: "Reconhecimento do setor automotivo", year: "2025", text: "Espaço para prêmios e selos recebidos, com nome de quem concedeu.", confirmed: false },
];

export type Cert = Item<{ title: string; issuer: string; number?: string; validUntil?: string; text: string }>;
export const certifications: Cert[] = [
  { title: "CNPJ ativo", issuer: "Receita Federal", number: "", validUntil: "", text: "Cadastro nacional da pessoa jurídica da loja.", confirmed: false },
  { title: "Alvará de funcionamento", issuer: "Prefeitura de Sapucaia do Sul", number: "", validUntil: "", text: "Licença municipal para o funcionamento do estabelecimento.", confirmed: false },
  { title: "Cadastro no RENAVE", issuer: "Senatran", number: "", validUntil: "", text: "Registro Nacional de Veículos em Estoque, exigido de lojas que comercializam veículos.", confirmed: false },
  { title: "Registro no órgão de trânsito estadual", issuer: "Detran-RS", number: "", validUntil: "", text: "Registro da atividade de comércio de veículos usados, quando aplicável.", confirmed: false },
  { title: "Entidade do setor", issuer: "Associação de lojistas", number: "", validUntil: "", text: "Filiação a associação ou sindicato do comércio de veículos, se houver.", confirmed: false },
];

export function mapEmbedUrl(): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(store.address)}&output=embed`;
}
export function mapDirectionsUrl(): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(store.address)}`;
}
