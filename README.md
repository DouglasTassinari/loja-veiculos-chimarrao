# Chimarrão Veículos — site, assistente, simulador e ERP + CRM

Uma base de dados, duas frentes:

1. **Site público** (SEO e conversão): início, estoque com filtros, anúncio de cada veículo com galeria de fotos, destaques, sobre nós, reconhecimento e feirões, certificações e licenças, contato com mapa, e um **assistente virtual** e um **simulador de financiamento** que capturam o contato do cliente.
2. **ERP + CRM interno**: estoque com custo e margem por veículo, fluxo de caixa, funil de vendas arrastável, clientes, vendas com financiamento e **tarefas automáticas de relacionamento** (pós-venda, aniversário da compra e aviso de fim de financiamento para renovar o carro).

Tudo está em [`app/`](app) (Next.js 16, TypeScript, Tailwind v4). O desenho do produto e a pesquisa estão em [`PRODUTO.md`](PRODUTO.md) e [`PESQUISA.md`](PESQUISA.md); a publicação está em [`DEPLOY.md`](DEPLOY.md).

## O que o site faz

| Parte | Como funciona |
|---|---|
| **Assistente virtual** | Só regras, **sem IA**. Entende frases como "SUV automático até 120 mil para a família", pergunta o que falta (tipo, orçamento, uso, entrada), sugere os veículos que mais combinam (com o motivo) e monta um **orçamento** com entrada, parcela por prazo, IOF e CET. Pede nome, WhatsApp e autorização (LGPD) e entrega o contato à equipe como lead. Nunca vê custo nem margem: só dados públicos. |
| **Simulador de financiamento** | Próprio da loja (não leva a banco nenhum). Pede nome e WhatsApp antes de mostrar parcela, IOF, CET e comparação de prazos. A taxa de referência vem da base pública do Banco Central (taxas médias de veículos por banco, atualizada a cada 6 h; se estiver fora do ar usa a última semana conhecida). |
| **WhatsApp** | Todo link de WhatsApp abre em **nova aba**, para o cliente não sair da loja. |
| **Páginas institucionais** | Reconhecimento, certificações e licenças só mostram o que foi **confirmado**; na versão de demonstração aparecem marcados como "Exemplo". |
| **Crédito de desenvolvimento** | Rodapé do site e do ERP: "Desenvolvido por TAZZIN". |

## O que o ERP + CRM faz

- **Painel do dono**: capital parado, giro, lucro do mês, caixa dos próximos 30 dias, veículos que pedem ação e relacionamentos para fazer hoje.
- **Estoque** (carros e motos): custo total, margem real, dias parado, preço × FIPE, publicar e destacar no site.
- **Funil de leads**: arraste o cartão entre as etapas (novo → contatado → visita → proposta → negociação → ganho/perdido) ou use a lista "mover".
- **Venda**: registrada a partir do lead; cria o cliente, baixa o veículo do estoque e gera as tarefas automáticas.
- **Tarefas e relacionamento**: pós-venda em 7 e 30 dias, revisão em 6 meses, aniversário da compra e **renovação quando o financiamento está acabando**, cada uma com a mensagem pronta para o WhatsApp.
- **Caixa**: contas a pagar e a receber, com saldo projetado.

## Rodar na sua máquina

Precisa do Node.js 22 ou mais novo.

```bash
cd app
npm install
npm run dev
```

- Site: http://localhost:3000
- ERP: http://localhost:3000/erp (senha de desenvolvimento: `admin123`)

Sem `DATABASE_URL` o sistema usa SQLite em `app/data/loja.db` (cria sozinho e já vem com 60 veículos de exemplo). Com `DATABASE_URL` usa PostgreSQL (é o que o Render usa).

## Testes e monitoramento

| Comando (em `app/`) | O que confere |
|---|---|
| `npm test` | Unidade e integração: regras do assistente (entendimento de frases, recomendação, orçamento), cálculo do financiamento (parcela, IOF, CET), regras do CRM (tarefas automáticas, datas), validação de telefone e nome, limite de pedidos, estoque (`catalog.json`), banco de dados real (SQLite temporário) e as APIs `/api/chat` e `/api/lead` (inclui tentativa de adulterar o estado, vazamento de custo e excesso de pedidos). |
| `npm run test:e2e` | Abre a loja de verdade no Chrome e usa o site e o ERP como cliente e como dono: conversa com o assistente até o orçamento, simulação e envio ao WhatsApp em nova aba, formulários, login do ERP, mover cartões (inclusive arrastando), registrar venda, tarefas, estoque e caixa. Também confere **imagens quebradas**, **rolagem lateral**, **erros no console** e **acessibilidade** (axe) no computador e no celular, e salva uma imagem de cada tela em `app/e2e-screens/`. |
| `npm run test:smoke -- https://endereco-do-site` | Verificação rápida de um site já publicado (é o que o monitor usa). |

No GitHub, o fluxo **verificacao** roda tudo isso a cada envio. O fluxo **monitor** confere o site publicado de 2 em 2 horas no horário comercial e avisa por e-mail se algo falhar.

## Dados de demonstração e o que falta para a loja real

- O estoque (60 veículos, de R$ 15 mil a R$ 250 mil, carros e motos), os clientes, as vendas e os leads são **exemplos**. As fotos são de veículos reais com licença livre (Wikimedia Commons); o autor e a licença de cada uma estão no anúncio.
- O WhatsApp (51 99999-9999), o telefone e o horário são fictícios. Troque em `app/src/lib/config.ts`.
- Feirões, prêmios, certificações e licenças **não foram inventados**: só entram no site depois de confirmados em `app/src/lib/content.ts`.
- Para a loja real: tirar `NEXT_PUBLIC_PREVIEW` e `SEED_DEMO` no Render, cadastrar os veículos pelo ERP e trocar os dados da loja.
