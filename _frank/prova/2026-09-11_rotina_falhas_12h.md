# Ronda das falhas — 11/09/2026, ~11h30–12hZ

Método serial (regra 8, ordem de 21/08): um incidente, até o fim.
Canal: ordem de 31/08 — tudo de FastCloner no **grupo**, nunca no privado.

---

## O que saiu daqui

| fato | onde |
|---|---|
| **1 incidente FECHADO** (`#351` / `c3aab2fd`), resolvido de verdade | `fixed`, 1 linha afetada, conferido na releitura |
| **2 PRs mergeados na main** (#236 `4df4a02`, #237 `fe0e1e5`) | fix em produção |
| **1 escalação ao grupo** (fechamento + urgência do Marcelo) | `notify-grupo.sh` |
| **1 chave de recado apagada** (`para_frank_c3aab2fd`, com `DELETE`) | confirmado 0 sobrando |
| **0 e-mail, 0 crédito movido, 0 GPU, 0 migration** | — |

---

## `#351` / `c3aab2fd` — o sensor estava cego, e agora não está · **FECHADO**

Peguei este primeiro por ordem da própria rotina (§1-B/1-C: recado e patch do
Vigia vêm **antes** do resto), não por escolha minha de pular a fila. É também o
único tipo de card que, se ficar aberto, **contamina a triagem de todos os
outros**: é o instrumento com que eu leio a caixa.

**O que era.** `ler_caixa.cjs:182` carregava a regex de palpite de fronteira MIME
que o `#337` já tinha tirado de produção (`a90e9b0`, PR #232). A linha que o
Gmail põe em todo encaminhamento (`--------- Mensagem encaminhada ---------`)
casa nesse palpite: o corpo era cortado no caractere 0 e saía
`(sem corpo em texto)`.

**Por que isso é grave e não é detalhe de ferramenta.** O defeito dispara
**exatamente em encaminhamento** — que é como o aluno contesta cobrança (ele
encaminha o NOSSO aviso). O Vigia lê a caixa com esta ferramenta em toda ronda.
Resultado: **o sensor reportava silêncio do aluno onde houve pedido.**

**O que fiz.** Não alarguei o palpite e **não copiei de novo** — foi a cópia que
criou o vão. `ler_caixa.cjs` passa a carregar `mail-charset.ts` por `jiti` (mesmo
caminho já usado pelo `2026-09-09_medir_mojibake_na_caixa.cjs`) e a usar
`mailText` / `header` / `decodeWord` / `stripHtml` / `fronteirasDeclaradas` /
`cortarNaFronteira` **de produção**, abortando se algum export sumir.
**−88 linhas de cópia**, e veio junto a decodificação de charset correta (a cópia
ainda fazia o round-trip `latin1` que o `#320` substituiu). `_anexos.cjs` recebe
`decodeWord` por parâmetro, então **herdou o conserto de graça**.

`mailText` ganhou `maxChars` **opcional** (default `BODY_MAX`) porque o teto
configurável do `--corpo N` era a **única** razão de existir a cópia. Teste novo
trava o parâmetro: quem apagá-lo obriga a ferramenta a ter cópia outra vez, que é
como o vão nasceu.

**Prova medida, não ensaio:**

| | antes | depois |
|---|---|---|
| uid 517 (Marcelo) | `(sem corpo em texto)` | **2.995 chars** |
| corpo vazio nas MESMAS 60 mensagens SEEN | **1** | **0** |
| testes `mail-charset` | 28/28 | **29/29** |

O teste `teto de 4000 chars (BODY_MAX) preservado` segue verde — é ele que prova
que **produção não mudou**. `tsc` e `eslint` limpos.

### Duas ressalvas, porque relatório que só tem acerto não serve

1. **Eu fechei antes da hora, e tive que voltar.** O PR #236 saiu com a afirmação
   de que "a ferramenta parou de adivinhar". **Não tinha parado**: havia um
   SEGUNDO palpite vivo em `anexosDoRaw` (linha 185), medindo tamanho de anexo.
   Só apareceu porque fui conferir na main se a regex tinha sumido, em vez de
   confiar no meu próprio diff — o `grep` voltou **2**, não 0. Fechado no PR #237.
   Caso sintético: `.eml` encaminhado sai como **16 bytes em vez de 108** (85% a
   menos). **Na amostra real de 60 mensagens a saída ficou byte a byte IDÊNTICA**,
   então essa segunda perna é **preventiva, não curativa** — não conto vítima
   evitada.
2. **Um comentário meu era falso e eu corrigi.** No #236 escrevi que o tamanho do
   anexo decide o teto de 2MB. **Não decide**: quem decide é `tam` (RFC822.SIZE,
   linha 596), e `anexosDoRaw` só roda depois, na mensagem já baixada. O número é
   informativo; o que ele estraga é a decisão humana de baixar o anexo com
   `--anexos <uid>`.

Ainda: o Vigia previu ~2.905 chars, o medido é **2.995** (3% a mais). A frase
final bate exata; a diferença é método de contagem e não muda conclusão nenhuma.
**Registro o número que eu medi, não o que me passaram.**

**A lição.** O bloco se anunciava *"portado de mail-respond.ts, comportamento
idêntico"*. Deixou de ser idêntico e ninguém viu. **Cópia que se declara idêntica
é justamente a que envelhece calada** — agora existe UMA implementação só.

---

## O que levei ao grupo, e não resolvi porque não é minha alçada

🔴 **Marcelo — a garantia fecha hoje 00:00Z (~12h a partir de agora).** O conserto
acima tornou **legível** o que já estava na caixa desde 09/09: o pedido de saída
dele, terminando em *"Eu não quero mais seguir no programa."* Ele já foi avisado
por e-mail na ronda das 11h para pedir direto na Hotmart (caminho que vale
sozinho e não depende de nós). **Os R$97 continuam esperando a palavra do
Johnny** — alçada dele, não minha, e eu não a tomei.

⚠️ Correção de registro: a ronda das 11h chamou o card do Marcelo de
`#265 / 71410a81`. O uuid `71410a81` é o card **da janela de garantia**
(`account.ts:171-18…`), não o do Marcelo. Não propago o mapeamento errado.

---

## O que continua parado (herdado, não tocado nesta ronda)

| | idade | passo em que está |
|---|---|---|
| Marcelo — R$97 | **fecha hoje 00:00Z** | palavra do Johnny |
| `#341` `b633b18c` — 13 pessoas, 136.825 cr | 24h | palavra do Johnny (teto 9-B) |
| `#309` Victor — prazo **já venceu** | 3d | decisão de vendedor na Hotmart |
| `#313` `2d0509b4` — 15 vitalícios de graça | 3d | ordem de conserto anotada |
| `#331` `3528dd59` — Mastroianni | 2d | reposição de crédito |
| PR **#92** em DRAFT | 15 dias | — |

⚠️ **A fila de recados está com ~30 chaves `para_frank_*`**, várias pedindo
e-mail a aluno que espera dentro do app (onde ninguém responde). É o maior bolsão
de aluno esperando que existe hoje e merece ser o alvo da próxima ronda.

## Números da ronda

- **72 → 71** em `open`/`investigating`. **1 fechado, e fechado de verdade** —
  fix na main, aceite do Vigia cumprido e medido.
- **0 e-mail enviado, 0 crédito movido, 0 GPU, 0 migration, 0 e-mail em massa.**
- Caixa lida só com `EXAMINE` + `BODY.PEEK`, busca `SEEN`. **Não toquei em
  não-lido** (fila da Fast segue em 0).
- 🧹 Higiene, **estável**: seguem **8 arquivos** modificados não commitados em
  `frontend/**/sgp*` e `frontend/messages/*`, mais os não rastreados em
  `_frank/rascunhos/`. **Décima primeira ronda seguida.** Não são meus, **não
  toquei**; commitei só os 3 arquivos do fix e este log.
