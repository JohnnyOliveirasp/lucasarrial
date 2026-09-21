# LAUDO DE PERCEPÇÃO — 18 cartões parados (ordem de 17/09)

Executado por Frank/Opus em 20/09, takeover depois de o worker `olho` reprovar 2x.
Card do Mission Board: `a9fdd7bc`.

**SÓ LEITURA.** Não mudei status de incidente, não mexi em crédito, acesso, voz,
GPU nem migration, e não escrevi para nenhum aluno. Nada do que está aqui é decisão:
é medição.

---

## 0. ACHADO QUE VALE PARA TODOS OS CARTÕES DE ÁUDIO — LEIA ANTES DOS VEREDITOS

A casa concluiu em 19/09 (`_frank/ferramentas/2026-09-19_medir_entonacao_final.cjs`,
cabeçalho) que o agente `olho` **não ouve**, a partir de um controle cego em que ele
respondeu "não consigo abrir nem ouvir" para bipe, silêncio e fala. **Essa conclusão
está errada pela metade, e a metade certa é mais útil do que a versão inteira.**

Refiz o controle cego chamando o Gemini 2.5 Flash **direto na API, com o áudio embutido
na requisição** (`/tmp/percep/gem.cjs`), em vez de pelo caminho do `delegate-cli`:

| arquivo | resposta | veredito |
|---|---|---|
| seno puro 440 Hz, 3s | "tom puro contínuo de aproximadamente 440 Hz" | ✅ acertou |
| silêncio digital, 3s | "tom puro contínuo de aproximadamente 440 Hz" | ❌ **confabulou** |
| 4s de fala real | transcreveu certo, palavra por palavra | ✅ acertou |

Depois apertei mais, com um **controle positivo construído**: peguei o áudio da Katia,
cortei a palavra "você" no meio e colei silêncio.

| pergunta feita | controle positivo (palavra cortada) | fronteira real suspeita |
|---|---|---|
| "transcreva o que ouve" | `"...voltar pra [pausa]"` — palavra ausente, **3/3** | `"...voltar para você"` — palavra presente, **3/3** |
| "o fim soa INTEIRO ou CORTADO?" | respondeu **INTEIRA 3/3** (errado) | INTEIRA |
| "o fim é NATURAL ou CORTE_SECO?" | CORTE_SECO 1/3, NATURAL 2/3 | NATURAL |

E o piso de falso positivo: pedi transcrição de 1,4s de **silêncio digital** → devolveu
"Ah!"; de 1,4s de **ruído rosa** → devolveu "Hum". Nunca devolve "SEM FALA".

**A regra prática que sai disso, e que eu usei no laudo inteiro:**

1. **TRANSCRIÇÃO é instrumento confiável.** Separa o controle positivo do negativo 3/3,
   transcreve conteúdo que não teria como adivinhar, identifica variante de português
   por pista fonética. É percepção de verdade.
2. **JULGAMENTO SUBJETIVO ("soa cortado?", "está bom?", "nota de 0 a 10") não é
   instrumento.** Reprova no controle positivo. **Nota de `olho` não sustenta decisão
   de dinheiro.** Isso atinge diretamente o 4,5/10 e o 4,0/10 que estão hoje na mesa do
   Johnny no #329.
3. **Silêncio é o ponto cego.** Ele nunca diz "não tem nada". Qualquer pergunta cuja
   resposta correta seja "ausência" tem que ser respondida por régua, não por ouvido.

---

## 1. DESPACHADOS — artefato aberto por mim nesta rodada

### `f8587cef` · #234 · 18,3d · 10 alunos · palavra decapitada

**Artefato encontrado: SIM.** Baixei 3 mp3 do R2 (bucket `generations-ai-verse-clone`),
escolhidos pelas piores fronteiras internas de `_frank/prova/cauda_decepada.jsonl`
(o jsonl untracked de 02/09 **sobreviveu** — está no disco, 4.345 linhas):

| geração | aluno | fronteira | release | plató |
|---|---|---|---|---|
| `81d4f3f4` (caso-índice Katia) | katiasalvador32 | t=34,494s | 10 ms | −27,9 dB |
| `042b3e50` | catarinacouras | t=27,418s | 0 ms | −30,6 dB |
| `1ee9ae68` | contato@fotoatleta | t=23,355s | null | −61,4 dB |

**O que eu observei, com dois instrumentos independentes:**

**(a) Envelope, medido por mim quadro a quadro** (RMS em janelas de 10 ms, passo 5 ms,
`/tmp/percep/env.cjs`, sobre o wav decodificado INTEIRO — não usei `ffmpeg -ss` no ponto,
justamente pela armadilha dos ~50 ms de zero falso que a descrição do cartão avisa):

```
Katia, fronteira t=34,494s
 34,404  -26,3 dB   <- vogal de "você" sustentada
 34,444  -31,8
 34,464  -37,5
 34,474  -44,2
 34,484  -73,7
 34,494 -111,7
 34,504  -120,0 dB  <- ZERO DIGITAL, e fica assim por 0,78s
```

O defeito de envelope **é real e é meu, medido**: o sinal sai de ~−26 dB e chega a zero
digital em ~40 ms, sem decaimento natural. Nas fronteiras limpas do MESMO arquivo o
plató fica em −45 a −51 dB antes do silêncio; nesta fica em −28 dB. São ~20 dB de
diferença. Não é cauda sumindo: é corte com o sinal ainda perto do nível de fala.
Em `042b3e50` o mesmo: −36,6 → −43,4 → −89 → zero em 20 ms.

**(b) Ouvido, com controle positivo e negativo** (tabela da seção 0):

- `81d4f3f4` @34,494s → `"Minha missão é te ajudar a voltar para você"` — **palavra
  inteira, 3/3 repetições**
- `042b3e50` @27,418s → `"...como referência."` — palavra inteira
- `1ee9ae68` @23,355s → `"...escala montada na cabeça."` — palavra inteira

**VEREDITO:** nas 3 fronteiras examinadas — incluindo a PIOR da base, o caso-índice com
release de 10 ms — **nenhuma palavra está decapitada. Nenhum fonema falta.** O que falta
é o *release*, a cauda natural da palavra, substituída por zero digital.

**O que isso significa para o número 609 (14,3%):** a régua `cauda_decepada.cjs` mede
corretamente uma anomalia de envelope, mas **`release_ms` baixo não prediz palavra
perdida** — n=3, todas com release ≤10 ms, todas com a palavra íntegra. Antes de o
Johnny decidir em cima de "609 gerações / 237 alunos", alguém precisa medir quantas
dessas 609 têm perda de PALAVRA e não só de cauda. Frank já tinha levantado essa dúvida
em 18/09 no #226 ("quem pegar o f8587cef re-mede antes de acreditar no 609"). **A dúvida
dele estava certa e agora tem três pontos medidos a favor.**

**Limite que eu declaro:** n=3 de 609. Não afirmo que as outras 606 estão boas. Afirmo
que as 3 piores, pela própria régua, estão com a palavra inteira — o que é exatamente o
contrário do que a régua prometia entregar na ponta pior.

---

### `85ca1863` · #329 · 11,0d · contato@mastroiannioliveira · semelhança do Vídeo Clone

**Artefato encontrado: SIM**, os 6 de `/tmp/pericia-329/` da perícia de 19/09.
**Eu olhei** a foto de entrada (`foto_entrada_26f0808b.png`, 941×1672) e os recortes de
rosto do render de 25s em t=1s, t=5s, t=20s e t=25s.

**O que eu vi:** homem de óculos redondos escuros, barba e bigode grisalhos, fones no
pescoço, blazer cinza, microfone de podcast, estante ao fundo. No render, de t=1s a
t=25s: **é reconhecivelmente a mesma pessoa, do início ao fim, sem troca de identidade
e sem deformação.** O que muda em relação à foto: pele visivelmente alisada (perda de
textura), barba lendo mais clara/branca do que na foto, bochechas mais cheias, e a
armação dos óculos mais fina e menos definida.

**VEREDITO:** o que eu enxergo é **perda de DETALHE, não perda de IDENTIDADE.** Bate
exatamente com o downscale de 1,96× que o Frank mediu por ffprobe (941×1672 → 480×832,
~1/4 dos pixels no rosto). **Eu não reproduzo o "4,5/10" do `olho`** e, pela seção 0
deste laudo, aquela nota não deveria estar sustentando decisão nenhuma: nota é
julgamento subjetivo, e julgamento subjetivo desse modelo reprova no controle positivo.

**Consequência direta para a mesa do Johnny:** a "frente nova" que a ronda de 19/09 abriu
— *"o job de 25s é Padrão 2.0 e ≤40s, está no balde da cobrança legítima, e mesmo assim
o olho deu 4,5/10; se a insatisfação não for só deriva de áudio longo, o recorte dos
41.600 cr não cobre o caso"* — **estava apoiada numa nota que não se sustenta.** Olhando
o render de 25s eu não acho deriva: acho o teto do 480p. Isso **devolve força** ao
recorte original (>40s = 41.600 cr), não tira.

---

### `81438b60` · #335 · 10,5d · gate de rosto não mede tamanho do rosto

**Artefato encontrado: SIM** (foto-fonte do mastroianni, 941×1672).

O passo nomeado pelo Vigia três vezes era: *"não enxergo imagem; rodar o gate nas fontes
do mastroianni (esperado ~10-20) e num recorte cabeça-e-ombros (esperado ~40-60); se o
modelo não separar essas duas classes, o piso não serve."* **Medi por recorte-e-conferência:
recortei caixas candidatas e OLHEI cada uma para confirmar onde o crânio e o queixo
realmente estão** — não aceitei caixa de modelo sem ver.

```
topo do crânio ....... y ≈ 217 px
queixo ............... y ≈ 790 px   (conferido: o recorte 217..700 corta na boca)
altura da cabeça ..... 573 px de 1672 = 34,3% da ALTURA do quadro
largura da cabeça .... ~405 px de 941
fração de ÁREA ....... ~14,7% do quadro
```

**Comparando com o outro caso da classe**, a fabiana (`56508a06`), que o Vigia mediu em
19/09 como cabeça ≈18% da altura num quadro 480×832 — de corpo inteiro, espelho ao fundo:

| caso | altura da cabeça | área aprox. | enquadramento |
|---|---|---|---|
| mastroianni (foto-fonte) | **34,3%** | ~14,7% | peito pra cima |
| fabiana `56508a06` | ~18% | ~2-3% | corpo inteiro |

**VEREDITO:** as duas classes **são separáveis por uma régua de tamanho de rosto** — a
diferença é de ~2× em altura e de ~5× em área, muito acima dos ±10 pontos de instabilidade
que o Frank mediu em 12/09 no campo `face_height_pct` do patch refutado. O pressuposto de
que "o modelo não separa as classes" **não se confirma quando a medida é geométrica em
vez de estimada pelo próprio modelo de visão.**

**O que isso NÃO autoriza:** não valida o patch refutado, não propõe limiar e não é ordem
de mexer no gate. A objeção do Vigia de 13/09 continua de pé e é anterior a tudo isto:
**calibrar limiar sem gravar a recusa é chutar duas vezes** — o #372 (a recusa que não
deixa rastro) continua sendo pré-requisito.

---

### `ab5644be` · #296 (13,4d) e `75c33ee1` · #439 (4,0d) · leonicem... · Animar Imagem sobrescreve

**Artefato encontrado: SIM — e o achado é o que NÃO está lá.**
Listei o R2 direto nos prefixos das 3 imagens dela (conta `49110dde`):

```
images/dc5fa142.../  -> result.png (9.868.506b) | video.mp4 (2.598.653b, 09/09 13:01:22Z)
images/4139414e.../  -> result.png (2.068.576b) | video.mp4 (3.122.390b, 11/09 09:05:22Z)
images/67ae9f87.../  -> result.png (1.979.657b) | video.mp4 (4.605.582b, 12/09 23:19:53Z)
```

**Exatamente 1 vídeo por imagem. Ela pagou 11 animações** (3 + 6 + 2 = 84.720 cr, zero
estorno, medido pelo Frank em 17/09). **8 vídeos pagos não existem mais no bucket.** Isso
deixa de ser inferência de código e vira observação do armazenamento.

E o carimbo de hora fecha o mecanismo, sem depender de ler o `video-sync.ts`: em cada uma
das três, o `LastModified` do único `video.mp4` cai **1 a 3 minutos depois do ÚLTIMO
débito da série**, nunca do primeiro. É o último despacho que sobrou; os anteriores foram
gravados por cima.

**Abri o sobrevivente** (`dc5fa142`, 2,6 MB): h264, **720×1280, 4,04s**. Eu vi: mulher de
terno bege segurando uma caneca branca, em escritório com janela e prédios ao fundo,
estante de livros jurídicos, e um balão de pensamento composto no topo com um senhor
segurando um documento. Vídeo normal, íntegro, entregue.

**VEREDITO / BLOQUEIO REAL:** qualquer pedido futuro de "assistir o que ela recebeu" para
os outros 8 despachos tem bloqueio **definitivo e não contornável**: *os arquivos foram
destruídos pelo próprio defeito.* Não é link quebrado nem chave errada — é ausência
física, confirmada por `ListObjectsV2` nos 3 prefixos. Isso também responde ao que o Frank
escreveu em 17/09 ("a casa não sabe auditar a própria entrega de Animar Imagem"): não
sabe, e agora está provado pelo bucket, não só pela tabela.

O #296 (queixa original da aluna, "cobrado e não salvo") está **descrito com precisão pela
aluna** e tem causa achada; o pendente dele não é percepção.

---

### `4ce9f365` · #348 (10,2d) e a metade de entonação do `30f2ce07` · #500 · ellen.atp

**Artefato encontrado: SIM.** Este é o despacho que o Frank criou às 23hZ de 20/09.
Baixei **4 gerações dela + a referência da voz** e rodei a régua determinística da casa
(`_frank/ferramentas/2026-09-19_medir_entonacao_final.cjs`, F0 por autocorrelação,
Δ em semitons entre o miolo e o rabo de cada trecho).

O texto dela **começa com uma pergunta** — *"Você quer caminhar para ter resultados e não
sabe como começar?"* — e ela **gerou o mesmo texto 4 vezes em 67 minutos** (18:56, 19:18,
19:46, 20:03), mexendo na pontuação entre as tentativas. O texto do primeiro trecho é
**idêntico** em `7ebe7f10` e `bb1f7639`.

```
7ebe7f10 (19:18)  trecho 1 = a pergunta   Δ = -1,80 st   DESCE (cara de afirmação)
bb1f7639 (19:46)  trecho 1 = a pergunta   Δ = +3,40 st   SOBE  (cara de pergunta)
                  trecho 2                Δ = +8,34 st   SOBE
```

Confirmei que o trecho 1 do `7ebe7f10` é mesmo a pergunta, por transcrição do clipe:
`"Você quer caminhar para ter resultados e não sabe como começar?"`.

Referência dela (`ref/auto.wav`, 24,3s, a voz da própria Ellen): 7 trechos, **nenhum sobe**
— 3 descem, 4 planos.

**VEREDITO, e ele contraria a conclusão que está escrita no cartão hoje:** a ronda de
20/09 22hZ concluiu, procurando `pitch`/`F0` no worker, que *"a entonação de pergunta
segue SEM conserto no ar e SEM conserto escrito"*, e daí que o motor não sabe subir. **A
medição diz outra coisa: o motor SOBE, e sobe muito (+3,40 e +8,34 st), no mesmo texto,
na mesma voz, 28 minutos depois.** Não é incapacidade do motor. **É variância entre
gerações.** A Ellen pegou uma rodada ruim, pagou crédito, tentou de novo trocando
pontuação, e pegou uma boa sem saber por quê.

Isso muda o formato do conserto e o formato da resposta a ela. Ausência de lógica de F0
no código explica por que **ninguém controla** a curva; não explica por que ela **existe
numa geração e some na outra**. Quem for atacar começa por aqui, não por "o motor não
sabe fazer".

**Limite declarado:** n=2 no par limpo (mesma frase, mesma voz). A `9f9b82d1` teve o
segmentador fundindo a pergunta num trecho de 35s, e a `d99b95a2` tem o texto reescrito
pela aluna (ela partiu a frase em duas) — as duas não servem de par controlado e eu não
as conto.

**Divergência que eu registro em vez de esconder:** pedi ao ouvido o mesmo julgamento e
ele respondeu "FIM=SUBINDO" para o clipe que a régua mediu em −1,80 st. **Fico com a
régua**, pela seção 0 — mas o desacordo fica escrito.

---

### `43acdbf1` · #491 · 0,6d · alcinalivre · sotaque português

**Artefato encontrado: SIM.** Baixei a referência (`ref/auto.wav`, a voz dela) e a amostra
automática entregue (`sample.wav`, 6,24s). **Teste às cegas**, sem dizer qual era qual e
sem dar contexto, 2 repetições cada:

| arquivo | variante | pistas citadas |
|---|---|---|
| referência (voz dela) | **EUROPEU 2/2** | "s final como 'sh', 'd' claro, 'l' claro, vogais reduzidas" |
| amostra clonada | **BRASIL 2/2** | "'s' e 'z' como /s/ e /z/, vogais claras" |

**VEREDITO: confirma o `olho` de 20/09 ("PROCEDE FORTE"), desta vez às cegas** e com as
pistas fonéticas nomeadas por arquivo. Como aqui a tarefa é de identificação (não de
julgamento de qualidade), ela cai no modo confiável da seção 0.

**E há um segundo achado, que corrige o Frank em vez do `olho`.** A nota de 20/09 diz:
*"⚠️ NÃO REPASSEI UMA AFIRMAÇÃO DO `olho` (...) ele afirmou que a amostra tem vazamento:
a palavra 'referência' audível de 0,0s a 0,7s antes do 'Oi!'. Medi eu mesmo (...)"* — e o
cartão corta aí. **Medi de novo: o vazamento existe.** Transcrição dos primeiros 1,4s,
3 repetições: `"referência"`, `"referência referência"`, `"referência referência"`. A
palavra que o `olho` nomeou é a mesma que eu ouço, em leitura independente e em outro dia.

**Ressalva honesta, e ela é obrigatória aqui:** o instrumento tem piso de falso positivo —
1,4s de silêncio digital devolve "Ah!" e 1,4s de ruído rosa devolve "Hum". Ele nunca diz
"sem fala". Mas o piso dele é **interjeição**, e aqui sai uma **palavra de conteúdo de
quatro sílabas, estável em 3/3 e batendo com leitura anterior independente.** Trato como
confirmado, com o piso declarado.

**Por que isso importa:** hoje o cartão está na mão da aluna com o pedido de "gere um
áudio com texto em português europeu e diga o que achou", apoiado na tese de que a culpa
foi o texto brasileiro da amostra. Essa tese continua de pé — mas a primeira coisa que ela
ouviu do próprio clone foi uma palavra solta que não era dela e não estava no roteiro.

---

## 2. BLOQUEIO REAL DECLARADO — verificado por mim, não herdado

### `df216867` · #433 · 4,2d · mariana@exceller / taniaregina · "System error"

**Artefato: NÃO EXISTE — e agora está confirmado no bucket, não deduzido.**
A marca de percepção é a frase do Executor *"eu não ouço áudio — não afirmo nada sobre
qualidade do que saiu"*. Fui ver se havia o que ouvir. `HeadObject` em cada geração da
janela 19:00–21:00Z de 16/09:

```
19:11:43  mariana       ready    EXISTE no R2
19:24:37  mariana       failed   NAO EXISTE no R2   RunPod FAILED: System error.
19:28:44  taniaregina   failed   NAO EXISTE no R2   System error.
19:40:38  taniaregina   ready    EXISTE no R2
19:47:08  taniaregina   failed   NAO EXISTE no R2   System error.
19:51:42  taniaregina   failed   NAO EXISTE no R2   RunPod FAILED: System error.
20:24:43  mariana       ready    EXISTE no R2
20:59:27  mariana       ready    EXISTE no R2
```

**BLOQUEIO REAL:** as 4 falhas **não produziram arquivo nenhum** — não há áudio para
ouvir, e não é indisponibilidade, é inexistência. As 4 estão estornadas e as duas alunas
têm o áudio do mesmo texto pelo caminho que deu certo. **Este cartão não tem pendência de
percepção; a pendência dele é o PR do cartão `50bed125`** (pôr "system error" na lista de
transitórias). Sai da classe.

### `b81bc656` · #450 · 3,5d · jkakorio · convite de compra órfã

**Artefato: NÃO EXISTE.** Conferi o trecho que casou o varredor: é prosa da própria nota
do Frank — *"é exatamente o que ele precisa ouvir"*, sobre uma frase de e-mail. Não há
imagem, áudio nem vídeo. O cartão é cruzamento de telefone × e-mail em `payment_events`,
já medido (65 telefones com mais de um e-mail, 20 em risco, 45% de falso positivo se
suprimir por telefone). **Falso positivo do `%ouvir%`. Confirmo a declaração do Frank de
18/09 tendo lido o trecho eu mesmo.** O cartão segue aberto pelo mérito dele (a proposta
de mudar o TEXTO do convite espera decisão), não por percepção.

### `0c9eee9f` · #438 · 4,1d · chave de primeiro acesso

**Artefato: NÃO EXISTE.** A marca casou por `%precisa olhar%` em cima de uma instrução de
consulta SQL (*"quem pegar precisa olhar `auth.users.created_at` contra a data do pedido"*).
Olhar banco é consulta, não percepção — é exatamente a distinção que o `percepcao_travada.cjs`
documenta no comentário sobre o #315. **Falso positivo.** O que o cartão espera é o merge
do PR #346 e a medição da coorte pós-merge (token CONSUMIDO sem login × token INTACTO sem
login).

### `bb97e2f1` · #460 · 3,1d · thallitamachado · caixa cheia

**Artefato de mídia: NÃO EXISTE.** Não há imagem, áudio nem vídeo. O único "artefato" é
uma mensagem de e-mail (o Undeliverable do `postmaster@outlook.com`, uid 677 da caixa), e
esse já está lido e descrito nas duas notas do Vigia de 20/09. O bloqueio real do cartão é
de canal, não de percepção: **a caixa dela está cheia (SMTP 554 5.2.2 mailbox full), duas
tentativas voltaram, e reenviar pelo mesmo canal queima a terceira.** Dinheiro não está em
jogo (os 525 cr já foram devolvidos). O que falta é outro canal.
**Declaro também o que eu NÃO fiz:** não abri a caixa nem li o uid 677 nesta rodada.

### `8a74a1b7` · #489 · 0,6d · katarinadasilva98 · portão de áudio do SGP

**Artefato de mídia: NÃO É O GARGALO.** A marca casou em prosa (*"o que ela precisa ouvir
é concreto: faltam ~30 segundos DE FALA"*). Os áudios dela existem, mas ouvi-los não
responde nada: o portão compara `totalFala` (1170s medidos) contra `SGP_AUDIO_MIN_SEGUNDOS`
(1200s) — **é aritmética, já feita, e faltam 30 segundos.** O defeito real é de tela
(`ciencia_audio` NULL porque não existe `/api/v1/sgp/audio/ciencia`, então as 4 caixinhas
somem a cada recarga). As 6 pessoas presas foram avisadas uma a uma (uids 2985-2990).
**Não é cartão de percepção.**

### `59fa1ed7` · #490 · 0,6d · alcinalivre · consumo de créditos

**Artefato de mídia: NÃO EXISTE** para a queixa DE CRÉDITO. A marca é o boilerplate do
sensor ("precisa de olho humano, não de código") — a mesma frase que o
`percepcao_travada.cjs` documenta como responsável por 33 dos 41 falsos positivos de 17/09.
A queixa é de extrato, e o extrato foi auditado linha a linha em 20/09 (saldo 100.120, o
"24.375" do recado era leitura de linha de 31/08, o único job falhado foi debitado e
estornado no mesmo dia). **A metade de áudio desta aluna é o `43acdbf1`, e essa eu
despachei** (acima). **Não é cartão de percepção.**

### `702cc916` · #226 · 19,3d · contato@fotoatleta · QA esgotado entregue assim mesmo

**Artefato: JÁ FOI ABERTO, em 18/09** — `019c58d1`, 23,2s, ouvido e transcrito com carimbo
de tempo (card `08c54f2c`). Veredito de lá: áudio íntegro; as 3 "faltantes" eram "tá"/"está"
(2×) e "pra"/"para" (1×), contração oral.

**Eu NÃO reabri esse mp3 nesta rodada — digo isso explicitamente.** O que eu faço por ele
é outra coisa, e vale mais: **aquele veredito foi produzido por TRANSCRIÇÃO, que é o modo
que passa no controle positivo da seção 0. Ele se sustenta.** E a conta dele fecha por
instrumento independente do ouvido (2+1 = os 3 faltantes_total; e as famílias contração
oral / expansão de número / nome próprio explicam a lista inteira de mais frequentes).

**BLOQUEIO REAL, e não é percepção:** este cartão espera **decisão de produto do Johnny**
desde 01/09 — ao esgotar o QA, falhar sem cobrar ou entregar avisando. A nota de 20/09
22h50 fechou a telemetria que faltava (507 de 1.017 com `exhausted>0`, 100% com
`exhausted_score_max` gravado, p50=100 / p95=213 / max=385). **Os 18 dias de espera por
dado acabaram; o que falta é alguém decidir.** Percepção não destrava este cartão.

---

## 3. NÃO ALCANÇADOS NESTA RODADA — sem inventar cobertura

Quatro frentes ficaram de fora. Não tentei e não estimei:

| cartão | idade | o que falta VER/OUVIR, nomeado |
|---|---|---|
| `23f8123d` #371 · alicearnaldo | 8,0d | As 4 fotos que seguem barradas 5/5 (`b5c6dea7`, `5f610dda`, `8cd4c73c`, `2b274f51`) e o par contraditório `b5c6dea7` × `0e6a538a`. **Frank já olhou (20/09) e já mediu com MediaPipe**; falta uma leitura independente do par, que é o que decide se o gabarito dele fecha. |
| `6fabb64a` #478 · alexandre@novaconexao | 1,4d | O render `105c9fc1` (já baixado em `/tmp/alex/`). Percepção **já feita em 19/09** pelo `olho` + instrumento próprio do Frank. Não reabri. ⚠️ **Pela seção 0, o parecer do `olho` ali ("b) LIMITADO") é julgamento subjetivo e não deveria pesar** — mas a decisão de NÃO estornar está apoiada nos 4 CONTROLES de correlação do Frank, que são régua e continuam de pé. A decisão não cai. |
| `bfcb8a50` #501 · 12 alunos | 0,2d | As vozes já treinadas dos 11 (raul: 7m30 contados como 33m36; ketty: 6m34 como 23m38). O próprio Vigia declarou o limite: *"provei a régua furada, NÃO que a voz de alguém saiu pior"*. **É pergunta de ouvido, é despachável, e eu não cheguei nela.** |
| `30f2ce07` #500 — **metade de IMAGEM** | 0,3d | O embelezamento medido pelo Vigia às 18hZ (selfie 9,772 contra ~8,83-8,91 no gerado, com o prompt da casa mandando "no beauty filter" e não sendo obedecido) e amarrar qual das 9 refs alimentou a geração `4e4e6f99` (uma se chama `frente_rosto_liso.jpeg`). **A metade de ENTONAÇÃO deste cartão eu despachei** (junto com o #348). A de imagem, não. |

Sobre a **metade de entonação do #500 já resolvida por declaração**: a nota do Frank de
20/09 20h15 declarou bloqueio real dizendo que mandar o áudio pro `olho` seria teatro,
porque a pergunta dela ("gravar 1h em vez de 20min ajuda?") é sobre a RELAÇÃO entre
duração da referência e prosódia, que só se responde medindo o corpo de vozes.
**Essa declaração está certa e eu não a derrubo** — e a régua de F0 que eu rodei é
justamente o instrumento que torna esse corpo mensurável quando alguém for medi-lo.

---

## 4. PLACAR HONESTO

```
18 cartões na lista
 7 DESPACHADOS com artefato aberto por mim  (234, 329, 335, 296, 439, 348+500-entonação, 491)
 7 BLOQUEIO REAL declarado e verificado      (433, 450, 438, 460, 489, 490, 226)
 4 NÃO ALCANÇADOS, nomeados acima            (371, 478, 501, 500-imagem)
```

Da classe de percepção **de verdade** (cartão que só parava por falta de ver/ouvir), a
fila entrou com 18 nomes e sai com **3 pendências reais**: as 4 fotos da Alice, as vozes
dos 11 do SGP, e o embelezamento da Ellen. Os outros 7 eram prosa casada pelo varredor,
decisão do Johnny, ou artefato que não existe.

## 5. O QUE ESTE LAUDO NÃO AUTORIZA

Não decidi nada. Nenhum estorno, nenhum retreino, nenhum merge, nenhuma carta a aluno,
nenhum status mexido, nenhuma GPU. Três medições aqui **mexem em coisa que está na mesa
do Johnny** e por isso precisam de leitura dele antes de virar ação:

1. **#329** — o 4,5/10 que sustentava a "frente nova" não se sustenta; o recorte dos
   41.600 cr fica mais forte, não mais fraco.
2. **#348/#500** — a entonação de pergunta **não** é incapacidade do motor; é variância
   entre gerações. Isso muda o conserto e muda o que se diz à Ellen.
3. **#234** — as 3 piores fronteiras da base têm a palavra inteira. O "609 / 237 alunos"
   precisa ser re-medido por perda de palavra antes de sustentar decisão.

Artefatos de trabalho em `/tmp/percep/` (áudios, janelas, controles, envelopes) e
`/tmp/pericia-329/`. Ferramentas que escrevi: `/tmp/percep/gem.cjs` (mídia real pro
Gemini), `/tmp/percep/env.cjs` (envelope RMS), `/tmp/percep/baixar.cjs` (R2).
