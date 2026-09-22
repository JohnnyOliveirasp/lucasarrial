# Ronda das falhas — 22/09/2026 ~21h40–22h30Z (Frank, dono da fila)

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`).
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou
reprocessado.

Serial pela regra 8. Não escrevi pra aluno, não mexi em crédito/acesso/
entitlement, não cancelei assinatura, **não mergeei nada**, não liguei chave,
não gastei GPU, não toquei em migration.

**Uma linha:** peguei o `#234` (f8587cef, 20 dias, 237 alunos) — o cartão mais
velho com aluno afetado que **não** depende do Johnny — e descobri que **dois
dos três próximos passos que eu mesmo tinha nomeado em 21/09 estavam errados**;
o terceiro virou o **PR #408**. No fim da ronda, **9 dos 13 operários da casa
caíram** ("Not logged in").

| fato | número |
|---|---|
| Cartões fechados | **0** (digo abaixo por que não fechei) |
| Alunos escritos | **0** (a classe inteira seria comunicado em massa — regra 8 de 21/08) |
| Fix em produção | **0** |
| PR aberto e revisado por mim | **1 (#408)** |
| Notas de incidente gravadas | **1** (#234, conferida na releitura: 39 → 40 notas, 1 linha afetada) |
| Ferramenta nova (só leitura) | **1** |
| Dinheiro devolvido | **0** |
| GPU gasta | **0** |

---

## 0. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 1073 lidas = 996 já com linha + 77 fora da janela + **0 escrituráveis**. Contagem fecha (1073 = 1073). |
| `enviados_x_tabela.cjs` (irmão de leitura, independente) | **0 carta depois do corte** fora da tabela. Veredito: buraco **PASSIVO**. |
| `percepcao_travada.cjs` | **0** card travado em percepção · controle positivo #310 reencontrado, 510 varridos. |
| `garantia_na_fila.cjs` | 6 perderam a janela · **1 vence em 48h** · 0 na perna da renovação. |
| `idade_incidentes.cjs` | **105 abertos** (igual à ronda anterior). 30d+: 3 · 15–30d: 17 · 7–15d: 36 · 3–7d: 28 · <3d: 21. |
| `esperando_johnny.cjs` | **19 cartões** parados em decisão do Johnny · mais velho **54d** · **60 alunos** distintos atrás da fila. |

O `#479` **não** voltou a queimar a ronda: ele já foi medido e desarmado como
falso alarme na ronda das 20hZ, e eu não o re-medi.

---

## 1. O cartão serial: #234 / `f8587cef` — palavra decapitada

Escolhido pela regra 8: **o mais antigo com aluno afetado que não está parado no
Johnny**. Os quatro mais velhos que ele (`c726c5ae` 105d, `d3d8d1b2` 54d,
`b706b32e` 40d, `719c9af6` 22d) estão todos na fila de decisão do Johnny e já
têm a análise escrita nas rondas de 20–22/09 — re-medir é o que queimou três
rondas no `#479`.

### 1.1 O passo (ii) que eu nomeei em 21/09 **não tem dado nenhum**

Minha própria nota de 21/09 deixou escrito: *"medir a 2ª prova por palavra
(`tail_interno_word_flagged`) como candidata a régua de verdade"*. Fui medir.
Ferramenta nova, só leitura:
`_frank/ferramentas/2026-09-22_regua_da_palavra_tem_dado.cjs`

Janela desde 02/09 17:08Z (nascimento do `tail_interno_*`), **1.453 gerações
`ready`**, 1.092 com bloco `qa`:

```
tail_interno_checked        11.747   (a sombra RODOU — controle do zero)
tail_interno_entregue          946 de 6.063 fronteiras com veredito = 15,6%
tail_interno_word_flagged        0   em 0 gerações      <-- o alvo
tail_word_flagged               93   em 59 gerações     <-- MESMA prova, fronteira FINAL
```

**O zero é real, e não é zero de consulta quebrada.** O irmão de controle é a
mesma prova na fronteira **FINAL**, onde ela roda sempre: marcou **93 vezes** no
mesmo período. Instrumento funciona; o que falta é a chave
`TTS_TAIL_QA_INTERNO_PALAVRA`, desligada na fronteira interna — exatamente como
o comentário do `tts_qa/loop.py` já avisava e eu não tinha conferido.

**Consequência:** o passo (ii) **não é medição de dado existente**, é **pedido de
aval pra gastar GPU** (N whispers com timestamp por palavra por geração, em vez
de 1). Não liguei.

### 1.2 E mesmo ligando, ela **não responderia** à pergunta do cartão

Este é o erro que importa. Em `tts_qa/loop.py`:

```python
cortado = fim_abrupto(seg, sample_rate)
if cortado is False and (not interno or tail_qa_interno_palavra):
    ... ultima_palavra_truncada ...
```

A prova por palavra **só roda quando o envelope APROVOU**. Ela nunca chega a
opinar sobre uma fronteira que o envelope **reprovou**. Ou seja: ela é
**complemento** (pega falso **negativo** do envelope), não **filtro**.

A pergunta parada desde 18/09 (`#226`) e reafirmada em 21/09 é se o envelope
**INFLA** — falso **positivo**. A prova por palavra, como está escrita, é
**estruturalmente incapaz** de responder isso. Ligar a chave custaria GPU e
**não destravaria a decisão**. O passo (ii) foi mal nomeado por mim; está
riscado da lista, com o motivo escrito no cartão.

> Número lateral, rotulado com cuidado pra ninguém repetir o erro do `#226`: os
> 93 são **por tentativa**, não por entrega — 93 em 2.298 `tail_checked` = 4,0%
> das tentativas em que o envelope aprovou e a palavra pegou corte. Mede
> **sub-detecção** do envelope na fronteira final. **Não** é taxa de entrega e
> **não** pertence ao 609.

### 1.3 O passo (i) saiu do papel: **PR #408**

O que travava a conferência ponto a ponto era a telemetria guardar **contador** e
não **posição** (limite 3 da nota de 21/09: *"a telemetria guarda CONTADOR e não
guarda o SEGUNDO da fronteira reprovada"*). Confirmei lendo
`registrar_tail_interno`: só `_entregue` / `_entregue_n` /
`_entregue_sem_veredito`. Nenhum offset, nenhum índice de chunk.

**PR #408** — `feat/tail-interno-posicao-da-fronteira`, base `main`, commit
`33f68893`, +155/−4 em 3 arquivos. **ABERTO, NÃO MERGEADO.**

- `registrar_tail_interno` ganha `dur_s` opcional; **`dur_s=None` = comportamento
  de hoje, inalterado** (coberto por teste);
- `tail_interno_entregue_t_s` (relógio de entrega) e
  `tail_interno_entregue_pos_s` (offsets das fronteiras reprovadas, teto de 40)
  nascem **juntos** na 1ª chamada com duração — lista vazia ≠ campo ausente, a
  disciplina que o arquivo já tinha;
- os **3** call sites de `jobs/inference.py` passam a duração do pedaço
  **realmente entregue** (no resgate, o **sub-pedaço**; no caminho normal, antes
  da pausa de parágrafo);
- `tail_interno_pos_crossfade_ms` grava o crossfade da montagem.

**Honestidade da medida, escrita no próprio código:** o offset é **aproximação
com desvio nos dois sentidos** — o crossfade **encurta** (posição real *antes*) e
a pausa de parágrafo **alonga** (posição real *depois*). Serve pra apontar o
ouvido na região certa (±poucos segundos), **nunca** pra corte automático por
timestamp. O operário documentou os dois desvios; eu só tinha pedido o do
crossfade.

**Testes, com controle:** +5 em `test_tail_qa.py`; suite alvo **42/42 OK**. A
suite completa do worker foi rodada **nos dois lados com o mesmo instrumento**
(venv descartável): branch **363** testes / `origin/main` **358**,
`failures=19 errors=28` **idênticos nos dois**, diff do conjunto de nomes
**vazio** — são deps pesadas ausentes no venv (`faster_whisper`, `torch`),
**pré-existentes, não regressão**. Delta limpo = só os +5 testes novos.

**Revisão:** feita **por mim, linha a linha**, porque o `gerente` da casa caiu no
meio da ronda (§3). Conferi os 7 pontos que eu tinha mandado revisar: compat­i­bi­li­dade
com `dur_s=None`, ausência de caminho que lance exceção (`self.sample_rate`
guardado e já preenchido no setup antes de qualquer chunk), os 3 call sites
usando o pedaço entregue e não o descartado, os dois desvios declarados, o
relógio andando também no veredito `None` (correto — pedaço mudo no meio do
arquivo ocupa tempo, e pular deslocaria todas as posições seguintes), campos
nascendo inicializados, e testes que não são tautologia. **Aprovado.**

### 1.4 O que o cartão espera agora, em ordem

1. **merge do PR #408** — depois dele, toda geração nova grava *onde* a fronteira
   reprovou;
2. com posição na mão, **refazer o par cego apontando o ouvido no segundo exato**
   das 4 discordantes (era o passo (iii); **só agora** ele fica possível);
3. só então decidir `TTS_TAIL_QA_INTERNO_MODO=reprovando` — a decisão do Johnny
   parada desde **12/09**.

Enquanto (2) não acontecer, **minha recomendação de 21/09 continua de pé: não
ligar o gate como está.**

### 1.5 Por que **não** fechei

Regra 14: medi e escrevi conserto, **não resolvi**. Nenhum aluno recebeu áudio
melhor por causa desta ronda. Segue `investigating`, de propósito — não é
`fixed` (nada foi resolvido) e não é `aguardando_aluno` (quem deve o próximo
passo é a **casa**).

E **não escrevi pros alunos**: os 237 receberem a mesma frase é, na prática,
**comunicado de limitação de produto** para a classe inteira — e-mail em **massa**,
que pela regra 8 de 21/08 precisa do "pode" do Johnny. Carta individual de caso
que eu esteja tratando eu mando sozinho, e **não segurei nenhuma** nesta ronda.

---

## 1.6 Resgatei um experimento que estava sendo perdido hoje — e ele derruba o par cego de n=24

Encontrei `_frank/ferramentas/2026-09-22_controle_embutido_decapitada.cjs`
**untracked** no git, sem menção em nenhum log. Foi escrito por uma ronda de hoje
às **14:00Z**, construiu um lote de controle **embutido** deste cartão (4
adulterados + 3 intactos + 5 reais) e **nada disso foi registrado**: o gabarito só
é impresso no **stdout** e morreu com aquele terminal. Sobraram 12 mp3 anônimos em
`/tmp` que a próxima limpeza apagaria.

**Recuperado**, porque o embaralho da ferramenta é determinístico de propósito:
re-rodei com os mesmos argumentos e reconstruí o lote. **`md5sum` dos 12 arquivos
contra os de 14:00Z: 12/12 idênticos** — é o mesmo lote, não um parecido. Gabarito
e método agora estão na main:
`_frank/prova/2026-09-22_controle_embutido_gabarito.md`.

**O resultado: não houve escuta.** Mandei os 12 ao `olho` num pedido só (a carga é
o ponto do teste), com uma regra que os testes anteriores não tinham — *"se você
não conseguir de fato ouvir, escreva NAO OUVI; nunca carimbe SEM CORTE num
arquivo que você não ouviu"*. Resposta em **9 segundos: `NAO OUVI` nos 12**,
`OUVI DE VERDADE: 0 de 12`. Sondagem de um arquivo só: **vazia**, 3s. Instrumento
alternativo também fora: `analyze_video` da Z.AI devolveu **HTTP 429 —
"Insufficient balance"**.

**O que isso prova.** O cabeçalho da ferramenta de 14:00Z registrou que o par cego
de **n=24** daquele dia voltou com **23 de 24 "SEM CORTE", todos "confiança
alta"**, inclusive gerações com decapitação **confirmada offline** (uma com
cinco). Aquela ronda levantou duas hipóteses e disse, com razão, que o teste não
as separava: **(a)** a régua marca o que o ouvido não ouve; **(b)** o ouvido
degrada sob carga. Com a escotilha do `NAO OUVI`, o mesmo ouvido nas mesmas
condições diz que **não ouviu nada** — é **(b)**, e pior que a suspeita: não era
perda de sensibilidade, era **resposta confiante sem escuta nenhuma**.

> **O par cego de n=24 de 22/09 está VAZIO DE INFORMAÇÃO** — não pode ser citado
> nem a favor nem contra a régua. É o desfecho que a própria ferramenta previu por
> escrito.

**O que isso NÃO prova:** não invalida o controle positivo de **21/09**, onde o
ouvido achou 3 de 3 cortes fabricados **com o segundo certo (10–50 ms)** e
preservou 2 de 2 intactos — impossível sem escuta real. Ele **funcionou em 21/09 e
não funciona agora**. E não decide se a régua infla.

**Alcance além deste cartão — atinge a ordem de 17/09.** Aquela ordem transformou
"precisa ver/ouvir" de **parada** em **despacho**, com o veredito voltando escrito
na nota do card. Se o ouvido devolve veredito confiante **sem ter ouvido**, o
despacho passa a produzir **laudo falso** em vez de parada — e isso é **pior** que
a parada que a ordem aboliu, porque *parece* resolvido.

> **Regra que fica, e que já se pagou hoje:** todo despacho de percepção leva a
> escotilha `NAO OUVI`/`NAO VI` **e** um controle positivo **embutido no mesmo
> lote**. Laudo de percepção sem controle embutido não entra em nota de cartão.

**Bloqueio declarado com motivo concreto** (ordem de 17/09, opção 2): a escuta
ponto a ponto deste cartão está bloqueada hoje por **falta de instrumento** —
`olho` devolve `NAO OUVI`/vazio, Z.AI sem saldo, 9 operários fora. Não inventei
laudo e não dei a escuta por feita.

---

## 2. Conserto escrito que está fora do ar — o número

O passo de fim de ronda por `git branch` continua inútil neste repo (~190 falsos
positivos por causa do merge por squash, já registrado em 20hZ). O que responde
"tem conserto pronto fora do ar?" é `gh pr list --state open`:

**58 PRs abertos** · mais velho **34,2d** · mediana **3,4d** · **15** com 7d+ ·
**11** com 14d+ · **4** com 30d+.

Não é lista pra ler hoje; é o tamanho do estoque. Entre eles estão os que os
cartões mais velhos esperam nominalmente (#404 do `d3d8d1b2`, #398 do
`b706b32e`, #355 do `58b376ea`).

---

## 3. ⚠️ FALHA DE FROTA MEDIDA NO FIM DA RONDA — 9 de 13 operários caíram

Aconteceu **durante** esta ronda e vai atrapalhar a próxima, então fica
registrado com a medição, não como impressão:

- o `coder` **entregou o PR #408 às ~21h50Z** normalmente;
- às **~22h15Z**, sondando um por um, **todos** os operários de assinatura
  Anthropic responderam **`Not logged in · Please run /login`**:
  `coder`, `qa`, `gerente`, `critic`, `analyst`, `strategist`, `generalist`,
  `carol` e o `social`-Sonnet — **9 de 13**;
- responderam "OK" apenas `olho` e `pesquisa` (Gemini via OpenRouter) e o `glm`.

**E o `olho` está de pé só no ping.** Minutos depois, na tarefa real (§1.6), ele
devolveu `NAO OUVI` em 12 de 12 arquivos e **resposta vazia** numa sondagem de um
arquivo só. Ou seja: responde "OK" a um ping de texto e **não executa percepção**.
O instrumento de reserva, `analyze_video` da Z.AI, está **sem saldo** (HTTP 429).

**Custo concreto pra próxima ronda:** sem o `/login` do Johnny, a casa **não tem
quem escreva código, quem teste em navegador, nem quem revise entrega** — e, com o
`olho` mudo e a Z.AI sem saldo, **não tem ouvido nem olho**, que é a perna que a
ordem de 17/09 depende. Foi por isso que a revisão do #408 saiu na minha mão.
Postado no grupo.

---

## 4. Fila de decisão do Johnny — 19 cartões, 60 alunos

Não re-escalei caso a caso (é o que a doutrina do próprio instrumento desaconselha)
e **não repinguei** o `1a9e6133`: a ronda das **15h50Z de hoje já cobrou** os três
cujo prazo vence 23/09, e repicar de novo na mesma noite queima o canal. Fica
registrado o que a próxima ronda encontra ao amanhecer:

> Se amanhecer **23/09** sem resposta, a janela dos **três** (`jununes42`,
> `joaov.cestaro`, `fastcloner@americanshowerglass`) **fechou**. Registre como
> fato, trate como exceção da família do `#207` — **não invente prazo novo e não
> deixe morrer em silêncio**. Os dois de **28/09** ainda têm margem: **não
> misture** com os três.

---

## 5. Ferramenta nova (só leitura)

`_frank/ferramentas/2026-09-22_regua_da_palavra_tem_dado.cjs` — responde se a 2ª
prova por palavra tem dado antes de alguém tentar "medir" o que não existe.
Carrega o **controle do zero** embutido (a sombra rodou? o mesmo instrumento
marca na fronteira final?) e **mata o processo em qualquer `error`** — zero de
consulta quebrada não é zero medido. Não escreve linha, não gasta GPU, não gasta
crédito, não manda e-mail.

---

## 6. Fim de ronda

- `git log --oneline origin/main..HEAD` conferido **vazio** após o push deste log.
- Nada de produção tocado por mim: **uma nota de incidente** (conferida na
  releitura), **uma ferramenta de leitura**, **um PR aberto** e este log.
- O código do #408 vai por branch `feat/` + PR com base `main`, como manda o
  manual; **só o log vem direto na main**.
