# Rotina das falhas — 03/09/2026, ~00h50Z

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, canal de 31/08 (tudo do
FastCloner vai no **grupo**), `2026-08-29_desligar_vigia_e_frank.md` (planilha desativada) e
`2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

## Placar

| | entrada | saída |
|---|---|---|
| abertos (`open`+`investigating`) | **4** | **4** |
| aguardando aluno | 10 | 10 |

Placar parado de propósito. **Não fechei nada e não abri nada** — o motivo está no §1: o que eu
levei ao fim nesta ronda não é um chamado, é a razão de um chamado ter ficado 7h06 aberto sem
ninguém perceber. Fechar algo para o número cair seria exatamente o vício que esta ronda está
desfazendo.

---

## §0 — Antes da fila: conferi se alguém estava esperando. Não estava.

A prioridade manda aluno antes de limpeza de fila, então comecei pela varredura, não pelo quadro.
Ela acusou **2 itens presos**:

**`marcelopersonalthe32@gmail.com`** — acesso vivo, 198.950 créditos, **24 dias sem voz pronta**,
acesso vence **05/09**. Sintoma que normalmente é aluno abandonado. **Fui conferir antes de
escrever para ele, e ele não está abandonado:**

| o que | conferido |
|---|---|
| pagou? | **sim** — `pagou_de_verdade.cjs`: R$ 368,64 avulsa (27/07) + R$ 97 assinatura (12/08) |
| crédito do treino que falhou | **devolvido** — `+10.000 voice_train_refund` em 10/08 10:43, mesmo dia da falha |
| foi avisado? | **3 vezes** — `ler_caixa.cjs --enviados`: uid 58 (24/08), uid 182 (27/08), uid 341 (29/08) |
| o último e-mail cobre o caso? | sim, e é bom: confirma a análise manual do áudio (são 2 pessoas na gravação), dá os dois mínimos certos, **avisa que o acesso vence em 05/09** e oferece levar o caso ao time |

**Decisão: não escrevi.** Um quarto e-mail em 4 dias para quem já tem a resposta completa e não
respondeu é ruído, não zelo — a régua da varredura ("parado há 7d+ pede SEGUNDA tentativa") já foi
cumprida três vezes. A bola está com ele. Registro porque um `🚨` na varredura que não vira ação
precisa de motivo escrito, senão a próxima ronda gasta o mesmo tempo de novo.

**`luanmarcal.com@gmail.com`** — import quebrado em 29/08 por arquivo não público no Drive.
**Onboarding antigo/planilha: a ordem de 29/08 me proíbe de ler, classificar, avisar ou
reprocessar.** Registro e não toco. **3ª ronda seguida.**

Nenhum outro aluno travado: `generations` presas +2h = 0, `voices` em `training` +2h = 0, lista de
estorno em dia (10 tipos, 2.690 linhas, nenhum tipo desconhecido).

---

## §1 — O serial: `#226`, e a objeção que estava há 5 rondas sem dono

Pelo método serial o `#226` é o mais antigo na minha mão (01/09; o `#47` está com a aluna desde
17:50Z de ontem e o defeito técnico dele mora no `#234`). A **decisão de produto** do `#226` é do
Johnny e está pendente pela 4ª ronda — mas havia uma parte que nunca foi de ninguém e não depende
dele: **por que o fechamento falso das 16:59Z passou 7h06 com o quadro reportando limpo.**

O Vigia registrou isso por **5 rondas** como *"o detector de fechado-que-voltou-a-disparar mente no
`#226`"*. Fui atrás da causa em vez de repetir a queixa. **Ele não mente. É cego por construção — e
isso é pior, porque o número que ele imprime tem cara de cobertura.**

### O mecanismo, lido no código

`last_seen_at` e `occurrences` não andam sozinhos. Só se movem por dois caminhos:

| caminho | onde |
|---|---|
| (a) ocorrência **nova com a mesma `signature`** | `lib/incidents/ingest.ts`, `reportar.ts`, `lib/support/failure-alert.ts`, `lib/incidents/gravar.ts` |
| (b) **evento de e-mail do aluno afetado** | `lib/incidents/espera.ts`, `lib/agent/mail-bounce-registro.ts` |

O `#226` foi aberto **na mão**, com a `signature` `qa_exhausted_entrega_silenciosa` inventada no
insert. Grep em `.ts/.tsx/.py/.cjs/.mjs` (fora `node_modules` e `_frank/prova`): **zero arquivos a
emitem.** E nenhum aluno escreveu sobre a classe. Não existe (a) nem (b) — o carimbo congela na
criação e **nada no sistema reaudita aquele fechamento**. Não é regressão nem dado corrompido: é o
desenho.

### A consequência, medida — e ela não é só deste chamado

| medida | valor |
|---|---|
| fechados (`fixed`+`ignored`) | 217 |
| **auditáveis** (`last_seen_at` já se moveu ao menos 1×) | **97 (44,7%)** |
| **cegos** (`last_seen_at` congelado no insert) | **120 (55,3%)** |
| cegos com `occurrences > 1` digitado à mão | **18** |

Para os 120 cegos, a família A do detector (`last_seen > resolved`) é **aritmeticamente
impossível**, e a família B só mede a distância insert→fechamento, que nada diz sobre reincidência.

**A prova mais limpa:** o **único** fechado que a família A pegou na base inteira é o `#8` /
`training:user_dataset` — e é o **único cuja `signature` existe no código** (2 arquivos). As dos
chamados abertos à mão (`transcode:mp3-sem-xing-header`, `image:pending_sem_reconciliador`,
`qa_exhausted_entrega_silenciosa`) aparecem em **zero**. Ou seja: o `1 de 217` **nunca foi taxa
baixa de zumbi** — era cobertura quase total de ~97 e cobertura **zero** dos outros 120.

**A sub-classe pior (18 casos):** `occurrences` alto e **imóvel**, digitado no insert — `#111` com
**2.625** e `#96` com **2.585** à frente. Têm cara de chamado bem instrumentado e são exatamente os
que ninguém reaudita. **O `#226` era um deles quando foi fechado.**

### O conserto — PR #163

Branch `fix/detector-fechados-declara-ponto-cego`, commit **`2653d95`**, **PR #163**. O detector
passa a separar **AUDITÁVEL (97) × CEGO (120)**, listar nominalmente os 18 com contador digitado, e
dizer no rodapé que sobre os cegos *"não é 'nenhum disparou', é 'não dá pra saber por aqui'"*.

Continua **só `.select()`**, nenhuma escrita. **Régua nenhuma mudou e nenhuma política de
fechamento mudou** — o que muda é o script parar de anunciar cobertura que não tem. Mesma linha do
`--completo` do `sql.cjs` e do registro local do `enviar_email.cjs`: instrumento que não cobre tudo
precisa dizer o que não cobre.

Saída conferida depois do patch (rodei):

```
AUDITÁVEL: 97 (44.7%) — last_seen_at já se moveu alguma vez...
CEGO:      120 (55.3%) — last_seen_at CONGELADO desde o insert...
Um fechamento FALSO dentro dos 120 cegos não é detectado por este script. Foi o caso do #226.
```

Anotado no `#226`: notas **18 → 19**, `status` inalterado (`investigating`), **1 linha afetada,
conferida na releitura pelo banco**.

### O defeito segue vivo — medido agora

`generations status='ready'` com `qa` não nulo: **330 de 737 (44,8%)** com `exhausted > 0`, **152
alunos**. A última é de **00:41:45Z** — sete minutos antes desta consulta. **7h42 seguidas** de
entrega depois do `fixed` falso das 16:59Z.

---

## §2 — O que eu NÃO fiz, de propósito

- **Não consertei a causa do ponto cego.** Chamado manual segue nascendo sem produtor de
  `signature`. O conserto de verdade é o insert manual declarar uma **consulta de reauditoria** —
  isso é desenho novo, não conserto de ronda, e não vou empurrar desenho grande no fim da noite.
  **O PR #163 não cria produtor nenhum:** se o `#226` for fechado de novo, volta a ser invisível.
- **Não reauditei os outros 119 cegos.** Tenho a lista dos 18 piores; auditar cada um é trabalho de
  ronda própria. Digo o número em vez de deixar parecer que varri.
- **Não corrigi `occurrences`/`last_seen_at` do `#226` na mão** (estão em 290 e 01/09 contra 330
  reais). Digitar o número certo seria repetir exatamente o vício que a nota denuncia.
- **Não fechei nem abri chamado.** O ponto cego não virou chamado novo: a classe é o próprio `#226`
  e o conserto virou PR no mesmo ato.
- **Não escrevi para aluno nenhum** (motivo do Marcelo no §0). Nenhum e-mail saiu nesta ronda.
- **Não toquei** em crédito, GPU, voz, áudio, migration (102 segue não aplicada) nem mergeei PR
  (`#15`, `#41`, `#42`, `#160`, `#161`, `#162`, `#163`).
- **Não afirmo** nada sobre áudio *audivelmente* defeituoso — não ouvi nada nesta ronda. Tudo aqui é
  leitura de código, telemetria e banco.
- Nada da **planilha** foi lido, escrito, classificado, avisado ou reprocessado (ordem 29/08).
- Não li a caixa do `suporte@` para triagem; a única leitura foi `--enviados` do Marcelo, que é
  pasta nossa e não mexe na fila da Fast.

## §3 — Trabalho de outro agente **não commitado em lugar nenhum** (risco de perda)

`git status` na main mostra, além do já conhecido `_frank/ferramentas/assinatura_em_dobro.cjs`:

```
 M frontend/src/app/api/v1/webhooks/hotmart/route.ts
 M frontend/src/lib/payments/hotmart-payload.ts
?? frontend/src/lib/payments/aviso-orfao.ts
?? frontend/src/lib/payments/aviso-orfao-canal.ts
?? frontend/src/lib/payments/aviso-orfao.test.ts
```

Conferi: os três `aviso-orfao*` **não existem em nenhum branch** (`git ls-tree` em
`feat/aviso-compra-orfa` só tem `hotmart-payload`). É código de **webhook de pagamento** vivo só na
árvore de trabalho — um `checkout -f` ou `reset --hard` apaga. **Não commitei**: código de pagamento
pela metade, de outro dono, entrando na história às escuras é pior que o risco. Fica registrado
como o `cauda_decepada.cjs` ficou — e aquele o dono acabou commitando (`87f8472`).

## Pendências que atravessam rondas

| item | estado |
|---|---|
| **Decisão de produto do `#226`** (QA esgota: falhar sem cobrar ou entregar avisando?) | **4ª ronda**. Pela régua de cobertura o alvo é **11 de 42 (26%)**, não os 44% do `exhausted` cru |
| PRs **#41/#42** (teto de 2MB) | 12º dia |
| **Migration 102** (`#232`) sem aplicar, aguarda Johnny | 9ª ronda |
| Causa do ponto cego (chamado manual sem produtor de `signature`) | **nova** — PR #163 só declara, não conserta |
| `aviso-orfao*` fora do git | **nova** — §3 |
