# Rotina das Falhas — 25/08/2026, ~20h40–21h UTC (dono da fila)

`git checkout main && git pull --ff-only origin main` → já em dia. Índice de
ordens lido; ordem de 21/08 (`fd0b0f5`) lida: método serial (regra 8) e post de
fato consumado (regra 7).

## Placar

| | |
|---|---|
| Fila no início | **11** abertos |
| Fila no fim | **11** — não fechei nenhum, e digo em que passo cada um emperrou (§5) |
| Incidente que eu trabalhei | **1** — `99`/`6c38c99d` (Luciano) |
| Aluno avisado por mim | **1** — Luciano, 2 e-mails, conferidos nos enviados (uid 103 e 105) |
| Crédito indevido devolvido | **nada a devolver** — ele nunca pagou, está em trial |
| Bug de produção que eu achei e corrigi | **1** — acento quebrado em e-mail de aluno (`d079815`) |
| Ferramenta consertada | **2** — `enviar_email.cjs`, `sql.cjs` |
| GPU que eu queimei | **nenhuma** |
| Crédito / acesso / `entitlements` que eu toquei | **nenhum** |

---

## 0. A ronda anterior não tinha commitado o registro dela

Cheguei e achei `_frank/prova/2026-08-25_rotina_falhas_20h.md` **sem commit**, mais
a ferramenta `medir_pausas_da_entrega.cjs` e duas atualizações de README soltas na
árvore. É exatamente a falha que a ordem manda evitar: registro que não vai pra
main é invisível pra ronda seguinte, inclusive pra mim. Commitado em `b362495`
antes de qualquer outra coisa.

## 1. Por que peguei o `99` e não o `97`, que é 1h mais velho

Desvio consciente da regra 8, registrado pra não virar precedente silencioso: **o
`99` tinha relógio que vencia antes da próxima ronda.** O `97` não tem relógio e
já tinha sido trabalhado hoje às 15h.

## 2. O prazo que ninguém tinha marcado — e era o mais curto

As notas anteriores (Vigia, 12h) viram só o `access_until` de 26/08 12:00Z. Fui no
`raw_event` da Hotmart e achei um segundo relógio, **mais curto**:

| o quê | quando | faltava, quando peguei |
|---|---|---|
| `warranty_date` (garantia) | 26/08 **00:00Z** = hoje 21h BRT | **3h15** |
| `date_next_charge` (cartão) | 26/08 **12:00Z** = amanhã 9h BRT | 15h15 |

`payment.type = CREDIT_CARD`, `recurrence_number = 1`, `price.value = 0`: ele está
em trial e a **primeira cobrança de verdade** roda amanhã de manhã. Ele já tinha
pedido reembolso por escrito (uid 283) e a casa tinha prometido resposta *"ainda
hoje"* às 06:45Z — resposta que não saiu. Sem aviso, ele seria cobrado enquanto
esperava por nós.

## 3. Não gerei o vídeo longo prometido, e isso é decisão medida

O clone oferecido "por conta da casa" tem **~90s**. A régua que já está no `97`:

| duração | rosto |
|---|---|
| 9,9s | limpo |
| 79,4s | drift leve |
| 81,6s | visível |
| **86,1s** | **severo** |

Os ~90s cairiam **no meio da faixa severa**. Entregar isso justamente ao aluno
cuja queixa É realismo, horas antes de cobrar o cartão dele, seria a terceira
recusa — e a primeira fabricada pela nossa mão. **Zero GPU queimada.**

### A medição que desmonta a leitura corrente da thread

Os 6 vídeo clones dele: **2,56s · 2,56s · 2,56s · 15,23s · 15,23s · 19,26s**.
Todos **abaixo** da faixa onde o drift do `97` aparece. Logo a queixa dele **não é
o defeito do `97`** — é a qualidade base do lip-sync. Juntar os dois cravaria
causa errada, que já aconteceu 2× neste repo.

E fui atrás da alavanca óbvia antes de dizer que não existe: os 6 saíram em
**480p**, e o tier 720p foi **removido em 04/08 por decisão do Johnny**
(`config.ts:12`), inclusive porque *"nunca rodou estável (3 falhas >45min com
áudio longo)"*. Ou seja: **não há, hoje, ajuste técnico meu** que alcance o que
ele pediu. Isso é resposta, não desculpa.

## 4. O bug que eu achei porque fui conferir o meu próprio e-mail

Mandei o e-mail, fui conferir na pasta de enviados (regra: conferir depois de
gravar) e vi **`vocÃª`** no lugar de `você`. Quase deixei passar como defeito do
leitor. Não era.

**Medido, não lido no código:** na **mesma** pasta, com o **mesmo** leitor, o
e-mail da Fast (uid 90) aparece com acento certo e o nosso (uid 103) aparece sujo.
A diferença estava no código dos dois remetentes:

- `mail-smtp.ts:141` (Fast) → `Content-Transfer-Encoding: base64`.
- `enviar_email.cjs` (nosso) → **nenhum** `Content-Transfer-Encoding`, e o corpo
  saindo em bytes 8-bit crus. Quando esse campo falta, o padrão é `7bit`, que
  **proíbe** byte acima de 127: cada acento vira dois caracteres sujos e sobra pro
  cliente adivinhar.

**Isso vale pra todo e-mail que essa ferramenta já mandou pra aluno.** Uma casa
que vende clonagem de voz em português mandando `vocÃª` pro cliente é o mesmo
tipo de dano que o aviso do "AI Clone Verse" que já está no cabeçalho do arquivo.

Corrigido (`d079815`) e **provado antes/depois pelo mesmo cano**: uid 103 sujo ×
uid 105 limpo (`você, coração, não, último`). Não é leitura de código: é o mesmo
leitor, a mesma caixa, antes e depois.

Junto foi o `sql.cjs`, que cortava a resposta em 2000 chars **em silêncio** — ler
nota de incidente por aquela janela entrega meia nota parecendo nota inteira.
Agora tem `--completo` e avisa quantos chars ficaram de fora.

## 5. Em que passo cada um dos outros emperrou

Fila entra 11, sai 11. Isso é resposta honesta e não preguiça: os três primeiros
da fila **já tinham sido trabalhados hoje** por rondas anteriores e o que sobra em
cada um **não é triagem**.

| # | em que passo travou | com quem está |
|---|---|---|
| `99` Luciano | aluno avisado, causa medida, nada mais é técnico | **Johnny + Lucas**: reembolso e a promessa da peça dos 45min |
| `97` drift | trabalhado às 15h (aluno estornado, 3 promessas fechadas, subcontagem corrigida) | **Johnny**: decisão de produto formulada em 24/08 e ainda sem resposta — limitar/segmentar a geração longa, ou seguir só avisando. Custo de não decidir, medido: **3 alunos, 24.045 cr devolvidos em 3 dias** |
| `108` referência | trabalhado às 16h30; os 2 alunos estão cobertos, nenhum no silêncio | **engenharia com cuidado**: a cura do começo da referência foi **revertida** em `951ec22` por ter piorado a Ellen. Não existe cura disponível hoje pra Katia |
| `47` Katia | trabalhado às 20h, aluna avisada, card `a1c65be3` aberto pro coder | coder |

## 6. As duas verificações que a ordem manda fazer, feitas

- **Fechado que voltou a disparar:** 114 fechados examinados, **1** disparou depois
  do fechamento (`acf8acd6`, já conhecido, 18 rondas sendo reconferido). Última
  ocorrência **73h atrás**, nenhum vivo nas últimas 48h. Nada novo se escondendo
  atrás de classe fechada.
- **`d3d8d1b2` (timeout):** a ordem de 20/08 manda reabrir **se voltar**. Não
  voltou — `last_seen_at` 25h atrás, **anterior** ao fechamento. Registro uma
  divergência de estado: a ordem descreve o incidente como `ignored` por decisão do
  Johnny, e hoje ele está **`fixed`** (fechado 25/08 00:19). Não mexi; fica anotado
  porque "fixed" e "risco aceito" não são a mesma coisa e a ordem escrita diz outra.

## 7. O que eu NÃO consegui fazer

**O post no grupo do WhatsApp da equipe (regra 7) não saiu.** A WAHA só escuta em
`127.0.0.1` no servidor e eu rodo fora dele. Não vou registrar como feito o que não
saiu. O texto está pronto (§8) e avisei o Johnny no Telegram (msg 446) — ou alguém
posta de lá, ou isso precisa de um caminho, senão a regra 7 vai **falhar calada
toda ronda**, que é pior do que não existir.

## 8. Texto que deveria ter ido pro grupo

> **Luciano (chamado 99) respondido — e por que não geramos o vídeo longo**
> Escrevi pro Luciano agora. Não geramos o clone longo prometido de propósito: em
> ~90s o rosto já sai fora da foto original (medido: 10s limpo, 86s severo), então
> entregaria pior do que ele já reprovou. Contei isso a ele, contei que a queixa
> dele é a qualidade base do lip-sync e que hoje não temos ajuste pra isso, e
> passei as duas datas dele: garantia venceu hoje 21h e a cobrança do cartão é
> amanhã 9h. Reembolso e a promessa da peça dos 45min continuam sendo decisão do
> Lucas e do Johnny. Junto: achei e corrigi bug que fazia nosso e-mail chegar com
> acento quebrado pra aluno — valia pra todos os e-mails da ferramenta, `d079815`.

## 9. Achado de passagem que continua sem dono

A nota [15] do `108` mediu uma linha **órfã** em `training_jobs` (`ebf5cc56`, voz
`f4b9b0f2`, Ellen) presa em `queued` desde 25/08 01:33, sem cobrança nenhuma,
artefato dos retreinos da casa. O `varredura_travados` vai reapresentar isso como
**"PAGANTE PARADO 12h"** em toda ronda futura, do jeito mais alarmante possível.
Já queimou um pedaço de duas rondas.

**Não mexi de propósito** — apagar linha de treino sem critério escrito é o tipo de
coisa que este repo já pagou caro. Mas isso é decisão do dono da fila e eu a estou
colocando por escrito em vez de deixar apodrecer: ou a linha é cancelada com
critério, ou o detector aprende a ignorar job órfão sem cobrança. Detector que
grita à toa acaba ignorado, e aí ele deixa de proteger quando for de verdade.

---

## O que eu NÃO fiz

- Não queimei GPU e não mexi em crédito, acesso ou `entitlements` de ninguém.
- **Não gerei o vídeo longo prometido** — a medição diz que sairia pior.
- Não li a caixa do suporte@ pra triagem (a fila de incidentes foi a fonte). Li
  **só** a pasta de enviados, pra conferir e-mail meu depois de gravar.
- Não fechei incidente nenhum, e não carimbei `fixed` em nada que não resolvi.
- Não prometi reembolso nem prazo ao aluno — não é minha decisão.
