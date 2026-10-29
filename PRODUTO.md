# Visão do Produto — "Lucro por veículo, não só estoque"

Referência visual/funcional: netcarmultimarcas.com.br (loja multimarcas, Esteio/RS — WhatsApp em destaque, ligação direta, "procedência" como argumento, vitrine /seminovos).
O site dela é uma vitrine. Nosso produto é um **sistema de gestão que também gera a vitrine**.

## O que a referência faz (lido no navegador em 29/10/2026)

Página /seminovos: 74 veículos, busca textual, botão Filtros, ordenação (Recomendados, Mais novos, Menor/Maior preço, A–Z).
Card: foto, marca, modelo/versão, "ano · km · câmbio", preço, nº de fotos, botão "Ver carro" + botão WhatsApp.
Selos: **I-CHECK** (vistoria própria), **Garantia de fábrica até AAAA**, garantia de motor e câmbio, garantia de bateria (BYD), "Baixa km p/ ano".
Carros **vendidos ficam visíveis** como "Vendido · Indisponível · ver similares" (mantém SEO e mostra giro). Foto de capa genérica (carro coberto) quando ainda não há fotos.
Extras: bloco "Ainda em dúvida?" no meio da lista, assistente de chat "iAN" (IA que qualifica o lead e encaminha à equipe), WhatsApp flutuante.

**Onde podemos ir além:** selos calculados automaticamente (não digitados), filtros por faixa de parcela, "abaixo da FIPE", comparador, simulador de financiamento no card, reserva online, e tudo isso alimentado pelo ERP (preço, status e selos sempre sincronizados).

## Princípio

Loja de carro quebra por: capital parado, custo escondido e lead perdido.
Cada tela do sistema responde: **"quanto eu ganhei/estou perdendo neste carro, e o que faço agora?"**

## Dores reais da loja → o que construímos

| Dor | Solução |
|---|---|
| Não sabe a margem real; custos soltos em caderno/WhatsApp | **Ficha financeira do veículo**: compra + preparação + documentação + financiamento do capital + comissões + impostos = custo real e lucro líquido, em tempo real |
| Carro parado come dinheiro | **Dias de pátio + custo de oportunidade**: cada carro mostra "está custando R$ X/dia". Alertas em 30/45/60 dias com sugestão de ação (baixar preço, repostar, promover) |
| Precificação no achismo | **FIPE + mercado**: comparação com FIPE e anúncios similares na região; preço sugerido para atingir a margem-alvo; piso de negociação por vendedor |
| Compra errada (paga caro, não vê o custo de reparo) | **Avaliador de compra**: checklist de vistoria + estimativa de reparo + simulação "se eu pagar X, lucro esperado = Y" antes de fechar |
| Preparação (mecânica, lataria, lavagem) sem controle | **Ordens de serviço internas** por veículo, com fornecedor, orçamento x realizado, prazo; carro só vai ao site quando "pronto" |
| Documentação/despachante: multas, débitos, gravame, transferência | **Painel de pendências documentais** por carro e por venda, com prazos |
| Lead se perde no WhatsApp | **CRM com WhatsApp**: lead do site/portais entra no funil, vendedor responsável, lembretes de follow-up, tempo de resposta medido |
| Anunciar em vários portais na mão | **Publicação única**: cadastra uma vez → site próprio + exportação para Webmotors/OLX/iCarros/Mercado Livre/Instagram (fotos e texto gerados) |
| Troca complica caixa e estoque | **Fluxo de troca**: carro recebido entra no estoque já com valor de avaliação e custo previsto |
| Financiamento e retorno de banco | **Propostas de financiamento** com simulação, controle de comissão/retorno por banco e recebimento |
| Caixa da loja misturado com o do dono | **Financeiro separado**: contas a pagar/receber, fluxo de caixa projetado, DRE, retirada de sócios, conciliação |
| Comissão de vendedor virou briga | **Comissão automática** por regra (fixa, % sobre lucro, meta) com extrato transparente |
| Consignação confusa | **Módulo consignado**: dono do carro, comissão da loja, prazo, repasse |
| Pós-venda esquecido | **Garantia e revisão**: lembretes, indicação, recompra |

## Dashboard do dono (a tela que ele abre toda manhã)

- Capital parado em estoque e média de dias de pátio
- Lucro líquido do mês vs meta, margem média
- Carros em risco (parados, margem negativa, documentação travada)
- Caixa hoje / próximos 30 dias
- Leads sem resposta e propostas abertas
- Ranking de vendedores por **lucro**, não por volume

## Site público (diferencial de conversão)

- Mobile first, carregamento <2s, SEO técnico completo (Schema Vehicle/Offer, páginas por marca/modelo/cidade)
- Prova de procedência em destaque: laudo cautelar, histórico, nº de donos, fotos de vistoria
- WhatsApp contextual (já abre falando do carro), ligação, "tenho interesse", simulador de parcela, "avaliar meu carro"
- Selos automáticos: "abaixo da FIPE", "recém-chegado", "único dono"
- Reserva de carro com sinal (opcional)

## Diferenciais frente a ERPs genéricos

1. Margem **real** por carro (não só preço de venda)
2. Foco em giro e custo de capital
3. Site + ERP + CRM numa base só (sem retrabalho)
4. Linguagem e fluxos do dia a dia da loja brasileira (ATPV-e, gravame, despachante, retorno de banco)

## Anúncios em marketplaces vinculados ao veículo

Cada veículo guarda seus anúncios externos (Webmotors, OLX, iCarros, Mercado Livre, Facebook/Instagram, etc.).

**Nível 1 — vínculo manual (MVP, sem depender de ninguém)**
- Campo "Anúncios" na ficha do carro: portal + link + data + valor pago do plano/destaque
- Painel mostra quais carros estão em quais portais e quais **faltam** anunciar
- Custo do anúncio entra na ficha financeira do carro (margem real)
- Lead entra com a **origem** (portal/site/Instagram) → relatório de ROI por canal: custo do portal x vendas geradas
- Alerta de "anúncio desatualizado": preço do ERP diferente do anunciado, ou carro vendido e anúncio ainda no ar

**Nível 2 — integração real (depende do portal)**
- Mercado Livre tem API pública; Webmotors, OLX e iCarros costumam exigir integração de parceiro/feed (XML/API) liberada para a loja. Vamos confirmar a disponibilidade de cada uma antes de prometer
- Publicar/atualizar preço/baixar anúncio direto do ERP
- Receber leads do portal no CRM automaticamente

**Nível 3 — nosso site também como vitrine forte**
- Cada anúncio externo aponta de volta para a página do veículo no site próprio (canonical, SEO), para a loja não ficar refém de portal



1. Cadastro de veículo + ficha financeira (custos → margem)
2. Dias de pátio e dashboard do dono
3. Site público com vitrine, página do veículo e WhatsApp
4. Leads/CRM básico
5. Financeiro e vendas completos
