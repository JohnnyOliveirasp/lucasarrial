# Ronda das falhas — 31/08/2026, 11h41–12h05 UTC (Frank)

Método serial (regra 8, ordem de 21/08). Ordem de 29/08 respeitada: **nada da
planilha foi lido, escrito, classificado ou reprocessado**, e nenhum incidente
de causa-planilha foi aberto ou reaberto.

## Placar

- Fila no início: **5 abertos + 3 aguardando_aluno**.
- Fila no fim: **5 abertos + 3 aguardando_aluno**.
- Fechados como `fixed`: **0**.
- Alunos avisados: **1** (Luciano, #99).
- Fix em produção: **0**. Os 4 PRs que destravariam a fila seguem OPEN.

O backlog não baixou. Isso é resposta legítima só se vier com o passo que
emperrou em cada um — está tudo no fim deste log.

## Caso 1 — #99 Luciano (`6c38c99d`): achei um erro NOSSO e ele custava o prazo

Peguei pelo serial (mais antigo com aluno afetado, 23/08). As 11 rondas
anteriores pararam em "depende de decisão comercial do Johnny". **Desta vez
tinha, sim, passo meu — ninguém tinha olhado o que o e-mail DIZ ao aluno.**

O e-mail de 29/08 10h47Z (Enviados uid 314) escreve, com todas as letras:
*"prazo de garantia até 02/09"*. A ronda das 10h43 de hoje já tinha medido que
`warranty_date` = `2026-09-02T00:00:00Z`, ou seja **meia-noite do dia 2 é o
instante em que FECHA**, e o último dia útil é 01/09. As duas medições existiam;
ninguém tinha ligado uma na outra.

Quem lê "até 02/09" entende que tem o dia 2 inteiro. Se ele confiasse no nosso
e-mail, pediria no dia 2 e **perderia os R$ 97 por erro de redação nosso**. Isso
deixou de ser decisão do Johnny e virou defeito nosso — e defeito nosso, em caso
individual que eu estou tratando, é alçada minha (regra 8).

**Ação:** e-mail enviado 11h43:02Z (Enviados **uid 365**). Curto, e só isso: a
data grava 02/09 00h00, então fecha na virada de amanhã; o último dia é 01/09;
a imprecisão foi minha; se quiser encerrar, basta responder até amanhã, sem
justificar. Dei também o caminho **pela Hotmart**, que não depende de decisão
nossa — para ele não ficar refém do nosso silêncio interno. **Sem `--bcc`**, de
propósito (lição do #201, onde o bcc foi junto no 550). Conferido depois de
enviar: cópia em Enviados uid 365 e **nenhum bounce novo** (os únicos seguem
sendo uid 380/381, de 30/08). O bounce do #201 voltou em ~2s, então ausência
aqui é sinal, não esperança.

Reconferido na fonte antes de afirmar qualquer coisa no e-mail:
`payment_events` por `buyer_email` — R$ 97 APPROVED 26/08, garantia
`2026-09-02T00:00:00Z`. Conta: acesso ativo até 19/09, 166.035 créditos, voz
`ready`, video_clones todos `ready`. O estorno do último teste está lá: **+630
com `kind='extra_purchase'` e `ref_type='video_clone_refund'`** — a armadilha
documentada, viva e visível: quem filtrar por `kind` conclui que ele não foi
estornado e paga em dobro.

Status: segue `investigating` — o relógio de dinheiro está vivo. **Registrei a
reclassificação para quem pegar depois:** pelo teste da ordem de 27/08 ("se o
código estivesse certo, isso não teria acontecido?") este caso **não é erro de
sistema** — nada quebrou, é insatisfação com o teto do motor mais uma decisão de
R$ 97. Foi por estar na fila como investigação técnica que ele gerou 11
escalações em 8 dias sem nunca ter passo técnico pendente. Depois de 01/09 ele
vai para `ignored` com nota de reclassificação, **nunca para `fixed`** — nada foi
consertado porque nada estava quebrado.

## Caso 2 — #192 (`ae0061d5`): travado, e não em mim

Os dois passos que faltam são de outra pessoa: **(a)** a decisão binária do
Johnny no PR #135 (ligar a guarda inteira ou só o bucket reverte-protegida — a
segunda é a recomendada) e **(b)** alguém **ouvir** o timbre (9-D). Conferi antes
de agir: o pedido de ouvido humano **já existe** desde 30/08 02h (nota 7) e segue
sem resposta (nota 9). Repostar seria exatamente o progresso parcial que a regra
7 proíbe. Não escrevi ao aluno: ele foi escrito em 30/08 01h e **não há fato novo
para ele**.

## Caso 3 — a verificação que eu vim fazer e que deu tudo certo

**Nenhum aluno em silêncio.** Os quatro que escreveram por último foram
respondidos em minutos, não em horas:

| aluno | escreveu | respondido |
|---|---|---|
| Jussara (#203) | 31/08 00h02Z | 00h05Z (uid 361) e 00h52Z (uid 363) |
| Liliane (#196) | 30/08 07h22Z | 07h40Z (uid 348) e 10h51Z (uid 351) |
| Natanael (#197) | 30/08 07h48Z | 07h50Z (uid 349) e 11h54Z (uid 352) |
| Vinicius (#202) | 30/08 23h47Z | 31/08 10h46Z (uid 364) |

E os 3 presos que a varredura acusa **já foram avisados**, com cuidado: Marcelo
(29/08 23h50, uid 341), Kelinn (29/08 13h55 uid 316 **e** 23h54 uid 342),
Luan Marçal (30/08 01h46, uid 347). Não escrevi para nenhum — aviso repetido é
ruído, e a bola está com eles.

⚠️ **Uma coisa para não repetir:** a Kelinn recebeu **dois** e-mails no mesmo dia
sobre o mesmo assunto (uid 316 e uid 342), de remetentes diferentes ("Equipe
FastCloner" e "Suporte FastCloner"), com conselhos levemente divergentes
("4 a 5 minutos" × "3 a 5 minutos"). Não é grave e não justifica um terceiro
e-mail, mas é duplicação de atendimento no mesmo caso. Acesso dela vence
**03/09**.

## Caso 4 — `d3d8d1b2` (#15): a ordem de 20/08 está vencida neste item

A ordem lista o timeout como item 1 do "que sobrou", dizendo que está `ignored`
e mandando reabrir se voltar. **Hoje ele está `fixed`.** Divergência entre ordem
e banco é para parar e conferir, não para assumir. Conferi:

- PRs **#89 e #91 estão MERGED** (28/08 20h51Z) — conferido no `gh`, não na nota.
  O merge veio **antes** do fechamento das 22h03Z, na ordem certa.
- `last_seen_at` = 28/08 **18h16Z**, ou seja **anterior** ao fechamento.
  **Nenhuma ocorrência depois de fechar.** A armadilha do `8d370ef5` (classe
  fechada que segue disparando e esconde ocorrências) **não** está acontecendo.

Fechamento legítimo. Não reabri. Anotei no incidente porque a `resolution_note`
ainda diz *"NÃO É UM FIX / REABRIR se voltar"* e ia confundir a próxima ronda.

**Duas ressalvas honestas:** o PR #89 é **reenvio automático**, trata o sintoma —
o aluno deixa de sentir, mas continua sem resposta **em qual fase** o chunk
pendura. E a instrumentação que a ordem pediu **existe e está parada**: o
**PR #90** (cita `d3d8d1b2` no título) segue OPEN. Se o hang voltar, o caminho
não é reabrir às cegas: é mergear o #90 primeiro, para a próxima ocorrência já
nascer dizendo a fase.

## Caso 5 — auditoria de fix preso em branch: **limpa** (e 3 alarmes falsos)

`origin/main..HEAD` **vazio**, árvore limpa. Auditei as 25 branches com commit
fora da main e sem PR aberto. **Nada preso.** Registro os falsos positivos
porque quase viraram "achado" no relatório:

- `frank/cancelamentos-2908` e `fix/inc108-cura-transcript-gate` pareciam segurar
  5 arquivos de `_frank/prova/`. **Os 5 estão na main** (`git cat-file -e`
  confirmou um por um). O `git diff main...branch` engana: compara com a
  **base de merge**, então mostra como "só na branch" o que foi commitado na main
  por outro caminho.
- `frank/inc169-merge` parecia segurar o fix do HeyGen (`video_title` × `title`,
  o campo que fazia **toda** geração Avatar IV ser recusada). **A main tem
  `video_title`** — conferido lendo `origin/main:.../heygen/client.ts`. #169 está
  corrigido e em produção de verdade.
- `revisao/inc150` idem: `ponte-help.test.ts` e a ponte no `help/route.ts` estão
  na main.

Lição: `main...branch` com "multiple merge bases" não serve de prova. A prova é
perguntar à main se ela tem o arquivo/a linha.

## O que trava a fila, e não é investigação

| PR | Incidente | O que destrava | Espera |
|---|---|---|---|
| #132 | #200 | seletor "Ritmo" só ativo com "Ajustar ao meu ritmo" | aval de merge |
| #133 | #201 | e-mail que volta deixa de morrer calado | aval de merge |
| #134 | #203 | "medindo…" eterno vira erro explícito | aval de merge |
| #135 | #192 | guarda de mandato do normalizador | **decisão binária** |
| #90 | (#15) | telemetria diz em que fase o chunk pendura | aval de merge |

Não mergeei nenhum: merge na main deploya, e produção precisa do aval.
**PR aberto não é produção (regra 14)** — por isso nenhum foi para `fixed`.

## Precisa de gente (nesta ordem)

1. **#99 Luciano — vence AMANHÃ (01/09).** Devolver ou segurar os R$ 97.
   Recomendo devolver. 12ª e última escalação útil (Telegram msg 664). O aluno
   agora sabe o prazo certo por escrito, então ele não perde o direito mesmo se
   a gente não decidir — mas a decisão de ser proativo ainda é do Johnny.
2. **#135** — ligar a guarda inteira ou só o bucket reverte-protegida
   (recomendo a segunda).
3. **#132 / #133 / #134** — aval de merge; 3 incidentes fecham no mesmo dia.
