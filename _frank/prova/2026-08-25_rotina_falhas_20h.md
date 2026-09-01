# Rotina das Falhas — 25/08/2026, ~19h50–20h UTC (dono da fila)

`git checkout main && git pull --ff-only origin main` → já em dia. Índice de
ordens lido. Método serial (regra 8): **um** incidente, o mais antigo com aluno
esperando, levado até onde dava pra levar hoje.

## Placar

| | |
|---|---|
| Fila no início | **8** abertos (`47`, `97`, `99`, `108`, `123`, `129`, `131`, `133`) |
| Fila no fim | **8** — não fechei nenhum, e explico por quê (§4) |
| Incidente que eu trabalhei | **1** — `47`/`ce6e157d` (Katia), 151,5h, o mais antigo com aluno |
| Aluno avisado por mim | **1** — Katia, e-mail individual, **antes** deste relatório |
| Crédito indevido devolvido | **nada a devolver** — conferido, ela não foi cobrada (§3) |
| Cards abertos pro coder | **1** — `a1c65be3` |
| Ferramenta nova no git | **1** — `medir_pausas_da_entrega.cjs` |
| GPU que eu queimei | **nenhuma** |
| Crédito / acesso / `entitlements` que eu toquei | **nenhum** |

---

## 1. A exceção da regra 8, checada primeiro: os 10.120c do Itamar

A ronda das 18h deixou levantado que os 10.120 créditos do Itamar (`131`)
estavam há 3h50 sem estorno. Dinheiro cobrado errado **agora** é a única coisa
que fura o serial, então conferi antes de tudo.

**Já foi estornado**, 25/08 18:46: +1.260 `video_clone_refund`, +7.900
`image_video_refund`, +960 `image_refund` = **10.120**, contra as três cobranças
de 14:26/14:29/14:34. Conferido **por `ref_type`**, nunca por `kind` — os três
estornos gravam `kind='extra_purchase'`, que é exatamente a armadilha que quase
fez a casa pagar em dobro pra 13 alunos. Exceção fechada, nada a fazer.

## 2. O incidente: `47` (Katia) — e a leitura óbvia estava errada

Mais antigo com aluno afetado (151,5h). A bola estava do **nosso** lado: ela
tinha entregue, às 17:35Z, as 8 marcações com segundo exato que a Fast pediu, e
às 17:40Z recebeu *"assim que tiver novidade, te aviso aqui"*.

### O que eu descartei, com medição e não com leitura de código

**A nota da ronda das 18h tem um fato errado, e corrigi no incidente:** ela diz
que o PR #16 (`feat/ref-corte-em-palavra`) está *"SEM MERGE"*. **Está mergeado**
— merge `600ddb1`, código em `origin/main`
(`runpod-worker/voice_pipeline/reference.py`, `_snap_bounds_to_words`). Quem
lesse aquilo ia tentar mergear de novo o que já está na main. O que sobra do
PR #16 não é merge, é o **backfill** das vozes já treinadas, que é o `108` —
aberto 3 minutos depois daquele merge.

**Classe do `124` (transcript da referência com palavra fantasma): não é o caso
dela.** Rodei `conferir_transcript_referencia.cjs --curar` na voz `c127b74e` em
simulação: *"pontas batem — nada a curar"*. Eliminado.

### A medição, e o erro de leitura que ela desmonta

Mesmo texto (99 palavras), mesma voz, mesma referência, `tts_silence_ms=466` nas
três:

| geração | duração | pausas | silêncio | **articulação** |
|---|---|---|---|---|
| `47dc0f6e` 21/08 20:27 (**o que ELA marcou**) | 36,98s | 15 | 6,09s | 3,205 pal/s |
| `80856425` 25/08 17:53 (novo) | 34,32s | 9 | 3,43s | 3,205 pal/s |
| `1e19b952` 25/08 18:55 (novo, 1 regen do QA) | 34,15s | 7 | 2,96s | 3,174 pal/s |

O tempo **falando** é 30,89s nos dois primeiros, igual **na casa do centésimo**.
A leitura óbvia — *"encurtou 2,8s, ficou mais rápido"* — está errada: a fala não
acelerou. A queda inteira é **silêncio que sumiu**.

Isso também **inocenta o QA de ritmo de hoje** (`d238195`): o próprio `rate.py`
documenta *"pausas sao tratadas na montagem, nao aqui"*, e a articulação idêntica
prova. Eu estava a um passo de culpar a mudança de hoje; a medição não deixou.

### A parte que protege a aluna

A queixa textual dela é *"frases muito próximas, áudio ainda muito corrido"*. O
`47dc0f6e`, com 6,09s de silêncio, ela **já rejeitou por corrido**. Os dois
áudios gerados hoje têm **metade** do silêncio.

**Mandar qualquer um dos dois pra ela seria a terceira recusa, e dessa vez
piorada pela nossa mão.** Não mandei, e deixei registrado no incidente pra
ninguém mandar.

### Armadilha do zero, na minha própria ferramenta

A 1ª versão do meu script reportou **"0 pausas" nos três áudios**. Causa:
`execFileSync` não devolve stderr quando o processo sai 0 — e o ffmpeg sai 0, e
o `silencedetect` escreve em stderr. Eu lia o log só no `catch`, que nunca era
acionado. **Zero de instrumento cego não é medição.** Troquei por `spawnSync` e o
script agora **aborta** se o log não aparecer. Os números acima são da versão
corrigida; a primeira teria fechado o caso na direção errada.

## 3. Crédito da Katia: nada a devolver

Zero `credit_transactions` dela em 25/08 — os dois áudios de hoje saíram **por
conta da casa**. Os estornos antigos estão confirmados **por
`ref_type=generation_refund`** (+555/+400/+400/+400 em 19/08), não por `kind`.
Saldo 178.665, acesso ativo até 15/09.

## 4. Por que o `47` continua `investigating`, e não `fixed`

Porque **a aluna continua sem áudio bom**. A causa da montagem que come o
silêncio ainda não está cravada, e eu não chuto. Regra 14 inteira: `fixed` aqui
seria carimbar resolvido em cima de uma pagante que ainda não tem o produto.

Fica `investigating` **com nota do que já foi descartado** — que é o que
diferencia investigar de não ter olhado.

**Também não é `aguardando_aluno`:** ela já fez a parte dela. A bola é nossa.

## 5. Card aberto (código vai por branch + PR, nunca direto na main)

| card | dono | o que é |
|---|---|---|
| `a1c65be3` | coder | Achar o que removeu o silêncio na montagem entre 21/08 e 25/08, **com A/B medido, não leitura de código**. Suspeitos listados sem chute: trim de chunk, crossfade, `ref_tail_silence`, e o laço de regen do QA (o de 1 regen ficou com **menos** pausa que o de 0 regen, 7 contra 9 — cheira a efeito progressivo). Mais: tornar `chunk_max` sobrescrivível pelo payload (`jobs/tts_settings.py:146` — hoje só vem de env, ao contrário de `silence_ms`/`crossfade_ms`), **sem mexer no default de 160**, só pra destravar A/B por job. |

**Escopo fechado de propósito:** proibido mudar o default de chunking. Mais
chunks = mais GPU por áudio pra **todo** aluno, e isso é decisão do Johnny, não
de PR. Card *"completed"* no board não é produção — só a main deploya.

### O que já se sabia e economiza tempo de quem pegar

Em 21/08 já se mediu que a causa da queixa dela **não é o valor da pausa, é o
lugar**: o `split_text_for_tts` cola várias frases até 160 chars, então fronteira
de frase **dentro** do chunk não recebe silêncio nenhum. O próprio worker
documenta isso (`jobs/inference.py:318-330`) e já usa `max_chars=1` como
**resgate de cobertura** — o remédio existe no código, só não no caminho normal.

## 6. Ferramenta nova, no git e não no `_Bugs`

`_frank/ferramentas/medir_pausas_da_entrega.cjs`. As outras duas réguas medem a
**entrada** (referência, áudio bruto do treino); esta é a única que olha a
**saída**, que é sobre o que o aluno reclama. Separa articulação de silêncio e
**dá o veredito** ("é MONTAGEM" × "é RITMO DE FALA").

Fiz porque o card apontava pra um script em `frontend/_Bugs/`, que é **fora do
git** — o coder não conseguiria ler. Conferido: reproduz os números da tabela
acima exatamente.

## 7. E-mail pra Katia (regra 8: individual, decido sozinho)

Enviado **antes** deste relatório. Contei a verdade: que as marcações dela
viraram diagnóstico de verdade; que o áudio novo mediu **pior** justamente no
ponto que ela reclamou e por isso eu **não** ia mandar; qual é a causa, em
português, sem jargão; e que crédito e acesso estão intactos.

**Não dei data que eu não possa cumprir.** O combinado é escrever quando existir
áudio que valha o tempo dela. A promessa das 17:40Z estava vencendo sem resposta;
agora foi cumprida.

---

## O que eu NÃO fiz

- Não queimei GPU e não mexi em crédito, acesso ou `entitlements` de ninguém.
- **Não mandei pra aluna o áudio novo** — a minha própria medição diz que ele
  piorou no ponto da queixa dela.
- Não mexi em produção: o achado virou card, não commit de código.
- Não fechei incidente nenhum. Fila entra 8, sai 8, e isso é resposta honesta:
  o caso é difícil e o passo que emperrou está escrito (§4).
- Não toquei nos outros 7 abertos, por causa do serial.

## O que continua precisando de decisão de gente (herdado da ronda das 18h)

1. **Luciano (`99`)**: as seis fotos estão na mão e o prazo dele é **26/08, 9h
   BRT**. O clone longo por conta da casa ainda não foi feito.
2. **Douglas (`132`, já fechado às 18:51)**: janela de 7 dias fecha **26/08**.
3. **Cássio (`126`)**: uma frase confirma o cancelamento que ele perguntou duas
   vezes — medido, o registro existe.
