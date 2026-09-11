# Ronda das falhas — 11/09/2026, 19h00Z (16h00 BRT)

Frank, dono da fila. Método serial (regra 8). Esta ronda **não fechou
incidente**. Entregou: **causa raiz do `#358` encontrada com arquivo:linha**,
**metade do conserto em produção e conferida por mim**, **o aluno atingido
avisado antes de reclamar** e **um card aberto para a metade que falta**.

Repo em `main`, `pull --ff-only`. `_frank/ordens/README.md`, a ordem de **27/08**
e a de **29/08** lidas antes de tocar em qualquer coisa. Nada da planilha foi
lido, escrito ou reprocessado. Canal de **31/08**: o aviso foi pro **grupo**.

`now()` medido no banco = **2026-09-11 18:42:09Z** no início.

---

## 1. Por que peguei o `#358` e não o mais antigo

A regra 8 manda pegar o mais antigo com aluno afetado. Peguei o **mais novo**,
e declaro o motivo em vez de esconder: o `#358` nasceu às **18:17Z**, dentro
desta janela, e a `varredura_travados` mostrou **32 de 55 cenas falhando na
hora corrente** (58%) num aluno pagante. A exceção da regra 8 é "produção fora
do ar ou dinheiro sendo cobrado errado agora".

**Sendo honesto sobre a minha própria justificativa:** conferi o dinheiro
primeiro e ele estava **certo** — ou seja, a exceção do dinheiro **não** se
aplicava. O que se aplicou foi produção quebrando ao vivo. Registro isso porque
"peguei o mais novo" é o tipo de desvio que, repetido sem justificativa, faz o
backlog velho nunca andar. Os antigos (`#313` de 09/06, `#15` de 30/07, `#47`,
`#99`) seguem parados, e isso é dívida desta ronda.

## 2. A causa raiz, medida — não herdada

**O Kie sinaliza throttle com `HTTP 200` e `code: 429` no CORPO**
(*"Your call frequency is too high"*). Como `res.ok` é `true`, a guarda de
status passava limpo, `data.taskId` vinha vazio e o código lançava erro na
**primeira** tentativa. O chamador marcava a cena `failed` e **estornava**.
Erro transitório e retentável virava **morte permanente da cena**.

A rajada que produz o 429 vem de
`frontend/src/app/api/v1/studio/[id]/route.ts:131`:

```ts
await Promise.all(pending.map((s) => syncStudioScene(s).catch(() => {})));
```

`pending` são **todas** as cenas em `generating_still`/`animating` do projeto,
**sem teto**. Projeto de 48 cenas = até **48 chamadas simultâneas** ao Kie por
tick do poll.

**Correção de rumo no meio da investigação, que vale registrar:** o primeiro
mapeamento (subagente) apontou o laço do `POST /scenes` como suspeito e
**especulou** concorrência ali. Fui conferir: aquele laço é **serial** (`await`
dentro de `for`) e o que ele dispara é o **still** (imagem), não o vídeo. A
raiz estava em outro arquivo. Se eu tivesse aceitado o relatório, teria mandado
consertar o lugar errado.

**Medido** (`mcpaganatto@gmail.com`, 11/09): 48 cenas criadas 18:11:49→18:13:13
→ **16 `ready`**, **22 mortas por 429**, **10 bloqueadas por moderação** (estas
nem chegaram a ser cobradas — o débito só ocorre após o `taskId`).

## 3. O dinheiro: conferido e correto, nada a devolver

`credit_transactions` do aluno nas 3h:

| | |
|---|---|
| débitos `ref_type=studio_scene` | **38** · −68.400 |
| estornos `ref_type=studio_scene_refund` | **22** · +39.600 (18:13:30→18:17:40) |
| líquido | **16 cobradas = 16 cenas entregues** ✔ |

Conferido **por `ref_type`, nunca por `kind`** — a armadilha de 20/08 que quase
pagou em dobro para 13 alunos (o estorno grava `kind='extra_purchase'`).

## 4. O que subiu pra produção — e o que eu conferi com a mão

**PR #240** → merge **`4204762`** na `main` → deploy run `34635319647`
**completed success** (conferido antes de escrever pro aluno).

`createTask` virou caminho único (`lib/kie/http.ts` novo) com retentativa em
429 — 3× (2s/5s/12s + jitter), detectando o 429 **no status HTTP E no `code` do
corpo**. Vale pra **imagem e vídeo**: o defeito era idêntico nos dois.

Um achado do conserto que merece ficar: `friendlyKieError` ganhou o teste de
throttle **antes** do de saldo, porque um 429 costuma vir escrito como
*"quota exceeded"* e `"quota"` casava na régua de saldo — fila cheia era
anunciada como *"limite do provedor"* e mandava o suporte investigar o lugar
errado.

**Não aceitei o número do relatório.** Rodei os testes eu mesmo, em worktree
isolado em `origin/feat/kie-retry-429`: **13 pass / 0 fail**. Inclui prova de
não-tautologia (o teste reimplementa o miolo antigo e mostra que ele estoura no
mesmo fixture) e o caso que separa código novo de velho (`status 200` +
`code 429` — quem só testa `status === 429` não pega este bug).

## 5. Por que o card continua `investigating` (regra 14)

1. **A causa da rajada não foi tocada.** `route.ts:131` segue sem teto. 48
   chamadas paralelas que agora retentam continuam sendo uma rajada — o retry
   ameniza, não remove.
2. **O `KieRateLimitError` foi criado e ninguém escuta.** Nenhum chamador testa
   `instanceof`. Esgotada a régua, `scenes.ts` ainda cai no catch genérico e
   chama `failScene` → a cena continua sendo destruída e estornada, só que mais
   tarde.
3. **O aluno não foi tornado inteiro:** as 22 cenas não existem. Ele tem o
   crédito, mas precisa refazer na mão.

**Card aberto** para as duas pernas (teto de 4 em paralelo + o
`KieRateLimitError` não matar cena com menos de 30 min).

**Limite declarado:** que a rajada do poll é a fonte do 429 é **inferência** —
código (`Promise.all` sem teto) + padrão medido (as 24 cenas criadas primeiro
sobrevivem, as seguintes morrem em série). **Não instrumentei** a concorrência
real no instante do 429. Quem fechar isto confirma com telemetria, não com esta
nota.

## 6. O aluno

Escrevi para **Márcio Paganatto** (`mcpaganatto@gmail.com`) — pagante ativo até
29/09, conta desde 29/07, saldo 152.223. Cópia **confirmada** em Enviados,
**uid 1887**, tentativa 1 (busca por `Message-ID` depois de gravar, não
"APPEND respondeu OK").

Ele **não tinha reclamado** — o cartão nasceu do detector de rajada. Escrevi
assim mesmo: ele viu 22 X vermelhos e não mexeu no projeto desde 18:13. O
e-mail diz a culpa é nossa e qual foi o mecanismo, que os 39.600 já voltaram e
ele pagou só pelas 16 entregues, que metade do conserto está no ar — e traz a
**ressalva explícita** de que a outra metade não está, com o conselho de gerar
em blocos menores até lá. Não anunciei conserto que não estivesse no ar.

## 7. Números da ronda

- **73 incidentes abertos → 73. Nenhum fechado.** O `+1` sobre as 18hZ é o
  próprio `#358`.
- **1 PR mergeado** (#240 → `4204762`, deploy success) · **1 card novo** ·
  **1 incidente anotado 2×** (notas 1→3).
- **1 e-mail** para aluno · **0 GPU, 0 crédito mexido, 0 estorno, 0
  cancelamento, 0 migration.**
- **Relógio do Leandro** (`#254`, R$97 de 05/09, vence **12/09 00:00Z**): segue
  **sem movimento**, ~4,8h restantes na hora deste registro. Avisado 2× nos dois
  endereços, nunca respondeu; pela 9-C não cancelo assinatura de titular sem
  pedido escrito. Já está com o Johnny desde a ronda das 18hZ — não repito o
  ping pra não virar ruído no grupo.
- 🧹 Higiene, **inalterada**: seguem **10 arquivos** modificados não commitados
  em `frontend/**/sgp*` e `frontend/messages/*`, mais não rastreados em
  `_frank/rascunhos/`. **Décima sétima ronda seguida.** Não são meus, **não
  toquei** — commitei só este log. Meus arquivos de trabalho ficaram em `/tmp`,
  fora do git, e o worktree que criei pra rodar os testes foi removido.

## O que a próxima ronda pega

1. **O card da perna 2 do `#358`** (teto de concorrência + `KieRateLimitError`).
   Enquanto não subir, projeto grande no Vídeo Estúdio segue perdendo cena.
2. **Corrigir o rótulo do `garantia_na_fila.cjs`** — herdado da ronda das 18hZ e
   **não feito nesta**: *"sem compra paga"* → *"SEM LINHA NO NOSSO BANCO"*.
   Continua valendo que o "5 perderam a janela" é **piso, não total**.
3. **Os antigos que não andam**: `#313` (09/06), `#15` (30/07), `#47`, `#99`.
   Três rondas seguidas sem toque neles.
