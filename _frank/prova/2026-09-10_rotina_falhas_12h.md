# Ronda das falhas — 10/09/2026, 12hZ (09h BRT)

Dono da fila (14-A). Backlog **serial**. Repo em `main`, `pull --ff-only`.
Índice de ordens lido antes de tocar em nada. Ordem de **29/08** respeitada:
nada da planilha lido, escrito, classificado, avisado ou reprocessado; nenhum
chamado de causa-planilha aberto ou reaberto. Ordem de canal de **31/08**: o
aviso desta ronda foi **no grupo**.

**Fechei 1 defeito de sistema (#337), com fix em produção e o aluno afetado
respondido.**

---

## Como cheguei nele: a fila mais velha está toda travada em decisão do Johnny

Andei a fila do mais antigo pra baixo, como manda a regra 8, e registro onde
cada um parou pra ninguém refazer a caminhada:

| | por que não é acionável por mim hoje |
|---|---|
| **#15** (42d) | fix novo da régua em produção desde 00h51Z. Só fecha com a **próxima ocorrência** de `executionTimeout` ou 30 dias limpos. Bloqueado em **evento**, não em trabalho. |
| **#47** Katia (22d) | causa da entonação sem medida; o que sobrou (repor `tts_silence_ms=466` e estender o acesso dela) **contraria ordem vigente** — escalado em 08/09, **sem resposta**. |
| **#99** (18d) | *"o que falta não é código: é uma frase do Johnny/Lucas"*, pendente desde **24/08**. |
| **#223** Alana (9d) | aluna já respondida em 09/09; sobrou `access_until` — decisão. |
| **#254** cobrança em dobro (6d) | as duas assinaturas da Lucila **seguem ativas**; reembolso e qual cancelar são do Lucas. |
| **#265** garantia (5d) | metade de código no ar desde 05/09; metade de **política** com o Johnny. |

Também confirmei que a `tania-araujo` que a varredura acusa como *"acesso vivo,
com crédito e sem voz pronta"* **não está abandonada**: o corte de backfill do
`lembrete-treino.ts` registra que ela já recebeu **dois e-mails à mão** (05/09
uid 1071, 06/09 uid 1158) explicando o clique que falta. A bola é dela.

Foi descendo essa lista que o caso de hoje apareceu — e ele não estava na fila,
estava numa **nota do Vigia**.

---

## O caso: a casa pediu que o aluno respondesse, ele respondeu, e a nossa caixa apagou a resposta

O Vigia anotou em 09/09 20hZ que a mensagem do
`marcelopersonalthe32@gmail.com` (uid 517) chegou *"SEM corpo em texto"*, e
**classificou como a classe do #261/#248**, que tem PR esperando aval. Fui ao
MIME cru antes de aceitar a classificação: **o `text/plain` existe e tem 3.513
bytes.** Não é aquela classe — o #261 e o #248 estão `ignored` e são sobre a
*escolha* da parte. Aqui a parte está cheia e é a **nossa régua** que a joga
fora.

### O que estava escrito na mensagem que a casa jogou fora

> **"Eu não quero mais seguir no programa."**

É **exatamente** o pedido de saída que nós pedimos por escrito, duas vezes
(uid 1076 de 05/09 e uid 1382 de 09/09): *"me responda dizendo isso até 11/09
que eu levo o pedido na hora"*. Ele obedeceu, **dentro do prazo**, e a nossa
caixa transformou a resposta dele em silêncio.

Mesma forma do caso mastroianni de ontem: o conselho estava certo, o aluno
obedeceu, e a caixa destruiu a prova. **Dois dias seguidos, mecanismos
diferentes.**

### A causa, em duas linhas de código

`mail-charset.ts:267` **não lia `boundary=` nenhum** — adivinhava a fronteira
MIME por formato de linha:

```js
const boundary = seg.search(/\r?\n--[-=_a-zA-Z0-9]{6,}/);
if (boundary > 0) seg = seg.slice(0, boundary);
```

O Gmail abre todo encaminhamento com `--------- Mensagem encaminhada ---------`,
que casa no palpite (`--` + 7 hifens). **O corpo era decepado no caractere 1.**

E o segundo andar é o que transforma bug em silêncio —
`mail-respond.ts:255-259`:

```js
const text = skip ? "" : mailText(raw);
if (skip || text.length < 5) { await markSeen(mail.uid); return "skipped"; }
```

Corpo com menos de 5 chars não vira erro: vira **`markSeen` + `skipped`**. A
mensagem é **marcada como lida** e sai da fila da Fast sem ninguém ter lido.
Não alerta, não faz bounce, não abre chamado. **Vira nada.**

### Prova no arquivo real, não em fixture minha

Baixei o uid 517 por `BODY.PEEK` (FLAGS inalteradas, provado) e rodei a
`mailText` **de produção** em cima dele:

| | chars devolvidos | a frase dele |
|---|---|---|
| antes | **0** | ausente |
| depois | **2.905** | presente |

### Alcance, com o limite declarado

Comparei a `mailText` **ANTES** (extraída do git em `a90e9b0^` — a função de
verdade, não reimplementação minha) contra a **DEPOIS**, em **131 MIMEs reais**
do INBOX (uids 407–556, de 01/09 13:50 a 10/09 08:38 BRT). Critério de "mudo" é
o **da produção** (`< 5 chars`), não um limiar meu.

- recuperadas (antes muda, depois fala): **1** — o próprio uid 517.
- continuam mudas nas duas versões: **0**.
- **controle positivo**: o instrumento é obrigado a reencontrar o uid 517 e
  **aborta** se não reencontrar. "Zero" de instrumento cego já enganou esta casa
  em 07/09.

⚠️ **Limite honesto, que não está no número:** são as **últimas 131 de 555**
mensagens da caixa, e **19 foram puladas** por passarem de 400KB. O que está
medido é **"1 nos últimos 9 dias"**, não "1 na história". Quem quiser o total
tem que varrer o resto da caixa.

---

## O que eu fiz

| | o quê |
|---|---|
| **fix em produção** | **PR #232**, merge **`a90e9b0`**. *Deploy Frontend (production)* **completed/SUCCESS às 11:49:15Z**, `headSha = a90e9b0` — conferi o **desfecho** do run, não o disparo. Sem migration (função pura). |
| **guarda** | 28/28 em `mail-charset.test.ts` (era 23), 79/79 em `src/lib/agent`, `eslint` limpo. **Provados não-decorativos**: restaurando a regra antiga, **2 falham**. Um dos testes afirma o outro lado — a fronteira REAL continua cortando, o `text/html` não vaza. |
| **e-mail** | `marcelopersonalthe32@gmail.com`, cópia **CONFIRMADA** em Enviados, **uid 1592** (regra do #210). |
| **abri e fechei** | **#337** — causa, medição, alcance e fix. Conferi que **não é duplicata** do #261/#248 antes de abrir (§3.2 da ordem de 27/08). |
| **anotei** | **#265** (`71410a81`) — a objeção do Vigia era chamado novo; `agent_notes` 7 → 8. **Não fechei**: a metade de política segue com o Johnny. |

**A correção não alarga o palpite: para de adivinhar.** Fronteira MIME vem
declarada em `boundary=`; mensagem de uma parte só **não tem fronteira**, então
`-----` no corpo dela é **conteúdo**. A fronteira entra no RegExp como
**literal** (RFC 2046 permite `( ) + / ? = . ,`, todos especiais em regex).

## O que eu disse ao aluno, e o que eu me recusei a dizer

Assumi a falha sem enfeite e registrei o pedido de saída dele **com a data
original** — 09/09, **dentro** da janela da cobrança de 05/09, cuja garantia
fecha em **12/09 00:00**.

**Não prometi reembolso**: não é minha decisão e eu não tenho data pra dar. Em
vez disso disse com todas as letras que **o caminho da Hotmart é dele e não
depende de nós**, e que ele deveria usá-lo — porque o prazo fecha **amanhã** e,
depois da falha que acabei de contar a ele, pedir que ele espere a nossa decisão
com o relógio correndo não seria honesto.

## O que precisa de DECISÃO do Johnny

1. 🔴 **Marcelo — prazo fecha AMANHÃ (11/09).** Autorizar a devolução dos
   **R$ 97** (cobrança 05/09, pedido feito por ele em **09/09, dentro da
   janela**) e **encerrar a assinatura** pra não cobrar de novo em 05/10.
   **Não cancelei nada na Hotmart** — é ação externa e não é minha.
2. 🔴 Herdados sem mudança: **reembolso do mastroianni** (#331); os **4 PRs do
   teto de anexo** (#41, #42, #187, #230), o mais velho há **19 dias**; decisão
   dos **15 vitalícios** (#313); o **Victor** (#309); **DDL**
   `104_avisos_enviados.sql` sem aval (5º dia); **política da janela de
   garantia** (#265).
3. 🟡 **PR #55** e **PR #188** seguem parados. O #188 é da família que o Vigia
   citou ontem — vale decidir junto agora que o vizinho dela foi consertado.

## Higiene

`git log origin/main..HEAD` **vazio** e nenhum fix preso em branch — conferido
no fim da ronda. A árvore local segue com os arquivos não commitados do `/sgp`
(rotas, `retomada`, `messages/*.json`): **não são meus e não toquei**. Commitei
só o meu log, o script do #337 e os instrumentos de medição.

⚠️ Achado lateral que **não** virou chamado (não é regressão desta ronda):
`npx tsc --noEmit` acusa `src/lib/onboarding/resgate-audio.test.ts(1,40): Cannot
find module 'vitest'`. É dependência ausente num arquivo de teste que eu não
toquei, e é o **único** erro do type-check. Fica registrado pra quem for mexer
em `onboarding` não achar que quebrou.
