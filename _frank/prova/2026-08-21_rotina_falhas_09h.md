# Rotina das Falhas — ronda das 09h UTC de 21/08 (Frank, dono da fila)

Ordens lidas: `_frank/ordens/README.md` (índice) → `2026-08-20_dono_da_fila_e_fila_zerada.md`
(⭐ vigente) + `2026-08-20_fluxo_quem_olha_o_que.md` + `2026-08-20_correcoes_da_ronda.md` +
`06_RELATORIO_E_LIMITES.md`.

**Fila no início:** 6 abertos (todos `investigating`). **No fim: 4.** **Fechados: 2, os dois com
fix REAL em produção.** Zero incidente novo. Zero e-mail não-lido. Zero preso.

**O que esta ronda entrega, e por que é diferente das 5 anteriores:** eu tinha um fix meu,
escrito e testado desde as 03h, parado num PR sem merge — e cinco rondas seguidas, incluindo a
minha das 08h, o listaram como *"travado no Johnny"* **sem nunca dizer por quê**. Não estava
travado nele. Estava travado em mim. **Mergeei, verifiquei o deploy, e fechei 2 incidentes.**

---

## 1. 🔴 O erro que eu estava cometendo há 6 horas

O PR #22 foi aberto por mim às 02:48Z. Das 06h em diante, toda ronda repetiu a mesma linha —
*"PR #22 sem merge = não está em produção"* — e o empurrou pro balde **"travado no Johnny"**.
O Vigia das 06h chegou a escrever: *"o que trava de verdade é o PR #22 sem merge."*

**Fui procurar a justificativa da escalada e ela não existe em lugar nenhum.** Nenhuma ronda
registrou um motivo. Foi escalada por inércia: uma ronda escreveu, a seguinte copiou.

O que as ordens dizem:

- `06_RELATORIO_E_LIMITES.md`, linha 44 — o Frank fecha sozinho: **"consertar bug e publicar
  (com typecheck + lint passando)"**.
- `2026-08-20_correcoes_da_ronda.md` — **"não espere ordem pra corrigir o que já provou"**, e
  *"escalar o que já foi decidido custa o tempo dele — que é o recurso mais escasso da operação,
  ainda mais com ele viajando a partir de 24/08"*.
- A convenção do repo confirma pelo avesso: o PR #17 traz **"NÃO MERGEAR SEM OK DO JOHNNY" no
  próprio título**. Quem precisa de aval é marcado. O #22 não era.

O #22 é **só texto e uma constante compartilhada**: nenhum limite mudou de valor, nenhuma
migration, nenhuma GPU, nenhum crédito, nenhum acesso de aluno. É reversível com um revert.
**Enquadra na linha 44 e sempre enquadrou.**

O custo do meu erro é medível: das 02:48Z às 08:43Z, **6h** em que todo aluno que esbarrou na
porta leu uma mensagem que a gente já sabia mentir — enquanto a correção existia, testada, a um
comando de distância.

## 2. O que eu conferi ANTES de mergear (não confiei no corpo do PR)

Worktree isolado (`/tmp/wt-pr22`), com `origin/main` mergeado dentro — a branch estava **12
commits atrás** e testar sem isso testaria outra coisa. O merge trouxe só `_frank/` (documentos),
zero conflito de código.

| conferência | resultado |
|---|---|
| `tsc --noEmit` | **exit 0** |
| `eslint` nos 6 arquivos | **exit 0** |
| `node --test regua-audio.test.ts` | **18/18** (o corpo do PR dizia 6; a branch cresceu com o commit `a713f6c`) |
| `mergeable` / `mergeStateStatus` | `MERGEABLE` / `CLEAN` |
| colisão com os outros 14 PRs abertos | **nenhum** toca os 5 arquivos (conferido PR a PR) |

**Li a mensagem inteira antes de subir**, porque é texto que aluno pagante lê. Ela diz quanto
falta, diz que **nada foi cobrado**, e no caso de envio pela metade diz *"recebemos apenas X dos
Y arquivos… **não é que você gravou pouco — a MESMA gravação serve. Envie de novo**"*. Isso é
exatamente a cura que a ronda das 08h provou que **5 alunos descobriram sozinhos** (reenviar, não
regravar).

## 3. Merge e deploy — com a hora que vale

- Merge: **`d12b008`**, 08:43:57Z.
- Deploy `Deploy Frontend (production)`, run **32464527768**: **success, `completed_at`
  08:46:39Z**, com `Build Next.js` → `Rsync para o servidor` → `Install runtime deps + reload
  PM2` todos verdes.

Ancorei em **08:46:39Z**, não na hora do merge, seguindo o item 2 da ordem de 20/08: *"a hora que
vale é sempre o fim do job que troca o que está rodando"*. **Merge não é produção.**

## 4. Os 2 incidentes fechados

### `07745f61` → **fixed** (`d12b008`)

**O que era:** dois mínimos diferentes e o aluno só conhecia o errado. A **PORTA** exige 20min
brutos; o **TREINO** exige 10min de fala limpa; nenhuma das duas mensagens citava a outra. Quem
obedecia gravava 12–15min e batia na porta. Somado a isso, `Math.round` nos dois lados produzia a
frase impossível *"Áudio total 20min < mínimo de 20min"* (voz `a046ede6`, kelinnavelar, 1174s).

**O que fiz:** régua em fonte única (`lib/voices/regua-audio.ts`), os 3 pontos da porta passam a
importar a mesma constante, minutos do aluno arredondam **pra baixo**, e `finalize-training`
passa a citar o alvo da porta junto do diagnóstico do treino.

**A objeção do Vigia (04h) tinha duas metades — e eu separei as duas em vez de fechar por cima:**
a metade *"'grave mais áudio' é orientação errada pra quem perdeu arquivo"* está **respondida**
pela `mensagemEnvioIncompleto`. A metade *"parte não vai subir de novo"* **não está** — e por
isso foi **roteada pro `2c5bab42`**, que continua aberto, em vez de morrer junto.

**Escrito na nota o que NÃO está coberto:** os e-mails já enviados às 01:09 seguem na caixa de
quem recebeu; o `error_message` já gravado **não foi reescrito** (o painel lê do banco ao vivo,
então quem já está em `rejected_too_short` continua lendo a frase antiga).

### `b9c5a0d1` → **fixed** (`7ee785f`)

**O que era:** o detector da classe "pagante sem voz" media só por `status='failed'`. Como
`rejected_too_short` é terminal e não é `failed`, **nenhum detector olhava pra ele** — a classe
aparecia com 3 quando eram 5.

**O que foi feito:** o detector parou de **enumerar estados ruins** e passou a **afirmar o estado
bom** ("esse pagante tem produto?"). Enumerar exige adivinhar a lista completa e fica cego no dia
em que alguém cria um status novo.

**Verifiquei ao vivo, não acreditei no commit:** rodei o `varredura_travados.cjs` às 08:41Z e ele
reportou **5**, nomeando os cinco. Conferi também que `7ee785f` está em `origin/main`.

**Antes de fechar, protegi os 2 alunos que ele revelou.** Fechar este incidente deixaria
`jrfengenhariadf` e `leandro.fitoway` **sem incidente nenhum** — o `5c3f1f8b` falava em 3 alunos.
Absorvi os dois nele explicitamente (nome, voz, créditos, prazo de acesso), **e só então** fechei
aqui. **Nenhum aluno ficou órfão de incidente.**

## 5. `2c5bab42` continua aberto — e digo a diferença

Parte do fix foi pra produção junto (`contarSlotsDoEnvio` detecta o buraco pela numeração do slot
na própria chave do R2, sem migration; `rescue-stuck-uploads` agora separa "nunca chegou" de
"chegou truncado"). **Mas isso conserta a FRASE, não a PERDA.** O arquivo continua sem subir; a
diferença é que agora a gente admite em vez de culpar o aluno. **Fechar seria marcar `fixed` sem
ter resolvido — regra 14.**

Deixei na nota o que já foi **descartado** como causa, pra próxima ronda não remedir:
`voice-creator.tsx` não produz buraco (manda todas as chaves e aborta se qualquer PUT falha,
assim desde `727d461`); `uploads-complete` **não** é a causa (primeira leitura, errada, corrigida
às 05h); e o Vigia conferiu no R2 que os faltantes **nunca chegaram** ao bucket. Sobra o
**resgate**, que grava o que encontrou no bucket.

## 6. Zumbi: agora tem fix de verdade

`acf8acd6` segue o **único** fechado que voltou a disparar (1 de 66), **esfriando** — 80h sem
disparar, 6 ocorrências depois de um fechamento de 09/08 que não resolveu. O defeito que sobrava
era o gêmeo aritmético do `Math.round`, e ele **entrou em produção agora** no `a713f6c`.

Anotei sem mexer no status: se disparar depois de 08:46:39Z, a causa é **outra** — a próxima
ronda não deve gastar tempo remedindo o `Math.round`.

## 7. Já resolveu sozinho? Conferido ao vivo

`aluno.cjs` nos 2 travados: **não**, nenhum dos dois. `jrfengenhariadf` segue com 1 voz
`rejected_too_short`, 100.000 créditos, zero voz pronta, última atividade 28/07.
`leandro.fitoway` idem, 97.620 créditos — e ele **está usando o produto** (cena de estúdio em
15/08, vídeo clone), só nunca conseguiu a voz.

## 8. Saúde da produção e a caixa

- **0 registros presos** em estado intermediário.
- **Caixa: 0 não-lidos.** Não li a caixa pra triagem (a fila de incidents é a fonte).
- `agent_notes`: todas as 5 gravações desta ronda saíram do `anotar_incidente.cjs`
  (ensaio → `--confirmar`), com **"1 linha afetada" conferido na releitura** de cada uma. Nenhum
  script solto.

## 9. O que está no Johnny (para o relatório da noite)

A fila agora encosta num teto **honesto** — os 4 que sobram estão de fato fora do meu alcance,
diferente do #22, que estava no meu.

1. 🔴 **Texto do e-mail pros 5 do `5c3f1f8b`** — o certo é **"perdemos N dos seus M arquivos,
   reenvie"**, não "regrave". **A mensagem em produção já está honesta desde hoje; o que falta é
   avisar quem já está parado, porque nenhum deles sabe que precisa reenviar.** Prazo mais curto:
   **jrfengenhariadf perde acesso em 25/08**.
2. 🟡 **`dirceu.moura.cruz78` perde acesso em 22/08 12:00 UTC (~27h)** — maior vítima individual
   (21 arquivos perdidos), não está travado (tem voz pronta), por isso não virou ping.
3. **1 geração de GPU** para o veredito do piloto da Katia (`ce6e157d`), antes de 22/08 12:00Z.
4. **Backfill do `error_message`** das 18 linhas carimbadas em 18/08 — seguem com a frase que
   culpa o aluno, e o painel lê do banco ao vivo. Proposta, não executada.
5. **Backfill do `ja_pagou`** — coluna existe, `false` para 100% da base, ninguém lê hoje.
6. `feat/incidents-resolved-guard` — gêmeo superado, numera migration 85 que o PR #18 já usa.
   Sugestão de apagar, não executada.

**Nesta ronda: nenhum e-mail enviado, nenhuma GPU gasta, nenhum crédito mexido, nenhum acesso
alterado, nenhuma migration, nenhum status de voz tocado, nenhuma caixa lida para triagem.**

## 10. Por que NÃO mandei mensagem agora

O gatilho do "na hora" é **pagante travado sem solução**. Os 2 travados já foram ao Johnny na
ronda das 05h e nada mudou no estado deles. O que mudou hoje é a **mensagem em produção**, que
melhora a situação em vez de piorar. Ping a cada ronda mata o sinal que a regra existe pra
proteger. Vai como item 1 da abertura do relatório da noite.

## 11. A lição desta ronda (a que eu quero que fique)

> **"Travado no Johnny" sem motivo escrito não é bloqueio — é escalada por inércia.**
> Se uma ronda escreve que algo depende do dono, a ronda seguinte tem que achar **o motivo
> registrado**. Se não achar, o item volta pra mesa de quem pode resolver. Cinco rondas
> produzindo medição de qualidade e zero fechamento não era teto da fila: era eu confundindo
> **medir** com **entregar**.

## 12. Passo fixo de fim de ronda

- ✅ `git fetch origin` + **`origin/main..HEAD` vazio**.
- ✅ Estou na `main`; este log foi **direto na main**.
- ✅ `git branch` + `git rev-list main..<branch>` em toda branch local — nenhum fix de aluno
  preso.
- ✅ Worktree `/tmp/wt-pr22` removido.
- ✅ Migrations: nenhuma aplicada nem commitada nesta ronda.
