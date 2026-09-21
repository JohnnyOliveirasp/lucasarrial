# Ronda serial 21/09 ~21h35–22h00Z — FastCloner

Serial (regra 8), a partir de `origin/main d5b7db1d`.

> ⚠️ Nome do arquivo com a hora **em Z**, de propósito. Já existem `…_22h.md` e
> `…_23h.md` nesta pasta carimbados com hora que não bate com o Z do próprio
> conteúdo (o "23h" cobre 20h40–21h15Z). Esta ronda é **posterior** à do "23h" e
> nomeá-la "24h" esconderia isso. O que vale é o carimbo Z do cabeçalho.

**Resumo em uma linha:** o aluno do `#229` pediu retreino de graça em 01/09, a
resposta ficou pronta em 02/09 e **nunca saiu** — e ao medir hoje descobri que
o áudio que a casa refez "por conta da casa" pra consertar a queixa dele
**carrega o mesmo defeito e num indicador está pior que o que ele reclamou**.
Escrevi a ele, contando inclusive essa parte.

---

## 1. Passos fixos

### 1.1 Reconciliação de envios — fecha, com os dois instrumentos concordando

Medido 21h36Z, `--corte=2026-09-14T14:06:31Z` nos dois.

**Instrumento 1** — `2026-09-18_reconciliar_envios_da_pasta.cjs` (`--confirmar`;
nada gravado porque não havia o que gravar):

| | |
|---|---|
| lidas da pasta "Sent" | 971 |
| já tinham linha (por Message-ID) | 894 |
| fora da janela (`--corte`) | 77 |
| recusadas (defeito da carta) | 0 |
| **dentro da janela sem linha** | **0** |

`971 = 971`: nenhuma carta sumiu na classificação.

**Instrumento 2** — `2026-09-18_enviados_x_tabela.cjs`, leitura independente:
971 lidas, **894 casadas por Message-ID + 4 por destinatário+janela de 10 min**,
**0 buracos depois do corte**, +73 anteriores. Veredito: o buraco é **PASSIVO**.

970 → 971 e 893 → 894 desde a ronda anterior: é exatamente a uid 3139 (a carta
do `#224`), que já nasceu com linha. O resíduo 77 × 73 segue com a mesma causa
já apurada, e `894 + 77 = 971` fecha dos dois lados.

*(A minha carta pro Paulo é a uid **3141** e saiu **depois** desta medição —
entra na conta da próxima ronda, não desta.)*

### 1.2 Percepção — o número cru subiu pra 7, a classe real segue ZERO

`percepcao_travada.cjs`: controle positivo OK (#310 reencontrado pela marca),
**503 incidentes varridos**, **7 cartões** (investigating 5 · aguardando_aluno 2).

São os mesmos 6 da ronda anterior **mais o `#517`**, que entrou na varredura por
causa da própria nota que o encerrou nos abertos (ela contém "humano olhar" ao
descrever o desenho do detector). Reli a última nota de cada um:

| cartão | o que a última nota realmente diz | travado? |
|---|---|---|
| `#450`, `#438` | falso positivo por palavra-chave | não |
| `#406`, `#455`, `#216` | percepção **cumprida** (o relato do que já foi visto casa o filtro) | não |
| `#226`, `#214` | esperando **decisão do Johnny**, escalada pelo grupo | não (regra 8 §4) |
| `#517` | nota de encerramento dos abertos; casa ao descrever o detector | não |

**Número honesto pro relatório: 0 cartão travado em percepção.** Mais velho
parado: 6,4 d (`#406`), e é percepção cumprida.

⚠️ O **PR #393** (o conserto que leva a classe crua a 0 sem qualificação manual)
segue **ABERTO**, agora com **~2h45**. Ainda não é PR apodrecendo; a cobrança
combinada era **se passar de um dia** — **continua de pé para a próxima ronda**,
e o `#517` entrando na lista crua hoje mostra que o falso positivo não é estável,
ele cresce.

### 1.3 Fila

Medido 21h38Z, antes de eu mexer em qualquer cartão, com o filtro corrigido de
22h (incluindo `aguardando_aluno`):

| status | abertos | com 7+ dias |
|---|---|---|
| `investigating` | 98 | 47 |
| `aguardando_aluno` | 32 | 17 |
| `open` | 3 | 0 |
| **total honesto** | **133** | **64** |

Contra 132/63 da ronda anterior. O `#517` saiu de `open` e foi pra
`investigating`; o `+1` líquido é movimentação de status, não cartão novo.

---

## 2. Escolha do item serial, e por que não foram os mais velhos

Os mais velhos com aluno afetado, com o estado de cada um **conferido** e não
herdado:

| | cartão | idade | por que não é ele |
|---|---|---|---|
| 1 | `#172` af06731f | 24,3 d | medido na ronda anterior: protocolo saiu 2×, falta **ele** gravar. Bola do aluno. |
| 2 | `#206` 99a20692 | 21,4 d | medido na ronda anterior na pasta remota (uid 371/373) + pedido SGP `0fd2845a` parado no passo `foto` com 0 áudios. Bola da aluna. |
| 3 | `#214` ffbfdfc4 | 21,0 d | **decisão do Johnny**, escalada ao grupo. Regra 8 §4. |
| 4 | `#216` 8b8fc4c8 | 20,4 d | trabalhado hoje às 19hZ (aluna respondida após 13 dias). Nota de 0,1 d. |
| 5 | `#223` 506b7c3a | 20,2 d | li as 16 notas. Update entregue em 13/09 (uid 2150), 5 gravações confirmadas no R2, porta de treino aberta. Espera **ação dela**. Legítimo. |
| 6 | `#224` 7ed72ad0 | 20,2 d | trabalhado na ronda anterior (estorno de 5.680 cr + carta). |
| 7 | `#226` 702cc916 | 20,2 d | **decisão do Johnny**, escalada hoje 18:59Z. Regra 8 §4. |
| 8 | **`#229` b0ddd483** | **20,0 d** | **nada esperava ninguém. Foi ele.** |

O `#517`, que a ronda anterior deixou como candidato serial, **já foi medido e
encerrado nos abertos** por uma passagem posterior: os 3 cartões abertos que o
levantamento apontou (`#311`, `#371`, `#446`) deram **3 de 3 falso positivo**,
conferidos um a um no banco. Não há ninguém esperando dinheiro ali. O
levantamento segue de pé só para os 15 cartões **fechados**, não auditados.

---

## 3. O item serial: `#229` — e o conserto da casa carregava o mesmo defeito

`b0ddd483-7980-4e9c-ab60-dea5bb6a14ae` · Paulo, `drpaulomartin@gmail.com` ·
aberto 01/09 20:50Z, 20,0 dias · `aguardando_aluno` · 5 notas.

Ele abriu pedindo **cura/retreinamento sem custo** da voz "Minha voz principal"
(`35a440b4`). O chamado nasceu **12 minutos** depois de uma entrega que o nosso
próprio QA tinha reprovado.

### 3.1 O silêncio, medido na pasta remota

`2026-09-21_cartas_para_o_aluno.cjs drpaulomartin@gmail.com` → **3 cartas, todas
de 01/09**: uid 436 (22:54Z), 437 (23:40Z), 439 (23:50Z).

A medição que responde o que ele pediu está na **nota 5 do cartão, gravada
02/09 01:35Z** — ou seja, **1h45 depois da última carta**. Ninguém nunca voltou
pra contar. **19,9 dias.**

O rótulo `aguardando_aluno` **mentia**: desde 02/09 nada estava sendo esperado
dele. É a mesma família do `#207` e do `#223`.

### 3.2 O estado atual dele, conferido antes de escrever

Perfil `266a390c`, `access_until` **26/09** — pagante **ativo**, com **dois**
ciclos pagos (`HP231922` 26/08 e `HP357102` **02/09**), 100.000 cr cada.
Ledger somado linha a linha: **173.752**.

Voz `35a440b4`: `ready`, 1322s, treinada 01/09, `speech_rate_wps` = **2.95** —
a régua corrigida da nota 5 **está gravada em produção** (era 4.25 pelo medidor
errado). Conferido no banco, não na nota.

⚠️ **3 gerações, a última em 01/09 22:48.** Ele renovou a assinatura em 02/09 e
**não gerou mais nada em 19,9 dias.** Pagante que pagou de novo e parou de usar.

### 3.3 O achado novo, e é contra a casa

| geração | quando | cobrada | `exhausted` | `regens` | `coverage_min_visto` |
|---|---|---|---|---|---|
| `cd6bc2af` (a que ele reclamou) | 01/09 20:38 | **1.998 cr** | 3 | 15 | **0,846** |
| `170db853` (a que a casa **refez pra consertar**) | 01/09 22:48 | conta da casa | 2 | 5 | **0,808** |

O piso é **0,85**. **As duas passam por baixo**, as duas foram entregues em
silêncio, e a **refeita está PIOR** no mínimo visto. O vigia tinha suspeitado
disso em 02/09 (nota 4 do cartão); hoje está **medido no campo `qa` das próprias
gerações**, não por timestamp solto.

Isso é a classe do `#226` (`tts_qa/loop.py:341-344`) **com a mesma vítima duas
vezes** — inclusive na tentativa de reparo. Anotado no `#226` (nota 59 → 60,
**sem mexer no status**: a decisão é do Johnny e foi escalada hoje 18:59Z). O
que a medição acrescenta não é opção nova, é um custo que faltava na opção (a)
"manter": **o conserto manual também reentrega reprovado.**

### 3.4 Dinheiro: nada estornado, e por quê

Ledger inteiro (15 linhas), casando `ref_type` **com** `ref_id` — nunca por
aluno:

- `-1.998` `generation` `ref_id=cd6bc2af` — ele pagou pelo áudio defeituoso.
- `170db853` (a refeita) **não tem linha nenhuma**: a frase "não descontei
  créditos seus" é **verdadeira**, reconferida hoje.
- **Nenhum estorno de `ref_type` nenhum**, em toda a vida da conta.

**Não estornei os 1.998**, e a razão está escrita no cartão: (a) ele não pediu
crédito de volta, pediu retreino; (b) a casa **nunca escreveu** a ele que tinha
estornado, então não há frase a honrar — é o que diferencia do `#224`; (c) a
regra permanente é *só se estorna quando há dívida real **e** quando o cliente
pede*. Os 3 falsos positivos do `#517` de hoje são a lição fresca de não
creditar por heurística.

O que eu **fiz** foi prometer por escrito que, se a regeração nova não resolver,
**devolvo os 1.998**. Cabe folgado na **regra 9-B** (até 20.000 cr por caso, eu
sozinho) e não depende de ninguém — então é promessa que eu cumpro.

### 3.5 O que escrevi a ele

**Enviados uid 3141**, cópia **CONFIRMADA na 1ª tentativa**, registrada em
`emails_enviados` (origem `ronda-manual`). Rascunho versionado em
`_frank/rascunhos/2026-09-21_paulo_retreino_resposta_que_nunca_saiu.html`.

1. Desculpa pelos 20 dias, nominalmente e sem rodeio.
2. Retreino **não** era indicado e por quê: referência saudável (26s, fronteiras
   certas, articula 2,60); refazer gastaria **10.000 cr dele** pro mesmo
   resultado.
3. O que era de verdade: *jowl* (5×), *platisma*, *ritidoplastia*, *SMAS*,
   *fáscias temporoparietais*, "dois mil e oito" — jargão e estrangeirismo,
   **não** timbre.
4. O caminho que funciona hoje: **grafia fonética no roteiro** ("djol").
5. **Admite** que o áudio "consertado" carrega o mesmo marcador e num indicador
   está pior: *"se você achou que continuava comendo palavra, você estava certo
   e o problema nunca foi a sua voz"*.
6. Oferece regerar **por conta da casa** com a grafia fonética, e **só se ele
   pedir** — nada de GPU sem o aluno pedir.
7. Dá o saldo (173.752) pra ele conferir sozinho.

### 3.6 Status, e por que não é `fixed`

Segue `aguardando_aluno`, mas agora o rótulo é **verdadeiro e tem data**: 21/09,
esperando ele mandar o roteiro ou dizer que não quer. **Não marquei `fixed`**
(regra 14): o defeito que produziu os dois áudios dele é o `#226` e está com o
Johnny, e a promessa dos 1.998 só vence quando ele responder.

---

## 4. O que NÃO fiz nesta ronda

Não mexi em plano, acesso, assinatura, migration, nginx, endpoint do RunPod nem
GPU. Nenhum merge, nenhum PR novo, nenhum estorno. Nada da planilha de SGP
(ordem de 29/08). As escritas em banco foram **duas**, as duas conferidas na
releitura: a nota+status do `#229` (5 → 6 notas) e a anotação no `#226` (59 → 60,
status intacto). A única carta a aluno foi a **uid 3141**.

## 5. O que a próxima ronda herda

1. **`#229` tem data**: se o Paulo responder com o roteiro, a bola volta pra casa
   **no mesmo dia** — regerar com grafia fonética por conta da casa, e se não
   resolver, **devolver os 1.998 cr** (promessa por escrito, regra 9-B, minha).
2. **PR #393** — hoje com ~2h45. Se amanhecer com mais de um dia aberto, **cobre**.
   O `#517` entrou na lista crua de percepção hoje: o falso positivo cresce.
3. **A resposta A/B do Johnny sobre os 7.455 do `#224`** segue pendente, e a casa
   **prometeu por escrito** voltar ao aluno com ela. Chegando, escreva no mesmo dia,
   inclusive se for não.
4. **`#226`**: decisão (a)/(b)/(c) com o Johnny desde 01/09, reescalada 18:59Z de
   hoje, agora com a medição da §3.3 anexada.
5. **`#517`**: encerrado nos **abertos** (3 de 3 falso positivo). Sobra auditar os
   **15 cartões fechados** e o detector despachado ao `coder` — com os 3 falsos
   como controle **negativo** obrigatório.
6. **`#494`** e os **7 alunos da classe com vídeo ainda não assistido** seguem de pé.
7. Seguem de pé: **140 recados `para_frank_*`** (mais velho ~430 h) e os **17
   cartões `aguardando_aluno` com 7+ dias** ainda não triados — dos mais velhos,
   `#172`, `#206`, `#223` e `#229` estão medidos e com dono definido.
