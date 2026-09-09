# Fecho do dia — relatório noturno de 08/09 (escrito 09/09 ~00:50–01:15Z)

Consolidado das ~24h desde o relatório anterior (08/09 01:20Z → 09/09 01:10Z).
Cada número abaixo foi **medido nesta ronda de fecho**, com o instrumento
nomeado na linha. Onde eu repito número de outra ronda, digo que estou
repetindo.

---

## 1. O que eu resolvi hoje

### 1.1 Cinco merges em produção, e a prova é do servidor

| commit | hora (Z) | o que corrige |
|---|---|---|
| `3dead5c` (PR #211) | 11:55 | convite de compra órfã ignorava pagante **dentro** da janela paga (`#305`) |
| `e449783` (PR #212) | 13:47 | o dedupe do convite era por e-mail e **permanente** → agora o ciclo é da **cobrança** (`#306`) |
| `c1db335` (PR #176) | 14:45 | piso de cobertura na escotilha de lacuna espalhada (`#226`) |
| `2adb080` (PR #213) | 14:47 | destrava `test_fase_telemetria`, defasado desde o PR #209 (`#15`) |
| `51217d1` (PR #202) | 18:47 | `access_source` no acesso vitalício |
| `d912c19` (PR #216) | 21:50 | **só comentário** — a margem da régua do `#15` é 1,6×, não 2,5× |

**Prova de que está no ar, e é do servidor, não do GitHub:** `BUILD_ID`
`wldcC4Ck0tUbpieY5BI2w`, gerado **08/09 21:52:35Z** — depois do último merge
(21:50Z). `pm2` com o `aiverse` **online**, uptime 3h, 0 restart instável.
Todos os runs de deploy do dia terminaram `success`. O run de `Build RunPod
Worker` do PR #176 saiu `cancelled` por concorrência, mas o conteúdo dele está
contido em `2adb080`, que construiu `success` — os workers reciclaram 15:21–15:22Z.

### 1.2 Cinco pagantes que estavam mudos "para sempre" voltaram a ser procurados

O `#306` é a classe: o convite de compra órfã deduplicava por **e-mail** e
**para sempre**. Assinante mensal cobrado todo mês, sem nunca ter conseguido
entrar, nunca mais era procurado por ninguém. Com o ciclo passando a ser o da
**cobrança**, saíram **5 e-mails entre 14:00:08Z e 14:00:35Z**
(`alinecuida`, `herysilva.27`, `gustavocasarotto`, `jkakorio`,
`rodrigo.limas.1978`). As 5 pessoas tinham janela paga viva e **todas as 5 já
haviam cancelado** — é o preço de ter ficado mudo.

⚠️ Registro do dia, e é uma falha minha de leitura: o PR #211 (11:55Z) subiu
**verde e com dois terços do efeito faltando**. Ele alargou
`compradorMereceConvite` citando 6 pagantes, mas alcançava só 2 — o dedupe
eterno continuava silenciando os outros 4. Quem achou foi a ronda das 14h, e o
conserto de verdade é o PR #212. Deploy verde não é efeito medido.

### 1.3 `#226` — o conserto pega, medido em produção e não presumido

Antes do merge: **118 entregas, 22 abaixo da régua 0,85, 5 abaixo do piso 0,65,
3 com cobertura 0,0**. Depois, com volume de verdade: **0 abaixo do piso em 45
entregas**, e o único "zero" restante era texto de **1 letra**. Zero falha e
zero estorno causados pelo conserto. A régua caiu de 7 em 124 para 0 em 45.

### 1.4 `#15` — duas hipóteses minhas refutadas por medição

Não fechei o card (40 dias), e não vou fingir que andou mais do que andou. O que
mudou hoje é que **duas** explicações candidatas morreram com número:

- a **margem da régua** é **1,6×**, não 2,5× — a conta antiga usava
  `elapsed_seconds`, que é setup-cego. Corrigido em `d912c19` (comentário, 26
  inserções, 0 linha de código);
- **dinheiro do card conferido e limpo**: as **19** gerações com
  `executionTimeout` têm **saldo zero** (débito com estorno casado). **Nenhum
  aluno pagou por falha nossa** neste card.

### 1.5 Três alunos escritos, com uid de Enviados conferido

| aluno | o quê | prova |
|---|---|---|
| Max (`max@md2net`) | fechou a pergunta de 03/09 parada há 5 dias; desfez o parágrafo falso de 04/09; explicou que 13/09 é **renovação**, não prazo; confirmou os 100.000 créditos | Sent uid 1305, 10:50Z |
| Katia | corrigiu uma contradição nossa anterior; a régua acerta no caso dela, o defeito segue aberto e eu disse isso | Sent uid 1336 |
| Edesio (`grupouniprox`) | pagou **R$ 1.054,32** em 31/08 e recebeu instrução impossível de cumprir; assumi o erro da casa e apontei o portal público do SGP | Sent uid 1362 |

### 1.6 O quase-acidente do dia, e ele é meu

Na ronda das 20h o log foi parar em branch `feat/`. O `git checkout main`
respondeu *"Switched to branch 'main'"*, o commit `8a26423` **nasceu em
`feat/fast-nao-promete-credito-sgp`**, e o `git push origin main` respondeu
`Everything up-to-date` com **exit 0** — sucesso aparente, log invisível. Outro
processo trocou a branch do repo por baixo no meio da ronda (a árvore começou
limpa e terminou com `M account.ts` e um `compras.ts` novo que não eram meus).

Consertado com `git branch -f main 8a26423` + `git merge-base --is-ancestor` e
push. **Lição gravada:** conferir `git branch --show-current` **imediatamente
antes** do commit, não só no começo — e nunca aceitar `PUSH OK` como prova.

Efeito colateral do mesmo problema: o log da ronda das 15h ficou **untracked**,
210 linhas documentando merges reais. Recuperado.

### 1.7 O estorno que eu NÃO fiz — e é resultado, não omissão

O recado `para_frank_2f1feb63` mandava devolver 525cr para
`thallitamachado@hotmail.com` (imagem "preta" das 19:07Z) se não houvesse
estorno. **Não há estorno mesmo** — extrato conferido, débito `-525` em
19:07:43Z, ref `image_generation 1723da64`, nenhuma linha positiva depois.

**Mas a premissa do recado está errada, e eu conferi olhando.** Baixei o objeto
do R2 (`voices-clone-ai-verse`, `…/images/1723da64…/result.png`, **1.902.552
bytes**, PNG **941×1672**, `status ready`, `error_message` NULL,
`kie_raw_error` NULL, `retry_count` 0) e **abri**: é o retrato normal da aluna,
de jaleco branco, bem iluminado. **Não está preta.** Contraprova: ela gerou de
novo às 21:37:34Z (`ddbe3c3b`, 2.209.999 bytes) e tirou vídeo às 21:49Z — as
duas íntegras.

Ou seja: o gerador entregou, o arquivo está bom e no lugar certo. **O que
falhou foi a aluna VER a imagem na tela** — a mesma família do
`[ERROR][client] window.onerror "network error"` em chunk do `_next` que aparece
no log de produção. Estornar às cegas teria devolvido crédito por um defeito que
não é esse, e teria fechado o chamado no lugar errado.

Anotado no `#310` com a prova. Script: `_Bugs/thallita_imagem_preta_0809.cjs`.
Ela é **pagante de hoje** (100.000 créditos às 17:19Z) e **não está travada** —
seguiu gerando a noite toda. O próximo passo é escrever para ela (o chat do app
não tem resposta humana), não mexer no saldo.

---

## 2. O que está parado esperando o Johnny

Mandei 8 perguntas em 06/09 e 4 em 07/09. **Recebi 0 respostas nas duas.**
Insistir mais alto não é a lição; hoje mando **3**, todas binárias, todas com
relógio, e paro de repetir a lista inteira todo dia — o resto continua nos cards.

1. **`#313` — revogo os vitalícios que ninguém comprou?** 15 entitlements
   `active` com `access_until` NULL saíram de produto de **CURSO**
   (7283335/7283229), criados em 09/06 antes do roteamento por produto.
   **1 pessoa já está com a plataforma viva até 2030** sem nunca ter comprado;
   as outras 11 ganham no primeiro login, porque `reconcileUserEntitlements`
   não filtra produto. *Recomendo revogar* — não é o que essas pessoas
   compraram. **Isto é o gargalo do dia:** trava o `#312` inteiro (os 19
   pagantes sem conta), porque criar conta pra eles dispara o vazamento em 4
   pessoas de uma vez. **O conserto já está escrito e parado** na chave
   `patch_2d0509b4`, esperando minha revisão — o que falta é a sua decisão de
   produto, não código.
2. **Processo os 2 reembolsos de garantia na Hotmart?** Hugo Correa
   (`hugo.correa@aol.com`, Pix hoje 08/09, pediu com ~3h de compra, garantia até
   14/09) e `franciswd.oficial@gmail.com` (compra 04/09, hoje é o **dia 4** dos
   7 do art. 49 do CDC, pedido por escrito). *Recomendo sim nos dois* — é
   direito de arrependimento dentro do prazo, e atraso aqui vira reclamação
   pública, não economia.
3. **`#290`: mando o e-mail de correção pros 7 assinantes?** É o lote que
   recebeu a carta dizendo que **não** tem a plataforma que eles pagam. O 8º
   (Max) já foi respondido individualmente hoje. É lote, por isso pergunto —
   perguntei em 06/09 e 07/09 também.

**Continuam paradas, sem relógio novo:** migration 82 (destrava o `#15`, 40
dias); `#314` com a fuse do Jesus Peres armada pra **18/09**; estornar ou não as
gerações que o nosso QA reprovou (`#226`/`#234`); reenquadrar ou fechar o `#222`;
e o endereço certo do `victor@lucasarrial.com` na `admin_emails` (`#308`).

---

## 3. Estado geral, medido agora

- **58 chamados não fechados**: **46 em investigação + 12 esperando aluno.**
  Ontem eram 46 (34 + 12). **Abriram 12 (`#304`–`#315`) e eu fechei ZERO.**
  Conferido por aritmética, não por sensação: 34 + 12 = 46, e nenhum chamado
  fechado reabriu (`resolved_at` mais recente da base é de **07/09 22:52Z**,
  o `#302`). O saldo do dia é **+12**, o pior da semana, e o método serial do
  `03_ROTINA.md` §8 diz que isso acontece quando o dia inteiro trabalha em
  investigação e nenhum item chega até o fim. Foi o que aconteceu.
- **Produção 24h: 313 entregas, ZERO falha.** 89 áudios, 146 imagens, 57 Vídeo
  Clone, 21 vozes — **todas `ready`**, nenhuma linha `failed` nas 4 tabelas.
- **GPU: os 3 endpoints saudáveis.** 1 job na fila no de voz, 0 `unhealthy`.
  1 `throttled` no de vídeo — é o datacenter sem GPU livre, não tem o que fazer
  no código.
- **Dinheiro: 19 tipos de lançamento nas 24h, nenhum desconhecido.**
  45 `payment_event` entregando **+4.500.000** créditos. Movimento positivo do
  dia: 1 `image_refund` (+525, `contato@mastroiannioliveira`), 1
  `studio_scene_refund` (+1.800, `carla_psico`), 1 perdão de saldo negativo de
  onboarding (+10.525, `luciano.rezende.filho`, decisão sua de 30/08) e a
  transferência de titularidade do `#314` — `courtesy_grant` **+100.000** para
  `tuquinha36` casado com `reparo_falha_operacional` **−100.000**. Líquido zero,
  mas **é a fuse de 18/09**: se ninguém tocar até lá, o acesso fica na conta que
  nunca logou.
- **Pagante sem acesso: NÃO é mais zero, e essa é a piora estrutural do dia.**
  Ontem reportei zero. O `#312` mediu hoje: **19 compradores do SGP aprovados,
  sem perfil e sem pedido no portal — 4 deles há 91 dias** (desde 09/06). O
  varredor que deveria achar essa gente (`orphan-outreach.ts:27,142`) filtra por
  **um** `product_id` fixo (7851642) e descarta todo comprador do SGP (7283229)
  **antes de qualquer regra**. Não era zero ontem; era **cego**.
- **Varredura: 4 presos**, todos já escritos antes, nenhum abandonado —
  `marcelopersonalthe32` (30 dias, voz falhou por erro nosso, **prazo de
  reembolso em 11/09, daqui a 3 dias**), `tania-araujo` (4 dias, avisada 2×, não
  clicou em "Treinar"), `hellengrasso` (2 dias, 5 de 7 arquivos não chegaram) e
  `luanmarcal` (import quebrado há 11 dias, link do Drive fechado). Mais 1 linha
  de escrituração sem ninguém esperando (`training_jobs` obsoleto com a voz já
  `ready`).
- **Sweeps vivos, provado no log do servidor** (não no cron): nas últimas 400
  linhas, `sweep-clones` **137** aparições, `winback` **253**, `mail-sweep`
  **11**. Rodando a cada 5 min.
- **Números meus que pioraram:** a fila interna de recados foi de **35 para 46**
  (+ 2 patches do Vigia esperando revisão = **48 chaves**), e a mais velha tem
  **7 dias** (`para_frank_702cc916`, de 01/09). Ontem eu drenei um terço; hoje
  drenei **nada**. É dívida minha e eu não vou pintar de outra cor.

### 3.1 Barulho no log de produção que NÃO é incidente (conferi antes de abrir card)

O `stderr` do `aiverse` repete duas falhas a cada poucos minutos e as duas são
**conhecidas e intencionais** — não abri chamado, e registro aqui pra próxima
ronda não abrir também:

1. `Could not find the table 'public.avisos_enviados'` — a migration
   `scripts/104_avisos_enviados.sql` **nunca foi aplicada, por decisão**. O
   registro é best-effort e a idempotência de verdade mora no `agent_state`
   (`sgp-boas-vindas-canal.ts:12-18`, `registrar-aviso.ts:25`). Confirmei que a
   tabela não existe em schema nenhum.
2. `expire_trial_credits` → `DESATIVADA MANUALMENTE 18/08: deteccao de pagante
   errada, zerou 14 pagantes` — desligada de propósito, e o sweep loga
   `FALHOU` a cada 5 min por causa disso.

⚠️ **`orphan_alerts` é chave de `agent_state`, não tabela** (`aviso-orfao-canal.ts:30`).
Quem for medir "não existe entrada em orphan_alerts" com SQL vai receber erro e
ler como zero — é exatamente a armadilha do `03_ROTINA.md`.

**Dívida que isso cria:** dois erros perpétuos e esperados no `stderr` fazem
qualquer erro NOVO passar despercebido. Não é urgente e não vou mexer em
produção sem seu sim, mas está registrado.

---

## 4. O que eu errei hoje

1. **Fechei zero chamados** com 12 abertos. Não foi falta de trabalho — foi
   trabalho que não chegou ao fim de nenhum item (§3).
2. **Mergeei o PR #211 achando que alcançava 6 pessoas e alcançava 2** (§1.2).
   Verde no deploy, dois terços do efeito ausentes. Só a ronda seguinte pegou.
3. **Quase perdi o log da ronda das 20h numa branch `feat/`** e o `push`
   respondeu sucesso (§1.6). O log das 15h chegou a ficar untracked.
4. **Não drenei um único recado da fila interna**, que cresceu 35 → 46 (§3).
5. **Reportei "pagante sem acesso: zero" ontem** com um varredor que é cego pro
   SGP. O número certo de ontem não era zero (§3).

## 5. A lição do dia

> **Deploy verde mede que o código subiu, não que o efeito aconteceu.**

O PR #211 passou em tudo e deixou 4 das 6 pessoas mudas. O `#226` só virou
resultado quando eu contei **45 entregas depois** do merge, não quando o build
ficou verde. E o "pagante sem acesso: zero" de ontem era um instrumento cego
respondendo com confiança.

Régua que fica: **todo conserto que existe pra alcançar gente termina com a
contagem de quantas pessoas ele alcançou de verdade, medida depois do deploy.**
Sem esse número, o card não fecha.
