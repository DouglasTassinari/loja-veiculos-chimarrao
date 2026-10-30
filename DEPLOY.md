# Publicar no Render

Mesmo padrão do NuMelhor: código no GitHub, publicado como serviço web no Render (`*.onrender.com`). Aqui o Render sobe também um PostgreSQL, definido em [`render.yaml`](render.yaml).

## Passo a passo

1. Abra: https://dashboard.render.com/blueprint/new?repo=https://github.com/DouglasTassinari/loja-veiculos-chimarrao
   (o repositório é privado: o Render precisa estar conectado à sua conta do GitHub, como no NuMelhor)
2. O Render lê o `render.yaml` e mostra o que vai criar: o web service `chimarrao-veiculos` e o banco `chimarrao-db`.
3. Preencha **ERP_PASSWORD** com a senha do ERP (mínimo 8 caracteres). Ela fica só no Render, não no repositório.
4. Clique em **Apply** e aguarde o primeiro deploy (alguns minutos).
5. O endereço será `https://chimarrao-veiculos.onrender.com` (ou com um sufixo, se o nome já estiver em uso).
   - Site: `/`
   - ERP: `/erp`

## Diferenças em relação ao NuMelhor

- Mesmo padrão: `render.yaml` na raiz, senha digitada no Render, segredo gerado pelo Render, endereço público vindo do `RENDER_EXTERNAL_URL`, rota `/saude` e workflows no GitHub Actions (`verificacao` a cada push, com testes de código e testes no navegador; `monitor` a cada 2 horas no horário comercial, com e-mail do GitHub se o site cair).
- Banco: o NuMelhor guarda os dados num arquivo SQLite. No plano gratuito do Render o disco é apagado a cada novo deploy, então aqui o estoque e o financeiro ficam no **PostgreSQL do Render** (`chimarrao-db`).
- Com domínio próprio, definir `NEXT_PUBLIC_SITE_URL` (equivale ao `PUBLIC_BASE_URL` do NuMelhor).

## Como funciona nesta versão de demonstração

- `NEXT_PUBLIC_PREVIEW=1`: faixa "Versão de demonstração" no site e bloqueio do Google (`noindex` e `robots.txt`).
- `SEED_DEMO=1`: na primeira subida, o banco recebe os dados de exemplo (60 veículos, clientes, vendas, leads e tarefas). Quando a versão dos dados de exemplo muda (`SEED_VERSION` em `app/src/lib/seed.ts`), eles são refeitos sozinhos na subida seguinte, só nesta versão de demonstração.
- Sem `ERP_PASSWORD` e `ERP_SECRET`, o ERP fica fechado em produção.

## Fotos e taxas

- As fotos dos veículos ficam em `app/public/vehicles` (cerca de 36 MB, versionadas no Git) e são de Wikimedia Commons com licença livre; o crédito aparece em cada anúncio e em `/creditos`.
- A taxa do simulador vem da base pública do Banco Central (consulta feita pelo servidor, com cache de 6 h). Se a consulta falhar, o site usa a última semana conhecida e continua funcionando.

## Limites do plano gratuito do Render

- O serviço dorme após ~15 min sem acesso; o primeiro acesso depois disso leva cerca de 1 minuto.
- O PostgreSQL gratuito expira em 30 dias. Para uso real, trocar `plan: free` por um plano pago no `render.yaml`.
- Cada commit na branch `main` gera um novo deploy automático.

## Para a loja real

1. No Render, apagar `NEXT_PUBLIC_PREVIEW` e `SEED_DEMO`.
2. Apagar os dados de exemplo (ou criar um banco novo) e cadastrar os veículos reais pelo ERP.
3. Trocar `store.whatsapp` e os dados em `app/src/lib/config.ts` pelos reais (hoje o WhatsApp é fictício).
4. Definir `NEXT_PUBLIC_SITE_URL` com o domínio final.
