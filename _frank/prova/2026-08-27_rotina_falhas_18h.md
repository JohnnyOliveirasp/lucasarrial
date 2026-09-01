# Rotina das Falhas — 27/08/2026, ronda das 18h UTC (Frank, dono da fila)

Método serial (regra 8, ordem de 21/08): um incidente por vez, até o fim.
Papéis (regra 14-A): o Vigia abre e anota; eu investigo, decido e fecho.
`git checkout main && git pull --ff-only origin main` → trouxe a ordem nova de
hoje. Índice de ordens lido antes de tocar em qualquer coisa.

**Ordem nova nesta ronda:** `2026-08-27_vigia_so_erro_de_sistema.md`. Ela não
muda quem fecha (eu), muda **o que o Vigia abre**. Usei ela hoje e ela já
mudou um desfecho — ver o `#143`.

## Placar

| | |
|---|---|
| Abertos no início | **12** |
| Abertos no fim | **11** |
| **Fechados nesta ronda** | **1** (`#143`, como `ignored` por enquadramento) |
| Incidentes que eu anotei com medição nova | 3 (`#11`, `#146`, `#143`) |
| Alunos que passaram a ter resposta | **1** (Kelinn Avelar) |
| Aluno afetado NOVO, que não estava em chamado nenhum | **1** (Kelinn) |
| Hipótese do Vigia derrubada por medição | 1 (`#146`) |
| Crédito / GPU / migration / merge | **nada tocado** |

---

## 1. `#11` `9ac03612` — trainer failed (21/07, o mais antigo)

Peguei pela regra 8: o mais antigo com aluno afetado. As rondas das 11h/12h já
tinham feito o grosso; o que **faltava** era a lacuna que o próprio Vigia
apontou às 12h18 — *"continuam sem apuração os outros dois e-mails do chamado"*.
Fechei essa lacuna. **Os três afetados estão apurados e nenhum está esperando.**

| aluno | estado | crédito |
|---|---|---|
| `franwd82` (3ª ocorrência, 27/08) | voz `ready` 10:56Z, retreino por conta da casa | quitado, sem 2ª cobrança |
| `fernando.gomes.perri` (2ª, 10/08) | **resolveu-se sozinho** — 2 vozes `ready` (12/08 e 15/08) | 2 estornos conferidos |
| `diretoriastupendo` (1ª, 21/07) | **não existe aluno por trás do e-mail** | nada a devolver |

**O estorno do fernando é a armadilha de 20/08 na prática.** Conferi por
`ref_type` (`voice_train_refund`), nunca por `kind` — porque os dois estornos
gravam `kind='extra_purchase'`. Quem filtrasse por `kind` concluiria que ele
não foi estornado e **pagaria em dobro**.

**`diretoriastupendo@gmail.com` não é aluno.** `profiles`: zero linha. Varri
`voices` de 21/07 a 22/07 inteiro com left join — nenhuma voz é dele (as falhas
daquele dia são de `casatumca`, `richargam` e `cristaisdeoz`). Sem profile não
há `credit_transactions`. Não foi exclusão LGPD (só o caso Kelly na pasta). É
**trial R$0**: `pagou_de_verdade` devolve *"NUNCA PAGOU"*. Leitura honesta:
reivindicou o trial em 21/07 e nunca completou o cadastro. **Não afirmo** que o
e-mail entrou na lista por bug — não achei o caminho que o inseriu.

**Passo em que emperrou:** `scripts/97` **não aplicada**. Reconferi no banco
agora: `information_schema` devolve **zero** coluna `trainer%` em
`training_jobs`. O código do PR #67 está em produção desde 11:46Z e já grava o
traceback no **log**, mas a coluna não existe, então o banco não guarda. A
migration **estreita um grant** (senão o aluno lê o próprio traceback via
PostgREST com o JWT dele) → é aval do Johnny, e eu não aplico sozinho.

---

## 2. `#146` `e4d8b6ce` — o portão de 20min (26/08)

Peguei em seguida pela regra de prioridade: **aluno vem antes da limpeza da
fila**. O `#52` é mais velho, mas a ronda das 17h já mediu que ninguém está
travado nele e que falta acúmulo de amostra; repetir seria a quinta ronda no
mesmo chamado sem dado novo.

### A hipótese do Vigia caiu na medição

Ele levantou que *"o portão pode não estar somando o conjunto todo"*. **Não é
erro de soma: o portão não mediu nada.** O run `f7a26c5e` gravou
`{"imported":0,"skipped":10,...,"voice_status":"rejected_too_short"}` —
nenhum dos 10 arquivos foi baixado. O *"menos de 20 minutos"* foi **herdado** da
voz `8dafbf91` (24/08, 1 arquivo, 72s) e virou e-mail sobre material que o
sistema nunca abriu.

Registro que a hipótese era razoável e que a medição a derrubou. Serve de
calibragem pro Vigia: **contagem de arquivo na planilha não prova que o arquivo
foi lido.**

### O estado real do fix — são dois defeitos e só um está no ar

- **Parte A (o e-mail mentiroso) VIVA.** `decidirAvisoAudio` importada em
  `app/api/v1/onboarding/import/route.ts:59`, chamada na `:384`. Commit
  `a36e356`, na main.
- **Parte B (a porta) MORTA.** `decidirVozOnboarding` está exportada e testada
  em `lib/onboarding/veredito-audio.ts:113`, mas **grep no projeto inteiro
  devolve ZERO chamador** fora do teste. Quem decide a voz em produção continua
  sendo o código velho, `lib/onboarding/import.ts:455-459`:
  `.order("created_at",{ascending:true}).limit(1)` +
  `if (existing && existing.status !== "uploading")` → **pega a voz mais velha e
  trata `rejected_too_short`/`failed` como "já está pronto"**.

**Consequência hoje:** aluno recusado que reenvia material NOVO pela planilha
continua sendo pulado sem download e sem medição. O sintoma que batizou o
chamado **pode se repetir**. Não apliquei: reabrir importação debita
`TRAINING_CREDIT_COST` sem trava de saldo → aval do Johnny.

### Onde a Parte B está: PR **#64**, aberto

Fui atrás no passo fixo de fim de ronda (conferir fix preso em branch) e achei.
Branch `feat/onboarding-nao-repete-veredito-velho`, commit `0abaeb0`, base main,
4 arquivos (+572/−22). O diff **liga a Parte B de verdade**: troca
`{ascending:true}` por `{ascending:false}`, remove o
`if (existing && existing.status !== "uploading")` e passa a chamar
`decidirVozOnboarding`. Tem **242 linhas de teste**. A Parte A que está no ar
(`a36e356`) saiu de um recorte **deste mesmo trabalho**.

**Não há nada a programar aqui — há uma decisão a tomar sobre o PR #64.** É a
diferença entre "pendente" e "pendente com número", e é o que eu levei ao Johnny.

---

## 3. Kelinn Avelar — afetada NOVA, não estava em chamado nenhum

Achei medindo o `#146`: o run `2dfac2bf` (25/08 12h41) tem `imported=0`,
`skipped=1` e o mesmo motivo *"menos de 20 minutos"* — **mesmo defeito do
ycarlosk, um dia antes**. Ela não está no `#139` (que cobre `ycarlosk` e
`definidameta`) nem em lugar nenhum. Levou o e-mail vago e ficou **14 dias
parada**.

**O que ela tinha de verdade:** voz `a046ede6`, `duration_seconds = 1174` =
**19min57s**, contra mínimo de 1200s. **Faltaram 26 segundos.** Catorze dias
parada por 26 segundos, e ninguém nunca lhe disse o número.

Conta viva: 200.000 créditos, acesso até 03/09, **trial** (`pagou_de_verdade`:
*"NUNCA PAGOU, R$0 APPROVED"*) → não é pagante travado e **não há crédito
indevido a devolver**.

**Escrevi pra ela às 18h UTC** (bcc suporte@): o número exato dos 26 segundos, o
pedido de desculpa pelo e-mail vago de 25/08, e a orientação de gravar **3
minutos a mais, não 1** — de propósito. É a lição do `curar_msg_envio_incompleto`:
mensagem que pede pouco demais leva o aluno à terceira recusa. Não prometi
prazo, não gastei GPU, não toquei em crédito.

**Observação que NÃO virei acusação** (falta `arquivo:linha`, e a ordem de hoje
exige): ela tem duas compras `active` de 27/08 e recebeu **dois**
`subscription_grant` de +100.000 no mesmo minuto (12h58). É crédito **entrando**
a mais, não aluno cobrado errado — sem dano a aluno, então não virou chamado.
Fica anotado pra quem for medir duplicidade de grant de trial com o código na mão.

---

## 4. `#143` `2bdcc095` — FECHADO como `ignored` (enquadramento, não discordância)

A ordem de hoje tem linha literal: *"cron que não foi ligado, turno vago"* →
**processo** → relatório + Telegram, **sem chamado**. E o §1 da mesma ordem cita
o **`#143` pelo número** entre os 8 que não eram erro de sistema. O
enquadramento não é opinião minha: **o Johnny já adjudicou este caso ao escrever
a ordem.**

**Qual checagem faltou:** nenhuma das três do §3. O Vigia não errou por
duplicata, nem por PR aberto, nem por conta de dinheiro sem ler código — a
medição dele está **certa**. Falhou o teste de bolso do §2: *"se o código/infra
estivesse certo, isso não teria acontecido?"* Aqui é **não** — o código está
certo, falta uma linha de cron.

**O fato segue de pé e eu reconferi hoje** (não herdei a medição de ontem):
rodei `schedule-cli list` às 18h UTC. `ROTINA DAS FALHAS` roda de novo 14h40 EDT
e o `VIGIA` 14h10 EDT, coerentes com `40 6-21` e `10 6-21/2`. **Nada cobre
22h-05h.** A janela cega de ~9h/dia existe hoje, 7 dias depois da ordem que
autorizou fechá-la.

**A objeção do Vigia, registrada porque é boa:** *"enquanto a janela existir,
TODO relatório de ronda que diz 'nada pendente' está medindo 15h do dia, não
24h"*. É verdade, e é um limite dos **meus** relatórios — inclusive deste.

---

## Decisões que são do Johnny (as três estão travando trabalho pronto)

1. **Migration `scripts/97`** — parada há **37 dias**, é o único bloqueio do
   `#11`. Estreita um grant de propósito (senão aluno lê o próprio traceback).
2. **`#146` Parte B = PR #64**, aberto. Código escrito, testado e **morto em
   produção**. Destranca a porta pra quem foi recusado e reenviou. Envolve
   débito sem trava de saldo — por isso não mergeei.
3. **Turno da noite** — decisão ou linha de cron (o fato do `#143`).

## Postado no grupo (regra 7, só fato consumado)

1. Fechei o chamado 143.
2. Escrevi pra aluna Kelinn Avelar.

## O que NÃO fiz

Não apliquei migration, não mergeei branch, não escrevi código, não gastei GPU,
não retreinei, não estornei, não toquei em crédito, acesso ou assinatura. Não
mexi em cron nem no agendador. Não li a caixa do suporte@ para triagem. Não
reabri incidente fechado. Não prometi prazo nem reembolso a ninguém.

## Para a próxima ronda

1. **As três decisões acima.** Sem elas, `#11` e `#146` não fecham — os dois
   estão com o trabalho técnico **pronto** e parados em aval.
2. **`#99` e `#120`** seguem no Lucas/Johnny — prazos **02/09** e **30/08**.
3. **`#52`** só anda com acúmulo de amostra (régua do próprio chamado: ~20
   entregas de escotilha, havia 1 na ronda das 17h).
4. **Conferir se a Kelinn respondeu.** Se reenviar, vale acompanhar o run: ela é
   exatamente o perfil que a Parte B morta ainda pode pular.
