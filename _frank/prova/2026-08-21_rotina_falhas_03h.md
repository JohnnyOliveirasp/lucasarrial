# Rotina das Falhas — ronda das 03h UTC de 21/08 (Frank, dono da fila)

**Fila no início:** 5 abertos (todos `investigating`), 1 deles sem nota nenhuma.
**Fila no fim:** 5 abertos, **os 5 com nota**, 1 com causa encontrada e fix em PR.
**Fechados nesta ronda:** nenhum. Explico cada "não fechei" abaixo.

---

## O achado da ronda: a contradição era NOSSA, não dos e-mails

O Vigia abriu o `07745f61` às 02:13 como *"os e-mails de 01:09 mandam gravar 15min mas o
portão exige 20min"*. Medi, e a contradição **não está nos e-mails escritos à mão — está no
código**. Os e-mails só repetiram o que o produto diz.

São **dois mínimos** e o aluno só conhecia o errado:

| | onde | exige |
|---|---|---|
| **PORTA** | `uploads-complete`, `onboarding/import`, `rescue-stuck-uploads` | **20min BRUTOS** somados |
| **TREINO** | worker (`TRAIN_MIN_USEFUL_SECONDS`) | **10min de fala LIMPA** pós Demucs+VAD |

`finalize-training.ts:88-99` citava só o mínimo do **treino** (*"mínimo: 10min de fala
limpa"*) e mandava *"tente de novo com essa gravação nova"*. Quem obedecia gravava 12–15min e
batia na **porta**. Nenhuma das duas mensagens mencionava a outra.

**Não é texto interno.** `voice-status-panel.tsx:236-251` (`VoiceErrorMessage`) busca
`/api/v1/voices/:id` e renderiza `voices.error_message` **ao vivo** quando `status=failed`.
Conferido no arquivo, não deduzido. É literalmente o que o aluno leu.

### A conta real: 9 pagantes, não 2

Paginado (848 vozes × 1339 profiles, `count:exact`, sem o teto de 1000). 24 vozes em
`rejected_too_short`; destas, **14 vozes de 9 alunos PAGANTES com acesso vivo e crédito.
Nenhum avisado.** Vários **por pouco**:

| aluno | mandou | parado desde | crédito | acesso vence |
|---|---|---|---|---|
| `natali.marcio` | 12min ×2 | **19/07 (33 dias)** | 175.737 | 19/09 |
| `jrfengenhariadf` | 10min | 25/07 (26 d) | 100.000 | **25/08** |
| `leandro.fitoway` | 10min | 30/07 (21 d) | 97.620 | 29/08 |
| `fabiobragaclone` | **18min** | 03/08 | 100.000 | 28/08 |
| `catarinacouras` | **18min** | 06/08 | 153.720 | 05/09 |
| `sidbae` | 9/8/5/7min ×4 | 09/08 | 75.292 | 09/09 |
| `rafaelleitemacedo` | 3min | 13/08 | 73.585 | 23/08 |
| `dirceu.moura.cruz78` | 11min + 13min | 15/08 | 64.286 | **22/08** |
| `richard.moraes` | **15min** | 16/08 | 89.360 | **25/08** |

O `richard.moraes` mandou **exatamente os 15min que nós pedimos**. O `rafaelleitemacedo`
(3min) é curto de verdade — esse não é vítima da mensagem, e está na lista por honestidade.

### Segundo defeito, aritmético

A mensagem usava `Math.round`, então 1174s (19,57min) virava a frase impossível:

> `Áudio total 20min < mínimo de 20min`

Foi o que `kelinnavelar` (voz `a046ede6`) leu. Reproduzido em bancada antes de mexer.

### O que fiz — PR #22

Branch `fix/regua-audio-mensagem-honesta`. Nova `lib/voices/regua-audio.ts` com a régua em
**um** lugar (a constante `20*60` estava duplicada em **4** arquivos), mensagem que diz
**quanto falta** e que **nada foi cobrado**, e `finalize-training` passa a citar o alvo da
porta junto do diagnóstico. 6 testes em `node:test`.

`tsc --noEmit` limpo · `eslint` limpo nos 6 arquivos · `node --test` 6/6.

**Escopo:** só texto e a constante compartilhada. **Nenhum limite mudou de valor**, nenhum
aluno destravado, nenhuma migration, nenhuma GPU. Conferido que **nada parseia a string** —
todos os consumidores olham o *status* `rejected_too_short`.

**Colisão: conferi ANTES de editar.** Listei os arquivos dos 13 PRs abertos; nenhum toca os
meus. Esse foi exatamente o passo que faltou na ronda anterior (commit `7ee785f` colidiu com
o PR #15) e é a razão de eu ter feito isso primeiro desta vez.

### O que o PR NÃO resolve — por isso o card fica aberto

1. **Os 9 já parados continuam parados.** Texto novo só vale pra falha nova. Precisam de
   e-mail = "pode" do Johnny.
2. **`error_message` já gravado não é reescrito.** O painel lê do banco ao vivo, então quem
   tem a mensagem velha continua lendo a velha. Backfill é **proposta**, não foi feito — é
   escrita em registro de aluno.
3. **O painel de `rejected_too_short` não mostra `error_message`**: mostra i18n estático
   (`panel.rejectedBody`) que **já dizia "mínimo de 20 minutos" certo**, nos 3 idiomas.
   Ou seja, essa metade do fix é de suporte/consistência e **não é visível ao aluno**.
   Registro pra não virar overclaim.
4. **Não mexi no VALOR de 20min.** Se a porta deve mesmo ser 20 brutos agora que
   `speech-estimate` sabe medir fala limpa de verdade é questão de **produto**, não bug.

---

## Os outros 4 incidentes

| id | o que mudou nesta ronda |
|---|---|
| `b9c5a0d1` | Classe subcontada: eram 2, **são 9**. Causa encontrada (é a mesma do `07745f61`) e o "detector cego" do título estava certo — **a mensagem** é que mandava o aluno fazer a coisa errada. |
| `5c3f1f8b` | Os 3 seguem parados (medido: zero vozes ready, zero gerações). Novidade: a instrução que a **ivanilde** vai receber tem que trazer 20min brutos, senão ela cai na mesma armadilha. |
| `ce6e157d` | **Relógio:** o acesso da Katia vence **22/08 12:00 UTC (~33h)**. Ela não gera nada desde 19/08 21:07. O piloto de pacing morre sem veredito e as outras 841 vozes seguem colando frases. |
| `100e7ace` | Sem material novo. **Mas** o PR #16 (`feat/ref-corte-em-palavra`) já ataca o item 2 do Johnny com `word_timestamps` — o caminho aprovado, e não por heurística de energia. É do Claude; não opinei no merge. |

---

## Leftovers da ordem de 20/08

**Item 1 — `d3d8d1b2` (timeout): NÃO voltou. Não reabri.**

⚠️ **Quase publiquei um zero falso.** Minha primeira busca foi por
`error_message ilike '%tempo de execu%'` e deu **0** — mas a assinatura real é em inglês,
`executionTimeout exceeded`. Refiz imprimindo as **famílias de erro cruas** de todas as 38
gerações `failed` da base:

```
 13x | última 2026-08-18T20:46 | executionTimeout exceeded
  8x | última 2026-08-20T10:09 | qa_coverage: ... texto completo apos esgotar regeneracoes
  6x | última 2026-07-15T01:40 | Failed to download https://voices-clone-ai-verse...
  4x | última 2026-05-26T22:40 | The expanded size of the tensor (8192)...
  2x | última 2026-08-10T10:50 | OSError: [Errno 28] No space left on device
```

São as **13 ocorrências** que o card já registrava, a última em **18/08 20:46 = 54h atrás**.
Não houve nova. Contra o histórico de ~2/semana, 54h **não é prova de cura** — é só ausência.
Segue `ignored` por decisão do Johnny, com o aceite de risco de pé.

**Item 2 — referências cortadas no meio da palavra:** em voo no PR #16, com
`word_timestamps`. Não é meu, não mexi.

**Item 3 — re-medir as 40 entregas com a régua corrigida:** **não fiz nesta ronda.** Não
inventei número: fica pendente e declarado.

---

## Saúde da produção (últimas 26h)

- **135 gerações: 132 ready, 3 failed.** As 3 são `qa_coverage` e **todas anteriores a
  20/08 10:09** — ou seja, **16,6h sem nenhuma falha**, e o fix do rótulo de diálogo
  (deploy 20/08 11:41 UTC) segue segurando: **15,1h limpas depois dele**.
- **32 vozes mexidas: 29 ready, 3 awaiting_training.** Zero falha nova, zero rejeição nova.

---

## Erro meu nesta ronda, e o que mudei

Ao anotar os incidentes usei `update({resolution_note})` direto, o que **apagou o histórico
das rondas anteriores** nos 4 cards que já tinham nota (o `07745f61` estava nulo, não perdeu
nada). Percebi na conferência de leitura pós-escrita.

**Recuperei os 4 na íntegra** (854 / 4436 / 3580 / 3196 chars) do dump que eu mesmo tinha
tirado no começo da ronda, e regravei como `histórico + separador + nota nova`. Conferido
por aritmética: 854 + 1783 + 73 do separador = 2710 gravados.

Regra gravada no `learn-cli` (id 881): **nota de incidente se CONCATENA, nunca se
sobrescreve.** A ronda que vier depois de mim herda isso.

---

## Avisei o Johnny na hora (não esperei o relatório)

São pagantes travados com prazo. Telegram `message_id 204`, pedindo o "pode" pra:

1. **E-mail pros 9 parados** com o número certo (custo zero). Dois vencem em 48h:
   `dirceu` (22/08) e `jrfengenhariadf`/`richard.moraes` (25/08).
2. **E-mail pros 3 antigos** (marcelo, claudio, ivanilde) — o texto que iam receber tinha o
   mesmo número errado.
3. **1 geração de GPU** pra dar veredito ao piloto da Katia antes de 22/08 12:00 UTC.

Nada de e-mail enviado, nada de GPU gasta, nada de crédito mexido nesta ronda.

---

## Passo fixo de fim de ronda

Conferência de `origin/main..HEAD` e de fix preso em branch registrada no fim deste arquivo,
no commit desta prova.
