# Ronda serial 21/09 ~17hZ — FastCloner

Serial (regra 8). Cartão do Mission Board: `0f6af20d`.

**Resumo em uma linha:** persegui o item nomeado (`hellengrasso@`) e ele
desembocou nos **90 alunos do SGP** — onde eu **fechei a bifurcação que travava
o cartão há 11 dias**, medindo o fato que faltava **sem tocar na planilha**; o
pedido foi ao Johnny maduro, e o Carlos segue com a cobrança dupla vencendo
**amanhã**.

---

## 1. Passos fixos

### 1.1 Reconciliação de envios — fecha, dois instrumentos concordando

`2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar`:

| | |
|---|---|
| lidas da pasta "Sent" | 937 |
| já tinham linha | 860 |
| fora da janela (`--corte`) | 77 |
| recusadas | 0 |
| **dentro da janela sem linha** | **0** |

Contagem fecha (937 = 937). O irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`),
que é instrumento independente, dá o mesmo veredito: **0 carta depois do corte**
fora da tabela. As 77 pré-tabela seguem sem decisão, como já estava escrito.

### 1.2 Percepção (ordem de 17/09) — 0 despachos, e agora eu sei POR QUÊ

| | |
|---|---|
| abertos/investigating | 93 |
| casam o detector | 18 (mais velho: 19d) |
| última nota já traz veredito → falso positivo | 15 |
| **candidatos reais** | **3** |

**Os 3 também são falsos positivos, e isto eu conferi em vez de supor.** Em
`702cc916`, `ab5644be` e `bb97e2f1` a palavra-chave casou numa **nota ANTERIOR**,
não na atual — nenhum dos três tem a última nota pedindo perícia.

**Isso dá nome preciso ao defeito do detector** (item nomeado #5), melhor que o
"~100% falso positivo" de antes: **o detector varre o jsonb INTEIRO de
`agent_notes`, enquanto o estado do caso mora só na ÚLTIMA nota.** Card que um
dia escreveu "assistir" casa **para sempre**, mesmo depois de resolvido. Não é
ruído aleatório: é um detector que mede histórico e apresenta como pendência.
A correção tem que ler a última nota, não a pilha.

**Nada despachado para o `olho` — não há sujeito.** Não inventei perícia para
cumprir roteiro.

### 1.3 Fila

93 abertos (41 com 7+ dias). Fila de não-lidos do `suporte@`: **0**.

---

## 2. O item serial: `hellengrasso@` → e o que ele revelou

### 2.1 A Hellen, individualmente, JÁ ESTÁ TRATADA — conferido, não herdado

- Voz `9bb9fccf` em `rejected_too_short` desde 06/09. **Confirmei a causa no R2,
  não na mensagem de erro**: sob o prefixo da voz existem **2 objetos reais**
  (`001_…m4a` e `006_…m4a`). A numeração bate com "2 dos 7", e o `006` prova que
  os do meio se perderam. O diagnóstico da casa estava **certo**.
- **4 cartas** (05/09, 06/09, 11/09 e 12/09 — Sent uid 1937), conferidas por mim
  na pasta remota. ⚠️ A tabela `emails_enviados` devolve **0 linhas** para ela, e
  isso **não é ausência de carta**: a tabela só cobre desde 14/09 14:06Z e as
  cartas dela são todas anteriores. Quem parar na tabela conclui "ninguém falou
  com a Hellen" e manda a 5ª carta em cima de 4.
- Créditos **intactos** (95.375), nada cobrado. Acesso até 05/10.
- Ela voltou ao app em **12/09 14:48Z**, depois da 4ª carta, e não refez o treino.
  Não respondeu (fila de não-lidos = 0, então não há resposta por ler).

**Não mandei 5ª carta.** A bola é dela e está escrito desde 12/09.

### 2.2 Mas a Hellen não é um caso solo: ela é 1 de **90**

O cartão dela (`12d4db57`) está `fixed` desde 12/09. O que a prende hoje é o
cartão **`1a9e6133`** (`sgp:planilha_antiga:pedido_sem_foto_sem_audio`, 90
ocorrências, aberto hoje 12:07Z): o pedido de SGP dela está em `status='dados'`
com **0 fotos e 0 áudios**, como os outros 89.

---

## 3. 🎯 O que esta ronda ENTREGOU: a bifurcação de 11 dias, fechada

O Executor deixou o cartão parado num único fato não medido:

> *"a planilha antiga ainda guarda as chaves/URLs do material? SE SIM é conserto
> de agente (re-import, sem falar com ninguém). SE NÃO, vira convocação dos 90 —
> e-mail em massa e aval do Johnny. NÃO acionei o Johnny porque o pedido ainda
> não está maduro."*

**Medi o fato — e medi do lado permitido.** `origem_dados` é coluna da **nossa**
tabela, não é a planilha: consultá-la não é ler a planilha. União das chaves nos
90 pedidos:

```
data, status, situacao, tem_foto, tem_audio, linhas_planilha, status_todos
```

**Zero dos 90** contêm qualquer link/caminho/chave (regex
`http|drive|.jpg|.png|.m4a|.mp3|.wav|key|path|url` → **0 casos**). O registro
guarda **booleano** (`tem_foto=true` nos 90, `tem_audio=true` nos 90), **não o
material**.

**Portanto o ramo "SE SIM" não existe:** não há de onde re-importar dentro da
nossa base. E o ramo de ir buscar na **planilha** está **vedado pela ordem de
29/08** ("não leia, não escreva, não reprocesse NADA que venha da planilha",
que vale para todos os agentes). Os dois caminhos de conserto silencioso estão
fechados — sobra **convocar os 90**, que é e-mail em massa e **exige o "pode"**.

### 3.1 O peso, medido, para o pedido chegar maduro

| | |
|---|---|
| pedidos | 90 (todos `status='dados'`, todos sem foto e sem áudio) |
| **declararam ter enviado foto E áudio** | **90 de 90** |
| material entregue por eles entre | **25/06 e 09/09** (o mais velho faz ~3 meses) |
| situação | 60 "TEM CONTA, SEM PEDIDO" · 30 "SEM CONTA" |
| perfil encontrado | 62 de 90 |
| **acesso pago VIVO hoje** | **18** |
| crédito > 0 | 22 |

**18 pessoas estão pagando agora por uma janela que não conseguem usar.**

### 3.2 Por que eu NÃO fechei o cartão como "planilha desativada"

A leitura mecânica da ordem de 29/08 mandaria `ignored`. **Não fiz, e não é
desobediência — é a regra do README:** *"na dúvida entre duas, pergunte; nunca
escolha em silêncio quando envolve dinheiro de aluno."* Fechar enterraria **90
alunos pagantes parados no sistema NOVO** (`sgp_pedidos`, produção), e a própria
ordem de 29/08 **preserva explicitamente o atendimento a ALUNO**. O conflito
entre as duas leituras é decisão do Johnny, não minha. Mantido `investigating`
**com a medição escrita na nota** (regra 5).

Nota gravada no `1a9e6133`: 1 → 2 notas, **1 linha afetada**, conferida por
releitura (não confiei no update mudo).

---

## 4. 🔴 Carlos — vence AMANHÃ, e a bola não é minha

Remedido vivo nesta ronda: as duas pernas **`active` até 2026-09-22**. Renova
**R$194 no lugar de R$97**, pela 2ª vez.

**Ele não respondeu, e isto é conclusivo:** conferi os **dois** endereços
(`caplastica@`, `gutoassuncao16@`) → nada; fila de não-lidos → **0**. Com a fila
vazia, não existe resposta por ler. **Sétima carta, zero resposta.**

**Não cancelei:** a 9-C autoriza cancelar **a pedido do titular**, e ele não
pediu. Sem o pedido, cancelar é *tirar dele*.

**O preço está escrito:** sem o "pode" hoje, a casa cobra **R$194 errado amanhã**
e a perna dele vira caso de devolução — a trava que já tem **17 dias**.

---

## 5. Escalado ao GRUPO (canal correto, ordem de 31/08)

Uma mensagem, **duas decisões que são do Johnny**, ambas com relógio: o Carlos
(vence amanhã) e a convocação dos 90. Postado via `notify-grupo.sh`. Nada foi
para o privado.

---

## 6. O que eu NÃO afirmo

- **Não afirmo que os 90 alunos ainda têm o material** para reenviar. Eles
  enviaram entre junho e setembro; se ainda guardam os arquivos é suposição
  minha, e a convocação tem que contar com quem não guarda.
- **Não afirmo que a planilha perdeu o material.** Afirmo que **nós** não o
  temos e que **não é permitido** ir verificar lá. São coisas diferentes e a
  segunda é uma trava de ordem, não um fato físico.
- **Não afirmo que os 15 falsos positivos da percepção estão todos corretos** —
  classifiquei pela última nota conter veredito; conferi os **3** que sobraram.
- **Não afirmo que a Hellen vai refazer.** Quatro cartas, voltou ao app e não
  refez.
- **Não afirmo que o Carlos vai responder.** Sete cartas, zero resposta.

## 7. O que eu NÃO fiz

Não cancelei assinatura. Não estornei. Não mexi em crédito, carteira, acesso nem
plano. **Não escrevi para aluno nenhum nesta ronda.** Não convoquei os 90. Não
liguei nem mandei WhatsApp. Não gastei GPU, não apliquei migration. **Não li a
planilha** (ordem de 29/08). Não abri cartão para o `olho` (§1.2). Hotmart só
por GET.

## 8. Fica nomeado para a próxima ronda

1. 🔴 **Carlos** — se o "pode" chegou, cancelar a órfã na hora pelo 9-C.
2. 🔴 **Os 90 do SGP** — se o "pode" chegou, a convocação precisa ser escrita
   contando com quem **não** guardou o material (§6).
3. **Detector de percepção** (§1.2): a correção é **ler a ÚLTIMA nota**, não o
   jsonb inteiro — causa agora nomeada com precisão.
4. **Juntar os 4 cartões de R2** (`e9b1fa98` aberto + 3 fechados) ou decidir que
   não se juntam.
5. **Segunda perna do `#510`**: `ingest` casa por assinatura sem filtro de status.
6. **Ponto cego da Nassara**: quem tem 2+ assinaturas e foi creditado só numa.
7. **Re-medir as 3 pernas restantes do `#254` por ASSINATURA**, não por e-mail.
8. **`#407`** — entrega ao time sem retorno humano.
9. **`#226`**, **`#343`/`#324`** — falta escolha do Johnny / sem revisão.
10. **`feat/resumo-diario-grupo-suporte`** — decisão do Lucas de 04/09 nunca subiu.

## 9. Armadilha nova, registrada para a próxima ronda

**`emails_enviados` tem cobertura que começa em 14/09 14:06Z — "0 linhas" NÃO
significa "nunca escrevemos".** Na Hellen a tabela diz 0 e a pasta Sent tem 4
cartas. Quem consultar só a tabela manda carta repetida a aluno que já foi
avisado 4 vezes — dano, não zelo. **A pasta remota é a fonte; a tabela é
parcial.** (Mesma família do `cobreDesde` que o README já alerta.)

Também repeti e confirmo: **a coluna é `signature`**, e `profiles` **não tem**
`full_name` (é `display_name`) nem `voices.error` (é `error_message`). Imprimi o
erro cru em vez de acreditar no `null` — foi o que evitou concluir "aluna não
existe".

## 10. Passo fixo de fim de ronda

Registro vai **direto na `main`** por worktree isolado. Nenhum código foi
escrito nesta ronda (só medição e uma nota de cartão), então **não há branch meu
que possa ter ficado preso**.
