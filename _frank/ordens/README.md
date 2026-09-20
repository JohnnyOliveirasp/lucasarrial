# Ordens — qual vale

Ordem é **datada e substituível**; o manual (`01`–`06`) é permanente. Quando
as duas discordarem, **a ordem mais nova vence** e o manual é corrigido em
seguida.

## Como ler

1. **Comece por este índice.** Ele diz qual é a ordem vigente de cada assunto.
2. Ordem superada leva um bloco `⛔ SUPERADA` no topo dizendo o que morreu e
   quem a substitui. **Se não tem o bloco, ela vale.**
3. Chegaram várias no mesmo dia? Ordene por horário e leia **todas antes de
   tocar em qualquer coisa** — a última pode anular parte da primeira.
4. **Na dúvida entre duas, pergunte.** Nunca escolha em silêncio quando envolve
   dinheiro de aluno. Aconteceu em 18/08 e foi o Frank quem pegou.

## Regra de canal (atualizada 20/08 — ver `2026-08-20_canal_telegram.md`)

> **Se eu preciso EXECUTAR aquilo, vai no git. Se é pra alguém SABER, vai no
> Telegram.**
> DDL, código, saída de comando, lista, consulta, ordem — **commite**, que eu
> leio do repositório: histórico, autoria e diff. Mensagem some, commit fica.
> O grupo **BrothersAI** (Johnny + Frank + Claude, mesmo bot, prefixo de quem
> fala) carrega o ping e a conversa em português — curto, sem jargão, porque o
> Johnny lê no celular.
> **Nunca no Telegram:** segredo (token, chave, senha), bloco de código ou
> saída de comando, e dado que identifique aluno sem necessidade.

## ⛔ ENCERRADO — regra de crédito (20/08)

**`2026-08-20_REGRA_FINAL_CREDITO.md`** — *"Aluno pagou, tem créditos. Parou de
pagar, não terá mais créditos novos e usa os que tem até acabar."* Dita pelo
Johnny, assunto **fechado**. Aplique e feche; não escale, não refine, não
reabra.

## ⭐ LEIA ESTA PRIMEIRO (20/08)

**`2026-08-20_dono_da_fila_e_fila_zerada.md`** — você é o DONO da fila (regra
14-A: o Vigia abre e anota, você decide e fecha), a fila está ZERADA, e as 3
coisas que sobraram + as armadilhas medidas hoje.

## ⭐ Anterior

**`2026-08-19_ULTIMOS_5.md`** — as 5 últimas verificações pra prova fechar.
Watchdog já está provado e encerrado. As ordens abaixo viram referência.

## Rotina permanente

**`2026-08-19_rotina_das_falhas.md`** — de hora em hora, olhar a fila de
incidentes, corrigir pelo playbook e fechar. Um relatório por dia, mesmo em
dia limpo. Enquanto o vigia noturno não existe, **o Frank é o vigia**.

### 📬 Passo fixo da ronda, desde 18/09: reconciliar os envios

```bash
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

**Por que é passo fixo e não ferramenta de ocasião (#101).** A carta mandada de
um **worktree descartável** sai pro aluno e não entra em livro nenhum: medido em
18/09, **106 de 117** cópias do `enviar_email.cjs` na máquina não têm
`registrarEmEnviosDaCasa`, e o ledger local é **gitignored** — morre junto com o
worktree. Consertar "o código da main" nunca fecha esse buraco, porque as cópias
furadas nascem mais rápido do que se conserta (99 → 106 em uma hora).

O que **sobrevive** a qualquer checkout é a pasta **Enviados** do IMAP, que é
remota. Por isso a reconciliação lê a pasta, não o ledger — e por isso ela
precisa rodar **toda ronda**: é o controle compensatório do buraco, não um
conserto de uma vez só. **Ronda que não rodar isto deixa o buraco voltar em
silêncio.** O `enviado_em` sai do cabeçalho `Date` da carta (a coluna tem
`default now()`: gravar sem data diria que a casa escreveu HOJE pra quem não
recebe nada há dias) e a linha nasce com `origem='reconciliado-da-pasta'`,
porque linha remontada não pode se passar por registro feito na hora.

Confira com o irmão de leitura, que é instrumento independente:
`node _frank/ferramentas/2026-09-18_enviados_x_tabela.cjs` — o veredito tem que
dizer **0 carta depois do corte**.

⚠️ **As 77 cartas anteriores a 14/09 14:06:31Z seguem SEM decisão** (é o que o
`--corte` exclui). Escriturá-las é defensável, mas `contato-tentativas.ts`
declara `cobreDesde` obrigatório e anuncia cobertura a partir da migration 108 —
mexer nisso é decisão de produção, não de ronda. Quem for decidir, decida com o
`cobreDesde` na mão.

## Vigentes

| Assunto | Ordem que vale |
|---|---|
| 🗺️ **O FLUXO: quem olha o quê e como se chama socorro** | `2026-08-20_fluxo_quem_olha_o_que.md` |
| 🎯 **VIGIA: só erro de SISTEMA vira chamado** (atendimento/processo/decisão vão pro grupo/Telegram; dinheiro exige `ref_id` + `arquivo:linha`) | `2026-08-27_vigia_so_erro_de_sistema.md` |
| 🌙 Turno da noite: **NÃO roda de madrugada** (Johnny 27/08; Executor 08h–23h BRT) | `2026-08-20_decisoes_55_trancadas_e_turno_noite.md` (item 2, ⛔ superado) |
| 🔴 Correções da ronda de 20/08 (janela do QA, worktree) | `2026-08-20_correcoes_da_ronda.md` |
| 💬 Canal: Telegram + git, e como ligar o teu lado | `2026-08-20_canal_telegram.md` |
| **Crédito: quem perde, quem mantém** | ⭐ `2026-08-20_REGRA_FINAL_CREDITO.md` — substitui TODAS as anteriores do assunto |
| Gate das telas (Roteiro, Edição, Settings) | `2026-08-18_gate_por_credito.md` |
| Congelar a lista + trial × venda | `2026-08-18_ok_para_executar.md` (itens 1 e 3) |
| Vigia noturno | `2026-08-18_vigia_noturno.md` |
| Prova de capacidade | `2026-08-18_prova_de_capacidade.md` |
| ⚠️ **SUSPENSA** — Como saber se "já pagou" (migration 79) | `2026-08-18_migration_ja_pagou.md` — **NÃO use a coluna `profiles.ja_pagou`.** O backfill dela nunca saiu: medido em 25/08, `ja_pagou = false` em **1.515 de 1.515** perfis, `ja_pagou_em`/`ja_pagou_origem` nulos em todos. A coluna carrega ZERO informação e lê **"nunca pagou" para todo mundo, inclusive para pagante** — conferido no mesmo dia num caso real (Rafael, `rafapaga@uol.com.br`, acesso Hotmart até 03/09, `ja_pagou = false`). Quem seguir esta ordem ao pé da letra nega crédito a quem pagou. **Enquanto isso, a fonte de verdade é `_frank/ferramentas/pagou_de_verdade.cjs`** (Hotmart viva: `value > 0` **E** status COMPLETE/APPROVED — `OVERDUE` não é pagamento). Incidente `cfcdd6bb` (#129). |
| Canal, conta de teste e prioridade | `2026-08-18_ddl_pelo_git_e_prioridade.md` |
| DDL aprovado + achados da prova | `2026-08-19_ddl_aprovado_e_achados.md` |
| 🖼️ Imagens: refactor de hoje + branch STALE (não mergear `feat/fix-image-upload-retry`) | `2026-08-19_imagens_refatoradas_branch_stale.md` |
| ☁️ **OneDrive: corrigido e no ar — branch STALE, não mergear `feat/onedrive-401`** | O incidente `144` (#144) foi fechado em 26/08 pelo **PR #60** (`feat/onedrive-spo-fedauth`), merge `2dd1150`, deploy SUCCESS 14:49Z. O caminho que vale é o módulo `frontend/src/lib/onboarding/onedrive.ts` (cadeia de redirect → cookie **FedAuth** → `_api/v2.0`). ⚠️ **Existe no origin um branch CONCORRENTE, `feat/onedrive-401`**, com uma tentativa ANTERIOR pro mesmo defeito por outro caminho (token "badger"), que reescreve `links.ts` com um `resolverOneDrive` próprio e **não conhece o `onedrive.ts`**. Ele não tem PR. Se alguém abrir e mergear, **derruba o fix que está em produção** — mesmo risco que o `feat/fix-image-upload-retry` já criou em 19/08. Não mergear; se for descartar de vez, apagar no origin. |
| 🎚️ **Cura de referência: corrigida e no ar — 2 branches STALE no origin, não mergear** | O incidente `#233` foi fechado em 02/09 pelo **PR #151**, merge **`ff06195`** na main. O caminho que vale é `marcarFimDeFrase()` em `_frank/ferramentas/fabricar_referencia.cjs`: fim de frase carimbado na **PALAVRA**, não no segmento do whisper. Medido em produção, regra antiga → nova: Katia `c127b74e` (2979s) **0 → 95** candidatas; Carol `04539483` (306s) 120 → 113, não regride. ⚠️ **Sobraram 2 branches no origin sem PR:** `fix/referencia-fronteira-de-frase-por-palavra` (era o **PR #54**, aberto 25/08 e **fechado por mim em 02/09**) e `feat/fabricar-referencia-fronteira-por-palavra`. O #54 trazia junto uma versão **velha** do `refazer_audio_conta_da_casa.cjs` que **apagaria** o `--texto-arquivo` e a trava de palavras que a main ganhou em `d29959b`. **Não mergear nenhum dos dois** — mesmo risco do `feat/onedrive-401` e do `feat/fix-image-upload-retry`. Se for descartar de vez, apagar no origin. |
| 🖼️ **Foto fora da geração (#74 / `8379549c`): corrigido e no ar — 1 branch STALE no origin, não mergear** | O #74 foi **fechado em 18/09 12hZ**. O que vale em produção é `f48358c` (quadro vazio adota a 1ª foto — o botão Gerar deixa de nascer morto) + **PR #27** (`765da14`, aviso persistente de que a foto nova ficou fora da geração). Conferido por md5 do fonte no Hetzner **idêntico** ao de `origin/main` (`aaf6af8df14c1072ce6fbb0f7376b153`). ⚠️ **Existe no origin o branch `fix/trava-foto-nova-8379549c`** (HEAD `136c4956`, 21/08 16:49Z, **sem PR**): tentativa PARALELA e mais forte pro mesmo defeito — trava **bloqueante** em vez de aviso — escrita nas mesmas horas em que o `f48358c` subiu, e abandonada quando ele subiu. Soma **123 linhas** em `image-studio.tsx`, arquivo que a main moveu em **5 commits** desde a base do branch. Mergear hoje derruba o que está em produção — **mesma família** do `feat/onedrive-401`, do `feat/fix-image-upload-retry` e das 2 da cura de referência. Não mergear; se for descartar de vez, apagar no origin. |
| 🎵 **Ritmo da referência: corrigido e no ar — 1 branch STALE no origin, não mergear** | O **PR #92** saiu do rascunho depois de **24 dias** e está em produção: **PR #379**, merge **`561f6867`**, conferido no conteúdo da `origin/main`. O que vale é `RefCandidate(clip, transcript, cut_mode, wps=None)` em `runpod-worker/voice_pipeline/reference.py` — o `cut_mode` da main (4 caminhos de corte) e o `wps`/`rate_penalty` do #92 **convivendo**, porque eram dois refactors concorrentes da MESMA estrutura, não conflito de texto (foi isso que queimou 2 tentativas de rebase mecânico). Medido antes do merge: 323/323 na união, mutante do `rate_penalty` derruba 3 de 8, `tsc --noEmit` exit 0, colunas da migration 118 conferidas no `information_schema`. Efeito colateral do merge com merge-commit (e não squash): o head do #92 virou ancestral da main, então **a autoria do autor original está preservada** e o próprio #92 consta MERGED. ⚠️ **O branch `fix/ritmo-da-referencia-porta-73a60bb` (head do #92) fica STALE**: ele **não conhece o `cut_mode`** e mergear a partir dele hoje derruba o que está no ar — mesma família do `feat/onedrive-401`, do `feat/fix-image-upload-retry`, das 2 da cura de referência e do `fix/trava-foto-nova-8379549c`. Não mergear; se for descartar de vez, apagar no origin. ⚠️⚠️ **E NÃO confunda as duas Ellens:** este conserto é de **VELOCIDADE DE FALA** e é da **`draellenca@hotmail.com`** (3 vozes, 21-24/08 — é o "Caso Ellen (draellenca)" do cabeçalho da migration 118). Os cartões **#348 (`4ce9f365`) e #500 (`30f2ce07`)** são de **`ellen.atp@gmail.com`** (2 vozes, 09-11/09) e a queixa dela é **ENTONAÇÃO DE PERGUNTA** ("não sobe o tom na interrogação"), que **não tem conserto no ar nem escrito**: medido em 20/09, não existe pitch/F0 em lugar nenhum do `runpod-worker` — os únicos `pitch` (`tts_qa/rate.py`, `tts_settings.py`) são sobre *preservar* pitch ao esticar tempo, e `F0` em `handler.py`/`montage.py` é nome de produto. **Não feche #348/#500 dizendo que o #92 resolveu.** |
| 🔊 Incidentes do QA de completude: medição pronta, falta curar 2 vozes | `2026-08-19_qa_coverage_incidentes.md` |
| 🔊 Resposta à passagem das vozes: quase tudo resolvido; falta re-medir 40 entregas (fecha o fb8d29b7) | `2026-08-19_resposta_passagem_vozes.md` |

## Superadas (leia só pra entender o histórico)

| Ordem | O que morreu |
|---|---|
| `2026-08-20_decisoes_55_trancadas_e_turno_noite.md` **item 1** | ⛔ **assunto ENCERRADO pelo Johnny em 20/08.** Ninguém destrava, ninguém zera, status quo nas 55. **Não reabrir.** O item 2 (turno da noite) segue valendo. |
| `2026-08-18_cancelar_credito_no_vencimento.md` | **"venceu = zera o crédito"** — substituída no mesmo dia por `2026-08-18_regra_final_pagou_fica.md`. Quem **pagou** fica com o crédito e com as portas. Confundir as duas já trancou aluno pagante (20/08). |
| `2026-08-18_ok_para_executar.md` | **item 4.3** — trava por `hasActiveAccess`. Bloquearia quem já pagou. |
| `2026-08-18_147_sem_acesso.md` | a conclusão (os 147 estavam soltos demais, não bloqueados) |
| `2026-08-18_trava_decisao_final.md` | ordem de execução (Hotmart → trava) e o recorte por status |

## O critério que vale hoje, em uma linha

> **Pagamento**, não status de assinatura. Quem já pagou fica com o crédito e
> com as portas. Quem nunca pagou e saiu do trial não gasta.
