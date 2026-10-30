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

## Segurança no ar

Nada a configurar no Render: os cabeçalhos de segurança saem do próprio código (`app/src/lib/headers.ts`, ligados em `next.config.ts`) e valem para toda resposta — política de conteúdo, bloqueio de iframe, `nosniff`, política de referência e de permissões, e HSTS quando o site roda em https. O `/erp` ainda responde com `noindex` e `no-store`.

Duas coisas continuam dependendo do painel do Render: a **senha do ERP** (`ERP_PASSWORD`, com 8 caracteres ou mais) e o **segredo** (`ERP_SECRET`, gerado pelo Render). Sem os dois, o ERP fica fechado em produção — ninguém entra, nem com a senha certa. Quem erra a senha 8 vezes em 15 minutos é barrado até a janela passar.

O monitor confere os cabeçalhos a cada rodada: se um deploy os derrubar, chega e-mail.

## Fotos e taxas

- As fotos dos veículos ficam em `app/public/vehicles` (cerca de 36 MB, versionadas no Git) e são de Wikimedia Commons com licença livre; o crédito aparece em cada anúncio e em `/creditos`.
- A taxa do simulador vem da base pública do Banco Central (consulta feita pelo servidor, com cache de 6 h). Se a consulta falhar, o site usa a última semana conhecida e continua funcionando.
- A consulta ao Banco Central são várias idas e voltas e leva segundos, então o servidor a faz **na subida** (`app/src/instrumentation.ts`) e guarda o resultado no processo por 6 h. Sem isso, quem abrisse o primeiro anúncio depois de cada publicação ou de o serviço acordar esperaria ~8 s.

## Sempre online (plano grátis)

O Render dorme o serviço grátis após 15 min sem visitas, e acordar leva ~1 minuto. Duas peças evitam isso no horário da loja:

1. **O próprio servidor se visita** (`app/src/instrumentation.ts`; já vem ligado quando roda no Render, `KEEP_ALIVE=0` desliga): a cada 9 min, entre 8h e 20h de Brasília (`KEEP_ALIVE_HOURS`, padrão `8-20`), ele chama `/saude` pelo endereço público, o que conta como visita. Fora do horário ele pode dormir.
2. **O monitor do GitHub** (`monitor.yml`, de 2 em 2 h, 8h05 às 20h05) acorda o site na abertura, confere tudo e manda e-mail se algo falhar.

Por que não 24 horas: o Render dá **750 horas grátis por mês somadas entre todos os serviços grátis da conta** (o NuMelhor entra nessa conta). Um serviço ligado o mês inteiro gasta ~744 h e os outros seriam suspensos. Das 8h às 20h são ~370 h. Para mudar, edite `KEEP_ALIVE_HOURS` no Render (ex.: `"7-22"`).

**Banco que vence:** o PostgreSQL grátis do Render **expira 30 dias depois de criado** (o nosso foi criado em 30/10/2026, então vence por volta de 29/11/2026), com mais 14 dias para atualizar antes de ser apagado. Na demonstração isso não derruba o site: se o PostgreSQL falhar, o servidor usa um banco de reserva temporário com os dados de exemplo (`/saude` passa a mostrar `"banco":"reserva"`).

Dois avisos chegam por e-mail, do monitor do GitHub:
- **7 dias antes do prazo**, pela data em `DB_EXPIRA_EM` no [`monitor.yml`](.github/workflows/monitor.yml) — ao trocar de banco, atualize essa data (ou deixe vazia para desligar o aviso).
- **Quando o site cair no banco de reserva**, porque dali em diante o que for gravado some no próximo reinício. **Na loja real isso não acontece de propósito**, para nunca gravar vendas reais num banco que se apaga: lá o erro aparece. Para a loja real use um banco que não vence (Neon grátis ou um PostgreSQL pago do Render) e coloque o endereço dele em `DATABASE_URL`.

Opcional: um monitor externo gratuito (por exemplo UptimeRobot, a cada 5 min em `/saude`) cobre também as madrugadas, sem gastar minutos do GitHub; lembre da conta das 750 horas.

## Limites do plano gratuito do Render

- O serviço dorme após ~15 min sem acesso; o primeiro acesso depois disso leva cerca de 1 minuto.
- O PostgreSQL gratuito expira em 30 dias. Para uso real, trocar `plan: free` por um plano pago no `render.yaml`.
- Cada commit na branch `main` gera um novo deploy automático.

## Para a loja real

1. No Render, apagar `NEXT_PUBLIC_PREVIEW` e `SEED_DEMO`.
2. Apagar os dados de exemplo (ou criar um banco novo) e cadastrar os veículos reais pelo ERP.
3. Trocar `store.whatsapp` e os dados em `app/src/lib/config.ts` pelos reais (hoje o WhatsApp é fictício).
4. Definir `NEXT_PUBLIC_SITE_URL` com o domínio final.
