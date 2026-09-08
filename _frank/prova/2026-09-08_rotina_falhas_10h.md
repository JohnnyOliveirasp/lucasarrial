# Ronda das falhas — 08/09 ~10h40–11hZ (Frank, dono da fila)

**Cards tocados:** `#290` / `446c3ae4` (serial da ronda), `#254` / `f1ada07e`
(perna DIEGO, prazo de 12:00Z) e `a0bc1f7e` (registro cruzado).

**O que fiz que muda estado:** 1 e-mail individual a aluno (Max, Enviados uid
1305), 1 rascunho corrigido antes de sair, 3 notas de incidente, 4 avisos no
grupo.

**O que NÃO fiz:** não fechei incidente; não cancelei assinatura; não mexi em
crédito, acesso, plano, GPU nem migration; não subi código (nenhuma linha de
produção mudou); não mandei o e-mail em lote dos 7 (segue esperando o "pode").

---

## §1 — `#254`, perna DIEGO: protocolo do prazo cumprido, decisão mantida

Item 1 do handoff das 02hZ, com vencimento **hoje 12:00Z**. Executado às 10h45Z.

| verificação | resultado |
|---|---|
| `ler_caixa --de sendzapoficial@gmail.com` | *nada encontrado* |
| `ler_caixa --de admin@ag12x.com.br` | *nada encontrado* |
| `ler_caixa --fila` (não-lidos no INBOX) | **0** |

**Fechei um buraco de instrumento que as rondas anteriores não tinham fechado, e
ele quase invalidava a conclusão.** O `ler_caixa` busca **só em `SEEN`** — a fila
de não-lidos é da Fast. Logo, uma resposta recente do Diego ainda não lida pela
Fast seria **invisível** pra mim, e eu estaria escrevendo *"não respondeu"* onde
o certo seria *"não consigo ver"*. Conferi a fila: **0 não-lidos**. Com a fila
vazia o recorte `SEEN` cobre a caixa inteira e o "nada encontrado" vira
conclusivo. Sem esse passo, a decisão de deixar cobrar R$194 estaria apoiada num
instrumento cego.

**Decisão mantida: não cancelar** a órfã `4UKYMN4L`. CPF diferente
(`35579447191` × `00295425105`) e titular Hotmart da órfã é **"Roseli Maria de
Santana"**. Cancelar sem pedido escrito é cancelar assinatura de **outra pessoa**.
Dinheiro cobrado errado se devolve; assinatura de terceiro cancelada por engano,
não.

Os **R$194 de 12:00Z vão sair por decisão consciente**, e a perna vira
**reembolso**. Postado no grupo às ~10h50Z marcado URGENTE com a hora limite na
frente — restavam ~70 min pro Johnny derrubar, que é alçada dele. Não mandei 3º
e-mail (seriam 2 em 48h; o 3º é o `#259` cometido por nós).

---

## §2 — `#290`: o rascunho pronto pra sair carregava o defeito do `a0bc1f7e`

**Este é o achado da ronda, e ele é contra o meu próprio trabalho de ontem.**

O texto que estava **pronto e conferido** esperando só o "pode" pra ir aos 8
dizia, no corpo:

> "a sua assinatura da plataforma está **ativa até {DATA}**"

com `{DATA}` preenchida de `entitlements.access_until`. Medi os 8 na fonte antes
de deixar sair:

| campo | resultado nos 8 |
|---|---|
| `access_until` × `raw_event->purchase->date_next_charge` | **idênticos nos 8** |
| `raw_event->subscription->status` | **ACTIVE nos 8** |

`LTY61KB0`, `E1239TIK`, `CL0KLOQ8`, `WEVYYE64`, `JJ54Q2L2`, `AQA0PSFE`,
`3847B6V3`, `E1BGOQEH`.

Para assinatura ACTIVE essa data é a **próxima cobrança**, não vencimento. Enviar
como estava seria cometer, **em 8 pessoas de uma vez**, exatamente o defeito que
a casa abriu como incidente **no mesmo dia** (`a0bc1f7e`, 08/09 00:16Z), que
mediu **27.436 créditos queimados em 8h** por *uma* aluna que recebeu prazo falso
nosso.

E o agravante aqui seria **maior**: os 8 nunca entraram, então têm os 100.000
**intactos** pra queimar em cima de uma pressa que nós teríamos inventado. Um
e-mail de reparação causaria o dano que pretendia reparar.

**Corrigido no rascunho antes de qualquer envio.** A frase agora diz que a
assinatura **renova automaticamente** naquela data e que a data **não é prazo de
uso**.

## §3 — A inversão que isso provoca: ninguém está perdendo janela, todos vão ser cobrados de novo

A leitura *"se não entrarem até lá, perdem a janela"* — que está na descrição do
card e no jeito como a varredura apresenta o campo — está **refutada**. Os 8
estão ACTIVE e **renovam**:

| renova em | quem |
|---|---|
| **13/09** | max@md2net, cris_evangelista22 |
| 19/09 | rmf174 |
| 20/09 | rutifortuna8, flaviamalavazi |
| 29/09 | fmgimael |
| 30/09 | malmeida313 |
| 02/10 | atendimento@dropweb |

O relógio não é *"corra antes que expire"*. É **"em 13/09 duas pessoas pagam o
SEGUNDO mês de uma plataforma que a nossa própria carta disse que elas não
tinham, sem ter entrado uma única vez"**. É argumento de **dinheiro**, não de
prazo, e é mais forte. Levado ao grupo nessa forma.

## §4 — Escrevi pro Max, sozinho, e por que ele e não o lote

Achado que as rondas anteriores não tinham visto: em **03/09** a casa mandou pra
ele (Enviados **uid 491**) a pergunta direta *"com qual e-mail você entra (ou
tentou entrar)?"*, **prometendo por escrito** ligar a assinatura assim que ele
respondesse. Em **06/09** a ronda ligou a assinatura dele **por conta própria**
(`LTY61KB0`, um dos 7 vinculados) e **ninguém voltou pra contar**.

Conferi o Sent **antes** de escrever: existem só 2 e-mails, uid 491 (03/09) e uid
921 (04/09), **nada depois do vínculo**. Ele está há **5 dias** esperando a
resposta de uma pergunta que nós mesmos respondemos.

Pela **REGRA 8 de 21/08**, e-mail individual sobre caso que estou tratando eu
decido sozinho — e a mesma regra manda **não segurar resposta de aluno esperando
permissão**. O lote dos 7 continua sem sair e continua esperando o "pode".

**Enviado**, cópia **confirmada** em Enviados **uid 1305**, tentativa 1. O texto
fecha a pergunta de 03/09, corrige o parágrafo falso de 04/09, diz que a conta
tem 100.000 créditos, e diz que **13/09 é renovação e não prazo** (o §2 aplicado
a ele).

**Contexto que reforça**, medido no `pagou_de_verdade` (Hotmart viva): Max pagou
**R$1.251,88** em 13/08 (assinatura 97 + SGP 741 + 297 + 116,88), tudo COMPLETE.
Entrou **uma vez**, 04/09 16:48Z, quando a entitlement dele ainda estava órfã —
viu conta sem acesso e sem crédito, e nunca mais voltou. A carta de 04/09 dizia
que a plataforma era "contratada à parte".

## §5 — Tânia: conferi em vez de presumir, e a resposta certa foi não escrever

A varredura acusa `tania-araujo@uol.com.br` como *"acesso vivo, com crédito e sem
voz pronta"* há 4 dias (voz `9c145745`, `awaiting_training`, 6 arquivos, 30 min,
paga). Cheirava a pagante travada.

**Não é, e não escrevi.** Conferi o Sent: ela já foi escrita **duas vezes** —
uid **1071** (05/09) e uid **1158** (06/09) — as duas explicando exatamente o
clique que falta, e as duas oferecendo iniciar o treino por ela se respondesse.
Não respondeu. Pela regra de 21/08, mandou e anotou = saiu do meu colo. Um
terceiro e-mail em 3 dias seria o `#259` cometido por nós.

`awaiting_training` segue não sendo bug (espera legítima pelo clique do aluno,
já fechado nas rondas de 27/08 e 28/08). Registro pra próxima ronda não gastar
turno redescobrindo isso: **16 vozes** nesse estado hoje.

---

## §6 — O que a próxima ronda faz

1. **`#254`/DIEGO:** depois de 12:00Z a perna é **reembolso**. Conferir se a
   cobrança de R$194 saiu e, se saiu, tratar como estorno (a alçada é do Johnny).
   Não mandar 3º e-mail.
2. **`#254`/CARLOS:** não escrever antes de **11/09**. Próximo débito 22/09.
3. **`#290`:** se o "pode" vier, mandar os 7 **com o texto já corrigido** (§2),
   um a um, sem `--bcc`. Se não vier até **13/09**, registrar que Max e Cristiane
   pagaram o 2º mês sem uso.
4. **`#290`:** a prova em produção do ramo corretivo do `0b672b2` **continua não
   existindo** — conferi hoje, nenhum e-mail novo da série saiu com o bloco
   corretivo. Só um assinante pagante comprando o SGP produz essa prova. Não
   inventar.
5. **`#15`:** inalterado — continua esperando a próxima **falha** (pro
   `chunk`/`attempt`) ou a autópsia do `5de8e601`. Não toquei.
6. **Migration 82** continua não aplicada, aguarda Johnny.

## §7 — Armadilha nova, e ela é genérica (vale além destes cards)

> **Nunca escreva data pra aluno lendo `access_until` sem antes olhar
> `raw_event->subscription->status`.** Se for ACTIVE, aquela data é **cobrança**,
> e a frase certa é **"renova em"** — nunca "ativa até" nem "vence em".

Não é conselho teórico. É o que separou hoje um e-mail de reparação de um e-mail
que causaria o dano que pretendia reparar. E note **onde** a armadilha reapareceu:
não num prompt, não no agente — num **rascunho escrito à mão por mim**, a partir
da mesma coluna. Isso amplia o escopo do `a0bc1f7e`: consertar só o
`account.ts:258-263` deixa a armadilha viva pra Fast, pra rascunho manual e pra
qualquer script futuro que formate essa data. Sugestão registrada no card: um
helper único que devolva a frase pronta a partir do status.

## Pendências que atravessam rondas

| item | estado |
|---|---|
| `#290` fechado | **não** — falta o "pode" dos 7 + prova em produção do ramo corretivo |
| `#254` fechado | **não** — causa da classe (`#222`) viva; estorno é da equipe de compras |
| DIEGO: R$194 em 08/09 12:00Z | **deixado cobrar** por decisão consciente; vira reembolso |
| `#222` reenquadrar ou fechar | **espera decisão do Johnny** desde 06/09 (notas 33/34) |
| `#15` fechado | **não** — 40 dias; bloqueado por instrumento |
| Migration 82 | não aplicada, aguarda Johnny |
| §2 do rascunho de 07/09 ("ativa até {DATA}") | **defeituoso, corrigido aqui** (§2) |
