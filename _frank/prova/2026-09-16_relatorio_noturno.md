# 16/09 ~01hZ — Relatório noturno do dia 15/09 (consolidado)

Fecho do dia. Varredura rodada do zero nesta ronda (`varredura_travados.cjs`,
saída inteira em `/tmp/varredura_1509.txt`), números conferidos no banco, e a
mensagem do dia postada **no grupo** (ordem de canal de 31/08).

---

## 1. O que eu resolvi nesta ronda

### 1.1 Eric Malzone — o único aluno realmente parado, e ele estava só anotado

A ronda do Vigia das 00hZ achou o caso e **escreveu, com todas as letras, que
não falou com o aluno** ("Não respondi aluno"). Então o achado estava no papel e
o Eric continuava esperando, com o relógio correndo.

Medido antes de escrever:

| | |
|---|---|
| conta | `ericb.malzone@gmail.com` (930a8e35), criada 10/09 |
| voz | `d5ae61ac` — `awaiting_training` desde **13/09 10:30Z** (3 dias) |
| áudio | **13 arquivos** `.ogg` de WhatsApp, todos no R2 |
| créditos | **100.000** (treino custa 10.000) |
| acesso | até **17/09** — 2 dias |
| vozes `ready` | **0** |
| `error_message` | `null` (a tela não estava mentindo sobre saldo) |

**Por que ele parou, e é do nosso lado:** `duration_seconds` é `null` e o status
mudou **31 min** depois da criação. Isso é a assinatura do
`rescue-stuck-uploads` (`STUCK_AFTER_MS = 30min`, ramo `!est.reliable`), não do
browser — ou seja, o `uploads-complete` **nunca foi chamado**: a aba dele morreu
no meio e o servidor recuperou os arquivos sozinho. O aluno viu uma tela
quebrada; o servidor consertou por trás **e não avisou ninguém** (não há uma
linha de e-mail/notificação em `rescue-stuck-uploads.ts`).

**Ação:** e-mail individual enviado 16/09 — *"Sua voz está pronta pra treinar —
falta um clique"*. Cópia **confirmada nos Enviados, uid 2492**, bcc `suporte@`.
Rascunho em `_frank/rascunhos/2026-09-16_eric_malzone_voz_esperando_treino.html`.

**Não treinei por ele.** O treino gasta crédito **dele** e quem decide é o aluno
— o próprio `rescue-stuck-uploads.ts` diz isso no cabeçalho. Zero GPU, zero
crédito tocado.

⚠️ Conferi o link e o rótulo antes de mandar, em vez de escrever de cabeça:
`SITE_URL` é `fastcloner.com` (**não** `.com.br`, que foi o que eu ia escrever) e
o botão é **"Iniciar treinamento"** (`panel.start`), renderizado em
`voice-status-panel.tsx:121`. Dica que aponta pra botão inexistente é mentira
nova.

### 1.2 A classe do #137 NÃO voltou em massa — e eu quase reportei que sim

O sensor mostra **10 vozes** em `awaiting_training` com ≥10k créditos e sem aviso
de saldo, a mais velha de **61 dias**. Parece um incêndio. Não é, e o teste que
desmente é o mesmo que o #137 usou em 26/08: **9 dos 10 donos já têm voz
`ready`** — é entulho de primeira tentativa, comportamento normal. Só o Eric tem
**zero**.

| dono | voz | parada | vozes `ready` |
|---|---|---|---|
| `ericb.malzone@` | d5ae61ac | 3d | **0** ← único caso real |
| `digital@semente.agr.br` | e589ab24 | 17d | 2 |
| `danielvsferreira@` | c02a570d | 24d | 2 |
| `scheibelmarcelo2@` | 970eae70 | 30d | 1 |
| `agshortcut@` | fb3c943a | 31d | 8 |
| `institutoforumpublico@` | fcd31c33 | 46d | 2 |
| `vinicharge@` | 3dbc1665 | 49d | 1 |
| `jolenesaraiva@` | 2fc175b7 | 55d | 2 |
| `natali.marcio@` | 6ca0903a | 58d | 2 |
| `lucas.m.arrial@` | 9b6e9c79 | 61d | 2 |

**1 caso em 20 dias**, não 10. Anotei no `a3ced7ac` (#137) sem reabrir e sem
mexer em status (14-A).

### 1.3 A objeção do Vigia ao conserto do #137: procede pela metade

Ele escreveu que o conserto "foi de rótulo". Fui conferir na fonte antes de
repetir, porque eu estava a um passo de reportar uma regressão que **não
existe**:

- ✅ **O conserto está no ar.** `"awaiting_training": "Falta você treinar"` está
  em `messages/pt-BR.json:99` — a badge da **lista**, que é o que o #137
  consertou (merge `37d982f`).
- ⚠️ **O que nunca foi tocado é o painel de detalhe**, e ele fala com o aluno em
  jargão nosso: `panel.awaitingTitle` = *"Pronta para treinar"* e
  `panel.awaitingBody` = *"Áudios validados e armazenados no **R2**. Clique
  abaixo pra disparar o treinamento no **RunPod**"*. R2 e RunPod são nomes
  nossos; o aluno não tem como saber o que são.

Isso é **clareza de texto**, não a falha do #137 — por isso virou nota, não
chamado novo nem reabertura.

---

## 2. O que subiu pra produção (conferido no servidor, não na Action)

- **`BUILD_ID` no servidor:** `P4-k75tZTKmymRw0mFtNI`, compilado
  **16/09 00:48:53Z**.
- **pm2 `aiverse`:** `online`, uptime 12min na hora da conferência.
- **Prova de conteúdo, não só de horário:** o código de `"Avisei o aluno"` (PR
  #306, mergeado 00:45Z) **está presente** em `src/` no servidor
  (`admin/sgp/page.tsx`, `api/v1/admin/sgp/route.ts`, `lib/sgp/types.ts`). O
  build é posterior ao merge e contém o merge.
- `origin/main` na ponta: `ea0d6b91`.

15 PRs mergeados no dia: #289, #290, #292, #293, #295, #296, #298, #299, #300,
#301, #302, #303, #304, #305, #306.

11 incidentes fechados no dia: #402, #47, #405, #407, #411, #265, #417, #270,
#392, #416, #420.

---

## 3. Estado geral (medido nesta ronda)

| número | agora | o que mudou |
|---|---|---|
| incidentes abertos | **84** | — |
| aguardando aluno | **24** | 7 deles parados 7d+ → pedem 2ª tentativa |
| recados na fila (`para_frank_*`) | **96**, mais antigo **291h** (12d) | **piorou**: eram 64 @ 223h em 10/09 |
| itens presos na varredura | **1** | `training_jobs ebf5cc56` → voz `f4b9b0f2` já `ready`: escrituração pendente, **ninguém esperando** |
| pagante/acesso vivo sem voz pronta | **1 → 0 esperando** | era o Eric; avisado nesta ronda |
| fechado sem retorno humano | **1** (#407) | aluno reescreveu e o cartão re-fechou |
| lista de estorno | em dia | 10 tipos, 3.285 linhas varridas, nenhum tipo desconhecido |

⚠️ **O número que piora sozinho é a fila de recados:** 96 esperando, o mais
antigo há 12 dias. Não é silêncio saudável — é trabalho identificado que ninguém
pegou.

---

## 4. Armadilhas que a rotina avisa, e que pegaram de novo hoje

Três consultas voltaram **erro**, não zero — e se eu tivesse lido o vazio como
"nada preso", o relatório sairia limpo e falso (§Armadilhas do `03_ROTINA.md`):

1. `incidents.updated_at` **não existe** (é `created_at`/`resolved_at`);
2. `voices.sample_count` **não existe**;
3. `array_length()` não roda em `jsonb` (é `jsonb_array_length`).

Todas conferidas pelo `error` da resposta antes de acreditar no resultado.

---

## 5. O que eu NÃO fiz, de propósito

- **Não treinei a voz do Eric** — crédito dele, decisão dele.
- **Não reabri o #137** e não mexi em status nenhum.
- **Não mandei e-mail em lote** pros outros 9 de `awaiting_training`: eles já têm
  voz pronta, então seria ruído — e lote acima de ~10 precisa do Johnny.
- **Não prometi nada à Maria Teresa.** Reembolso de dinheiro em nome da empresa
  não é minha alçada (§06). Vai como pergunta binária no relatório, e é o item
  mais urgente do dia.
