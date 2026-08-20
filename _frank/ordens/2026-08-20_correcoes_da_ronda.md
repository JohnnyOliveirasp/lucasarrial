# ORDEM — Correções da ronda da manhã (20/08)

Li tuas três rondas de hoje. O método está certo — recusar o zero, imprimir o
`error` de cada consulta, virar medição em ferramenta em vez de prometer
atenção, respeitar a 14-A anotando sem mexer em status. Não vou elogiar item
por item.

Cinco coisas, em ordem de importância. **A nº 1 mexe em dinheiro de aluno e
corrige a mim, não a você.**

Escrevi isto enquanto você trabalhava, e quando fui subir você já tinha
empurrado sete commits. Dois deles mataram itens que eu ia te mandar: a janela
da métrica (`bd9042f`) e o prazo da Josilene (`46a4299`). Reescrevi em vez de
insistir — o item 2 virou registro, não ordem. Isso também é um dado: você está
achando as coisas antes de mim, então **não espere ordem pra corrigir o que já
provou.**

---

## 1. 🔴 A dinicleia NÃO devia estar trancada — e eu errei antes de você

Você concluiu: *"Ela parou de pagar, então a trava está certa pela ordem de
13/08."* **Está errado**, e a ordem que prova isso já estava no repositório.

Existem duas ordens de 18/08 sobre crédito, e a segunda **anula** a primeira:

- `2026-08-18_cancelar_credito_no_vencimento.md` — "venceu = zera crédito"
- `2026-08-18_regra_final_pagou_fica.md` — **REGRA FINAL**, e o próprio texto
  dela diz que substitui a anterior no ponto do zeramento.

O que vale, e está no índice do `README.md` deste diretório:

> **O que decide é o PAGAMENTO, não o status da assinatura.**
> Pediu cancelamento **depois de já ter pago** → para a cobrança recorrente,
> **mas o crédito é dela** e ela usa até acabar.
> *"Quem já pagou fica com o crédito e com as portas."*

A dinicleia teve a cobrança #2 de R$97 **COMPLETE**. Ela pagou. Pela regra
vigente ela fica com os 100.000 créditos **e com o acesso**. A recorrência #3
estar OVERDUE só para a renovação — não retira o que ela comprou.

**Isso vale para as 47.** O critério por pessoa é um só: *já teve algum
pagamento aprovado, em qualquer momento?* Sim → não trava. Não (só trial,
valor 0,00) → trava.

**Faça:**
- **NÃO destrave ninguém ainda.** Isso é dinheiro e acesso de aluno em massa;
  a regra é clara mas o Johnny confirma antes da execução (README, item 4:
  "nunca escolha em silêncio quando envolve dinheiro de aluno").
- **Meça e reporte**, que isso você decide sozinho: das 47, quantas tiveram
  pagamento aprovado alguma vez, quantas nunca pagaram, e quantas estão
  trancadas AGORA sendo do primeiro grupo. Esse número é a ordem de serviço.
- A tua pergunta binária no relatório **pode sair da lista** — ela já está
  respondida por ordem vigente. O que sobra pro Johnny é só executar.

**Lição de método, que vale mais que o caso:** antes de responder qualquer
coisa sobre crédito, abra o `_frank/ordens/README.md` e veja qual ordem está em
"Vigentes". Duas ordens do mesmo dia sobre o mesmo assunto é sinal de que uma
substituiu a outra. Eu não fiz isso e te dei a resposta errada primeiro.

## 2. ✅ A janela da métrica — você chegou antes de mim, e fez melhor

Eu tinha escrito este item como correção: você ancorou em 11:01, que é a hora
do **push**, e a régua só ficou viva às **11:41:58Z** (fim do `deploy-runpod`).
Quarenta minutos de geração contados como "régua nova" eram régua velha.

**Você achou sozinho e corrigiu em `bd9042f` antes de eu conseguir te mandar.**
E resolveu melhor do que eu ia pedir: em vez de anotar a regra pra lembrar
depois, o `--corte auto` **pergunta ao GitHub** o `completed_at` do
`deploy-runpod` do último run verde — e **se recusa a comparar antes×depois**
quando não consegue descobrir, em vez de inventar janela. Isso é a diferença
entre corrigir um número e corrigir a classe do erro. Continue assim.

Fica só uma extensão, porque a armadilha não é do QA, é de qualquer medição
"antes × depois de um deploy":

> A hora que vale é sempre o **fim do job que troca o que está rodando** —
> `deploy-runpod` no worker, `Deploy Frontend (production)` no frontend. Nunca
> a hora do push, nunca a hora do fim do *build*.

Se você medir qualquer outra coisa contra um deploy, reuse o mesmo `--corte
auto` em vez de escrever data na mão.

## 3. "Quantas regenerações o portão tenta" — resposta, e ela não precisa de código

No `tts_qa/loop.py` (`run_chunk_qa`):

```
max_attempts = max(start=2, echo=3, coverage=3, intrusion=3) = 3
```

São **3 tomadas**, ou seja **no máximo 2 regenerações** antes de desistir.

Mas o ponto útil é outro: **o worker já devolve esses números** no output do
job — `qa.regens`, `qa.exhausted`, `qa.coverage_flagged` e, principalmente,
**`qa.coverage_espalhada`** (quantas vezes a régua nova decidiu ENTREGAR em vez
de reprovar). Esse último é exatamente a métrica que mede se o fix pegou.

Não está no banco porque **o webhook joga fora**: conferi
`frontend/src/app/api/v1/webhooks/runpod/route.ts` e não há nenhuma referência
a `qa`. Persistir isso é um fix pequeno e te dá a métrica sem depender de log
nem de ler código.

**Autorizado a propor** (não a executar sem falar): a coluna e o `INSERT`
entram como migration, e migration precisa de OK — mas a proposta pode vir
pronta.

## 4. Worktree isolado: sim, faça

Tua leitura está certa, e o problema é maior do que pareceu. Conferi o repo do
Johnny: a branch **`feat/ref-corte-em-palavra` não existe nele** — nem local,
nem no `origin`. Ela só existe na cópia da rede que você divide com o coder.

Duas consequências:

- **O trabalho do coder não está publicado em lugar nenhum.** Se aquela cópia
  se perder, perde junto. Peça pra ele dar push mesmo com a branch incompleta.
- O teu diagnóstico do `git push` que respondeu "Everything up-to-date" sem
  publicar nada está certo. A conferência que te salvou —
  `git log origin/main..HEAD` — **vira passo fixo do fim de ronda**, não só
  desta vez.

## 5. O `handler.py` vai mudar de forma — não estranhe

Estou refatorando o `runpod-worker/`. O `handler.py` sai de **1.683 para 93
linhas** (virou só o despachante) e o resto mudou de endereço:

| era | virou |
|---|---|
| `_run_chunk_qa`, `_chunk_coverage`, `_maior_lacuna`, `_chunk_intrusions` | `tts_qa/` |
| `_handle_inference` | `jobs/inference.py` (classe `InferenceJob`) |
| `_handle_train` | `jobs/train.py` (classe `TrainJob`) |
| `_log` | `worker_log.py` |
| constantes de env | `worker_config.py` e `jobs/tts_settings.py` |

**NENHUMA regra mudou.** Conferido mecanicamente contra o arquivo anterior: 37
funções idênticas por AST; os **50 eventos de log** continuam com o mesmo nome
(teus greps valem); as **38 variáveis de ambiente** continuam com o mesmo
default; e o texto do erro `qa_coverage` está **byte a byte igual** — a
assinatura do incidente depende dele.

Ainda está numa branch local (`refactor/worker-modularizacao`), **sem push**.
O que está em produção é o `aae3ba5`. Quando subir pra main eu aviso no grupo.

---

## Uma coisa que eu quero que você faça diferente

Você errou três vezes seguidas nos números numa manhã, percebeu, e virou a
medição em ferramenta em vez de prometer atenção. **Isso está certo e é o que
eu quero que continue.**

O que faltou foi um passo antes: **a ordem vigente estava no repositório e
respondia a tua pergunta binária.** Antes de escalar decisão pro Johnny, leia o
`_frank/ordens/README.md` e veja se o assunto já tem dono. Escalar o que já foi
decidido custa o tempo dele — que é o recurso mais escasso da operação, ainda
mais com ele viajando a partir de 24/08.
