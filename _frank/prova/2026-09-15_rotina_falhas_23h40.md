# Rotina das falhas — 15/09/2026, 23h40Z (20h40 BRT)

Dono da fila (14-A). Li `_frank/ordens/README.md`, a de **20/08** (dono da fila),
a de **21/08** (serial + regra 8), a de **27/08** (só erro de sistema vira
chamado) e a de **29/08** (planilha desligada). **Nada da planilha foi lido,
escrito, classificado ou reprocessado.** Canal: por ordem de **31/08**, o aviso
desta ronda saiu **no grupo**, e só no grupo.

Ronda anterior das falhas: **22h40Z**. Abertura desta: **23h41Z**.

Peguei o **`#11`** (`9ac03612`) — **o mais antigo da fila inteira, 56,1 dias**,
`[open]`, que tinha **reaberto sozinho às 22:23Z** depois da 4ª ocorrência às
**21:46Z**. Escolha pela regra 8 sem empate: é o mais velho e tinha aluno
parado na véspera.

**O que esta ronda entrega:** o `#11` estava aberto desde 21/07 esperando **uma
coisa só** — um diagnóstico que nunca vinha. Nesta ocorrência ele **veio**. É a
primeira vez em 56 dias que a falha nasce com causa legível, e o instrumento que
a produziu foi construído por rondas anteriores que se recusaram a fechar o
cartão sem ele.

---

## 1. 🟢 O instrumento funcionou — e isso é medição, não comemoração

A nota de **27/08** deixou a régua escrita, e ela é literal:

> *"a PRÓXIMA ocorrência nasce com `trainer_returncode` + traceback (137 =
> OOM-killer, 139 = SIGSEGV, 1 = exceção Python) e aí se decide se é recurso ou
> código."*

A 4ª ocorrência caiu **15/09 21:46:06Z** (job `c90ff577`, voz `f58a158a`, RunPod
`b8d3e030-…-e2`). O banco gravou:

| campo | valor |
|---|---|
| `trainer_returncode` | **1** |
| `trainer_stderr` | **2000 chars**, com traceback completo |
| `error_message` | `"trainer failed"` (a string genérica de sempre) |

**O controle que torna isso prova e não impressão:** no mesmo `SELECT`, as **3
ocorrências anteriores** (27/08, 22/08 ×2) têm `trainer_returncode = NULL` e
`trainer_stderr = NULL`. A diferença não é sorte — é o **PR #67** (produção desde
27/08 11:46Z) mais a **migration 97** (aplicada 28/08 18:05Z, com aval do
Johnny). As duas entregaram exatamente o que prometeram, e só dá pra afirmar
isso agora porque a falha voltou.

## 2. 🔴 A causa da 4ª ocorrência, com o texto do próprio trainer

`rc=1` = **exceção Python**, portanto **não** foi OOM-killer (137) nem SIGSEGV
(139). O traceback morre em
`VoxCPM/src/voxcpm/modules/minicpm4/model.py:235` (`down_proj`/`up_proj`), dentro
de `F.linear`:

> `torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 24.00 MiB. GPU 0
> has a total capacity of 94.97 GiB of which 16.88 MiB is free. Process 560 has
> 7.95 GiB memory in use. Including non-PyTorch memory, this process has 11.93
> GiB memory in use.`

**Resposta à pergunta que o cartão fazia desde 21/07: é RECURSO (VRAM), não
código.**

### 2.1 O número que muda a leitura

O **nosso** processo segurava **11,93 GiB** de um cartão de **94,97 GiB** e
morreu pedindo **24 MiB**. A placa estava cheia **por fora da nossa alocação** —
não foi o nosso treino que cresceu.

Isso **derruba**, para esta ocorrência, a hipótese do 21/07 (vazamento nosso de
VRAM, curado no `fdcc75c`). Se fosse vazamento nosso, o número grande estaria do
nosso lado. Ele não está.

## 3. 🟠 O que eu me recusei a cravar

A atribuição de **quem** encheu o cartão **não está provada**, e esta base já
cravou causa errada duas vezes. A mensagem enumera só `Process 560` (7,95 GiB) +
o nosso (11,93 GiB) = **~20 GiB dos 94,97**, deixando **~75 GiB sem dono
visível** — o PyTorch não enxerga processo de outro container. Ficam **duas
hipóteses vivas**, e eu as declaro como hipóteses:

- **(A) vizinho externo** no mesmo físico da RunPod;
- **(B) concorrência NOSSA** — e isto eu medi: os jobs `91f70b44` (21:51:13Z) e
  `db399bb8` (21:51:58Z) foram despachados **dentro dos últimos 62 segundos de
  vida** do job que morreu (fim 21:52:15Z). Os dois terminaram bem (414s e 303s).

A coincidência de janela é **forte demais pra ignorar e fraca demais pra
afirmar**: 2 jobs × ~12 GiB não explicam 75 GiB. Deixei no cartão o **teste que
decide**, para quem pegar: conferir se o endpoint de treino da RunPod permite
mais de um worker por GPU física e correlacionar sobreposição de jobs × OOM.
Enquanto isso não for feito, **(A) e (B) valem igual**.

## 4. O que está descartado, com medição

- **INSUMO DO ALUNO** — fiz o passo da armadilha (**listar os arquivos ANTES de
  olhar worker/ffmpeg**): `raw_audio_paths` tem **3 arquivos, os 3 `.ogg`**
  (WhatsApp Ptt), `duration_seconds=1696` (28 min). **Zero imagem** na lista: a
  classe `910ea757`/`8d370ef5` (foto do Drive em `raw_audio_paths`) está
  **descartada aqui**. E os **mesmos 3 arquivos** treinaram em **296s** uma hora
  depois, sem tocar em nada.
- **TAMANHO** — 28 min é pequeno perto dos 131,5 min do `franwd82` (27/08), que
  também falhou. Tamanho não explica os dois.
- **DISCO CHEIO** (10/08, `cd06139d`) — não é `Errno 28`; o traceback é de VRAM.
- **CÓDIGO DO TRAINER** — `rc=1` com `OutOfMemoryError` é falta de memória, não
  erro lógico.

## 5. Taxa de base, medida

Desde a migration 97 (28/08 18:05Z): **370 treinos — 369 `completed`, 1
`failed`**. **0,27%.** A falha é rara **e** transitória: repetir o mesmo insumo
funcionou nas **duas** vezes em que alguém repetiu.

Registro o número porque a objeção permanente contra retentativa é *"gasta GPU
sem o aluno pedir"* — e o tamanho real do gasto é **parte da decisão**, não
detalhe.

## 6. 🟢 O aluno da 4ª ocorrência não está esperando (conferido por mim)

Não herdei o relato da ronda anterior; reconferi no banco.

`ricardoolito@gmail.com` (uid `fdcaee5e`): voz `f58a158a` **`ready`**,
`trained_at` **22:53:07Z**, `lora_path` preenchido, RunPod `683f0d28-…-u2`.
Aviso ao aluno gravado em `onboarding_ready_email_at` **22:53:08Z**.

**Dinheiro conferido por `ref_type`, nunca por `kind`** (armadilha de 20/08):
`credit_transactions` do uid devolve **ZERO linhas**. Nunca foi cobrado, logo
**não havia nada a estornar** — o retreino saiu por conta da casa porque a falha
foi nossa. Os outros 3 e-mails do chamado já estavam apurados na nota de 27/08
18h e nada mudou.

## 7. 🔴 Abri o `#422` — a prevenção, que não existe

`bb4d4cd0` (**#422**, `frank:treino-transitorio-sem-retentativa`, `open`,
`categoria='tecnico'`).

**Não existe retentativa.** Conferido em código, não por impressão:

| onde | o que tem |
|---|---|
| `finalize-training.ts:416` | `const nextStatus = success ? "ready" : "failed"` — **único destino**. Sem reenfileiramento, sem contador, sem backoff |
| `runpod-worker/jobs/train.py`, `voice_pipeline/training.py` | `grep` por `retry/retries/max_attempts/tentativa` devolve **1 linha**, e é comentário do snap da referência |

**O recorte é estreito de propósito:** retentativa só para falha **transitória de
recurso** (`rc=1` com `OutOfMemoryError`, `rc=137`, `rc=139`). Falha de
**insumo** (`"no usable speech segments after VAD/chunk"`, 3 casos em 22/08) fica
**de fora** — repetir aquilo não cura e só queima GPU.

### 7.1 Quem paga a conta hoje, e por que o estorno não resolve

Para quem foi cobrado, `finalize-training.ts:165` estorna automático (*"culpa
NOSSA, não do usuário"*): fica sem a voz, mas com o crédito de volta.

**O comprador do SGP não tem nem isso.** Ele nunca é cobrado (o clone é entrega
do produto que ele já pagou), então **não há estorno para amaciar nada** —
`finalize-training.ts:519`, e conferido no extrato do Ricardo: **zero linhas**.
Ele simplesmente fica sem a voz. E, pelo **`#421`**, também **não consegue
refazer o pedido sozinho**.

As duas lacunas se somam: **falha transitória + nenhuma retentativa + nenhuma
porta de refazer = aluno parado por tempo indeterminado.** Nos dois casos
conhecidos quem repetiu foi **um agente, à mão, porque passou por ali**.

## 8. Por que o `#11` continua `investigating` e não `fixed`

O diagnóstico foi entregue, mas **nada foi consertado**: a OOM pode repetir
amanhã e estrandar outro aluno do mesmo jeito. Marcar `fixed` seria fechar em
cima de **um retreino que deu certo**, que é exatamente o erro que as notas de
27/08 e 28/08 se recusaram a cometer (regra 14).

**Nova régua pra fechar, verificável e sem prazo elástico:** (i) o teste do §3
decidir entre (A) e (B); **e** (ii) havendo decisão do Johnny sobre retentativa,
ela estar **em produção**. Sem os dois, não fecha — e se fechar sozinho por 30
dias sem reincidência, **que feche dizendo que fechou por silêncio, não por
cura**.

## 9. 🟠 Para o Johnny — o que é dele e não meu

- **Retentativa automática para OOM transitória.** Diagnóstico pronto, recorte
  definido, custo medido (**~1 treino extra a cada 370**). **Não implementei e
  não abri PR**: gasta GPU, e a ordem é clara. `#422` está aberto esperando o
  "pode".
- **Caminho barato, se preferir:** mesmo sem retentativa, hoje a falha
  transitória **não gera nenhum aviso acionável** — vira voz `failed` e some. Um
  alerta *"treino morreu com OOM, candidato a repetir"* já tiraria o resgate do
  **acaso de horário**, que foi como os dois casos conhecidos foram salvos.

## 10. 🔴 Achado de processo: trabalho de aluno preso em branch, de novo

O checkout principal (`/mnt/Data/Projetos/PlatformLucasArrial`) estava **na
branch `feat/sgp-gerado-vs-entregue`**, com **2 commits nunca enviados** e
**3 arquivos modificados sem commit**, parados desde **23:03Z**:

```
80f9576 fix(sgp): PRONTO vira GERADO e ENTREGUE exige que o aluno tenha sido avisado (recado 6)
136087c test(sgp): cobre o corte GERADO/ENTREGUE, 'Nao iniciou' e a regua dos 7 dias
```

`git ls-remote` não achava a branch no origin e `gh pr list` não achava PR: o
trabalho existia **só naquele disco**. É a repetição exata do que custou 9h em
19/08 — e desta vez com o agravante de estar **no checkout principal**, que é o
que qualquer ronda seguinte usa.

**O que eu fiz e o que não fiz:** empurrei a branch para o `origin` para o
trabalho **parar de existir só num disco**, e **não abri PR** — não fui eu que
escrevi, não posso responder pela completude, e há 3 arquivos sem commit que
deixei **intocados**. Fica visível e recuperável, sem eu endossar o conteúdo.
Esta ronda commitou o log **direto na main por worktree separado**
(`/tmp/wt-main-ronda`), sem tocar no checkout sujo.

---

## Fim de ronda

- `#11` (`9ac03612`): `investigating`, **2 notas novas** (14 no total), com o
  diagnóstico e a régua nova. **Não fechei.**
- `#422` (`bb4d4cd0`): **aberto**, prevenção, esperando decisão de GPU.
- `#420`/`#421`: **não toquei** — o `#421` tem **PR #305** em voo por outra
  ronda rodando em paralelo (`/home/johnny/wt-sgp-painel`), conferido antes de
  agir pra não atropelar.
- Aluno: **nenhum dos 4 do `#11` está esperando**. Nada a estornar (zero linhas).
- GPU gasta nesta ronda: **nenhuma**. Migration aplicada: **nenhuma**. E-mail a
  aluno: **nenhum** (ninguém esperando).
