# Ronda das falhas — 09/09 ~14h40–16h00Z (Frank, dono da fila)

**Card:** `#234` / `f8587cef` — *"PALAVRA DECAPITADA NO MEIO DO ÁUDIO ENTREGUE"*,
aberto **02/09**, 609 ocorrências, 237 alunos, 272 vozes, `investigating`.

**Escolhido por quê (regra 8):** o mais antigo acionável com aluno afetado, e é
o mesmo que a ronda das 13h50 estava carregando. `#226` segue esperando decisão
do Johnny; `#15` sem ocorrência nova desde 04/09.

**O que NÃO fiz:** não fechei, não mudei status, não gastei GPU nem whisper, não
toquei em crédito/acesso/voz/plano, não escrevi pra aluno, não apliquei
migration. Tudo abaixo é leitura de JSONL + R2 + `ffmpeg` local, de graça.

---

## §0 — Comecei refazendo trabalho já feito. Registro porque foi erro meu.

O log das 14h termina com um §5 mandando *"medir os dois polos inteiros com
`cauda_piso_relativo.cjs --voz`, contando separado as não-classificáveis"*.
Executei isso. **Já estava feito e commitado** em `bb8568b` (13h19Z), e eu só
descobri depois de rodar, quando fui conferir a convenção de commit.

Reproduzi os números exatos daquela nota: degenerado **0/12 no ALTO contra 4/17
no ZERO**, e a leitura crua **12,8% × 29,1%** apontando pro lado errado. Serve
como replicação independente e nada mais. **Custou uma ronda de medição à toa**,
e a causa é banal: li o §5 do log mais novo como se fosse a fronteira do card,
sem antes rodar `git log -- _frank/ferramentas/` pra ver o que já tinha entrado.

➜ Regra que estou levando adiante: **antes de executar o §5 de um log, conferir
o `git log` do card.** Log é escrito no fim da ronda; commit de outra ronda pode
ter passado na frente. Aqui passou.

Duas medidas minhas que o `bb8568b` não tinha, e que não mudam a conclusão dele:
a assimetria não é gradiente suave, é **um lado só** — as 7 vozes com margem
`limiarVoz − piso` abaixo de 5dB são **7/7 do polo ZERO**, com a assinatura do
frame degenerado (13/27 das "decepadas" com `release ≤ 5ms`, contra 3/26 nas de
frame folgado). A `031f2193` passa da trava por **0,1dB** e se comporta como as
recusadas. A trava por `faixa > queda+6` é um **penhasco**, não uma guarda.

---

## §1 — O teste que decide: executado, e o candidato SOBREVIVE

O `bb8568b` deixou escrito qual era o teste que valia: *"faixa × taxa da ENTREGA
nas 99 vozes elegíveis, sem polo e sem detector relativo"*. **Ninguém tinha
rodado.** Rodei.

**Por que os testes anteriores eram circulares.** O detector relativo tira `piso`
e `limiarVoz` do p05/p95 **do próprio arquivo**. Faixa estreita ⟹ limiar quase
no piso ⟹ `release≈0` ⟹ "decepada" por construção. Medir
taxa-relativa-na-referência contra faixa-da-referência é medir a régua contra
ela mesma. Nenhum limiar conserta, porque os dois lados saem do mesmo `p05`.

**Como este quebra a circularidade** — os dois lados vêm de arquivos diferentes,
por instrumentos que não se conhecem:

| | vem de | medido por |
|---|---|---|
| **preditor** | a REFERÊNCIA | `ffmpeg` + envelope, **sem** detecção de fronteira |
| **desfecho** | a ENTREGA | detector **absoluto** (piso −90dB fixo), do JSONL commitado |

O `p05` da referência não entra em nenhuma conta do desfecho. A ferramenta
**asserta** essa independência no autoteste (`--conferir` falha se o
`cauda_polos.cjs` encostar em qualquer símbolo do detector relativo).

**Resultado, n=99, ZERO perdas** (nenhuma voz sem referência, nenhum ffmpeg
quebrado — o teto de 15% de perda não chegou a ser exercido):

| | valor |
|---|---|
| Spearman ρ (faixa da referência × taxa na entrega) | **+0,431** |
| p (permutação bicaudal, 200k) | **0,00001** |
| Pearson r | +0,198 |
| faixa < 45dB (n=44) | taxa média na entrega **7,7%** |
| faixa ≥ 45dB (n=55) | taxa média na entrega **16,9%** |

**O sinal é POSITIVO — o oposto do artefato.** O viés circular empurra para
**−0,604**; o que se mediu contra a entrega é **+0,431**. Se o artefato estivesse
vazando, vazaria para o outro lado. Ele trabalha *contra* este resultado.

O gap Pearson (0,198) × Spearman (0,431) é honesto e quer dizer que a relação é
**monótona mas não linear** — não use a reta, use a ordem.

### Robustez (as três checagens que este card exige)

| corte | n | ρ | p |
|---|---|---|---|
| todas | 99 | +0,431 | 0,00001 |
| **sem referência de catálogo** (`stock-zero-shot`) | 94 | +0,392 | 0,00010 |
| **miolo**, sem o decil de faixa alta e o de baixa | 79 | +0,403 | 0,00025 |

Cohort: **87 donos distintos em 99 vozes**. O maior concentra 7 — e é a conta de
catálogo `a661ec71`, cuja saída acima mostra que ela não sustenta o resultado.

### O contraste DENTRO do dono, que era exatamente o que faltava

O `bb8568b` recusou promover o candidato dizendo: *"nenhum dono tem voz nos dois
polos (sem contraste dentro de dono)"*. **Tem.** A conta `a661ec71`, mesma
esteira, mesmo pipeline, 7 vozes elegíveis:

| voz | faixa | p05 | taxa na ENTREGA | fronteiras |
|---|---|---|---|---|
| `4f311a94` | 75,9dB | −90,6 | **49,4%** | 40/81 |
| `5747af94` | 73,9dB | −91,8 | 34,1% | 46/135 |
| `34455bd8` | 65,4dB | −77,7 | 27,9% | 41/147 |
| `ace65f3c` | 56,2dB | −75,7 | 31,1% | 33/106 |
| `714c7843` | 53,1dB | −70,9 | 12,1% | 7/58 |
| `a3a3388e` | 52,3dB | −70,4 | 11,7% | 7/60 |
| `c93e80d4` | 37,0dB | −52,4 | **5,3%** | 2/38 |

**20 pares concordantes contra 1 discordante.** Um único dono, uma única
esteira, só a referência varia — e a taxa da entrega acompanha em ordem quase
perfeita, de 5,3% a 49,4%. n=7 não carrega o card sozinho; quem carrega é o n=99.
Isto remove a objeção nominal que segurava a promoção.

---

## §2 — A minha hipótese do meio da ronda: testada e DERRUBADA

Vendo os polos, levantei que o mecanismo fosse o **piso de ruído**: referência
com silêncio quase digital (ALTO, mediana p05 −85,8dB) ensinaria corte abrupto,
e referência com ruído de sala (ZERO, −60,9dB) ensinaria decaimento. Parecia
bom: AUC 0,701, p=0,036.

**Está errado, e o teste é de graça.** Nos mesmos 99:

| preditor | ρ | p |
|---|---|---|
| `p95` — **nível de fala** | **+0,442** | 0,00001 |
| `faixa` (p95−p05) | +0,431 | 0,00001 |
| `p05` — piso de ruído | +0,237 | 0,019 |

E as parciais: faixa × taxa **controlando o piso** = **+0,470**; piso × taxa
**controlando a faixa** = **−0,311** — o sinal **inverte**. Controlada a faixa,
piso mais baixo anda com *menos* decapitação, não mais. O piso é carona
(colinearidade faixa×piso = 0,870), não é o mecanismo.

⚠️ Com colinearidade de 0,87 as parciais são instáveis e eu não separo `p95` de
`faixa` com este n — as duas são a mesma família. **O que dá pra afirmar é o
negativo**: silêncio digital na referência não é a explicação.

---

## §3 — Dinheiro e aluno

Nada. Este card não envolve crédito, débito nem estorno (checagem 3 da ordem de
27/08, revalidada). Não mexi em saldo de ninguém e não há aluno esperando
resposta **neste card**.

`tania-araujo@uol.com.br` reapareceu na varredura (voz `9c145745`,
`awaiting_training`, 5 dias, 200k créditos). **Não é caso novo e não é bug:**
estado legítimo (ninguém clicou em treinar) e a aluna já foi avisada 2×, uids
1071 (05/09) e 1158 (06/09) — a régua da casa é 2 lembretes e parar. Conferido,
não reaberto.

---

## §4 — O que a próxima ronda faz

1. **O teste de mecanismo é caro e precisa de aval.** O experimento que separa
   causa de correlação é: pegar UMA voz de faixa larga, refazer a referência com
   a faixa comprimida (sem tocar na fala), **retreinar** e gerar o mesmo texto.
   Mesma voz, mesmo texto, só a referência muda. **Isso gasta GPU e é retreino,
   então não faço sem o "pode" do Johnny** — está no §5 abaixo.
2. **De graça, antes disso:** ver se a faixa da referência prediz *onde* dentro
   do áudio a decapitação cai (início × fim), e se ela se correlaciona com o
   `release_ms` contínuo em vez da taxa binária. Se o efeito for no release
   contínuo, é ganho de instrumento pra qualquer conserto futuro.
3. **Consertar o penhasco da trava** (§0): recusar por **margem** `limiarVoz −
   piso`, não por `faixa > queda+6`. Não fiz nesta ronda porque mudar a trava
   muda números já publicados e eu não queria misturar isso com o resultado do
   §1. Vai isolado, com `--ancora` revalidada.
4. Não repita: `.like()` em uuid volta vazio em silêncio; `null <= 35` é `true`;
   `_Bugs/` é gitignored; e **confira o `git log` do card antes de executar o §5
   de um log** (§0 desta ronda).

---

## §5 — O que precisa do Johnny

> **`#234` — libero um retreino de voz por conta da casa (1 voz, ~1 geração) só
> pra testar se comprimir a faixa da referência derruba a decapitação?**
> É o único experimento que vira correlação em causa. Custa GPU e é retreino, e
> a regra é não gastar sem o aluno pedir — por isso está parado aqui.

`#226` (290 gerações que o QA reprovou) continua esperando decisão e é ele que
destrava o resto do `#234`. Migration 82 segue não aplicada.

---

## Pendências que atravessam rondas

| item | estado |
|---|---|
| `#234` fechado | **não** — de propósito. Correlação forte, causa não provada, sem conserto |
| candidato "faixa da referência" | **PROMOVIDO a achado medido** — teste não-circular, n=99, ρ=+0,431 (p=1e−5), robusto em 3 cortes + contraste dentro do dono |
| hipótese "piso de ruído / silêncio digital" | **derrubada** nesta ronda (parcial inverte o sinal) |
| mecanismo (por que faixa larga decepa) | **desconhecido** — precisa do retreino do §5 |
| penhasco da trava por `faixa` | **aberto** — conserto desenhado, não aplicado |
| `#226` | espera decisão do Johnny |
| Migration 82 | não aplicada, aguarda Johnny |
