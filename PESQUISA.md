# Pesquisa — referência, concorrentes e dores de lojistas (29/10/2026)

## 1. Site de referência (Netcar Multimarcas, Esteio/RS)

**Estrutura:** Por que Netcar · Sobre · Estoque · Entregas · Comparar · Venda seu carro · Regiões · Atualidades (blog) · Contato · Localização. Landing pages de SEO: `/comprar-suv`, `/comprar-hatch`, `/comprar-sedan`, `/seminovos-automaticos`. URL do carro: `/veiculo/modelo-versao-ano-placa-id`.

**Listagem:** busca em linguagem natural ("hatch até 100 mil"), filtros, ordenação, cards com selos, carros vendidos mantidos ("ver similares"), bloco "Ainda em dúvida?", assistente de IA (iAN) no WhatsApp.

**Página do veículo (o que converte):**
- Selos: ÚNICO DONO, I-CHECK APROVADO, garantia de fábrica até AAAA
- Ficha: ano, km, combustível, câmbio, motor/potência, cor, portas
- Preço + nota "financiamento sujeito à análise"
- Prova social: nota 4,9 com 892 avaliações no Google
- CTAs: Falar deste carro · Usado na troca · Comparar
- Certificado de consulta **DEKRA / CheckAuto** acessível
- WhatsApp por intenção: consultar financiamento · agendar visita · avaliar meu usado · pedir mais fotos/vídeo
- Álbum de clientes/entregas, equipamentos (31 itens), resumo técnico, WhatsApp pré-preenchido com o carro

**Pontos fracos observados:** fotos genéricas em parte do estoque; sem simulador de parcela na tela; sem "abaixo da FIPE"/histórico de preço; comparar e filtros pouco explorados.

## 2. Concorrentes (sistemas para lojistas)

| Sistema | O que oferece (fonte: sites/artigos deles) |
|---|---|
| **CarHand** | Avaliação com FIPE, checklist com fotos e laudo PDF; consulta veicular (gravame, roubo, leilão, débitos); consignação com conta a pagar automática; precificação FIPE em lote; CRM Kanban com "procurados/ofertados"; contratos por WhatsApp; NF-e e RENAVE (adicionais); DRE, fluxo 30–90 dias, comissão; alerta de carro parado >60 dias; multiloja |
| **Autoconf** | Avaliação 360º + simulador de compra; integra site e portais (196 lojas em 2022) |
| **Revenda Mais, BNDV, Simples Veículo, Boom, Linx Auto** | Estoque, financeiro, NF, CRM; conteúdo de blog sobre gestão |
| **Kavak** (não é concorrente direto) | Inspeção 240 itens, garantia, reconditioning próprio — mostra o padrão de confiança que o consumidor passa a esperar |

**Conclusão:** o básico (estoque, financeiro, CRM, FIPE, portais) já existe. O espaço para diferenciar está em **decisão e lucro** (alertas acionáveis, custo do capital, margem real em tempo real), **experiência do site** (mais conversão que a média) e **simplicidade** (loja pequena usa de verdade).

## 3. Dores de lojistas encontradas

Fontes: blogs de Revenda Mais, Simples Veículo, CarHand, BNDV, estudos de mercado. Não consegui acessar Reddit nem grupos fechados de Facebook/WhatsApp, onde as dores reais aparecem mais cruas — **vale a gente validar com 3–5 donos de loja de verdade**.

1. **Lucro real invisível** — custos de preparação, oficina, comissão e tempo parado não entram na conta; "não sei quanto sobrou na última venda"
2. **Estoque parado** — giro mínimo ~35 dias; carros >60 dias precisam ser repreçados; dono não sabe quais são os 3 mais antigos
3. **Margem apertada** — bruta ~10–11%, líquida 4–9%; juros altos e queda de preços de usados em 2026 (carros chineses, desaceleração)
4. **Compra "no olho"** — pneu gasto, gravame, leilão, sinistro descobertos depois
5. **FIPE mensal** — reprecificar carro por carro consome tempo
6. **Anúncio manual** — digita em site e redes, carro vendido continua anunciado
7. **Lead perdido** — sem histórico; contato fica com o vendedor que saiu
8. **Financeiro disperso** — entrada, financiamento, cartão, troca, parcelas, consignante; ninguém sabe o caixa das próximas semanas ("se eu tirasse uma semana de folga...")
9. **Retorno de financiamento e conversão** — pouco monitorado
10. **Comissão** — fixa, % sobre entrada ou % sobre lucro (este exige financeiro redondo)
11. **Documentação e RENAVE** — ATPV-e, multas por falha no registro, contratos em pastas; transferência demorada gera reclamação no Reclame Aqui
12. **Pós-venda e risco jurídico** — vício oculto, garantia, publicidade enganosa
13. **Consignação** — prazos e valores de carros de terceiros
14. **Decisão por percepção** — "qual canal trouxe mais vendas?" ninguém sabe
15. **Golpes** — 91 mil golpes de veículos online em 2023 (OLX); falso intermediário, comprovante falso, Pix

## 4. O que isso muda no nosso plano

**Entra no MVP (maior dor × menor esforço):**
- Cadastro por placa com consulta/FIPE; ficha financeira completa (custo real e margem)
- Preparação/oficina com despesas anexadas
- Alertas: dias de pátio, margem negativa, preço > FIPE, anúncio desatualizado
- Fluxo de caixa 30–90 dias, comissão por regra
- Site: página do veículo no padrão acima + selos automáticos + WhatsApp por intenção + simulador de parcela
- CRM Kanban com origem do lead

**Fase 2:** consignação, contratos/documentos, RENAVE/NF-e via integradora, portais, pós-venda/garantia, "procurados/ofertados".

**Nosso diferencial a perseguir:**
1. **"Próxima melhor ação" por carro** (baixar R$ X, repostar, mudar foto, ofertar a um lead do CRM)
2. **Custo do capital parado** em R$/dia
3. **Painel do dono no celular** — lucro do mês, caixa, carros em risco
4. **Site que converte mais** com dados reais (garantia, laudo, avaliações, preço vs FIPE)
5. **Simples de operar** por loja pequena, sem consultoria de implantação

## 5. Lacunas / riscos a validar

- Preço e disponibilidade de APIs: FIPE (oficial/Parallelum), consulta veicular (CheckAuto/DEKRA/CarHand), RENAVE/ATPV-e (integradora), portais (Webmotors, OLX, iCarros) — exigem contrato
- Requisitos fiscais (NF-e, regime tributário de revenda) — validar com contador
- LGPD: dados de clientes, CPF, consentimento nos leads
- Falar com lojistas reais antes de fechar o escopo das fases 2+
