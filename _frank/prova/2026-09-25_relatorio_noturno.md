# Relatório noturno — 25/09/2026 (rodou 01:02–01:20Z de 26/09)

Consolidado do dia inteiro, como manda `06_RELATORIO_E_LIMITES.md`. O canal é o
GRUPO (ordem de 31/08): nada foi pro privado do Johnny.

## O que eu medi, e com que instrumento

| pergunta | instrumento | resultado |
|---|---|---|
| fila preso | `varredura_travados.cjs` | **1 preso** (escrituração de `training_jobs`, ninguém esperando) |
| pagante trancado | `pagante_trancado.cjs` | **0** · 1 sem prova (`drfabiovilhena29@gmail.com`, sem subscriber code) |
| percepção travada | `percepcao_travada.cjs` | **0** (controle +/− OK, 573 varridos) |
| pediu pra sair e é cobrado | `saida_x_assinatura.cjs` | **0 sangrando**, 43 já fora |
| parado na decisão do Johnny | `2026-09-22_esperando_johnny.cjs` | **10 conferidos**, mais velho 24d, 29 alunos atrás (+12 não triados) |
| GPU | `api.runpod.ai/v2/<id>/health` | voz: 6 ready, fila 0 · vídeo: fila 0, **2 throttled** |
| deploy no ar | md5sum + BUILD_ID (regra 5-B) | fonte do servidor == `origin/main` byte a byte |

## A fila (medida na ronda das 01hZ, commit 9e16ad6f)

```
167 vivos = 130 abertos (15 open + 115 investigating) + 37 aguardando_aluno
404 fechados = 337 fixed + 67 ignored
95 abertos com 7d+
```

Do dia: **11 fechados** (todos com `resolution_note`), **22 abertos**.

## Dinheiro do dia

Somei `credit_transactions` com `amount > 0` na janela 25/09 03:00Z → 26/09 03:00Z:

```
payment_event       4.800.000 cr   <- compra, NÃO é devolução
react_refund           11.520 cr
video_clone_refund      7.665 cr
image_video_refund      1.320 cr
                   -------------
devoluções do dia      20.505 cr   (teto da regra 9-B: 100.000/dia)
```

Longe do teto. Nada congelou.

## Cartas

**49 cartas para 24 alunos distintos** (`emails_enviados`, mesma janela):
14 ronda-manual · 18 onboarding-aviso · 9 sgp-codigo · 8 fast-resposta.
1 cancelamento executado e confirmado ao aluno (`dionatas@outlook.com`, 23:27Z).

## O achado da noite: #590 — o pm2 mata o app a cada ~4 minutos

Prova no log do próprio pm2 (`~/.pm2/pm2.log` no Hetzner):

```
2026-09-26T01:11:50: [PM2][WORKER] Process 3 restarted because it exceeds
--max-memory-restart value (current_memory=717971456 ...)
```

717.971.456 B = **685 MB**. O teto configurado é 629.145.600 B = **600 MB**.
`grep -c "exceeds --max-memory-restart"` → **172 mortes**; primeira às
25/09 **14:08:49Z**, última às 26/09 01:11:50Z. Por hora de 25/09: 14h=14
15h=11 17h=17 18h=24 19h=23 20h=21 21h=9 22h=1 23h=29 · 26/09 00h=19 01h=4.

Memória ao vivo (9 amostras de 20s, 01:07→01:10Z):
`459 → 477 → 557 → 572 → 553 → 412 → 371 → 372 → 373 MB`.

**Dano medido hoje: ZERO.** 12h COM as mortes contra as 12h ANTES:
`generations` 116/0 falhos contra 45/0 · `image_generations` 101/0 contra 25/0 ·
`video_clones` 66/1 contra 19/0. Nenhuma falha atribuível.

⚠️ **Dois limites que eu NÃO escondi:**
1. O `pm2.log` só começa em **25/09 06:15:15Z** e não há rotacionado. Então
   14:08 é a primeira morte **da janela que o log cobre**, não a data de início
   provada. (armadilha 1: instrumento cego não produz zero medido)
2. Meu script ad-hoc de dano deu **erro** em `react_jobs` e eu não converti isso
   em zero. Ali eu estou cego; quem enxerga é o `varredura_travados.cjs`, e ele
   acusou 1 preso só (escrituração).

Não mexi no teto: subir `max_memory_restart` é mexer em produção fora do fluxo
normal e pede o aval do Johnny. A máquina tem folga (7,7 GB total, 2,8 GB
disponíveis), então 1,5 GB é viável. Virou a pergunta binária 1 do relatório.

## O que subiu pra produção hoje

`BUILD_ID nMgDMVmvEZDmuosacj6hn`, mtime **25/09 20:32:21Z**, conferido por SSH —
não por Action verde. Prova da regra 5-B:

```
contato-ficha.ts        335571ab14e61b12ea439ac1711c8bde  (servidor == main)
contato-tentativas.ts   ac49618057c78b0776f2af37067d0eaa  (servidor == main)
social/access.ts        ab13a7af2c9818753326f62d4ff4a818  (servidor == main)
```

E **nada sob `frontend/` entrou na main depois desse build** (conferido com
`git log --name-only`): os commits posteriores são `_frank/prova/*`,
`_frank/ferramentas/*` e `.github/workflows/worker-tests.yml`. Ou seja, o que
está no ar É a main, e as 172 mortes não são deploy em curso.

Consertos do dia que estão no ar:
- `1164f1bb` (PR #449) — SGP: "refazer entrega" ficou **alcançável**; a rota
  existia e não tinha botão nenhum há 9,8 dias. Fechou o **#421**.
- `7a238076` (PR #429) — o botão de cancelar dentro do app dizia "cancelada"
  antes de tentar, e engolia a falha. Fechou o **#552**.
- `17cdf6d0` (PR #448) — a "pausa entre frases" da tela estava **inerte** com o
  crossfade ligado: 194 gerações de 88 alunos pediram pausa e receberam áudio
  idêntico.
- `c288b515` (PR #445) — `protesto_invisivel` enxergava **13 de 167** chargebacks.
- `4496e687` (PR #450) — ficha de bounce: ausência de carimbo no ledger não é
  prova de entrega.
- `2213a850` — React: o vídeo que o aluno sobe volta a servir no roteiro e na
  geração (#434).
- `82a077d1` — auth não promete código de verificação pra quem já tem conta.
- `c24ebbd1` — o manual da Fast passou a dar o endereço real de `/planos`.
- `e3c9a9bf` (PR #452) — as **414 guardas** da suíte do worker passaram a rodar
  em CI. Elas passam hoje, e é justamente por isso que valia ligar.
- `3bddeee2` — a compensação por erro nosso saía com a guarda de ritmo desligada.
- `f6dc4f5d` (PR #444) — clamp de ritmo que morde deixa rastro no QA (#571).

## Ainda na mesa, com número

- **`para_frank_*`: 144 recados pendentes** em `agent_state`, o mais antigo de
  **03/09 (22 dias)**, + 1 `patch_*`. Já existe cartão sobre a fila não esvaziar
  quando o cartão fecha (aberto 24/09).
- **10 cartões parados na decisão do Johnny**, mais velho **24d**, **29 alunos**
  atrás. A doutrina de 17/09 manda levar em **LOTE**, não um por ronda — é o que
  o relatório faz.
- **#526 Hellen Grasso**: pagante com 95.375 cr e **sem voz desde 06/09 (19d)**,
  porque só 2 dos 7 áudios dela chegaram (falha nossa). Carta saiu hoje 12:22Z.
- **2 throttled** no endpoint de vídeo: o datacenter não tem GPU livre. Nada a
  fazer no código (manual, §5).

## Erro meu que vale registrar

Rodei a primeira `varredura_travados.cjs` de um checkout parado na branch
`feat/intrusao-sistemica-gate`, e ela gritou "`video_clip_refund` não
classificado". **É artefato da branch velha**: na `main` esse ref_type já está
cadastrado desde `53e64785` (hoje, 6ª reincidência da classe). Conferi com
`git show origin/main:_frank/ferramentas/_estornos.cjs`. Ferramenta da casa
rodada de branch velha mede a branch, não a produção.
