# Rotina das Falhas — 30/08/2026, 12h44–13h UTC (= 09h44 BRT) — dono da fila

Abertura: `git checkout main && git pull --ff-only origin main` → já em dia (`00ee667`).
`git log origin/main..HEAD` **vazio** na chegada. Índice de ordens lido antes de tocar em
qualquer coisa; a ordem de 29/08 (`desligar_vigia_e_frank`) relida: ela desliga o que atua
**pela planilha**, não o atendimento a aluno.

Ronda anterior: **Vigia às 12h UTC** (sensor). Esta é a das falhas, como **dono**.

---

## Placar

| | |
|---|---|
| Abertos na chegada (`open`/`investigating`) | **2** (#192, #197) |
| Abertos ao sair | **1** (#192 — travado em humano, ver §4) |
| Incidentes cuja classificação eu CORRIGI | **2** (#195, #197) |
| Registro de fechamento que eu COMPLETEI | **1** (#193, estava `fixed` com nota nula) |
| **Alunos para quem escrevi** | **1** (Johnathan, Sent uid 353) |
| Alarmes MEUS que eu retiro nesta ronda | **1** (cobrança dupla da Kelin) |
| Falsos 🚨 da varredura que eu medi e descartei | **3** (Marcelo, Kelin, Luan) |
| Defeito de processo de 3 dias que eu FECHEI | **1** (doc do `DELETE` + 27 recados) |
| Posts no grupo (regra 7, fato consumado) | **1** |
| Escalado ao Johnny | **1** (Telegram msg 649) |
| Código de app / crédito / GPU / acesso / migration | **nada tocado** |

---

## 1. `#195` — apurei a objeção do Vigia: não era bug de ferramenta, era DOIS DONOS

O Vigia anotou às 12:14Z que a nota dizia *"fechado ignored"* mas a coluna gravada era
`fixed`, e deixou duas hipóteses: (a) corrigir o status, ou (b) **defeito de instrumento**,
se a ferramenta estivesse ignorando o `--status`.

**Não é (b), e eu fui ler antes de acusar a ferramenta.** `anotar_incidente.cjs:136-137`
aplica `patch.status = status` direto, e o `.select()` confere 1 linha. Ela obedece.

**A causa real está nas próprias notas do card, e é de processo:**

| hora | quem | o que fez |
|---|---|---|
| 10:45:17Z | frank | fecha **ignored** (a `resolution_note` que diz "fechado ignored, mesmo critério do #30" é desta gravação) |
| 11:28:23Z | claude | re-fecha o MESMO card como **fixed** |

O `resolved_at` gravado no banco é `11:28:23.816357` — bate no microssegundo com a nota do
segundo agente. **Dois donos no mesmo card, e o segundo sobrescreveu o primeiro.** É
exatamente o que a regra 14-A existe pra impedir, e o efeito medido pelo Vigia (um caso
sem defeito nosso entrando na conta de "bug consertado") era real.

**Decidi como dono: `ignored`.** Duas contas do aluno, webhook `PURCHASE_APPROVED`
processado sem erro em 28/08, nada consertado, creditado ou alterado por nós.
Gravado e conferido: 1 linha afetada, `status = ignored`.

**Deixei `resolved_at` e `resolved_by=claude` como estavam, de propósito.** A data em que o
caso acabou é verdadeira e a ferramenta não re-carimba card já fechado. Reescrever
atribuição na mão seria falsear histórico pra ficar bonito no relatório.

## 2. `#197` (Natanael) — a medição que ninguém tinha feito: fui à Hotmart VIVA

O card estava `investigating` há ~5h **depois** de o aluno já ter sido respondido, fazendo
a fila parecer ter investigação técnica parada que não existe.

`cancelar_assinatura.cjs` em **ensaio** (nada cancelado) devolve **uma única** assinatura
ligada a `natanaelvarela@hotmail.com`: code `4JEV39ES`, produto `7851642` "Plano Founder",
status **CANCELLED_BY_SELLER**. Local: entitlement `canceled`, acesso até 18/09, 4.951 cr
preservados (regra 9 — cancelar não apaga o pago).

**Logo: o CURSO não está no nosso produtor da Hotmart.** Não é falta de vontade nem de
permissão: o produto não existe na nossa conta. Isso **confirma pela API viva** o que o
e-mail das 11:54Z tinha afirmado só pelo banco — a diferença entre afirmar e provar.

Aluno já respondido (Sent uid 352, 11:54:22Z) com o cancelamento confirmado, a correção
explícita da informação falsa de garantia (#198), zero promessa de reembolso, e o caminho
que não depende de nós. O e-mail termina pedindo a ele **uma** coisa: dizer onde o curso
foi comprado. Enquanto ele não responder, não existe passo meu → **`aguardando_aluno`**.

**O que continua sendo de gente, e eu não finjo que resolvi:** ele pediu o cancelamento do
curso **duas vezes**. Se o curso for de produtor do Johnny/Lucas, alguém de lá processa
independentemente da resposta dele. Escalado.

## 3. Johnathan — promessa nossa quebrada, e é o item mais sério da fila

Em **29/08 13:50Z** escrevemos: *"nós mesmos rodamos o processamento da sua voz — você não
precisa mandar mais nada"* e *"eu te escrevo de volta com o resultado, dando certo ou não"*.
O importador que faria isso foi desativado **horas depois**, pela ordem de 29/08 20h.
**23h de silêncio, nenhum dono.**

**Medi antes de escrever**, e o resultado muda a conversa: `pagou_de_verdade` → NUNCA PAGOU;
`profiles` → `free`, acesso **null**, −1.575 cr (só os 3 avatares por conta da casa);
procurei **segunda conta** (o que resolveu o #195) varrendo `profiles` e `payment_events`
por `johnathan`/`pires` → os outros "Pires" são **pessoas diferentes** (Renata, Geci,
Gerciane), nenhuma compra dele em lugar nenhum. `onboarding_runs`: 2 runs, ambas `ok=false`.

**Escrevi pra ele** (Sent **uid 353**, 12:48:44Z). Assumi o erro nosso, expliquei que o
processo virou manual, **não dei data** (foi promessa sem dono que o deixou esperando),
confirmei que ele não foi cobrado por nada, e pedi **uma** coisa útil: o e-mail da compra,
caso tenha comprado com outro endereço — enquadrado como "ligar as pontas", **sem afirmar
que ele não pagou** e sem prometer liberação.

**O que eu deliberadamente NÃO fiz:** não rodei o processamento dele. Isso hoje é manual, a
fila é decisão do Johnny, e disparar GPU por conta própria para quem não tem compra nem
acesso não é minha alçada. Escalado com recomendação explícita.

## 4. `#192` (Robert Ros) — segue travado, e digo em que passo

**Passo que falta: alguém OUVIR.** ~16h desde a queixa (29/08 21:23Z), ~11h desde que os 3
`.ogg` foram pro grupo (30/08 02:03Z) com IDs de envio gravados. Não avancei um milímetro
**de propósito**: veredito de qualidade de voz não é meu (regra 9-D), dataset/referência/
treino já foram medidos e fechados como íntegros, e existe promessa registrada ao aluno
(00:51Z) de que a resposta viria "dando certo ou não". Inventar veredito seria o pior erro
possível aqui. **Quinta ronda seguida em que o único passo pendente é humano** — por isso
foi ao Telegram, não só a este log.

## 5. Alarme MEU que eu retiro antes de sair da ronda

Vi na Kelin **2 assinaturas ativas** e **2 grants de +100.000 no mesmo minuto** (27/08
12:58) e tratei como possível **cobrança dupla** — a única exceção que quebraria o serial.

**Fui medir na Hotmart viva e estava errado:** `XSV1RSIO` e `PXO4RBZV`, ambas ACTIVE,
ambas **`trial: true`**; `pagou_de_verdade` → **NUNCA PAGOU**, `R$ 0 APPROVED` nas duas.
**Ninguém está pagando duas vezes.** Registro o alarme retirado porque falso alarme que
fica no log vira verdade na terceira ronda. Não abri chamado: R$0 não move dinheiro, não
tenho `arquivo:linha`, e a 14-C exige os dois.

## 6. Os três 🚨 da varredura: todos já avisados, nenhum abandonado

A varredura marca "acesso vivo + crédito + sem voz pronta" como alarme, mas **ela não sabe
se o aluno já foi contatado**. Conferi os enviados um por um:

| aluno | parado | e-mails nossos | último | respondeu? |
|---|---|---|---|---|
| Marcelo (`marcelopersonalthe32`) | 20d | **3** (24/08, 27/08, 29/08) | 29/08 23:50Z, com escuta humana confirmando 2 pessoas no áudio | não |
| Kelin (`kelinnavelar`) | 17d | **8** | 27/08 15:53Z, medindo que faltaram 26s | não |
| Luan (`luanmarcal.com`) | 31h | **4** | 30/08 01:46Z | não |

**Nenhum precisa de e-mail meu.** Marcelo recebeu o terceiro há 13h; um quarto seria ruído,
e a própria varredura avisa que "aviso repetido é ruído". Crédito do Marcelo já foi
devolvido (+10.000 em 10/08). **Fica registrado pra próxima ronda não re-alarmar.**

**Luan, e a ordem de 29/08:** a falha dele é do onboarding por Drive de **29/08 05:42**,
anterior ao SGP entrar em produção (20:17) — ou seja, **território da planilha**. Não abri
chamado, não reprocessei, não avisei linha parada. E não precisou: ele já tinha sido
avisado duas vezes.

## 7. Defeito de processo de 3 dias — FECHADO nesta ronda

Três rondas seguidas anotaram que o `03_ROTINA.md` manda limpar recado com `set_state`
value null e que isso não funciona. **Não herdei a medição de ninguém** (foi exatamente
"herdar número de nota alheia" que produziu o "5 imagens da Liliane"). Provei numa chave
descartável minha e limpei atrás de mim:

- `update agent_state set value = null` → **`23502`** *"null value in column value violates
  not-null constraint"*, e **a chave continua lá** (reli: 1 linha).
- `delete` → **1 linha apagada**, 0 sobrando.

**Corrigi a doc** (`03_ROTINA.md` §1-B e §1-C) pra mandar `DELETE`, com o motivo escrito.

**E então usei ela.** Cruzei os **28** recados `para_frank_*` com o status real dos cards:
**26 apontam para incidente já `fixed`/`ignored`** — é backlog velho, **não trabalho
escondido**. Apaguei 27 (os 26 fechados + o do #197, tratado nesta ronda), conferindo
**1 linha afetada em cada**. **Mantive 1 de propósito:** `para_frank_6c38c99d` (#99
Luciano), que não foi tratado e precisa de gente.

## 8. `#193` — conserto real, registro vazio: completei

Um dos recados dizia *"trave o `--curar`, a ferramenta continua armada e já corrompeu 2
vozes de aluno"*. O card estava **`fixed` com `resolution_note` NULA e sem commit** — que é
o padrão que a regra 14 proíbe, e o tipo de coisa que eu não aceito por etiqueta quando o
dano é voz de aluno.

**Fui ler o código.** O portão existe: `conferir_transcript_referencia.cjs:118-129` (commit
`fd1730a`) — três abortos antes de qualquer escrita (cauda instável em 3 leituras / cauda
medida já é a do transcript / texto novo não termina na cauda medida), ensaio como padrão
e **backup do texto antigo antes do update**. **O `--curar` não está mais armado.**

Gravei a `resolution_note` que faltava, com o commit. **Ressalva que não escondo:** o
`update` da linha 127 não tem `.select()` e não confere linhas afetadas; risco baixo porque
o id vem de um `.single()` que já leu a linha. **Não abri chamado**: é endurecimento sem
ocorrência medida, e abrir chamado em cima de leitura de código sem ocorrência é o erro que
o Vigia retratou três vezes esta semana.

---

## 9. O que precisa de GENTE (foi pro Telegram, msg 649)

1. **#192 Robert Ros** — 16h esperando um ouvido. Áudios no grupo desde 02h03.
2. **#99 Luciano** — garantia vence **02/09, faltam 3 dias**; escalado 5× sem resposta.
   Depois de 02/09 quem decide passa a ser o silêncio.
3. **Johnathan** — decidir se alguém roda a voz dele no processo manual. Sem compra ligada
   ao e-mail dele, o que muda a resposta.
4. **Natanael** — o curso não é nosso produto (provado na Hotmart viva). Se for do Johnny
   ou do Lucas, alguém de lá cancela. Ele já pediu 2×.

## 10. Limites e o que eu NÃO fiz

- **Limite da minha prova, dito na cara:** `ler_caixa` só varre os **LIDOS**. Se algum
  aluno respondeu e a mensagem está não-lida (fila da Fast), eu não a veria. Vale para os
  cinco alunos citados neste log.
- Não escrevi código de app, não mergeei patch, não toquei em crédito, acesso, GPU nem
  migration, não disparei reprocessamento, não abri chamado com causa na planilha, não
  reabri nada e **não dei veredito sobre qualidade de voz**.
- Não fechei incidente não resolvido. O #192 sai desta ronda aberto porque **está** aberto.
- Fim de ronda: `git fetch origin && git log --oneline origin/main..HEAD` conferido vazio
  após o push deste registro; nenhum fix preso em branch de feature.
