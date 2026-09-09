# Ronda das falhas — 09/09 13h19Z (Frank, dono da fila)

**Card:** `#234` / `f8587cef` — *"PALAVRA DECAPITADA NO MEIO DO ÁUDIO ENTREGUE"*,
aberto **02/09**, `investigating`.

**Escolhido por quê (regra 8):** continuação direta do §5 da nota anterior
(arquivada como `2026-09-09_rotina_falhas_14h.md`), que deixou a próxima ronda
cravada em 4 passos. Método serial: executei os passos na ordem em que ela
escreveu, e parei onde a trava dela mandava parar.

> ⚠️ **Nome do arquivo x relógio.** Esta nota é de **13h19Z**, medido com
> `date -u` no início da ronda, e mesmo assim vem DEPOIS da nota arquivada como
> "14h" (que se descreve cobrindo 13h00–14h00Z). O rótulo daquela estava
> adiantado. Registro aqui porque ordenação por nome de arquivo mente neste par:
> a ordem real é `13h.md` → `14h.md` → **esta**.

**O que NÃO fiz:** não fechei o `#234`, não mudei status de incidente, não gastei
GPU nem whisper, não toquei em crédito/acesso/voz/plano, não escrevi pra aluno,
não apliquei migration. Tudo abaixo é leitura de JSONL + R2 + `ffmpeg` local.

---

## Resumo em 5 linhas

1. Reconstruí os dois polos de voz e **provei a reconstrução** contra a nota 27.
2. Medi **as 29 vozes inteiras** dos dois polos com o detector de piso relativo.
3. **A trava metodológica do passo 2 DISPAROU: o teste está morto.** A taxa de
   frame degenerado é **0,0% no polo ALTO contra 23,5% no polo ZERO**.
4. **O passo 3 é impossível**, e isso é demonstrável: a banda de `QUEDA_PLATO`
   em que a âncora sobrevive é **[23, 25]dB**, e para fechar o frame de todas as
   vozes seria preciso **< 18,9dB**. As duas faixas são **disjuntas**.
5. A hipótese da referência **continua NÃO TESTADA** — mas agora sabe-se *por
   que ela não é testável assim*, e apareceu um candidato novo e mais forte.

---

## §1 — Os polos não estavam gravados em lugar nenhum (e agora estão)

As notas 27, 29, 30 e 31 comparam "as 12 vozes do polo ALTO contra as 17 do polo
ZERO" — e **nenhuma delas grava quais são**. Reconstruí do JSONL commitado, e
não pedi pra ninguém acreditar: `_frank/ferramentas/cauda_polos.cjs --conferir`
reproduz os números publicados pela nota 27 e **falha se divergirem**.

```
OK    vozes elegíveis (>=30 fronteiras): 99 (nota 27: 99)
OK    fronteiras internas: 6797 (nota 27: 6797)
OK    taxa global %: 13.1 (nota 27: 13.1)
OK    polo ALTO — 1º %: 54.1 (nota 27: 54.1)
OK    polo ALTO — 12º %: 29.9 (nota 27: 29.9)
OK    13º (fora do polo) %: 29.6 (nota 27: 29.6)
OK    polo ZERO — quantas vozes: 17 (nota 27: 17)
OK    polo ALTO idêntico nas 2 definições de fronteira interna
OK    polo ZERO idêntico nas 2 definições de fronteira interna
```

O 13º em **29,6%** contra o 12º em **29,9%** é o que mostra que o corte em 12 não
é arbitrário: existe um degrau ali.

**Uma ambiguidade que medi e que não importa.** "Fronteira interna" tem duas
definições em uso no card: `ehFim()` (o que o `cauda_alcance.cjs` usa) e "todas
menos a última" (a frase literal da nota 27). Elas **não** dão o mesmo total —
98 vozes/6.762 contra 99/6.797, e é a segunda que reproduz a nota 27. Mas a
**membership dos dois polos é idêntica nas duas**. O recorte é robusto à escolha,
e o `--conferir` vigia essa equivalência: se um dia quebrar, a ronda descobre
antes de comparar.

⚠️ **Discrepância que fica em aberto, e é da nota 27, não da reconstrução:** ela
diz que a maior voz do polo ZERO tem "85 fronteiras internas". Nas duas
definições dá **112** (voz `7fbeb738`); 85 é a *segunda* maior (`031f2193`). O
JSONL não é tocado desde 04/09 (`git log` do arquivo), então **não é deriva de
base**. Não muda polo nenhum e não enfraquece o argumento dela — 0 em 112 é ainda
mais improvável que 0 em 85 — mas número publicado que não reproduz é dívida, e
fica registrada.

---

## §2 — Passo 1: as 29 vozes medidas, e a trava do passo 2 disparando

Âncora rodada **antes** de apontar pra qualquer base (`--ancora`): **APROVADA**,
com `81d4f3f4` pego em t=34,525s contra os 34,494s esperados.

| polo | vozes | degenerado | classificáveis | fronteiras decepadas |
|---|---|---|---|---|
| **ALTO** | 12 | **0 (0,0%)** | 12 | 14/109 (**12,8%**) |
| **ZERO** | 17 | **4 (23,5%)** | 13 | 39/134 (**29,1%**) |

> **A trava do passo 2 é explícita: "se a taxa de degenerado diferir entre o polo
> ALTO e o ZERO, a comparação está viesada e o teste MORRE — confira isso ANTES
> de comparar as taxas." Ela difere: 0,0% contra 23,5%. O teste está MORTO.**

**E é bom que a trava exista, porque o número que ela barrou aponta pro lado
errado.** Lido cru, o resultado diria *"a referência do polo ZERO é 2,3× mais
decapitada que a do polo ALTO"* (29,1% contra 12,8%) — ou seja, as vozes que
**nunca** entregam palavra decapitada teriam a referência **mais** decapitada.
Isso não é a hipótese confirmada nem refutada: é a hipótese **invertida**, que é
a assinatura clássica de viés, não de achado. Sem a trava isso viraria manchete.

As 4 vozes recusadas, todas do polo ZERO: `4facb39e` (30,7dB), `61875041`
(27,1dB), `7fbeb738` (24,9dB), `cd6bce1b` (25,6dB).

---

## §3 — Por que enviesou: o instrumento está lendo FAIXA DINÂMICA, não decapitação

O viés não é acidente de amostra, tem mecanismo medido e ele fecha em três
passos:

**(a) A faixa dinâmica da referência separa os polos sozinha.**

| polo | n | mín | mediana | máx |
|---|---|---|---|---|
| ALTO | 12 | 36,1 | **69,8dB** | 75,9 |
| ZERO | 17 | 24,9 | **34,8dB** | 170,2 |

Mann-Whitney **U=177 de 204 · AUC=0,868 · z=3,32**. Uma voz do ALTO sorteada tem
87% de chance de ter faixa maior que uma do ZERO.

**(b) A taxa que o detector mede é função da faixa.** Correlação de Pearson entre
faixa e taxa medida na referência: **r = −0,604** (n=24). Partindo em 45dB:

| faixa da referência | taxa medida |
|---|---|
| < 45dB (n=11) | 43/122 = **35,2%** |
| ≥ 45dB (n=13) | 10/120 = **8,3%** |

**(c) Logo a comparação entre polos é circular.** A faixa separa os polos (a), a
faixa determina a taxa (b) — então comparar a taxa entre polos é comparar faixa
dinâmica com outro nome. É a mesma família de erro da trava de frame degenerado
que a nota 31 já tinha achado, só que **contínua em vez de binária**: o degenerado
é o caso extremo (faixa ≤ 31dB), mas a inclinação existe em toda a curva.

A prova mais limpa disso apareceu ao afrouxar o limiar (§4): `4facb39e`, faixa
**30,7dB**, entra na classificação e sai com **11 de 13 fronteiras decepadas
(85%)** — a maior taxa de todas as 29. Voz que mal passa do limite de validade
é justamente a que o instrumento mais marca.

---

## §4 — Passo 3 (baixar `QUEDA_PLATO`): tentado, e é IMPOSSÍVEL — com a prova

O passo 3 mandava baixar `QUEDA_PLATO` até o frame fechar, **revalidando na
âncora a cada mudança**. Fiz exatamente isso. Para permitir, transformei a
constante em parâmetro (`--queda`), com o aviso no código de que ela nunca se
mexe sem `--ancora` no mesmo valor.

**Âncora a cada valor (a régua exigida pelo passo 3):**

| `--queda` | âncora | `--queda` | âncora |
|---|---|---|---|
| 18 | **REPROVADO** | 24 | APROVADO |
| 20 | **REPROVADO** | 25 (padrão) | APROVADO |
| 22 | **REPROVADO** | 26 | **REPROVADO** |
| 23 | APROVADO | 28 / 30 / 35 | **REPROVADO** |

**A banda em que o detector sobrevive à âncora é [23, 25]dB — 3dB de largura.**

Agora as duas exigências, lado a lado:

- frame de um arquivo só fecha quando `faixa > queda + 6`;
- a voz mais estreita do recorte tem faixa **24,9dB** → exigiria **queda < 18,9dB**;
- a âncora **morre abaixo de 23dB**.

**As duas faixas são disjuntas.** Não existe valor de `QUEDA_PLATO` que
classifique as 29 vozes e continue reproduzindo o único positivo confirmado por
gente. O passo 3 não é difícil, é **impossível** — e o motivo é estrutural, não
falta de tentativa.

Rodei mesmo assim o **melhor caso admissível** (`--queda 23`, o valor mais
frouxo que a âncora aceita), para não concluir impossibilidade sem medir:

| polo | degenerado @23 | classificáveis | fronteiras decepadas |
|---|---|---|---|
| ALTO | **0/12 (0,0%)** | 12 | 11/109 (10,1%) |
| ZERO | **3/17 (17,6%)** | 14 | 40/147 (27,2%) |

Recupera **uma** voz (`4facb39e` — e ela sai com os tais 85%, piorando o viés em
vez de aliviar). A assimetria continua **inteiramente de um lado**: 0 recusadas
no ALTO, 3 no ZERO. **A trava do passo 2 continua disparando no melhor caso
possível.** Está encerrado: por este caminho não passa.

⚠️ Detalhe que explica a fragilidade da banda: na âncora `81d4f3f4` o release
medido é **35ms**, contra um `REL_MAX_MS` de **35** — ela passa **exatamente em
cima do limiar**, sem folga nenhuma. É por isso que 22dB já a derruba. O
detector não está confortavelmente aprovado; está aprovado no fio.

---

## §5 — Um candidato NOVO, e desta vez não é o cohort de sempre

O item (a) do §3 é viés para a pergunta que eu estava fazendo, mas é **medição
válida por si**: a referência do polo ALTO tem faixa dinâmica **larga** (mediana
69,8dB) e a do polo ZERO, **estreita** (34,8dB), com AUC 0,868. Isso não depende
do veredito de decapitação — é propriedade do arquivo de referência.

**E não é a armadilha que já matou quatro hipóteses deste card.** A nota 27
registrou que `is_stock`, idioma e comprimento da referência morreram todos no
mesmo cohort (`a661ec71`, catálogo de uma conta só). Conferi antes de escrever:

```
vozes mapeadas: 29/29 · donos distintos: 28
ALTO: 12 vozes em 12 donos distintos; maior dono concentra 1
ZERO: 17 vozes em 16 donos distintos; maior dono concentra 2
```

**28 donos para 29 vozes.** Não há concentração que explique a separação. Este é
o primeiro sinal do card que sobrevive à checagem de cohort.

⚠️ **E aqui eu paro, de propósito.** Três motivos para não promover isto a achado
nesta ronda:
1. **Nenhum dono tem voz nos dois polos** — não existe contraste dentro de dono,
   que é o teste que separaria "propriedade da gravação" de "propriedade de quem
   grava" (equipamento, sala, celular).
2. `0e65362e` tem faixa **170,2dB** com **n=1** fronteira: é referência com
   silêncio digital (p05=−200dB), outro regime de arquivo. Um outlier desses num
   polo de 17 pede tratamento explícito antes de virar estatística.
3. Este card já produziu **quatro** hipóteses que ficaram lindas em amostra
   pequena e morreram na população. Não vou plantar a quinta com n=29.

**Teste honesto que decide, e ele é barato:** medir a faixa dinâmica da
referência das **99 vozes elegíveis** (não só das 29 dos polos) e correlacionar
com a taxa de decapitação **da entrega** — que é o número confiável, medido pelo
detector absoluto, onde ele é válido. Isso sai da comparação de polos (viesada) e
vai para a população inteira, sem depender do detector relativo para nada.

---

## §6 — Um tiro no pé que quase não fez barulho (e o conserto)

Ao criar `--queda`, o parser posicional ingênuo (`!a.startsWith("--")`) deixou o
**valor** da flag passar como se fosse id de voz: com `--queda 23`, a ferramenta
tentou medir uma voz de prefixo `"23"`.

Aqui ela só gritou `prefixo "23" ambíguo (5)` — 5 vozes começam com 23 — e isso
aconteceu **depois** de medir as 29 do recorte, então **nenhum número desta nota
foi contaminado** (as tabelas do §4 estão completas e conferidas voz a voz).

**Mas o barulho foi sorte.** Se o valor casasse com **um** id só, ela mediria uma
voz sorteada pelo limiar, com o rótulo do recorte, e ninguém veria. É a mesma
classe do `.like()` em uuid da nota 30: **erro que volta vazio ou volta errado,
em silêncio**. Consertado com `idsPosicionais()`, que desconta o valor de cada
flag, e o comentário no código conta o caso.

Regressão conferida: `--voz 0c5ec8ab --queda 23` agora sai `exit=0`, e o padrão
(sem `--queda`) mede idêntico ao de antes da mudança.

---

## §7 — Verificações

| verificação | resultado |
|---|---|
| `_cauda.cjs --autoteste` | **Régua aprovada** |
| `cauda_polos.cjs --conferir` | **APROVADA** (9/9) |
| `cauda_piso_relativo.cjs --ancora` (padrão 25) | **APROVADO**, pega t=34,525s |
| `node --check` nos 2 arquivos | OK |
| `git branch --show-current` antes de commitar | `main` |

⚠️ **`tsc` e `eslint` não cobrem estes arquivos** e eu não vou fingir que
cobriram: são `.cjs` em `_frank/ferramentas/`, e o eslint do `frontend/` responde
`File ignored because outside of base path` (exit 0, 2 warnings). A regra 4 vale
para código do app; para estas ferramentas a verificação real é o autoteste e a
âncora, que rodaram.

---

## §8 — O que a próxima ronda faz

1. **Não reabrir a comparação de polos com o detector relativo.** Está medido que
   ela é circular (§3) e que não há limiar que a conserte (§4). Caminho fechado.
2. **Testar a faixa dinâmica na POPULAÇÃO**, não nos polos: faixa da referência
   das 99 vozes elegíveis × taxa de decapitação da entrega (detector absoluto,
   onde é válido). Sem polo, sem detector relativo, sem o viés do §3.
3. **`request_params`** continua sem ser olhado neste card (era o item 3 do §5 da
   nota anterior, e segue de pé).
4. Se o item 2 der sinal, o teste que separa gravação de gravador é **duas vozes
   do mesmo dono em polos diferentes** — que **não existem nas 29** (§5), mas
   podem existir nas 99.

---

## Pendências que atravessam rondas

| item | estado |
|---|---|
| `#234` fechado | **não** — de propósito. Causa não identificada |
| hipótese da referência (áudio) | **NÃO TESTADA** — e agora se sabe que o detector relativo não a testa (§3, §4) |
| detector de piso relativo | válido na âncora, **mas passa no fio** (release 35 contra limiar 35) e é circular entre polos |
| polos ALTO/ZERO | **gravados e verificáveis** (`cauda_polos.cjs`), primeira vez |
| faixa dinâmica da referência | **candidato novo**, sobreviveu à checagem de cohort (28 donos/29 vozes), não promovido a achado |
| manchete `624 / 14,4%` | inalterada por esta ronda |
| `#226` (290 gerações que o QA reprovou) | espera decisão do Johnny — destrava o `#234` |
| Migration 82 | não aplicada, aguarda Johnny |
