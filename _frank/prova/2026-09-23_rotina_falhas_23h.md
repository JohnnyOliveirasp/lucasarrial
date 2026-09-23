# Ronda das falhas — 23/09, ~22h40-23h20Z (Frank, dono da fila)

**Desfecho: 1 serial levado ao fim do que é meu (`#353`), 1 aluno pagante
respondido por gente pela primeira vez em 12 dias, 1 classificação FALSA
derrubada com medição, 1 decisão A/B escalada, 1 armadilha de medição
registrada antes de virar número mentiroso no relatório.**

Gasto: **zero GPU, zero crédito movido, zero migration, zero merge, zero código
de produção tocado**. As escritas foram: 1 nota de incidente, 1 carta a aluno,
1 pedido ao grupo.

**Nenhum incidente foi fechado nesta ronda, e isso é resposta legítima** (regra
14): o que trava o `#353` é decisão comercial do Johnny, e fechar sem ela seria
carimbar "resolvido" em cima de um aluno que continua sem resposta.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável. **1133 = 1133**, nenhuma sumiu (1056 já com linha + 77 fora da janela). |
| `enviados_x_tabela` (irmão de leitura, independente) | **0** carta depois do corte fora da tabela. Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho 0d. Controle positivo (#310) e negativo (#518) OK, 525 varridos. |
| Censo da fila | **144** abertos (investigating 106 · aguardando_aluno 30 · open 8) · mais velho **55,4d** |
| `fechados_que_disparam` | 16 fechados com sinal de vida, **1** nas últimas 48h pelo script. Conferidos por SQL os **9** fechados com `last_seen_at` em 48h: em **9 de 9** o `resolved_at` é posterior ou igual ao disparo. Nenhuma classe fechada seguindo disparar. |
| `esperando_johnny` | **17** parados em decisão do Johnny · mais velho 55d · 54 alunos atrás da fila. **Não re-escalei o lote** (foi ao grupo às 20hZ de hoje; doutrina de 17/09 manda lote, não repetição). O pedido que saiu hoje é **caso novo**, não repetição — ver §3. |

As 77 cartas anteriores ao corte seguem sem decisão, como a ordem prevê.

---

## 2. Serial: `#353` / `72de0a07` — Wellington Pereira Da Luz

### 2.1 Por que este cartão

Mais antigo com aluno nomeado que **nunca tinha sido investigado pelo Frank** —
nenhuma nota `by=frank` em **12,4 dias**. Os mais velhos em idade bruta foram
relidos nota a nota e seguem travados em decisão alheia: `d3d8d1b2` (55d,
Johnny), `37bacb68`/`f8587cef`/`f1ada07e` (trabalhados hoje em rondas
anteriores), `af06731f`/`99a20692` (bola do aluno), `8b8fc4c8` (mão humana na
Hotmart), `702cc916`/`52b22304`/`5c68eb33` (dinheiro, mesa do Johnny),
`132f7808`/`94d3015d` (WhatsApp sem aval). Li também `7ed72ad0`, `b0ddd483`,
`7578c587` e `09a26f8b` na íntegra: **os quatro esperam decisão de dinheiro do
Johnny**, não investigação.

### 2.2 O erro que eu derrubo, e ele é da casa

A nota do Vigia de 22/09, item 3, conclui: *"ISTO NÃO É DEFEITO… `compras:
NENHUMA` é o registro de que ele nunca pagou. O sistema fez o que foi
mandado"*, e manda o caso como linha de atendimento.

**Ele pagou.** `pagou_de_verdade.cjs` na Hotmart **viva**, medido nesta ronda:
3 avulsas COMPLETE, **R$ 831**.

| transação | produto | valor | data |
|---|---|---|---|
| HP2345208468 | Fábrica de Conteúdo Invisível | R$ 297 | 14/04 |
| HP2027021128 | Gerador de Ganchos Inteligente | R$ 37 | 14/04 |
| HP2966771625 | **Sistema de Geração Pronto** | **R$ 497** | **07/05** |

O `compras: NENHUMA` do `aluno.cjs` lê o **nosso** banco, que não conhece esses
produtos. É a mesma cegueira já medida no `5f9eb4db` (#426: `orphan-outreach.ts:33`
filtra o PRODUCT_ID único `7851642`) e no #173. **O zero não diz "não pagou",
diz "eu não enxergo"** — e um cliente de R$ 831 ia ficar arquivado como caloteiro
de trial em cima dele. Mesma doença que a ordem de 18/08 já carimbou em
`profiles.ja_pagou` (SUSPENSA); reapareceu por outro caminho.

**Não é falha do Vigia** (14-A: ele anota com o instrumento que tem). É o
instrumento que mente calado.

### 2.3 O que eu medi, não herdei

- `sgp_pedidos`: duas linhas. `4684d515` status `dados` (10/09 12:57,
  abandonada) e **`f4d68bee` status `pronto` desde 10/09 15:27:37,282Z** —
  enviado 15:21:25, foto pronta 15:23:58, voz pronta 15:27:37. **A entrega
  aconteceu.**
- `entitlements` para o e-mail dele: **zero linhas**. `profiles`: SEM ACESSO,
  0 créditos.
- 8 cartas na pasta remota em 10/09; a última, uid 1624, **"Seus arquivos estão
  prontos — falta só o acesso"** (`avisoOkMasAssine`, `onboarding/avisos.ts:287`).
  **Nenhuma carta depois disso** — 13,3 dias de silêncio antes da minha.
- `auth.users` `27e5ce89`: `last_sign_in_at` **2026-09-22 15:10:55,039Z**. Ele
  **entrou** no app e **92 segundos depois** (15:12:27Z) escreveu *"Quero falar
  com um humano"*. Ele não estava perdido do lado de fora: entrou, viu, e pediu
  gente. Recebeu ping de robô.

### 2.4 ⚠️ A armadilha que eu quase pisei — registrada pra ninguém repetir

`sgp_pedidos.concluido_em` está **NULL em 388 de 388 linhas**, em todos os
status. Cheguei a tratar isso como *"131 entregas paradas sem conclusão"*.

**Não é sinal de nada.** Lendo a rota `/api/v1/admin/sgp/[id]/conclusao`:
`concluido_em` é **anotação de atendimento** (pedido do Lucas de 14/09), não
passo de pipeline — e a própria rota tem caminho 503 para a **migration 110
ausente**. Coluna que ninguém escreve carrega **zero informação**: mesma família
do `profiles.ja_pagou`. Medir por ela produziria um número grande, redondo e
falso, exatamente do tipo que circula sem ressalva.

### 2.5 O que ele consegue fazer hoje — conferido no fonte da main (`ee9f6a14`)

`app/[locale]/app/layout.tsx:58`, `voice-cloning/page.tsx:35`,
`images/page.tsx:32` e `history/page.tsx:19` **só redirecionam quando não há
usuário**. `hasActiveAccess` é calculado mas **não** redireciona; crédito só vira
`canTrain`/`canGenerate = false`. Conferido também em produção por HTTP:
`/app/voice-cloning`, `/app/images` e `/app/history` devolvem
`307 → /login?redirectTo=…`, ou seja a rota existe e o único porteiro é o login.

**Ver e baixar a voz, o clone de foto e o áudio dele não depende de assinatura.**
O que depende é **gerar coisa nova**. Isso é o que a carta pôde entregar hoje
sem decisão de ninguém.

### 2.6 Feito

1. **Escrevi pra ele** (regra 8, individual, SMTP do suporte@). Cópia
   **CONFIRMADA** na pasta Enviados **uid 3302**, tentativa 1, registrada em
   `emails_enviados` (origem `ronda-manual`). Rascunho versionado em
   `_frank/rascunhos/2026-09-23_wellington_luz_quero_falar_com_um_humano.html`.
   A carta (a) assume que a demora foi nossa; (b) lista as 3 compras, pra ele
   ver que a casa olhou; (c) dá os 3 atalhos diretos pro material que é dele;
   (d) diz **sem embrulho** que gerar coisa nova pede a assinatura da
   plataforma, separada do SGP — **não prometi acesso**; (e) promete que eu
   volto com a resposta do dono **seja ela qual for**; (f) reabre a pergunta de
   11/09 (ElevenLabs/HeyGen) que nunca foi respondida de verdade.
2. **Escalei** (9-D) via `ask_humans.cjs`, HTTP 200, `sent_to`
   `120363428193217427@g.us`. Binária com recomendação: **(A)** fica como está;
   **(B)** 30 dias de plataforma contados da **entrega** (10/09) — a regra do
   próprio weekly do Johnny de 14/09 (*"SGP = 30 dias"*), cuja **migration 115
   nunca foi aplicada**. Recomendei **(B)**, só pra ele, porque ele pagou em
   07/05 e a casa só entregou em 10/09: o atraso foi nosso.

### 2.7 O que eu não fiz, e por quê

**Não liberei acesso e não dei crédito.** O que a compra avulsa dá direito
dentro do FastCloner é decisão **comercial** (#173), e o `1e2cf1fe` já fechou
essa classe como regra deliberada do Lucas de 31/08 — **esse fechamento está
certo e eu não o reabro**. Escolher em silêncio aqui seria escolher no lugar do
dono, com dinheiro de aluno, que é o que o README proíbe.

**Não marquei `fixed`** (regra 14): falta a decisão A/B e falta eu voltar pra
ele com ela. **Status segue `investigating`** — `aguardando_aluno` mentiria pela
segunda vez neste cartão: eu fiz uma pergunta a ele, mas o que trava é decisão
**nossa**.

**Não abri cartão novo pra classe:** ela já existe (`1e2cf1fe` fechado como
não-defeito + `5f9eb4db` aberto).

---

## 3. Número novo pra quem for decidir o A/B

Pedidos SGP em `pronto` hoje: **131**. Sem acesso válido: **78**. Sem acesso
**e** com 0 crédito: **51**. Mais velho: **25,0 dias**.

⚠️ **Ressalva na frente do número, e ela vale mais que o número:** os 51 **não
são 51 defeitos**. Pela regra do Lucas de 31/08 a falta de acesso é
**esperada**. Isto é o **tamanho da população que a decisão A/B alcança**, não
uma fila de erro. Quem ler como fila de erro investiga na direção errada — foi
por não fazer essa distinção que o `1e2cf1fe` precisou ser fechado como
não-defeito depois de medido.

---

## 4. Fim de ronda

- Log commitado na **main** (regra 25-B).
- **Nenhum código de produção tocado** — não há fix preso em branch de feature.
  Conferido com `git log origin/main..HEAD` e `git branch`.
- Escritas conferidas na releitura: `#353` anotado (1 linha afetada, 6 → 7
  notas), carta com cópia confirmada na pasta remota (uid 3302), pedido ao
  grupo com HTTP 200 e `sent_to` devolvido.
- Grupo: fatos consumados postados com `notify-grupo.sh` — a carta, a correção
  da classificação e o A/B. Nada de log de terminal, nada de progresso parcial.
