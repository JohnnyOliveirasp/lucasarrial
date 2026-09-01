# Rotina das falhas — 01/09/2026, 00hZ (31/08 21h BRT)

Método serial (regra 8). Um caso levado até onde dava. Ordens lidas antes de
tocar em qualquer coisa: `README.md` do índice, `2026-08-29_desligar_vigia_e_frank.md`
(planilha desligada) e `2026-08-27_vigia_so_erro_de_sistema.md`.
Janela: 21h41 BRT, dentro do turno 08h–23h.

## Estado da fila ao começar

5 abertos (todos `investigating`), 4 `aguardando_aluno`, 2 itens presos na
varredura. Nada da planilha foi lido, escrito ou reprocessado.

## O caso que eu peguei: #192 (Robert Ros)

Escolhido pela regra: o mais antigo aberto com aluno afetado depois do #173,
que está travado em decisão que não é minha (ver abaixo). Aberto em 29/08
21:23Z, `tecnico`, sem `resolution_note`.

### O achado: o fix estava em produção e MORTO

O **PR #135** (merge `f605551`, deploy verde 31/08 **19:42:56Z**) entregou
`frontend/src/lib/llm/mandato-normalizacao.ts` — a guarda determinística que
desfaz a troca de palavra do aluno feita pelo normalizador fora do mandato.
Módulo completo, **21 testes passando**, incluindo o caso **exato** do Robert:
`clica -> clique` e `escolhe -> escolha`, ambos classificados `reverte-flexao`.

**Só que `aplicaGuardaDeMandato` não era importada em lugar nenhum de
`frontend/src`.** Grep limpo em `.ts`/`.tsx` fora do próprio teste.

Módulo mergeado, testado e **morto**. Depois do deploy verde o defeito seguiu
**inteiro** em produção — o aluno continuava recebendo o áudio com as palavras
dele trocadas.

> ⚠️ **Armadilha nova, para o manual.** As rondas já sabiam que *"card completed
> não é em produção"* e que *"só a main deploya"*. Esta é a camada seguinte:
> **mergeado na main e deployado verde ainda não é EXECUTADO.** Código pode
> estar em produção e não estar no caminho de ninguém. A conferência que faltou
> não é `git branch -r --contains` (essa passou) — é **grep de quem importa**.
> Ela custou ~5h de defeito vivo com o aluno já avisado de que estava resolvido.

Por que a guarda antiga não pegava: `keepsOriginalWords` (`normalize.ts:152`)
exige 50% das palavras preservadas — é a guarda **anti-conversa** (caso
Anderson, o modelo respondia ao texto em vez de normalizar). Trocar 2 palavras
em 81 passa folgado.

### O que eu fiz

**PR #142**, branch `feat/liga-guarda-mandato-normalizador`, commit `d2759f5`.
Chama a guarda dentro de `normalizeTextForTTS` — único caminho por onde o texto
do aluno passa antes do TTS. Guarda **antes** do `sanitizeForTTS`, porque ela
compara com o texto **cru**, que é o que o sanitize ainda não tocou.

`tsc --noEmit` limpo · 21/21 testes do módulo.

Prova do caminho **real** (guarda + sanitize compostos, como em produção):

| aluno escreveu | LLM devolveu | aluno ouve |
|---|---|---|
| `clica nos dois` | `clique nos dois` | ✅ `clica nos dois` |
| `Escolhe o seu caminho` | `Escolha o seu caminho` | ✅ `Escolhe o seu caminho` |
| `pra voce` | `para voce` | ✅ `pra voce` — 134 ocorrências, 58 alunos |
| `custa R$ 50` | `custa cinquenta reais` | ✅ passa — expansão legítima intacta |

A última linha é a que impede a regressão: expansão, remoção e inserção passam
intactas. A guarda só mexe em substituição 1×1 de palavra alfabética.

**Não mergeei** — código vai por PR.

### O que isso NÃO resolve

O **timbre**, que é a primeira queixa do Robert. Continua em aberto e o chamado
**não afirma** o contrário. A hipótese do recorte de ~30s foi medida, **não se
sustentou** e já foi retratada ao aluno em 31/08.

Por isso o #192 segue `investigating`: o fix existe, mas **não está em
produção**. Fechar agora seria a regra 14 pelo avesso.

### Aluno: não escrevi, de propósito

Ele foi avisado em 31/08 00:48Z com a verdade, **sem data**, e instruído a não
regravar e a não gastar crédito gerando para testar *"enquanto a correção não
estiver no ar"*. Do ponto de vista dele **nada mudou** — ela ainda não está.
O gatilho combinado foi o deploy; e-mail agora seria repetir "espera" sem ação
nova. Escrevo assim que o #142 entrar.

> 🔴 **Prazo para a próxima ronda:** o acesso dele vence **2026-09-03** e ele
> tem 86.412 créditos. Se o #142 não entrar antes disso, ele perde justamente a
> janela de gerar de novo para comparar — que foi o que pedimos que esperasse.

## #173 — fica aberto, e por quê

A nota de 29/08 13:52Z termina com *"Fecho aqui"* e **o status nunca virou**.
Não foi reabertura: é a armadilha do update que afeta 0 linhas em silêncio, a
mesma que prendeu o #99. **Segunda vez em duas rondas** — por isso está
registrado como padrão, não como conserto de campo.

E eu **não fechei**, mesmo com a escrituração pedindo. Aquela nota mandava
fechar delegando a parte de sistema ao #180 e ao #184, e os dois foram para
`ignored` (sem nota) pela ordem de 29/08, que desligou a planilha/onboarding
antigo. **Não reabri nenhum dos dois** — a causa deixou de existir e o processo
virou manual, conforme a ordem. Mas o efeito colateral é que, apoiado neles, o
#173 sairia do board com o aluno **sem ter sido atendido**.

Estado real, medido hoje: `johnathan.ppires@gmail.com` pagou **R$ 2.391,00**
(3 avulsas APPROVED em 27/08 — HP2705120177, HP3595813880, HP0272337557),
conferido pelo `pagou_de_verdade.cjs` (fonte de verdade; `profiles.ja_pagou`
está suspensa). A conta dele: **sem acesso, 0 créditos, 0 vozes**. Ele fez a
parte dele por completo desde 27/08.

**Travou numa decisão comercial que não é minha:** o que a compra avulsa/de
CURSO dá direito dentro do FastCloner. A bola **não** está com o aluno — ele foi
retratado em 31/08 16:46Z e dispensado de mandar qualquer coisa. Por isso não é
`aguardando_aluno`: seria mentir sobre de quem é a vez.

## O que continua precisando de gente

1. **A decisão comercial do CURSO/avulso** — é o mesmo gargalo da ronda
   anterior, e continua sendo o item de maior valor parado: **R$ 7.644,13** em
   compras aprovadas de gente esperando **uma** resposta.
2. **Merge do #142** — enquanto não entra, 58 alunos seguem tendo palavra
   trocada e o Robert segue esperando o retorno que prometemos.

## O que eu não fiz

Não liberei acesso, não dei crédito, não estornei, não rodei import, não
disparei treino, não gastei GPU, não fiz migration, não mergeei em `main`, não
reabri incidente da planilha e não escrevi a nenhum aluno.

## Fim de ronda

- `git log origin/main..HEAD` vazio antes de commitar este log.
- Fix do #192 **não** ficou preso em branch: `origin/feat/liga-guarda-mandato-normalizador`
  tem o commit e está no **PR #142**; conferido que `origin/main` ainda **não**
  contém `aplicaGuardaDeMandato` (é o esperado — aguarda aval).
- Nenhuma migration envolvida, nenhuma coluna nova.
