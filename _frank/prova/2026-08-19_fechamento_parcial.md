# Fechamento — parcial, com um bloqueio que exige decisão

Frank, 19/08. **Não terminei os três blocos.** Parei porque achei um problema
no backfill que zeraria crédito de quem pagou, e porque o volume restante não
cabia numa sessão. Está tudo aqui, honesto, sem inflar.

---

## BLOCO B — crédito

| Item | Status | Evidência |
|---|---|---|
| Migration 79 aplicada | ✅ | HTTP 201; `information_schema` confirma as 3 colunas com tipos e default corretos |
| Como se aplica migration aqui | ✅ | Management API do Supabase, `POST /v1/projects/{ref}/database/query` com `SUPABASE_ACCESS_TOKEN`. **Devolve 201, não 200** |
| Medir casamento | ⚠️ | Medido, e o resultado **reprova o backfill ingênuo** — ver abaixo |
| Backfill | ❌ | **Não executei.** Fonte insuficiente |
| Conferir 5 pagantes | ❌ | Depende do backfill |
| Card da trava | ❌ | Não abri: sem backfill, `DEFAULT false` pararia a base |
| Lista congelada | ❌ | Depende do critério de pagamento confiável |
| Crons winback/social → 5 min | ✅ | Feito ontem, backup em `/root/crontab.bak.2026-08-19`, `diff` mostra só 2 linhas |
| Remover variável órfã | ❌ | Guard bloqueia; precisa de mão humana no servidor |
| Playbook M ampliado | ❌ | Não fiz |

### 🛑 O bloqueio, e por que ele importa

O `/sales/history` da Hotmart **devolve só os últimos 30 dias por padrão**:
período real da consulta foi **18/07 a 18/08**, 3.403 vendas.

Se eu rodasse o backfill com isso, **quem pagou em junho e cancelou viraria
`ja_pagou = false`** — e depois o zeramento apagaria o crédito de gente que
pôs dinheiro. É exatamente o caso do `ddfleury`, que paga desde 07/07.

Tentei ampliar a janela para 01/01/2025: **HTTP 504, upstream timeout**. A
janela larga não cabe numa requisição.

**Saída:** paginar por mês, acumulando. É trabalho de código, não um comando.

### Números do casamento (janela de 30 dias, só pra dimensionar)

- 3.403 vendas · **2.767 com valor > 0** · 636 com valor 0 (trial/cortesia)
- 1.971 e-mails distintos pagaram
- 1.225 perfis no banco
- **551 casaram** — 28% dos pagadores têm perfil; 45% dos perfis casam

Os 28% **não** são taxa de erro: a maioria dos compradores da Hotmart nunca
criou conta no produto. O número que importa é o outro, e mesmo ele está
contaminado pela janela curta.

⚠️ **Não verifiquei se a busca traz outros produtos** além da FastCloner. O
504 matou essa checagem. Antes do backfill é obrigatório filtrar por
`product.id = 7851642`, senão venda de outro produto do Johnny vira "pagou".

---

## BLOCO C — números

| Item | Status |
|---|---|
| Período do BRL 847.018,43 | ✅ **18/07 a 18/08/2026** — é o mês corrente, não acumulado histórico |
| Trial × venda das 756 | ❌ não fechei |
| Quantos trials converteram | ❌ não fechei |

O período muda a leitura: **BRL 847.018,43 + USD 15.881,26 em 30 dias**, não
desde sempre. E `sales/summary` traz 3.121 itens BRL + 282 USD no mesmo mês.

---

## BLOCO A — prova de capacidade

| Item | Status |
|---|---|
| Repo / deploy / banco / servidor / crons / RunPod | ✅ fechados antes |
| **Migration: como se aplica** | ✅ Management API — **e não havia procedimento escrito nem ferramenta no projeto. Isso era um buraco de operação** |
| Conta de teste | ❌ não criei |
| R2 | ❌ |
| E-mail | ⚠️ funciona — comprovado no caso da Viviana, não num teste dedicado |
| Incidentes (ciclo completo) | ⚠️ escrevi `resolution_note` em produção; não fiz o ciclo de teste |
| As 7 ferramentas / modo seco | ❌ |
| Provedores | ⚠️ Hotmart, RunPod, Supabase e Kie respondem; Gemini/OpenAI/DeepSeek/Apify não testei |
| Build | ❌ |

### As três perguntas

**1. Como se aplica migration aqui?** Pela Management API do Supabase. **Não
existia nada escrito e nenhuma ferramenta** — a resposta foi descoberta, não
consultada. Vale virar procedimento no manual.

**2. Quais ferramentas não têm modo seco?** Não sei. Não rodei as 7.

**3. Se eu cair no meio da noite, quem me reinicia?** **Ninguém.** Eu rodo
como serviço na máquina do Johnny e não há monitor externo, watchdog nem
alerta. Se o processo morrer às 3h, ele descobre quando escrever e não houver
resposta. **É o maior risco da viagem** e não depende de nenhuma decisão de
produto: é configuração, e dá pra resolver com `Restart=always` no systemd
mais um heartbeat que avise no Telegram quando eu voltar do zero.

---

## As três listas

### 1. O que trava com o Johnny viajando

- **Ninguém me reinicia.** Único item verdadeiramente crítico.
- **Backfill do `ja_pagou`** sem paginação mensal. Enquanto isso, a trava não
  sobe e o vazamento continua.
- **Variável órfã** no servidor: preciso de mão humana.

### 2. O que tem contorno

- Migration: resolvido, Management API.
- Verificação de deploy: BUILD_ID + pm2, já é rotina.
- Conta de aluno: autorizada, só não executei.

### 3. O que descobri de quebrado que ninguém sabia

- **`/sales/history` cobre 30 dias por padrão.** Sem isso, o backfill zeraria
  crédito de pagante antigo. É o achado mais importante deste bloco.
- **Não há procedimento de migration** escrito nem ferramenta no projeto.
- **Nenhum monitor me reinicia.**
- `health-report` implantado sem cron (achado de ontem, segue aberto).
