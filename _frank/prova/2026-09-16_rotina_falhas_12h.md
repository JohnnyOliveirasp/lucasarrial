# Rotina das falhas — 16/09/2026, 12hZ (09h BRT)

Dono da fila (14-A). Li `_frank/ordens/README.md`, a de **20/08** (dono da fila),
a de **21/08** (serial + regra 8), a de **27/08** (só erro de sistema vira
chamado) e a de **29/08** (planilha desligada). **Nada da planilha foi lido,
escrito, classificado ou reprocessado.** Canal: por ordem de **31/08**, o aviso
desta ronda sai **no grupo**, e só no grupo.

Ronda anterior das falhas: **11hZ**. Abertura desta: **10h40Z**.

Peguei o **`#285`** (`e6c53db1`, 9,8 d). **Não é o mais velho da fila — é o mais
velho onde a bola ainda é nossa**, e eu conferi um por um antes de escolher:
`#11` e `#15` seguem em decisão do Johnny; `#99` tem prazo do Johnny em 19/09;
`#101` estava travado em merge; `#223` saiu do meu colo em 13/09 esperando
resposta da aluna (regra 8); `#226` e `#234` esperam o Johnny virar chave de GPU.
O `#285` era o **mais antigo cartão que ninguém tinha voltado a trabalhar** — a
última nota era do próprio dia de abertura.

**O que esta ronda entrega:** (1) um cartão que estava catalogado como *limite de
produto* e era **bug nosso**, com a causa provada; (2) o aluno avisado e o
crédito devolvido; (3) **uma hipótese minha derrubada** antes de virar manchete;
(4) um cartão fechado cedo demais **reaberto**, com 25.000 créditos que ninguém
tinha devolvido.

---

## 1. O `#285` não era limite de produto. Era o `#270`, 9 dias antes.

O cartão estava classificado como *"avaliar limitação do produto vs. orientação
de uso"*. Não era. É exatamente o defeito do `#270` — o botão **"Gerar prompt
automático"** apagando a atribuição das fotos extras — num aluno que ninguém
tinha ligado àquele cartão.

### 1.1 A linha do tempo, medida em `image_generations` + `credit_transactions`

Marcelo Santos Pereira, `smilefastrio@gmail.com`, dentista, pagante, plano pro.

| hora (06/09) | o que aconteceu |
|---|---|
| **14:22:32Z** | geração `0f0efe39`, 4 refs. Ideia dele: *"…Seu consultório odontológico **(da foto extra)** de fundo e levemente desfocado"* |
| | prompt que **de fato** foi pro gerador: *"…Ao fundo, **um consultório odontológico** com móveis, equipamentos e iluminação profissional…"* — o `(da foto extra)` **apagado**, trocado por um consultório **genérico** |
| 15:47–16:00Z | ele **desiste do botão** e escreve o prompt à mão em 3 gerações seguidas (`idea` vazia), tentando forçar preservação de identidade |
| **15:57:36Z** | abre este chamado: *"O processo de geração de imagem deixa muito a desejar"* |
| 17:27Z | a casa responde com **modo de usar** — *"use fotos extras, descreva o cenário"* |

A dica de 06/09 **não tinha como funcionar**: o botão apagava exatamente a
atribuição que a dica mandava escrever. Ele reclamou do sintoma certo e ouviu
que era jeito de usar.

### 1.2 Ele tinha feito tudo certo — e isso é visual, não inferência

Baixei as referências **da própria geração** do R2 (`voices-clone-ai-verse`,
prefixo `dad39108-…/refs/`) e olhei:

- `13c2201e_1000235859.jpg` → **é o consultório odontológico dele**: cadeira
  azul, refletor, bancada, ar-condicionado, janela.
- `2e931787_20260810_190227.jpg` → é ele, jaleco escrito *"Dr. Marcelo Pereira —
  Cirurgião Dentista"*.

A foto do consultório **estava na geração**. O gerador só nunca foi instruído a
usá-la.

---

## 2. Conserto: já estava no ar. O que faltava era provar que cobria ELE.

Não subi código. O `#297` (merge **`3e8af23`**) está em produção desde **15/09
18:11Z** — conferido como **ancestral de `origin/main`**, não por "card
completed".

Dizer a ele *"está consertado"* porque o conserto do Paulo subiu seria presumir:
as duas ideias não têm a mesma forma — o Paulo escreve `da foto extra` solto, o
Marcelo põe **entre parênteses**, que é o tipo de construção que um LLM engole ao
reescrever. Então fiz a prova com o texto **dele**:

`_frank/ferramentas/2026-09-16_prova_foto_extra_marcelo.mts` chama o **Haiku de
verdade**:

| caso | resultado |
|---|---|
| A — texto real dele, com parêntese | **3/3 ok** |
| B — mesmo texto sem parêntese (isola pontuação) | **3/3 ok** |
| C — controle negativo (lote de selfies, não pode inventar extra) | **3/3 ok** |

Guarda de fallback ativa: saída idêntica à ideia seria `INCONCLUSIVO`, nunca
`ok` — sem isso a ferramenta mede a si mesma e mente. Re-rodei também a prova do
`#270`: **12/12 ok hoje**, incluindo o controle que impede o defeito ao
contrário. E **0 gerações** com o defeito depois de 15/09 18:11Z.

---

## 3. 🔴 A hipótese que eu matei antes de publicar (era minha, de hoje)

Meu **primeiro** controle negativo usou a ideia real dele de 04/09 — *"Ao fundo,
**meu consultório**"*, refs=7 — e deu **0/3**. Por uns vinte minutos aquilo
parecia uma **regressão do `#297`**: *"o conserto fez o modelo inventar
atribuição a foto extra"*. Era manchete pronta.

**É falso.** Uma das 7 referências daquela geração **é o consultório dele**
(conferido na imagem, §1.2). Quando ele escreve "meu consultório" e sobe 7 fotos,
o Haiku dizer *"o consultório da foto extra"* é a leitura **certa**, não
invenção. O controle é que estava **contaminado**: não testava invenção, testava
uma atribuição legítima.

Troquei pelo controle limpo e **deixei o erro documentado no cabeçalho da
ferramenta**, com as duas imagens nomeadas, pra ninguém repetir. O gêmeo desse
controle no arquivo do `#270` (6 selfies, fundo neutro) passa 3/3 hoje — que é a
prova de que não há regressão.

---

## 4. 🟢 Aluno: crédito devolvido e carta enviada

**Dinheiro.** A geração `0f0efe39` custou **525 cr** e **não tinha estorno** —
conferido casando **`ref_id`**, nunca por `kind` (armadilha de 20/08). Estornado
hoje pelo **caminho de produção** (RPC `add_extra_credits`,
`ref_type='image_refund'`, `ref_id` da geração — o mesmo que
`images/finalize.ts:108` usa). **Conferido no banco depois de gravar**, não na
fala da RPC: linha `+525 image_refund` às 11:51:04Z, saldo **55.305 → 55.830**,
delta **525 = esperado**.

**Carta** (regra 8, decisão minha): enviada 16/09, cópia **confirmada** em
Enviados **uid 2502**, e registrada em `emails_enviados` com origem
`ronda-manual`. Assumi o defeito, assumi que a resposta de 06/09 foi dica de uso
para um problema nosso, mostrei o texto dele e o que o gerador recebeu, confirmei
o estorno e disse que a foto do consultório segue salva na conta. **Não prometi
resultado, não empurrei recompra, não prometi prazo.**

`#285`: `investigating` → **`fixed`**, `resolved_commit = 3e8af23`,
`resolution_note` 0 → 4.286 chars.

---

## 5. 🔴 O `#270` foi fechado cedo demais — 25.000 créditos que ninguém devolveu

Fechar o `#285` me obrigou a olhar o `#270`, e o que achei é maior que o meu
cartão.

A nota de fechamento do `#270` conta, com todas as letras, **"22 de 43 gerações
(51%), 15 alunos"** — e o fechamento **avisou 1 aluno e estornou 0**. Medido hoje
casando `ref_id`:

> **22 gerações · 15 alunos · 25.525 créditos debitados · ZERO estornados.**

O próprio aluno daquele cartão (`pcezardireito@icloud.com`) tem **3** gerações
atingidas e **1.575 cr** não estornados: foi avisado, não foi ressarcido.

Pela regra 8, *"fim"* é conserto em produção **+ aluno avisado + crédito indevido
devolvido**. Duas das três pernas estavam abertas. Deixar `fixed` faria 14 alunos
e o dinheiro **sumirem da fila junto com o bug** — então **reabri**
(`fixed` → `investigating`), com a lista nominal dentro do cartão e a nota
deixando explícito que **o código está certo** e não estou desfazendo o conserto.

**O que eu NÃO fiz, de propósito:** estornei só os 525 do aluno do **meu**
cartão. Os outros **14 alunos / 25.000 cr** são estorno em escala + e-mail em
massa — **decisão do Johnny** (regra 8), não minha. Levado ao grupo hoje.

Ferramenta pronta pra quando houver decisão:
`_frank/ferramentas/2026-09-16_estornar_foto_extra.cjs <email> [--confirmar]` —
usa a RPC de produção, **ensaia sem `--confirmar`**, **pula quem já tem estorno
casado** (o falso negativo que paga em dobro) e confere o saldo no banco depois
de gravar.

---

## 6. 🟢 O `#101` destravou — e não fui eu

O **PR #311** da ronda das 11hZ **foi mergeado**: entrou na main como
**`366e1cd`**. O `ea77d4f` da nota anterior não aparece como ancestral porque o
merge foi **squash** — o que vale é o `366e1cd`.

**Conferido em uso, não por leitura de git:** a carta de hoje pro Marcelo saiu
pelo `enviar_email.cjs` e imprimiu *"registrado em `emails_enviados` (origem
`ronda-manual`)"*. Ou seja, a ronda agora deixa rastro no mesmo livro-caixa da
casa — que era o passo que o cartão nomeava como pendente. Anotei lá; **não
fechei**, porque a outra metade do título (os bounces originais) é decisão de
quem pegar o cartão com a régua toda.

---

## Fim de ronda

- `#285` (`e6c53db1`): **FECHADO** (`fixed`), causa provada, aluno avisado,
  **525 cr devolvidos e conferidos no banco**.
- `#270` (`9d9baab6`): **REABERTO** com a medição de 22 gerações / 15 alunos /
  **25.525 cr debitados e 0 estornados**.
- `#101` (`b2651a6f`): anotado — **bloqueio do merge deixou de existir**. Não fechei.
- **Aluno avisado: 1** (Marcelo, uid 2502 confirmado). **E-mail em massa: nenhum.**
- **Crédito devolvido: 525** (1 aluno, pelo caminho de produção, conferido no banco).
- **Código novo em produção: nenhum** — o conserto já estava no ar (`3e8af23`).
- **GPU gasta: nenhuma. Migration aplicada: nenhuma. Assinatura mexida: nenhuma.**
- Número que eu **matei** antes de publicar: *"o conserto do `#297` regrediu e
  inventa foto extra"* — controle contaminado, meu, de hoje (§3).
- Número que **não é meu pra resolver**: 25.000 cr de 14 alunos — do Johnny.
- `#11`, `#15`, `#99`, `#223`, `#226`, `#234`: **não toquei.** Seguem em decisão
  do Johnny ou esperando aluno. O `#99` tem **prazo em 19/09 12:00Z**.
- Aviso do grupo: enviado por `notify-grupo.sh`, só fato consumado.
