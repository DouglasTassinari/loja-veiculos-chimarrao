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
| Cabeçalhos de segurança e cache das fotos | `src/lib/headers.ts` (ligados em `next.config.ts`) |
| Tentativas de senha no ERP | `src/lib/ratelimit.ts` (`LOGIN_TRIES`, `LOGIN_WINDOW_MS`) |
| Páginas de 404 e de erro | `src/app/not-found.tsx`, `src/app/(site)/{not-found,error}.tsx`, `src/app/erp/error.tsx` |
| Imagem de compartilhamento (WhatsApp, redes) | `src/app/opengraph-image.tsx` |

## O que já existe

Veja o [README da raiz](../README.md) para a lista completa. Em resumo: site com assistente virtual (só regras) e simulador de financiamento próprio; ERP + CRM com funil arrastável, clientes, vendas com financiamento e tarefas automáticas de relacionamento.

## Testes

```bash
npm test               # unidade + integração (SQLite temporário e PostgreSQL de verdade)
npm run test:e2e       # navegador (Chrome instalado): site e ERP, computador e celular, acessibilidade
npm run test:smoke -- http://localhost:3000   # verificação rápida de um site no ar
```

`test:e2e` constrói o site, sobe numa porta própria (3210) com um banco descartável e salva uma imagem de cada tela em `e2e-screens/`. Para repetir sem reconstruir: `E2E_SKIP_BUILD=1 npm run test:e2e`.

`src/integration/db-postgres.integration.test.ts` sobe um **PostgreSQL de verdade** dentro do teste (PGlite numa porta local) e roda o mesmo caminho da produção: esquema, índices, colunas acrescentadas depois, trava de concorrência e dados de exemplo. É o que pega um erro de escrita no esquema que o SQLite perdoa e o Render não — o esquema é entregue ao PostgreSQL comando a comando, separado por ponto e vírgula, então nem os comandos nem os comentários podem ter um no meio.

## Limitações conhecidas

- Login por senha única (sem usuários/perfis).
- FIPE e preço de mercado são digitados à mão (sem integração).
- Fotos por URL (sem upload).
- SQLite local é só para desenvolvimento; em produção use `DATABASE_URL` (PostgreSQL).
- O assistente e o simulador usam limite de pedidos por IP em memória (basta para uma instância).
