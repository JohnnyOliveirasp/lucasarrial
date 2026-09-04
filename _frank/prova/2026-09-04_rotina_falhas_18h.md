# Ronda das falhas — 04/09/2026, ~17:40Z (14h40 BRT)

Serial: **`702cc916`** (#226). **Não fechei** — e a ronda explica por quê com
número, não com impressão: o conserto que existe cobre **7 das 24** entregas
ruins.

Ordem de 29/08 respeitada: nada da planilha foi lido, escrito, classificado,
avisado ou reprocessado. Canal: aviso no **grupo** (`notify-grupo.sh`), ordem
de 31/08.

---

## 1. Por que segui no `702cc916` e não no `3ca22d47`

O `3ca22d47` (#222) é mais antigo (01/09 15:54), mas o vigia mediu pela **3ª
ronda seguida** que, pelo defeito original dele, **não há aluno sem acesso
hoje**, e a decisão que o move (vínculo-por-confirmação no cadastro) está com o
Johnny desde 14:46Z, com as duas chaves óbvias já reprovadas. Não há passo meu
que o mova. O `702cc916` tinha passo meu: o PR #176 estava parado com uma
ressalva de mérito em cima.

## 2. Respondi a ressalva do vigia (§6-C das 16hZ) — ela não trava o merge

O vigia levantou a `a8caaae1`: única geração em que o caminho de resgate
**realmente executou**, e mesmo assim saiu em **0,615**, abaixo do piso 0,65
que o PR propõe. A leitura natural é assustadora: se o piso manda pro resgate e
o resgate não levanta, o job cai e o aluno é estornado — a tempestade de 19/08.

**Fui ler o diff em vez do título, e o `coder` já tinha tratado isso.** A
função tem **três chamadores** e `False` significa coisa diferente em cada um:

| chamador | o que `False` faz |
|---|---|
| `_gerar_todos_os_chunks` | manda pro resgate nível 1 |
| `_resgatar_por_subdivisao` | escala pro nível 2 |
| **`_resgatar_nivel_2`** | **`return None` → job falho → estorno** |

O PR aplica o piso nos dois primeiros e o **isenta no terceiro** (`terminal=True`),
onde ele só **conta** (`coverage_espalhada_piso_terminal`) e entrega a menos
ruim, igual a hoje.

**Não acreditei no docstring — conferi a cadeia do estorno por caminho
próprio:** `frontend/src/app/api/v1/webhooks/runpod/route.ts:295` chama
`handleTechFailure` com `debitRefType: "generation"` e
`refundRefType: "generation_refund"`. A afirmação que sustenta o desenho
inteiro é **verdadeira**.

Logo, sob o PR, a `a8caaae1` termina em *"entrega a menos ruim"*, **não** em
falha+estorno. **A ressalva está respondida e não bloqueia o merge.**

## 3. O achado da ronda: o PR **não fecha** o chamado

Medido no banco (janela desde 02/09 02:32Z, `coverage_espalhada > 0`):

| grupo | entregas | alunos | faixa |
|---|---|---|---|
| **abaixo do piso 0,65 — o PR PEGA** | **7** | **6** | 0,333 – 0,625 |
| **0,65 ou acima — o PR NÃO pega** | **17** | **12** | 0,667 – 0,846 |

Mergear mata a cauda pior. **12 alunos continuam recebendo áudio sub-régua.**
Registro isso agora porque a ronda das 16:00Z abriu o card como se o piso
fosse *o* conserto, e ele é **um pedaço** dele.

## 4. E não toca no `#47` (Katia) — nem com piso 0,80

As duas entregas que ela rejeitou — `1498fbe5` (02/09, a que **nós** mandamos
como *"VERSAO NOVA … corrigida"*) e `423e390a` (04/09) — estão em **0,800**.

- piso 0,65 → não pega.
- piso 0,80 → **também não pega** (a comparação é `<` estrita).
- piso 0,85 → pega, mas 0,85 **é a própria régua**: equivale a apagar a
  escotilha, reprovado com razão porque reprova áudio perfeito com markup.

### Por que nenhum piso resolve a classe dela

97 palavras em 6 chunks (~16 por chunk). O pior chunk perde ~3 palavras e a
maior lacuna **contínua** fica abaixo de
`limite_lacuna = max(COVERAGE_QA_GAP_MIN=6, 20% do chunk) = 6`. Essa é
**exatamente** a forma de buraco que a escotilha foi construída pra deixar
passar.

**O piso mexe no LIMIAR. A pergunta continua sendo "o buraco é contínuo?"
quando a pergunta que decide o caso dela é "o que sumiu é palavra de verdade ou
é marcação?".**

## 5. Correção de instrumento na nota das 16:00Z

Onde a ronda anterior escreveu *"cobertura 0,333 — um terço do texto"*, **não
é**. `coverage_min_visto` é o **mínimo entre os chunks**: a `97464f01` tem 275
palavras em 19 chunks, então 0,333 são ~10 palavras sumidas de **um** chunk de
~14,5 — não um terço da entrega. (A ronda das 16:00Z tinha a ressalva certa no
§4 e a frase errada no §3-C; fica corrigido.)

**Controle rodado antes de acreditar no recorte:** as frações limpas (0,333,
0,667, 0,75, 0,800) levantam a suspeita de denominador minúsculo — mediria
"1 de 3 palavras" e não "um terço do texto". Fui conferir o tamanho dos chunks:
**8,8 a 20,8 palavras**, nenhum minúsculo. A suspeita **não** se confirmou, e
os números do §3 valem. Registro a checagem porque ela é que dá direito a
usá-los.

## 6. O que falta, e é barato — card `2e8e0775` pro `coder`

Registrar **QUAIS** palavras sumiram. Hoje o QA sabe *quanto* sumiu
(`chunk_coverage`) e a *forma* do buraco (`maior_lacuna`), mas não *o quê*.

O dado já está de graça no caminho: `chunk_coverage` (`tts_qa/metrics.py:47`)
já monta `difflib.SequenceMatcher(None, expected, got)`, e as palavras
faltantes caem dos opcodes `delete`/`replace`. A função irmã
`chunk_intrusions`, **no mesmo arquivo**, já percorre `get_opcodes()` pro caso
inverso. **Telemetria pura: sem GPU, sem whisper novo, sem mudar
comportamento** — o card diz isso em caixa alta e pede um teste que prove que o
veredito de entrega não mudou.

Com isso, *"3 palavras espalhadas"* separa em **`**negrito**`, emoji,
`[pausa]`** (ok) de **"você", "não", "muito"** (perda real) — e o `#47` fecha
com dado em vez da 4ª rodada de hipótese.

**Continuo NÃO afirmando** que a palavra faltante da Katia é "você". Segue sem
medida, igual às rondas de 13:49Z e 16:00Z. O que mudou é que agora sei como
medir barato.

## 7. Registro

- `702cc916` (#226): nota gravada, `agent_notes` 33 → **34**, 1 linha afetada,
  conferida na releitura. Status **mantido em `investigating`**.
- `ce6e157d` (#47): nota gravada, `agent_notes` 47 → **48**, 1 linha afetada,
  conferida na releitura. Status mantido em `aguardando_aluno`.
- Card **`2e8e0775`** aberto pro `coder`.
- Grupo avisado com a recomendação de merge e o escopo honesto dela.

## 8. O que eu NÃO fiz

Não fechei, não reabri, não mudei status, **não mergeei o PR #176** (a decisão
foi passada ao Johnny com a ressalva respondida), não apliquei a migration 102,
não virei o `TTS_TAIL_QA_INTERNO_MODO`, não mexi em crédito, não estornei, não
cancelei assinatura, não gastei GPU, não escrevi pra aluno (a Katia recebeu a
carta de 16:00Z, uid 765; 4º e-mail em 2h seria ruído) e não toquei em nada da
planilha.

## 9. Pendências que continuam com o Johnny

1. **Solon** — cancelar a duplicada, prazo **06/09**, agora ~**43h**. Dinheiro.
2. **Jackson** — cancelar a `6VHWPHB9` + estornar R$97; ele já escolheu por
   escrito. As duas cobram de novo em **19/09**.
3. **PR #176** — mergear? Ressalva do §6-C respondida; ganho é parcial (7 de 24).
4. `3ca22d47`/#222: vínculo-por-confirmação no cadastro.
5. `#246`: compra avulsa do curso dá acesso ao FastCloner?
6. `#234` (`TTS_TAIL_QA_INTERNO_MODO`, +16–19% de GPU) — segue travando o #47.
7. Migration 102 não aplicada (**20ª** ronda).
8. 14 branches locais não triados.

## 10. Passo fixo

`git fetch origin && git log --oneline origin/main..HEAD` conferido no fim
desta ronda. Nenhum código foi escrito por mim — só este log, direto na main.
