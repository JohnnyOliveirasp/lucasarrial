# Ronda das falhas — 11/09/2026, 15h46Z (12h46 BRT)

Frank, dono da fila. Método serial (regra 8): peguei **um** card e levei até o fim.

> ⏱️ **Correção de carimbo:** anunciei esta ronda no grupo como "~19h". Está errado —
> ela rodou às **15h46Z**. O `resolved_at` do banco confirma (15:45:35Z). Registro aqui
> porque a hora errada já saiu no grupo e em uma nota de incidente (corrigida lá também).

## FECHADO: `#241` `07a423ff` — limite de vozes clonadas

**O que era:** o aluno `claytonpc10@gmail.com` perguntou no chat do app
(`/app/voice-cloning/generate`) quantas vozes clonadas pode ter na conta. Ocorrência 2,
aberta em 10/09 18:34. Chat do app não devolve resposta humana, então a resposta tinha
que sair por e-mail — e não saiu por 8 dias.

**Por que era este card:** os cinco mais antigos da fila estão travados, e **conferi cada
um nesta ronda em vez de herdar a conclusão da ronda anterior**:

| card | idade | onde emperra | conferido por mim hoje? |
|---|---|---|---|
| `#15` `d3d8d1b2` | 43d | espera ocorrência nova sob a régua nova **ou** 30 dias limpos | ✅ sim, medido — ver abaixo |
| `#47` `ce6e157d` | 23d | repor `tts_silence_ms=466` contraria ordem vigente de 24/08 ⇒ palavra do Johnny | ✅ li o estado |
| `#99` `6c38c99d` | 19d | decisão comercial Johnny/Lucas sobre os R$97 de 26/08, pedida pelo aluno em **24/08** | ✅ li o estado |
| `#223` `506b7c3a` | 10d | Johnny dizer se reabre a janela da Alana (promessa escrita × REGRA FINAL DE CRÉDITO) | ✅ li o estado |
| `#226` `702cc916` | 10d | decisão de produto: ao esgotar o QA, falhar sem cobrar ou entregar avisando | ✅ li o estado |

O `#241` é o mais antigo onde **a bola era nossa** e não dependia de ninguém.

### A medição que destrava (ou não) o `#15`

A condição de fechamento escrita no próprio card é "a PRÓXIMA falha de `executionTimeout`,
já com a régua nova". Medi em vez de supor: `generations` com `status=failed` desde 04/09
são **exatamente 2** —

```
2026-09-04T20:36:58Z  a07e9278  elapsed=579.0  1304 chars  executionTimeout [fase: inference.chunk.generate running_s=5]
2026-09-04T20:47:50Z  86254b30  elapsed=484.8   751 chars  executionTimeout [fase: (sem fase instrumentada)]
```

As duas são **anteriores** à régua nova (PR #229, merge `3f25c18`, 10/09 00:51Z).
**Zero ocorrência sob a régua nova.** O gatilho não disparou: o card segue parado com
razão, e o relógio dos 30 dias limpos corre desde 10/09.

### A resposta, conferida em duas fontes independentes

Não aceitei de graça a nota do Executor de 10/09 que já dizia "não existe limite".

1. **Código** — não há teto de quantidade. `grep` por `max_voices` / `voice_limit` /
   `maxVoices` / `VOICE_LIMIT` em `frontend/src` volta **vazio**. A rota que autoriza o
   treino (`voices/[id]/start-training/route.ts:85-120`) só checa três coisas: a voz é do
   próprio usuário (`.eq("user_id", …)`), `status == awaiting_training`, e
   `saldo >= TRAINING_CREDIT_COST`. **Não há `COUNT` de vozes em ponto nenhum do caminho.**
2. **Controle positivo no banco** — é o que separa *"não achei o teto"* de *"não existe
   teto"*. Varri `voices` **paginado** (1.270 vozes, 871 usuários): o máximo real por
   usuário é **32**, e há usuários com 11, 9, 9, 9, 8. Se houvesse teto, ninguém teria
   passado dele.

**O que de fato limita é crédito:** `TRAINING_CREDIT_COST = 10.000` por voz treinada
(`lib/credits/config.ts:10`); geração = 1 crédito por caractere com piso de 400
(`generationCreditCost`).

**Estado do aluno, medido:** acesso ativo até 03/10, `plan=pro`, **106.180 créditos**,
2 vozes `[ready]` (`6e369397`, `684f2c98`). Dá ~10 treinos novos. Nada travado, nada a
estornar, nada a liberar.

**Respondido:** e-mail em 11/09, **Enviados uid 1839, cópia CONFIRMADA na 1ª tentativa**.
Mandei os dois números, o saldo dele, a conta dos ~10 treinos e o aviso de que o treino é
cobrado **no clique** — para ele não queimar 10.000 com referência ruim.

**Não virou chamado de código: não há defeito.**

## Verificado e descartado — não é incidente

`allinegalpao@gmail.com` apareceu na varredura como "acesso vivo, com crédito e sem voz
pronta". **Não está travada:** o treino começou **15:39Z**, seis minutos antes de eu
olhar, com o débito de 10.000 no extrato no mesmo minuto, e são 22min de áudio. Job em
voo, comportamento normal. Conferi em vez de abrir chamado em cima do rótulo da varredura.

## Continua parado — é palavra do Johnny, não investigação

| | prazo | o que falta |
|---|---|---|
| **Marcelo** `marcelopersonalthe32@gmail.com` | garantia fecha **hoje 00:00Z (12/09)** | autorização da devolução dos R$97 |
| **Hellen Grasso** | porta fecha **amanhã 12:00Z** | ela **pagou** (~R$644, 2 compras APPROVED em 05/09); pela REGRA FINAL DE CRÉDITO não deveria perder nada |
| `#304` Emanuel · `#341` `b633b18c` (16 pessoas) · `#313` `2d0509b4` (15 vitalícios) · `#331` Mastroianni · `#244` tela de senha · `71410a81` garantia ancorada errada (57 alunos) · PR **#92** em DRAFT | — | herdados, não tocados nesta ronda |

Os dois relógios foram ao grupo nesta ronda marcados como urgentes — **não é re-escalação
vazia: hoje é a última ronda antes do prazo do Marcelo virar.**

## Números da ronda

- **72 → 71** em `open`/`investigating`. Um fechado, de verdade: aluno respondido com
  cópia confirmada, causa conferida em duas fontes, sem defeito por trás.
- **3 itens** na varredura de presos: 2 são os relógios acima (palavra do Johnny),
  1 era falso positivo (treino em voo, descartado com medição). **10 aguardando aluno.**
- **1 e-mail enviado** (uid 1839, cópia confirmada). Caixa **não** lida para triagem.
- Custo: **0 GPU, 0 crédito, 0 visão paga.** Não toquei em voz, saldo, acesso, assinatura
  nem migration.
- 🧹 Higiene, **inalterada**: seguem **10 arquivos** modificados não commitados em
  `frontend/**/sgp*` e `frontend/messages/*`, mais não rastreados em `_frank/rascunhos/`.
  **Décima quarta ronda seguida.** Não são meus, **não toquei**. Meus scripts de
  investigação ficaram em `/tmp/frank/`, fora do git.
