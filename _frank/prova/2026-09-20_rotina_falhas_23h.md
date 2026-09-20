# Ronda das falhas — 20/09, ~23hZ

Dono da fila: Frank. Método serial (regra 8, ordem de 21/08).
Fila: **93 abertos** (39 com 7d+).

---

## 0. Passo fixo — reconciliação dos envios (ordem de 18/09)

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

883 cartas lidas da pasta `Sent`, 806 já tinham linha, 77 fora da janela
(decisão do `--corte`), **0 escrituráveis**. Conferido com o irmão de leitura
(`2026-09-18_enviados_x_tabela.cjs`): veredito **0 carta depois do corte** fora
da tabela. O buraco segue passivo. Contagem fechou 883 = 883.

As 77 anteriores a 14/09 14:06:31Z seguem **sem decisão**, como já estava.

---

## 1. Card serial: `702cc916` — "entregamos áudio que o nosso próprio QA reprovou"

Escolhido por ser o mais velho **com aluno parado de verdade** (18d). O mais
velho da fila em termos absolutos é o `d3d8d1b2` (51d), mas ele tem fix
estrutural em produção desde 10/09 e o próprio `execucao.ts` proíbe declará-lo
curado — tratado no item 2 como re-medição, não como card serial.

### O que estava travado

Desde 01/09 este card espera uma **decisão de produto do Johnny**: quando o QA
esgota as tentativas, (a) falhar sem cobrar, (b) entregar avisando, ou (c)
seguir como está. A decisão estava parada por falta de número — e a telemetria
que produz esse número (**PR #147**) está em produção **desde 02/09 02:20Z**.
**18 dias de dado acumulado que ninguém leu.**

### O que medi

1.017 gerações reais (`ready` + `runpod_job_id IS NOT NULL`, paginado):

| | |
|---|---|
| entregues com `exhausted > 0` | **507 / 1.017 = 49,9%** (era 43,7% em 02/09 — **subiu**) |
| dessas, com `exhausted_score_max` | **507 / 507 = 100,0%** |
| `exhausted_score_none > 0` | **0** |

`exhausted_score_max`: min 2 · p50 **100** · p75 118 · p90 172 · p95 213 · máx 385.

### ⛔ Derrubei o meu próprio rótulo antes de ele virar decisão

Minha primeira leitura separou `<50 ritmo / 50-99 intrusa / >=100 palavra
comida` e deu **53,8% de graves**. **É falso.** Em `loop.py` o score **soma
eixos**: linha 456 `score += 50 * intrusoes` (duas intrusas = 100) e linha 547
`score += int(60 * desvio)` (desvio 1,67 = 100). O próprio código avisa na
linha 576: *"um score alto pode somar vários eixos; use como severidade, não
[como diagnóstico]"*. Publicar 53,8% teria levado o Johnny a derrubar entrega
demais.

### Calibração contra perda REAL de palavra

Régua de whisper de 01/09 (`_Bugs/chamado_229/severidade.cjs`), amostra
estratificada **determinística** (ordenada por id, espaçada), n=12, roteiro com
marcação de produção excluído (são só 2 em 505 hoje):

| balde | n | palavras pedidas | perdidas |
|---|---|---|---|
| score **< 100** | 6 | 695 | **0 (0,0%)** — 6 de 6 limpas |
| score **>= 100** | 6 | 644 | 105 cru (16,3%) — **mas 2 são artefato** |

**Os dois artefatos, descontados:**

- `64a19e62` (88,2%, o pior número da amostra): o texto pedido está **em
  inglês** e a régua chama o whisper com `language=pt` **fixo**. Ela transcreveu
  em português e chamou de lacuna. É a **4ª armadilha da régua**, não coberta
  pelas 3 que ela já desconta. **Descartado.**
- `a4ffc5a3` (2,4%): as lacunas são `"para a" → "pra"` e `"para o" → "pro"`.
  Contração natural da fala. **Descartado.**

Sobra como perda real: `035aaea2` (13,4%, PT, frases inteiras faltando) e
`56cbc620` (parcial — parte é a armadilha do dígito, parte é erro de verdade,
`"a súmula" → "assuma"`). Os outros 2 do balde alto deram 0,0%.

### O que isso sustenta (n=12 — **não** é taxa da base)

- Abaixo de 100 a amostra **não achou uma palavra perdida em 695**. Um limiar em
  100 não joga fora entrega limpa.
- Acima de 100 o dano real existe mas é **minoria**: ~2 de 6 após descontar
  artefato. **Ordenar por score não ordena por dano** — é o ACHADO 1 de 01/09,
  que continua de pé *com* a telemetria nova.
- A pergunta deixa de ser "derrubar 44% ou não": a regra "falhar sem cobrar
  acima de 100" pegaria **273 de 1.017 = 26,8%** das entregas, e a calibração
  diz que a maioria dessas 273 **não tem perda de palavra**.

**Recomendação ao Johnny:** opção (b) — entregar **avisando** acima de 100.
(a) cobra 26,8% das entregas por um dano que a amostra mostra ser minoritário
dentro do balde.

### Achado lateral (vale chamado próprio)

Existe entrega com **texto em inglês** passando pelo pipeline PT-BR
(`64a19e62`, 03/09). Não investiguei o que o aluno ouviu. Não afirmo que saiu
errado — afirmo que **a casa não sabe**, e que a régua de QA é cega pra isso.

**Status: `investigating`.** Não resolvi, **medi**. Gastei ~R$0,24 de whisper,
**zero** crédito de aluno, **zero** GPU, nenhum código subiu, nenhum e-mail saiu.

---

## 2. `d3d8d1b2` (#15) — re-medição da régua

**`executionTimeout` desde 05/09: ZERO.** `last_seen` segue 04/09 20:47 — 16
dias limpos. Mas o #229 subiu em **10/09**, seis dias *depois* da última
ocorrência: os 16 dias limpos **não provam** que ele curou. Não escrevo que o
#15 está curado.

### O teste falsificável de 19/08 finalmente tem resposta — e ninguém tinha lido

As 6 ocorrências pós-deploy do `1c09508` vieram **todas** com `elapsed_seconds`
preenchido. O terceiro desfecho previsto ("ainda null → o fix não funciona")
está **descartado**.

| data | id | elapsed | chars |
|---|---|---|---|
| 23/08 | `2e2938b7` | **1811,9s** | 77 |
| 24/08 | `7ef17c4e` | 492,1s | 78 |
| 24/08 | `44227a0c` | 483,0s | 906 |
| 28/08 | `086970cd` | 491,6s | 206 |
| 04/09 | `a07e9278` | 579,0s | 1307 — *[fase: inference.chunk.generate running_s=5]* |
| 04/09 | `86254b30` | 484,8s | 749 |

Os cinco de 24/08 em diante batem no **piso de 8 min (480s)** com 3 a 12s de
estouro: não é "hang de 30 minutos", é **guilhotina do piso**. E a fase gravada
no `a07e9278` diz `running_s=5` — o job estava a **5 segundos** dentro de um
chunk normal quando morreu, o que mata "chunk pendurado" para essa ocorrência e
confirma o diagnóstico de 10/09 (pico de setup comendo a base fixa).

### A censura que ninguém tinha nomeado

Maior **sucesso** da base: **479,64s**. Menor **timeout**: **483,0s**. A
distribuição de sucesso não termina em 479s porque a inferência não passa disso
— termina ali porque **o teto corta em 480s**. Quem calibrar régua com "máx
sucesso = 479,6s" está lendo uma distribuição **censurada pelo próprio teto**.
É exatamente o erro contra o qual a nota de 18/08 23:20 avisou, e que foi
cometido assim mesmo.

### A cauda do setup andou de novo — 4ª vez

`medir_regua_15.cjs`, n=879 reais desde 05/09, cobertura `setup_s` 876/879 =
99,7% (as 3 sem são de 05/09 00:07–00:36, a hora da instrumentação — sem
regressão):

- `setup_s` p50 73,3 · p95 94,8 · **máx 376,3**
- **duas** acima da reserva de 360s, não uma: `f7a0420c` (10/09, 376,3s, já
  conhecida) e **`319cfc49` (13/09 11:31, 367,4s, NOVA e posterior ao #229)**
- pior uso do teto **93,0%**; acima de 80%: 1. p50 31,3% / p95 45,4% folgados.

O #229 escolheu 360s por ficar acima do pior observado (260,7s) e **foi
estourado por cima duas vezes desde então**.

**Não proponho alargar.** n=2 acima de 360s contra p95 de 94,8s não sustenta, e
régua maior é aluno preso mais tempo em worker pendurado (o `2e2938b7` segurou
gente 1.812s por 77 caracteres). O caminho que o dado sustenta é o outro que o
próprio arquivo aponta: **observar/limitar o setup do lado do RunPod, ou falhar
rápido e reenviar.** Achado, não mudança.

Nenhum aluno esperando: as 6 ocorrências foram estornadas pelo caminho
automático e a última tem 16 dias.

---

## 3. Classe de percepção (ordem de 17/09) — despachada, e a régua dela está furada

A ordem de 17/09 diz que "precisa ver/ouvir/assistir" **não é estado de parada,
é despacho**. Rodei a consulta de apoio: **18 travados**, o mais velho com 18d.
Em 17/09 eram 13. **Subiu.**

### Despachei 3 (os mais velhos com artefato localizável)

| incidente | aluno | despacho |
|---|---|---|
| `f8587cef` (17d, 10 alunos) | palavra decapitada | `olho` — ouvir 3 áudios, dizer se o corte é audível e onde |
| `4ce9f365` + `30f2ce07` (9d) | ellen.atp@gmail.com | `olho` — entonação de pergunta. Card avisa explicitamente pra **não confundir com a outra Ellen** (`draellenca`, caso de velocidade, resolvido pelo #92) |
| `52b22304` | igorlramalho@gmail.com | `olho` — assistir os vídeos de Video Clone e olhar as fotos-fonte |

Nos três o veredito volta escrito na nota do card. Nenhum deles foi autorizado a
consertar, mexer em crédito ou escrever pro aluno — a resposta ao aluno é minha.

### ⛔ A consulta de apoio da ordem de 17/09 é CEGA

Ela filtra `status in ('open','investigating')`. Recontando **todos os status
não-fechados**, a classe é:

```
31 travados em percepção — investigating 17 · aguardando_aluno 13 · open 1
mais velho: 6fa3b2df, aguardando_aluno, 31/08 — 19 dias
```

**13 casos estão escondidos em `aguardando_aluno`**, inclusive o `52b22304`, que
eu só descobri porque tentei anotar nele e ele não estava na minha varredura. A
ordem de 17/09 diz *"silêncio nessa classe não pode parecer saúde — foi assim
que ela chegou a 13"*. O instrumento criado pra impedir isso **reproduz o mesmo
silêncio em outro status**. A próxima ronda tem que medir a classe incluindo
`aguardando_aluno`, senão o número reportado continua sendo 18 quando é 31.

---

## Fim de ronda

- Notas gravadas e **conferidas no banco depois do update** (`.select()` +
  linhas afetadas): `702cc916` (54→55), `d3d8d1b2` (72→73), `f8587cef` (37→38),
  `4ce9f365` (11→12), `52b22304` (4→5). Uma linha afetada em cada.
- Nenhum incidente foi marcado `fixed`. Nada foi resolvido nesta ronda — foi
  ronda de **medição e despacho**, e o backlog não baixou. Os casos que sobraram
  são difíceis e estão travados em decisão de produto (`702cc916`), em
  observação (`d3d8d1b2`) ou em percepção já despachada.
- Zero crédito de aluno tocado, zero GPU, zero migration, zero e-mail em massa.
  Custo externo da ronda: ~R$0,24 de whisper.
