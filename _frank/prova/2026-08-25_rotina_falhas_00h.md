# Rotina das Falhas — 25/08/2026, ~00h40–01h00 UTC (Claude)

Método serial (regra 8): **continuei o mesmo incidente da ronda anterior** —
o `#72` — em vez de abrir frente nova. Ele tinha uma vítima não tratada com
nome e sobrenome, e isso é "não terminou", não "pegar outro".

`git checkout main && git pull --ff-only origin main` → trouxe `42e3b68`.
Índice de ordens lido. Valem a `2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐),
a `2026-08-20_REGRA_FINAL_CREDITO.md` e a `2026-08-21_passagem_incidentes_para_claude.md`.

---

## O caso: `#72` (`2c5bab42`), UPLOAD SILENCIOSO — 2ª vítima, `leandro.fitoway`

A ronda das 23h50 mediu os 7 afetados do incidente e achou **dois que nunca se
recuperaram**: `jrfengenhariadf` (tratado lá) e `leandro.fitoway`, que ficou
explicitamente **não contatado**. É o item que estava no meu colo.

**25 dias parado. Pagante ativo, 97.620 créditos, acesso até 29/08.** Nunca
recebeu e-mail nenhum — conferido na pasta Enviados antes de escrever
(`--enviados --para`: *nada encontrado*).

### O que eu medi (não é inferência)

**No R2**, prefixo da voz `a6bc8184`: **6 objetos**, índices
`006 007 008 010 012 013` de 14 → faltam `000–005`, `009`, `011`. Os seis foram
gravados entre **19:02:59 e 19:03:02** de 30/07: o envio durou **3 segundos** e
parou.

**Baixei os 6 e medi com ffmpeg** (`silencedetect -35dB`, leitura, sem GPU,
sem crédito):

| | bruto | fala | razão |
|---|---|---|---|
| os 6 que chegaram | 575s (**9min35s**) | 561s (**9min21s**) | **0,976** |
| projeção p/ os 14 | **22,4min** | **21,8min** | — |

Gravação limpíssima (97,6% de fala). E a projeção passa nas **duas** réguas:
porta 20min brutos, treino 10min de fala limpa.

> ⚠️ **Diferença que muda a resposta**, e por isso medi antes de escrever: o
> **jrf** projetava ~18min e **seria recusado de novo** se eu só dissesse
> "reenvie". O **leandro** tinha áudio suficiente — ele não tem voz **só** por
> causa do nosso upload. Mandar a mesma carta pros dois teria sido errado num
> dos dois casos.

### O que eu fiz — fato consumado

**E-mail individual enviado** (regra 8, 21/08: individual sobre caso que estou
tratando é decisão minha). **00:47:30Z**, assunto *"Sua voz: 8 dos seus 14
arquivos nunca chegaram - a falha foi nossa"*.
**Conferido na pasta Enviados depois de gravar: uid 67, 4KB.** Isso prova
**envio**, não prova **entrega**.

O que a carta diz: (a) 8 de 14 arquivos não chegaram, com a numeração exata, e
a falha foi nossa; (b) a gravação dele **servia** — com os números medidos;
(c) reenviar os mesmos áudios **+3 a 5min de folga**, porque 22,4min é
projeção e a margem sobre a porta é de só 2,4min; (d) as **duas** réguas
explicadas; (e) como evitar a queda (a voz se chama *"Teste de voz pelo
iphone"* — orientei enviar pelo computador ou manter a tela acesa);
(f) **não prometi que o defeito está 100% corrigido, porque não está**;
(g) 97.620 créditos intactos, nunca foi cobrado.

**Crédito: nada a estornar.** Nunca houve débito por esta tentativa —
o treino não chegou a ser disparado.

**Duas notas gravadas no `#72`** (`anotar_incidente`, concatena):
15 → 16 → **17 notas**, conferido na releitura, 1 linha afetada.

---

## O achado que explica os 25 e os 30 dias

Fui atrás de **quem** escreveu `raw_audio_paths` pela metade, porque isso muda
o diagnóstico do incidente inteiro.

**Não foi o browser.** `voice-creator.tsx:369-374` **aborta** se qualquer PUT
rejeita e nem chega a chamar `uploads-complete`; e a linha 377 manda
`slots.map(...)` — **todas** as chaves. Se tivesse passado por ali, o registro
teria 14 chaves, não 6. E esse aborta existe desde `4848826` (**22/07**),
**antes** das duas vozes (jrf 25/07, leandro 30/07).

**Foi o servidor, e corretamente:** `rescue-stuck-uploads.ts:170-179` lista o
R2 e grava **o que achou** — já com `contarSlotsDoEnvio` +
`mensagemEnvioIncompleto`. Ou seja:

> O defeito é **a aba/conexão morrer entre os PUTs e o `uploads-complete`**, e
> ele **NÃO está corrigido** — continua possível. O que foi corrigido em 21/08
> foi a **mensagem** parar de culpar o aluno.

### E o buraco que custou 25 e 30 dias

**No caminho self-service ninguém avisa o aluno.** Conferido nos imports:
`rescue-stuck-uploads.ts` e `uploads-complete/route.ts` **não importam nenhum
módulo de e-mail**. Só o caminho do **onboarding/planilha** avisa
(`import/route.ts:362`).

Então a voz vira `rejected_too_short`, a mensagem honesta é escrita numa linha
que o aluno só lê se voltar na tela, e **ninguém escreve pra ele**. Foi
exatamente isso com o jrf (30 dias) e o leandro (25 dias) — **os dois
pagantes**.

**Não subi correção pra isso de propósito.** Criar aviso automático pra todo
`rejected_too_short` é comportamento **novo** de e-mail em massa, e a **regra 1
do `onboarding/avisos.ts`** (do Johnny) diz que **erro NOSSO não vai pro
aluno**. A leitura honesta aqui é que só o aluno pode agir (reenviar), mas
**quem decide é ele**. Proposto no Telegram, não executado.

---

## O que eu conferi e NÃO virou trabalho

**`ycarlosk@gmail.com`** apareceu novo na varredura (pagante, 100.000 créditos,
acesso até **26/08**, voz recusada com 1min). Parecia 3ª vítima do `#72`.
**Não é:** 1 arquivo só, índice `000` de 1, prefixo `onboarding_` — veio pela
**planilha**, sem buraco de numeração. E o caminho do onboarding avisou:
**4 e-mails na pasta Enviados** (uid 4–7, 24/08 12:36Z). Aluno informado, dono
existe, não mexi.

---

## Fila no fecho

Sem mudança de status por mim. **`#72` continua `investigating`** — e continua
certo que esteja:

- o defeito de envio interrompido **não está corrigido**, só mitigado;
- o `jrf` depende de **decisão do Johnny** (acesso vence **25/08 12:00 UTC**);
- o aviso do caminho self-service depende do **"pode"** dele.

Fechar agora seria trocar "medi e avisei" por "resolvi". Regra 14 inteira.

## Ressalvas que eu não mascaro

- **A projeção dos 22,4min é projeção**, não medição — os 8 arquivos perdidos
  não existem pra medir. Está dito assim no e-mail e aqui.
- **Envio ≠ entrega.** Tenho o uid 67 na pasta Enviados; não tenho confirmação
  de leitura, e bounce não escreve em lugar nenhum (buraco do detector já
  registrado na ronda das 20h).
- **`ler_caixa.cjs` mostra acento quebrado** (`OlÃ¡`) — defeito do nosso
  leitor, não do que o aluno recebe (já provado na ronda das 23h50). Não
  "consertar" o remetente por engano.
- **`resolved_at`/`resolved_commit` do `#72` seguem preenchidos** (21/08,
  `cd470fc`) num incidente `investigating`. O conserto existe e está órfão em
  `origin/feat/incidents-resolved-at` (198 commits atrás da main, carrega
  migration 86, **sem PR**). Não mergeei — mesma armadilha STALE de sempre.
- **Nomes dos arquivos do leandro têm dígitos injetados** (`WhatsA2pp`,
  `Whats4App`, `2026-072-30`). É cosmético (a chave é só nome, o áudio abre e
  mede normal) e **não** é a causa de nada aqui. Registro pra não virar caça
  ao fantasma numa próxima ronda.

## Regra 7: o grupo do Lucas segue inalcançável — **4ª ronda seguida**

Medido de novo, não herdado: `avisar_grupo.cjs` aborta com
`WAHA_API_URL/WAHA_API_KEY ausentes nesta máquina`. E o `--fato` do **PR #37**
continua **fora da main** — o script ainda exige `--assunto`/`--pergunta`.
O fato desta ronda foi pro **Telegram**. Isso precisa de provisionamento, não
de mais uma anotação.

## Sobra pro próximo turno

- **Decisão do Johnny no `#72`/jrf até 25/08 12:00 UTC** (~11h desta ronda).
- **`#124`** (Dr. Negrini) vence na **mesma** fronteira, 25/08 12:00 UTC.
- **`#99`** (Luciano) — reembolso, espera Lucas/Johnny.
- **Proposta do aviso self-service** — espera o "pode".
- **`#15`** travado na env `FASE_TELEMETRIA_SECRET` (passo do Johnny).
- **WAHA nesta máquina** — sem isso a regra 7 não é cumprível daqui.
- Se o leandro responder, **acompanhar o treino de perto** (prometi isso a ele).

## Fim de ronda, passo fixo

- `git fetch origin && git log --oneline origin/main..HEAD` → conferido, e este
  log vai **na main**, não em branch.
- **Nenhum código alterado** nesta ronda → nenhum PR, nenhuma branch.
- **Nenhuma migration aplicada** → nada a conferir por DDL.
- **Nada gastou GPU nem crédito**: só leitura no R2 e ffmpeg local.
