# Ronda das falhas — 20/09, ~20h30–21h00Z (Frank)

Item serial: **a cadeia da entonação — #348 / #500 (Ellen)**, cujo conserto é o
PR #92. A ronda anterior deixou o PR *medido*; esta transformou a medição em
**despacho com diagnóstico**, que é o passo que faltava havia 24 dias.

E, fora do serial, esta ronda **entrega o primeiro fix em produção em várias
rondas**: o #501, mergeado e conferido na main.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — **nada no privado do Johnny**; os dois
posts do grupo estão no §5.

## Placar

- Fila: **93 abertos** no início **e no fim** da ronda (eram 92 às 19h40),
  **39 com 7d+**. A fila não baixou, e não escondo isso: o que saiu desta ronda
  foi um fix em produção, não um cartão fechado.
- Fechados `fixed`: **0** — honesto. Nada foi resolvido até o fim (§3).
- **Fix em produção: 1** — PR #378, merge `fed87f4a`, conferido na `origin/main`.
- Alunos respondidos: **0**, e é decisão, não omissão (§2 e §3).
- Crédito devolvido: **0**. GPU gasta: **0**. Migration: **0**.
- Passo fixo dos envios: **881 lidas, 0 carta fora da tabela** depois do corte.
- `pagante_trancado`: **0 trancados, 0 na fronteira**, 1 sem prova.
- Percepção travada: **1 card** (#450), falso positivo já declarado — §4.
- Cartões: **1 novo** (`46be0ebb`), **1 entregue e mergeado** (`783ef4cc`).

---

## 0. Passos fixos

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): **881**
cartas lidas de `Sent`, **804** já tinham linha, **77** fora da janela,
**0 escrituráveis, 0 recusadas**. A contagem fecha (881 = 881).

Diferença contra as 19h40 (878 lidas / 801 com linha): **+3 cartas no intervalo,
as 3 já com linha**. O buraco não voltou a vazar — é exatamente isso que o passo
fixo existe pra detectar.

O instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue **passivo**.

`pagante_trancado.cjs`: **0 pagante trancado, 0 na fronteira**, 1 sem prova
(`drfabiovilhena29@`, sem subscriber code no payload — mesma pendência de ontem).

`fechados_que_disparam.cjs`: 15 fechados com sinal de vida, **0 vivos nas últimas
48h**. Nada a reabrir. (O script não tem opinião sobre os 191 *cegos* — isso é
limite dele, não "nenhum disparou".)

---

## 1. #501 — o vazamento fechou em produção; a exposição já criada, não

O Vigia abriu às 20hZ: a régua de 20 min do SGP somava o **mesmo arquivo** várias
vezes. **12 alunos** passaram sem ter 20 min de fala distinta e **11 já tiveram a
voz treinada** — raul 7m30 contados como 33m36, ketty 6m34 como 23m38.

O `coder` (cartão `783ef4cc`) entregou. **Não aceitei o relatório: conferi.**

| o que ele alegou | como conferi | resultado |
|---|---|---|
| PR aberto, mergeável, sem DDL | `gh pr view --json` | OPEN, MERGEABLE, 15 arq., **0 `.sql`** |
| suíte 9/9 | rodei eu, no branch real | **9 pass / 0 fail** |
| está em produção | `git show origin/main:…` | arquivo **existe** na main |

Essa última linha é a lição de 19/08 aplicada: **card `completed` não é produção,
só a main deploya** — por isso fui olhar a main, não o board.

**A escolha de projeto é o que torna isso bom, e registro por quê:** a cópia
*entra* mas *não conta*. A decisão saiu da **hora da escrita** e foi pra **hora
da conta**, sobre o array de verdade do banco. Isso fecha **por construção** o
buraco de concorrência do #238 (dois POSTs simultâneos passavam os dois) **sem**
`CREATE OR REPLACE` em `sgp_anexar_audio` — ou seja, sem entrar na fila de DDL
represada. Conserto vivo no deploy, em vez de morto esperando aval.

**O que me convenceu na suíte foram os controles NEGATIVOS**, não os positivos —
suíte verde que não morde não prova nada:
- mesmo **nome** com etag diferente conta as duas (duas gravações legítimas do
  mesmo celular saem com o mesmo nome; sem isso o conserto viraria regressão);
- mesmo etag com **tamanho** diferente não é o mesmo conteúdo;
- item legado **sem** etag/bytes conta individualmente — **falha aberta**.

Falha aberta é a direção segura: pedido em andamento não tem impressão de
conteúdo, logo **não perde minuto retroativamente**.

**Não marquei `fixed`, e a regra 14 continua inteira.** O PR impede o *próximo*
caso; ele **não cura** os 11 que já treinaram com material insuficiente. Voz
treinada não melhora por deploy. Retreino é **GPU**, e GPU é decisão do Johnny —
levada ao grupo nesta ronda (§5). Fecha quando a exposição dos 11 estiver
decidida, não quando o código subiu.

---

## 2. A entonação (Ellen): saiu de "parado" para "despachado com diagnóstico"

O cartão `fc8ab4bf` **falhou no `coder`**, foi escalado, e a medição (`8206e7bd`)
voltou com três coisas que mudam o que se sabia:

1. **O PR #92 não está obsoleto.** A main **não tem nenhuma** lógica de velocidade
   na escolha de referência. Conferi eu mesmo na fonte antes de aceitar: o
   `reference.py` da main não menciona `wps`. Isso derruba a hipótese barata de
   que a main já teria resolvido sozinha.
2. **Ele piorou, e agora com número:** `mergeable` saiu de **UNKNOWN** (19h40Z)
   para **CONFLITANTE** (agora). Merge-base `28e2aac9`; a main andou **1023
   commits** desde então. **24 dias** em draft.
3. **Por que o `coder` falhou duas vezes** — e este é o achado que importa:
   **não é conflito de texto, é redesenho.** Dois refactors **concorrentes da
   mesma estrutura**, e conferi os dois lados na fonte:
   - main, `runpod-worker/voice_pipeline/reference.py:245` — `class
     RefCandidate(NamedTuple)` com `clip/transcript/cut_mode`, onde `cut_mode`
     diz por qual dos **quatro** caminhos o clipe foi cortado;
   - branch do PR — a mesma coisa virou 4-tupla `(score, clip, transcript, wps)`,
     com `rate_penalty(wps, median)` entrando no score.

   Tratar isso como rebase mecânico é exatamente o erro que queimou as duas
   tentativas. **Um operário falhar duas vezes na mesma coisa é sintoma de
   cartão mal escrito, não de operário ruim** — o cartão anterior pedia
   "resolver o conflito".

**Despachei o `46be0ebb`** pro `coder`: unir `cut_mode` + `wps` numa estrutura só,
**com as duas suítes passando juntas como critério de aceite** (main 315/315,
branch 207/207 hoje, isoladas), e com as armadilhas de ambiente **escritas
dentro** — suíte junta quebrada na main por vazamento de mock, um teste que baixa
o VoxCPM2 real do HuggingFace (139 MB), `/tmp` sem espaço. **Ele não mergeia; eu
revejo e eu decido (14-B).**

**LIMITE DECLARADO:** o estado *merjado* não foi medido, e não por preguiça — ele
**não existe** enquanto alguém não resolver o conflito semântico.

**Em voo no fim da ronda:** o `46be0ebb` seguia `running`. Digo o passo, como
manda a regra 8: está na união das estruturas; o que falta é as duas suítes
passarem juntas. Não bloqueei a ronda nele.

---

## 3. Por que 0 aluno respondido, sendo que há aluno esperando

**Não escrevi pra Ellen**, de propósito: ela foi respondida **hoje**, com a
orientação de regravação. Cobrar de novo horas depois é pressão, não serviço —
mesmo critério que a ronda das 19h40 aplicou ao Carlos. O que falta pra ela não é
mais uma carta, é o conserto no ar.

**Não escrevi pros 12 do #501.** Dizer "sua voz foi treinada com material
insuficiente" **sem ter o retreino autorizado na mão** cria uma dívida que eu não
posso pagar. A carta útil depende da palavra do Johnny, e ela foi pedida (§5).

Registrei o despacho nos dois cartões da Ellen (#500 com a medição inteira, #348
apontando pra ela) **para nenhum dos dois parecer parado** — nota vazia foi o que
produziu os 16 dias de silêncio da ordem de 17/09.

---

## 4. Percepção (ordem de 17/09)

`percepcao_travada.cjs`: **1 card**, parado há **2,3d** — o **#450**, e é o
**mesmo falso positivo** já declarado na ronda anterior (casou por prefixo; não
existe artefato pra despachar). A classe de percepção real segue em **ZERO**.

**Não apertei o padrão do varredor, de propósito**, e mantenho o raciocínio da
ronda anterior porque ele está certo: falso positivo custa 2 minutos de
conferência; falso negativo custou os 16 dias de silêncio que originaram a ordem.

---

## 5. O que travou, com quem, e com que data

1. **Retreino dos 11 do #501** — **pedido nesta ronda**, primeira vez. É GPU,
   logo é do Johnny. Postei no grupo com os números (raul 7m30→33m36, ketty
   6m34→23m38).
2. **O "pode" do reembolso em dinheiro** — pedido em 04/09, **16 dias**. Atinge
   Carlos, Jackson, Leandro e Nassara. **Não repus no grupo**: já foi hoje,
   marcado urgente, e a regra 7 proíbe repetir progresso parcial. Repetir de 18
   em 18h mata o canal que o Lucas também lê.
3. **A frase escrita do titular (9-C)** — Carlos (20/09 01h47Z) e Leandro
   (19h40Z), **as duas com data anotada**. Esperar resposta de aluno não é estar
   travado (regra 8).

**Posts no grupo nesta ronda: 2**, os dois fato consumado ou decisão nova, uma
linha cada, sem log de terminal e sem dado de aluno desnecessário:
(a) o fix do #501 em produção com o PR e o merge;
(b) o pedido de decisão sobre o retreino dos 11 — **marcado explicitamente como
pedido novo, não repeteco**, justamente pra não parecer ruído.

---

## 6. Observação que não vira cartão agora, mas fica escrita

A medição do PR #92 encontrou de quebra, e confirmo que é sério:
**nenhum workflow de CI roda `pytest`**. O `runpod-worker.yml` só builda Docker.
Os 315 testes da main **não barram nada automaticamente** — eles só rodam quando
alguém lembra. É a mesma família do "fix preso em branch 9h" e do PR de 24 dias:
trabalho feito que não chega em produção porque nada o empurra.

Não abri cartão porque é mudança de infraestrutura de CI, não conserto de ronda,
e porque a fila já tem 39 itens com 7d+. Fica **nomeado** aqui para não virar
descoberta esquecida.

---

## 7. O que eu não fiz

Não marquei `fixed` nenhum. Não cancelei assinatura, não estornei, não toquei em
crédito, acesso, voz treinada, migration nem GPU. Não mergeei o PR #92 (nem
nenhum dos 5 branches STALE do origin). Não escrevi para aluno. Não li nem
reprocessei nada da planilha (ordem de 29/08). Nada no privado do Johnny
(ordem de 31/08).
