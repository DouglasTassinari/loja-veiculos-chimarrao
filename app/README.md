# Loja de Veículos — Site + ERP (MVP)

Next.js 16 + TypeScript + Tailwind. Dois bancos com o mesmo SQL (`src/lib/db.ts`): sem `DATABASE_URL`, SQLite embutido em `data/loja.db` (desenvolvimento, fora do git); com `DATABASE_URL`, PostgreSQL (produção). As tabelas são criadas sozinhas e, fora de produção (ou com `SEED_DEMO=1`), recebem dados de exemplo. Publicação no Render: ver `../DEPLOY.md`.

## Rodar

```bash
npm install
npm run dev
```

- Site: http://localhost:3000
- ERP: http://localhost:3000/erp (senha de desenvolvimento: `admin123`)

Em produção defina `ERP_PASSWORD`, `ERP_SECRET` e `NEXT_PUBLIC_SITE_URL`.
Para começar do zero com dados reais, apague `data/loja.db` e remova a chamada `seed(db)` em `src/lib/db.ts`.

## Identidade visual

Segue o `Manual_Identidade_Visual_Chimarrao_Veiculos` (na pasta acima). Cores e fonte em `src/app/globals.css`, logos em `public/brand/`, favicon em `src/app/icon.png`. Regra editorial do manual: não afirmar "revisado", "garantia", "procedência comprovada", "menor preço" ou "financiamento aprovado" sem evidência. Os selos do site só aparecem quando o dado foi marcado no ERP.

## Onde mexer

| O que | Arquivo |
|---|---|
| Nome, WhatsApp, endereço da loja | `src/lib/config.ts` |
| Custo do capital, meta de margem, limites de dias | `src/lib/config.ts` (`finance`) |
| Regras de margem, alertas e "próxima ação" | `src/lib/finance.ts` |
| Consultas e gravações no banco | `src/lib/data.ts` |
| Site público | `src/app/(site)` |
| ERP | `src/app/erp` |

## O que já existe

**Site:** home, estoque com filtros e ordenação, página do veículo (selos automáticos, WhatsApp por intenção, simulador de parcela, formulário de lead, Schema.org Car/Offer), sitemap e robots, carros vendidos mantidos como "vendido".

**ERP:** painel do dono (capital parado, giro, lucro do mês, caixa 30 dias, carros que precisam de ação), estoque com custo/margem/dias, ficha financeira do veículo (custos, preço vs FIPE, publicar no site, registrar venda com comissão), leads em Kanban, contas a pagar/receber com saldo projetado.

## Limitações conhecidas

- Login por senha única (sem usuários/perfis).
- FIPE e preço de mercado são digitados à mão (sem integração).
- Fotos por URL (sem upload).
- SQLite local: para produção em Vercel migrar para PostgreSQL (só `db.ts`/`data.ts` mudam).
