# Rotina das falhas — 16/09/2026, 01h40Z (22h40 BRT de 15/09)

Dono da fila (14-A). Li `_frank/ordens/README.md`, a de **20/08** (dono da fila),
a de **21/08** (serial + regra 8), a de **27/08** (só erro de sistema vira
chamado) e a de **29/08** (planilha desligada). **Nada da planilha foi lido,
escrito, classificado ou reprocessado.** Canal: por ordem de **31/08**, o aviso
desta ronda saiu **no grupo**, e só no grupo.

Ronda anterior das falhas: **00h40Z**. Abertura desta: **01h43Z**.

Peguei o **`#99`** (`6c38c99d`, 23,4 d, aluno Luciano). Os dois mais velhos
seguem travados em decisão do Johnny e isso está escrito neles: o **`#11`**
(56 d, retentativa de OOM) e o **`#15`** (47,5 d, env `FASE_TELEMETRIA_SECRET`,
**22 dias** parado numa linha de env). Pela regra 8, "travou? diga em que passo
e siga" — o `#99` é o mais antigo onde a bola ainda é **nossa**.

**O que esta ronda entrega:** (1) um aluno pagante avisado de um erro **nosso**
antes de ele esbarrar nele; (2) um defeito de produto achado, medido e aberto
(**`#424`**); (3) **duas hipóteses minhas derrubadas antes de virarem achado** —
inclusive uma que teria sido manchete e era artefato.

---

## 0. Antes de tudo: o `git pull` estava travado há 8 commits

`git pull --ff-only` abortava por **2 arquivos não rastreados** em
`_frank/rascunhos/` (os dois `2026-09-15_abrir_*.cjs`). Não apaguei por reflexo:
conferi contra o remoto com `git cat-file -p origin/main:<arquivo>` e os dois
eram **byte-idênticos** ao que já estava commitado — sobras locais de uma ronda
que depois empurrou o mesmo conteúdo. Removidas as cópias, o fast-forward passou
(`62c3c32 → ea0d6b9`).

Registro porque o checkout estava **8 commits atrás** e uma ronda que não puxa
decide em cima de código velho.

---

## 1. O `#99` mudou de estado enquanto ninguém olhava: o aluno pediu pra sair

A ronda de 10/09 deixou uma **decisão com data**: *"o e-mail prometido sai em 16
ou 17/09 (2-3 dias antes da cobrança)"*. Ela foi **cumprida antes**, em 15/09
08:45 BRT. O aluno respondeu em **6 minutos**:

| quando (BRT) | o quê |
|---|---|
| 15/09 08:45 | nós: "a cobrança de R$ 97 cai sábado (19/09)" |
| 15/09 **08:51** | ele: **"Quero cancelar tudo. Obrigado pelo esforço, mas nada deu certo."** |
| 15/09 08:58 | ele confirma a titularidade: "Isso mesmo." |

**Cancelamento executado e conferido na fonte viva**, não no nosso banco:
`LGKZLCLN = CANCELLED_BY_SELLER` (via `saida_x_assinatura.cjs`). **A cobrança de
sábado não acontece.** Não fui eu que cancelei — já estava feito quando cheguei;
o meu trabalho foi **conferir em vez de confiar**.

---

## 2. 🔴 O defeito nasceu dentro do próprio cartão: dois e-mails nossos, 7 minutos, sentidos opostos

| enviados | 15/09 | o que diz sobre o dinheiro dele |
|---|---|---|
| uid 2413 | 11:55Z | "seus 166.035 créditos (...) **você pode usar até acabar, sem pressa**" |
| uid 2416 | 12:02Z | "seu acesso e os créditos (...) **continuam disponíveis até 19/09/2026**" |

O segundo é o **último que ele leu**, e está **errado**.

### 2.1 Conferido no código, não no roteiro

Em **todas** as rotas que ele usaria, a checagem é de **saldo**, e o
`hasActiveAccess` só é lido **dentro do ramo de falha**, para preencher o campo
`subscribed` do 402 — ou seja, com saldo a data da assinatura **nunca é
consultada**:

```
api/v1/voices/[id]/generate/route.ts:177        if (bal.total < creditCost)
api/v1/voices/[id]/start-training/route.ts:104  if (bal.total < TRAINING_CREDIT_COST)
api/v1/videos/[id]/videos/route.ts:155          if (total < need)
lib/studio/billing.ts:30                        if (bal.total >= args.cost) -> ok
lib/video/sales.ts:52                           if (bal.total >= SALES_AI_COST) -> ok
```

E o gate de tela já foi desligado **de propósito**, com a ordem citada no próprio
comentário do código:

- `app/[locale]/app/layout.tsx:95` — *"Entrada LIVRE (...) O paywall não bloqueia
  mais o acesso"*
- `app/[locale]/app/roteiro/page.tsx:52` — *"`subscribed` continua existindo SÓ
  pra escolher o texto do aviso (...) **não tranca mais nada** (ordem do Johnny
  18/08)"*

**Os 166.035 créditos e a voz "Luciano 1" não expiram em 19/09.**

---

## 3. 🟠 Duas hipóteses MINHAS, derrubadas antes de virarem achado

Registro as duas porque a segunda teria sido a manchete da ronda — e era falsa.

**(a) O recorte inflado.** A primeira medição deu **266 pessoas** travadas com
saldo. Só que a regra de 20/08 protege **quem pagou**, e trial R$ 0 não entra.
Separando por pagamento de verdade (`payment_events` com `price.value > 0` e
status `APPROVED/COMPLETED/COMPLETE`, o mesmo critério do `pagou_de_verdade.cjs`):
**102 pagantes**, não 266. O número cru estava **62% inflado**.

**(b) A manchete que não existia.** Com o recorte limpo eu tinha *"223 pagantes
trancados, 47,9 milhões de créditos confiscados"* — e fui conferir o que
`subscribed = false` de fato **faz**. Não tranca nada (§2.1). **Ninguém está
trancado.** O número morreu.

O que me segurou foi ler o `layout.tsx` antes de escrever, em vez de deduzir do
nome da função. A regra que eu tiro disto: **`hasActiveAccess` aparecer numa rota
não prova que ela bloqueia** — nesta base o nome mente, o valor é metadado de
402. Fica escrito aqui pra próxima ronda não repetir a corrida.

---

## 4. 🔴 O que sobrou é real, e virou o `#424`

`app/[locale]/app/credits/page.tsx`:

```
:41  const subscribed = hasActiveAccess(email, access_until, access_source)
:57  {(unlimited || subscribed) && ( ...painel com o SALDO... )}
:76  {!unlimited && !subscribed && ( <h2>Assine para liberar seus créditos</h2> )}
```

Com a data vencida, a tela **esconde o saldo** — inclusive o bloco rotulado
*"Avulsos (não expiram)"*, que é literalmente o que não expira — e exibe
**"Assine para liberar seus créditos"**, afirmando que o dinheiro do aluno está
preso atrás de uma assinatura. É o **confisco que a ordem de 20/08 proibiu com
todas as letras**, encenado na interface.

A causa está escrita no comentário da `:55`: *"Não-assinante (0/0) só vê o convite
pra assinar"*. O autor **assumiu que não-assinante tem saldo zero**. A regra da
casa cria exatamente a população onde essa premissa é falsa.

**Medido no banco vivo:** **102 pagantes**, **23.598.446 créditos**, menor saldo
7.702, maior 497.105. Mais **121 pagantes** (24.340.125 cr) entram na faixa em 7
dias — **o Luciano é um deles, em 19/09**.

⚠️ **Limite declarado:** o casamento é por **e-mail**
(`payment_events.buyer_email` × `profiles.email`). Quem paga com um endereço e usa
a conta em outro não aparece — mesmo limite do `saida_x_assinatura.cjs`. **O
número é piso, não teto.**

O cartão foi aberto com repro em SQL e **controle positivo nomeado**: o Luciano
tem de aparecer no recorte a partir de 19/09 12:00Z; se não aparecer, o
instrumento cegou e o zero não vale.

**Não escrevi código e não abri PR**: redação de tela de produto é do Johnny e do
Lucas. O conserto é pequeno (`subscribed` → `subscribed || saldo > 0` nas `:57`/`:76`).

### 4.1 A classe já bateu na porta antes — e eu não reabri nada

- **`#48`** (ignored, 19/08): a Josilene achava que perderia 185.969 cr no
  vencimento. **A análise de lá está certa** e eu concordo com o fechamento — o
  saldo dela não zerava, e no caso dela o acesso ainda estava vigente, então a
  tela **ainda mostrava** o saldo. Cito porque a **pergunta** é a mesma do
  Luciano 27 dias depois: os alunos acreditam que o crédito morre na data. Este
  cartão não contesta o `#48`; ele nomeia **um mecanismo concreto** que ensina
  essa crença.
- **`#136`** (fixed, 25/08): a Fast prometia "créditos não expiram nunca" a trial
  R$ 0. É o **espelho** deste: lá a casa prometia de mais a quem não tinha
  direito; aqui ela nega o que o aluno **tem**.

---

## 5. 🟢 Aluno avisado (regra 8 — e-mail individual, decisão minha)

Enviado 16/09 **01h55Z**, cópia **confirmada** em Enviados (**uid 2494**). No
e-mail: assumi o erro com todas as letras, corrigi a data, confirmei que os
166.035 cr e a voz ficam — e **avisei de antemão do defeito de tela do `#424`**,
para ele não concluir em 19/09 que confiscamos o saldo dele.

Não o empurrei de volta (ele disse que nada deu certo, e isso se respeita) e
**não prometi nada sobre os R$ 97**, que não é meu para prometer.

> Foi o silêncio que fez a Viviana explodir. Aqui o aluno sabe **antes** de
> esbarrar no defeito.

---

## 6. Por que o `#99` segue `investigating`

Porque o que ele ainda deve **não foi entregue**: o posicionamento sobre os
**R$ 97** de 26/08, pedido por ele em **24/08**, está há **23 dias** sem resposta.
É decisão **comercial** (Johnny/Lucas), não é código e não é da minha alçada.

Fechar agora seria marcar `fixed` em cima de um aluno que **foi embora com a
pergunta dele sem resposta** — a regra 14 inteira.

| o que está resolvido | o que falta |
|---|---|
| cobrança de 19/09 parada e conferida na Hotmart | a resposta sobre os R$ 97 |
| aluno avisado, com a informação errada corrigida | (e só) |
| defeito de produto medido e aberto (`#424`) | |

---

## Fim de ronda

- `#99` (`6c38c99d`): `investigating`, **41 notas** (40 → 41). Não fechei, e o
  passo que falta está nomeado.
- `#424`: **aberto** (tela de créditos mente para 102 pagantes). Com repro,
  controle positivo e limite declarado.
- `#11`, `#15`, `#422`: **não toquei.** Seguem em decisão do Johnny; o `#15` faz
  **22 dias** parado numa linha de env.
- **Aluno avisado: 1** (Luciano, uid 2494 confirmado). **E-mail em massa: nenhum.**
- **Crédito mexido: nenhum. Assinatura cancelada por mim: nenhuma. GPU gasta:
  nenhuma. Migration aplicada: nenhuma. Código alterado: nenhum.**
- Números que eu **matei** antes de publicar: "266 travados" (inflado 62%) e
  "223 pagantes trancados / 47,9 mi confiscados" (artefato — ninguém está trancado).
- Aviso do grupo: enviado por `notify-grupo.sh`, só fato consumado.
