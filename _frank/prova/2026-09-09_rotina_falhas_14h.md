# Ronda das falhas — 09/09 ~13h00–14h00Z (Frank, dono da fila)

**Card:** `#234` / `f8587cef` — *"PALAVRA DECAPITADA NO MEIO DO AUDIO ENTREGUE"*,
aberto **02/09**, 609 ocorrências na abertura, `investigating`.

**Escolhido por quê (regra 8):** o mais antigo **acionável** com aluno afetado.
O `#15` continua sem ocorrência nova desde 04/09 20:47Z e o `#226` está travado
por relógio até 18hZ (decisão medida na ronda das 11h30). Mesmo critério da
ronda das 12h40, continuando de onde ela parou.

**O que NÃO fiz:** não fechei, não mudei status, não gastei GPU nem whisper, não
toquei em crédito/acesso/voz/plano, não escrevi pra aluno, não apliquei migration.
Tudo abaixo é leitura de JSONL + R2 + `ffmpeg` local, de graça.

---

## §1 — Ferramentas de medição: metade estava commitada, e a outra metade EVAPOROU

A ronda das 12h40 (nota 30) encerrou a pendência da descrição conferindo que
`cauda_decepada.cjs`, `cauda_alcance.cjs` e `cauda_decepada.jsonl` estão
rastreados. **Reconferi e está certo** — os três em `origin/main`, working tree
limpa, ninguém precisa refazer a varredura de 20min/2GB.

**Só que a conferência olhou a lista errada.** Ela checou as ferramentas que a
*descrição* citava, de 02/09. As ferramentas que as rondas de **08/09 e 09/09**
escreveram não estavam nessa lista — e elas não existem:

| ferramenta | citada em | `origin/main` | histórico (`--all`) | disco |
|---|---|---|---|---|
| `_Bugs/2026-09-08_envelope_fronteira.cjs` | nota 29 | ausente | ausente | ausente |
| `_Bugs/2026-09-09_referencia_decepada.cjs` | nota 30 | ausente | ausente | ausente |

Causa, e é banal: **`_Bugs/` é gitignored** (`.gitignore:87`, `git check-ignore`
confirma). O `_Bugs/` inteiro nunca teve um arquivo rastreado (`git ls-files
_Bugs/` volta vazio). Toda ferramenta que nasce lá morre com a worktree.

**Por que isso importa mais do que parece.** As notas 29 e 30 citam os dois
arquivos **pelo caminho**, como se fossem consultáveis. Não são. O prejuízo não é
o arquivo, é o raciocínio: a nota 30 termina dizendo "quem for retomar precisa de
um detector de piso relativo" — e quem retomasse reescreveria do zero, sem saber
o que já tinha sido tentado nem por que falhou. É a mesma perda que a descrição
do card gritou em 02/09, repetida em outro endereço.

➜ Virou **regra 25-B** em `01_REGRAS_DURAS.md`: ferramenta que sustenta um número
vai pra `_frank/ferramentas/` (rastreado), não pra `_Bugs/` (ignorado). A 25
continua valendo pro que ela cobre — dump, print, smoke de uma vez só.

---

## §2 — A mina do `release_ms` NULL: desarmada, e o número-manchete **não muda**

A nota 29 registrou em 08/09 que "as 335 fronteiras com `release_ms` NULL são
mina (`null<=35` é true em JS)" e o conserto ficou por fazer. Fiz agora.

**O que a mina é.** No JSONL, `release_ms: null` significa *"a voz não passou de
-40dB em nenhuma janela dos 400ms anteriores ao corte"* — decaimento LONGO, o
oposto de decapitada. Mas em JavaScript `null <= 35` é **`true`** (o `null` vira
0 na comparação relacional), então qualquer comparação que esqueça o `!== null`
conta essas fronteiras como **o corte mais abrupto possível**. São **834 de
15.285** fronteiras (5,5%) na base de hoje.

**Por que ninguém viu estrago — e é importante dizer que estrago não houve.**
Com o `--plato -40` de fábrica a mina é **inerte**, e não por sorte: é impossível
por construção. Se o platô medido a 60ms passasse de -40dB, a varredura
regressiva teria achado `release <= 60` e o null não existiria. Logo
`null` ⟹ `plato <= -40`, e o segundo termo da régua barra sozinho o que o
primeiro deixaria passar. **Medido: das 834 fronteiras null, ZERO têm plato >
-40.** Os 5 sítios de comparação existentes ainda por cima tinham o guarda.

**Então onde ela morde.** Quando alguém afrouxa o `--plato` — que
`cauda_alcance.cjs` aceita na linha de comando e que a tabela de sensibilidade
**nunca varria** (ela varre só o `--rel`). Medido hoje na base inteira:

| `--plato` | com guarda | sem guarda | fronteiras null que entram |
|---|---|---|---|
| -40 | 633 / 250 | 633 / 250 | 0 |
| -45 | 668 / 260 | 688 / 270 | 29 |
| -50 | **682 / 265** | **753 / 285** | 142 |
| -90 | 691 / 270 | 854 / 310 | 485 |

Um `--plato -50` numa varredura de sensibilidade publicaria **+71 gerações e +20
alunos que não existem** — com cara de medição.

**O conserto não foi "lembrar do guarda"**, porque lembrar não escala: já eram 5
sítios em 2 arquivos, e a 3ª cópia (§1) mostrou que o próximo esquecimento era
questão de tempo. A régua agora mora em **`_frank/ferramentas/_cauda.cjs`**, uma
só, e **normaliza na leitura**: `null` vira `Infinity`, e a comparação errada
deixa de ser possível — `Infinity <= 35` é false em qualquer limiar, inclusive
num `--rel 9999`. Tem autoteste (`--autoteste`, 6 casos + varredura de 25
combinações de limiar) que falha se a mina voltar.

⚠️ **O formato em disco não mudou.** A normalização é só na leitura; o JSONL
continua gravando `null`, a prova commitada (4.345 entregas) segue válida, e
ferramenta velha e nova leem o mesmo arquivo. Nada precisa ser remedido.

**Contraprova de regressão, que é o que importa:**

| | antes | depois |
|---|---|---|
| gerações internas | 624 (14,4%) | **624 (14,4%)** |
| alunos | 246 | **246** |
| vozes | 281 | **281** |
| fronteiras internas ruins | 1.382 | **1.382** |

**O número-manchete não muda.** A mina era real e estava armada, mas nunca
corrompeu número publicado. Quem ler as notas antigas não precisa reinterpretar
nada. Acrescentei também a tabela de sensibilidade do **platô**, que faltava.

⚠️ Continua de pé o alerta da nota 29, que é outro assunto: o limiar cai na
**subida** da distribuição (6,4% a 15ms · 14,4% a 35ms · 18,2% a 45ms), então
`624 / 14,4%` serve pra dizer QUE existe, **não** pra dimensionar dano nem pra
priorizar aluno. Isso é ponto ruim da curva, não instrumento refutado.

---

## §3 — Avanço da causa: o detector de piso relativo existe, passa na âncora, e já achou uma armadilha nova

A nota 30 deixou o passo (a) cravado: escrever o detector de piso relativo e
**validá-lo na âncora `81d4f3f4` @ t=34,494 antes de apontar pra qualquer base**.
Está feito: **`_frank/ferramentas/cauda_piso_relativo.cjs`** — em pasta
rastreada, por causa da §1.

**O que muda nele.** O detector da entrega define fronteira como corrida de
≥120ms abaixo de **-90dB** (silêncio digital). Isso vale em mp3 de TTS e é
estruturalmente inaplicável em gravação humana, que tem piso de ruído — foi
exatamente essa cegueira que produziu o "0 decepadas em 12/12 e 17/17" da nota
30, que era `n=0` fronteiras, não refutação. Aqui tudo é relativo ao próprio
arquivo: `piso = p05 + 6dB`, `fala = p95`, `limiarVoz = p95 - 25dB`.

**A trava da âncora passou** (`--ancora`), e ela exige acertar o *segundo*, não
só o arquivo:

```
OK    81d4f3f4 esperado=cortado medido=cortado · pegou t=34.525s (esperado 34.494s)
OK    47dc0f6e esperado=limpo   medido=limpo
OK    1498fbe5 esperado=limpo   medido=limpo
Detector APROVADO na âncora — pode apontar pra base.
```

(os 31ms de diferença são a grade de 5ms do envelope contra a posição exata em
amostras do detector absoluto; nas entregas com silêncio digital o `p05` dá
-200dB e o frame relativo degenera pro absoluto — é retrocompatível de fato.)

**E aí ele achou uma armadilha nova, minha, antes de eu publicar.** Apontado nas
duas vozes citadas pela nota 30, ele deixou de ser cego (`n=8` fronteiras em cada,
contra `n=0` de ontem) — mas na `7fbeb738` marcou **8 de 8 fronteiras como
decapitadas, todas com `release=0`**. Isso não é achado, é **frame degenerado**:
a faixa dinâmica do arquivo é 24,9dB (p05 -60,9 · p95 -36,0), menor que os 31dB
que a régua precisa, então `limiarVoz` (-61,0) cai **abaixo** do `piso` (-54,9),
o próprio silêncio conta como "voz acima do limiar" e a busca regressiva acerta
em ms=0 sempre. **100% de falso positivo por construção.**

Sem trava, isso teria virado *"o polo ZERO tem 100% de decapitação na
referência"* — o erro que a nota 30 pediu pra não repetir, invertido: ontem foi
cegueira, hoje teria sido alucinação. **A trava está no código**: frame inválido
não é classificado, é recusado com o motivo na tela.

Com a trava, o que sobra medido é honesto e pequeno:

| voz | polo | faixa | resultado |
|---|---|---|---|
| `0c5ec8ab` | ALTO | 69,1dB | **0 decepadas de 8 fronteiras** |
| `7fbeb738` | ZERO | 24,9dB | **não classificável** — não conte em polo nenhum |

**A hipótese "a decapitação é herdada do áudio da referência" continua NÃO
testada** — e agora por um motivo diferente e menor: o instrumento enxerga, mas
uma parte das referências tem faixa dinâmica estreita demais pro frame atual.
Uma voz do polo ALTO medida limpa é 1 de 12; não conclui nada sozinha.

---

## §4 — Dinheiro e aluno

Nada novo. Este card não envolve crédito, débito nem estorno (checagem 3 da
ordem de 27/08, feita na abertura e revalidada). Não mexi em saldo de ninguém e
não há aluno esperando resposta neste card.

---

## §5 — O que a próxima ronda faz

1. **Medir os dois polos inteiros** com `cauda_piso_relativo.cjs --voz`, contando
   separado quantas vozes caem em *não classificável*. Se a taxa de degenerado
   diferir entre ALTO e ZERO, a comparação está viesada e o teste morre — confira
   isso ANTES de comparar as taxas.
2. **Se sobrar voz demais fora**, baixar `QUEDA_PLATO` (25dB) até o frame fechar,
   e **revalidar na âncora a cada mudança** — a constante saiu do frame da
   entrega, não é lei da natureza.
3. **Candidato seguinte por voz**, se a referência cair: `request_params`, que
   ainda não foi olhado neste card.
4. Não repita: `.like()` em coluna uuid volta vazio em silêncio (nota 30) — use
   `faixaUuid()`, que `cauda_piso_relativo.cjs` já implementa.

---

## Pendências que atravessam rondas

| item | estado |
|---|---|
| `#234` fechado | **não** — de propósito. Causa não identificada |
| ferramentas em `_Bugs/` evaporam | **corrigido na regra** (25-B); as 2 perdidas não voltam |
| mina do `release_ms` NULL | **corrigida** — `_cauda.cjs`, com autoteste |
| manchete `624 / 14,4%` | válida, e **não muda** com a correção; serve pra existência, não pra dimensionar |
| hipótese da referência | **não testada** — instrumento pronto, medição por fazer |
| `#226` (290 gerações que o QA reprovou) | espera decisão do Johnny — destrava o `#234` |
| Migration 82 | não aplicada, aguarda Johnny |
