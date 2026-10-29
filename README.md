# Loja de Veículos — Site + ERP

Projeto com duas frentes sobre a mesma base de dados:

1. **Site público** — vitrine de estoque, focada em SEO e conversão (leads, WhatsApp, simulação de financiamento).
2. **ERP interno** — estoque, custos, vendas, financeiro.

## Stack proposta

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | SSR/SSG, metadados dinâmicos, sitemap, ótimo para SEO |
| UI | Tailwind CSS + shadcn/ui | Visual moderno, rápido de customizar |
| Banco | PostgreSQL (Supabase ou Neon) | Relacional, ideal para financeiro |
| ORM | Prisma | Tipagem e migrações |
| Auth | Auth.js / Supabase Auth | Login do ERP com perfis (admin, vendedor, financeiro) |
| Imagens | Cloudinary ou Supabase Storage | Otimização das fotos dos veículos |
| Deploy | Vercel | Simples, CDN global |

Estrutura sugerida: monorepo único Next.js com rotas `/(site)` públicas e `/erp` protegidas.

## Site — foco em SEO e venda

- Página por veículo (`/carros/marca-modelo-ano-cidade-id`) com Schema.org `Vehicle`/`Offer`, OG tags e galeria otimizada
- Listagem com filtros (marca, modelo, preço, ano, km, câmbio, combustível) e URLs indexáveis por filtro (`/carros/toyota`, `/carros/suv`)
- Páginas locais ("carros usados em {cidade}") e blog
- Sitemap e robots dinâmicos, Core Web Vitals, imagens WebP/AVIF
- Conversão: botão WhatsApp fixo, formulário de proposta, simulador de financiamento, "avaliar meu carro" (troca), selo de procedência, badge de oportunidade
- Analytics + Pixel/Conversions API, Google Business Profile

## ERP — módulos

1. **Estoque**: cadastro de veículo (placa, chassi, RENAVAM, FIPE, fotos, documentos), status (preparação, disponível, reservado, vendido), publicação no site com um clique
2. **Custos por veículo**: compra, transporte, documentação, mecânica, estética, comissão, impostos → custo total e margem real
3. **Vendas**: proposta, cliente, forma de pagamento, financiamento, troca (entra no estoque), contrato
4. **Financeiro**: fluxo de caixa, contas a pagar/receber, DRE simplificado, relatórios por período/veículo/vendedor
5. **CRM**: leads vindos do site/WhatsApp, funil, follow-up
6. **Cadastros**: clientes, fornecedores, usuários e permissões

## Roadmap

- **Fase 1** — Base: setup, banco, auth, cadastro de veículos e custos
- **Fase 2** — Site: home, listagem, página do veículo, SEO técnico, leads
- **Fase 3** — Vendas e financeiro: vendas, fluxo de caixa, margem por veículo
- **Fase 4** — CRM, relatórios, integrações (FIPE, WhatsApp, portais)

## Pontos a definir

- Nome da loja e identidade visual
- Cidade/região (SEO local)
- Quantidade de veículos e usuários do ERP
- Emissão de nota/contrato necessária?
