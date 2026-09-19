# RONDA DAS FALHAS — 19/09, ~16hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_15h.md`.

**Método serial (regra 8).** Usei a ordenação que as duas rondas anteriores
deixaram como lição nº1 — **abertos com aluno nomeado, ordenados pela data da
ÚLTIMA NOTA, não pela de criação**. O primeiro da lista era o `#314`, **11 dias
sem ninguém escrever nada**. Terceira ronda seguida em que o cartão mais
abandonado só aparece nessa ordenação; ele não é o mais velho por criação.

E o `#314` não era um card qualquer parado: **ele continha um aviso com data,
endereçado a quem o pegasse.**

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
726 lidas da pasta "Sent" = 649 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`),
instrumento independente: **0 carta depois do corte**, veredito "buraco é
PASSIVO".

Pasta **720 → 726** e tabela **643 → 649** desde as 15hZ: as 6 cartas do
intervalo **já nasceram com linha**. Controle compensatório funcionando.

As **77 anteriores a 14/09 14:06:31Z seguem sem decisão** — decisão de
produção, não de ronda, e eu não a tomei.

## 1. Estado da fila

| status | 15hZ | 16hZ |
|---|---|---|
| fixed | 278 | **279** |
| investigating | 94 | **93** |
| ignored | 60 | 60 |
| aguardando_aluno | 34 | 34 |
| open | 1 | 1 |

Total varrido **467**, igual. O movimento de 1 (investigating → fixed) **não é
meu**: aconteceu entre as duas rondas e eu não abri nem fechei cartão nesta.
**Eu não fechei nada, e o número diz isso** — o porquê está em §5.

**Percepção travada (ordem de 17/09): 2 cards, o mais velho parado há 1,1 dia.**
Nenhum dos dois é caso de despacho: o `#450` já foi medido e declarado falso
positivo do detector, e o `#473` espera a própria aluna ouvir o áudio refeito —
espera legítima, com data. Nada a despachar para o `olho` ou o `qa` nesta ronda.

---

## 2. O item serial: `#314` — a fuse explodiu, dois dias antes do previsto

`58b376ea` · aberto **08/09** · última nota **08/09** · **11 dias de silêncio** ·
aluno **Jesus Peres**, `diretoria@grupoperes.com.br`.

O card terminava assim: *"⏳ O MEU PRÓPRIO REPARO TEM PRAZO DE VALIDADE — 18/09.
Quem pegar este card depois de 18/09 tem que CONFERIR o Jesus antes de qualquer
outra coisa."*

Hoje é 19. Conferi. **Já tinha estourado — e não na data que o card vigiava.**

```
entitlements.A1ZH3SEI.updated_at = 2026-09-16 11:18:07.805Z
user_id 347eccc3 (conta que ele USA) -> 4656e845 (conta que ele NUNCA abriu)
gatilho: payment_events 8638e6c3 · PURCHASE_COMPLETE · iehudaperes@grupoperes.com.br
         recebido 11:18:07.419Z · processado 11:18:08.608Z · error NULL
```

**A lição:** o card vigiava a **renovação de 18/09**. Quem armou o gatilho foi um
`PURCHASE_COMPLETE` **dois dias antes**. O card até dizia "ou qualquer evento da
Hotmart", mas **a data escrita foi a coisa lembrada**, e ela deu falsa sensação
de prazo. Prazo de validade de reparo manual não tem **data** — tem **evento**.

### 2.1 O instrumento ficou MAIS VERDE depois do estrago

Isto é o achado que vale além deste cartão.

A consulta de exposição que o card e a nota 1 usavam — *dono atual ≠ conta do
`buyer_email`* — devolvia **1 linha** enquanto a bomba estava **armada**. Rodei
hoje, antes de tocar em nada: **0 linhas.**

Não porque melhorou: **porque disparou.** Depois da transferência o dono **passa
a ser** a conta do `buyer_email`, e o caso **sai do radar da própria consulta que
o vigiava**.

É a mesma família do `ref_type` × `kind` e do `?buyer_email=` do `#481`:
**instrumento que fica mais verde depois do dano.** Quem rodar só essa consulta
na próxima ronda lê "exposição 0" e conclui saúde.

Detector do dano **consumado** (não do armado), escrito para quem quiser
construir: *entitlement `active` cujo dono tem `last_seen_at` NULL enquanto
existe outra conta do mesmo aluno com uso.* **Não virei ferramenta hoje** —
fica declarado, não feito.

### 2.2 Dinheiro: não houve desta vez — e é por isso que o script velho não servia

`credit_transactions` dos dois perfis **não tem nenhuma linha depois de 08/09**:
o evento de 16/09 não gerou lançamento. Os **111.650** nunca saíram da conta que
ele usa (confirmado pelo instrumento independente `aluno.cjs`).

Por isso **reexecutar o script de 08/09 teria sido um erro**: o passo 4 dele
lança **-100.000** na conta fantasma, que **hoje já está zerada** — criaria saldo
negativo do nada. Escrevi um script **novo e mais estreito**, só com o que falta.

### 2.3 O que eu fiz, conferido na releitura

`_frank/ferramentas/2026-09-19_jesus_peres_titularidade_2a_vez.cjs --confirmar`
— **10 pré-condições** conferidas antes de gravar (entre elas *"a fantasma NUNCA
foi usada"* e *"nenhum lançamento depois de 08/09"*); qualquer divergência
abortava.

1. `A1ZH3SEI.user_id` `4656e845` → `347eccc3` — **1 linha afetada**
2. perfil fantasma `iehudaperes@`: `plan` pro → free, `access_until` 18/09 → NULL
   — **1 linha** (o evento de 16/09 tinha desfeito **também isto**, que o reparo
   de 08/09 havia deixado em free)

**Releitura do banco:** `A1ZH3SEI` dono=`347eccc3` status=active · `diretoria@`
saldo **111.650** · `iehudaperes@` plan=free, acesso NULL, saldo 0.

Commit **`fc7ad927`** na main. O script de 08/09 morava em `_Bugs/`, que é
**gitignored** — o novo está em `_frank/ferramentas/`, **rastreado**, para
existir na próxima ronda. (Mesma doença do ledger do #101: trabalho que some
com a pasta.)

### 2.4 O que eu NÃO fiz no aluno, de propósito

**Não toquei no perfil da conta real.** Ele está `plan=pro` com `access_until`
**2026-09-18 12:00Z — data já vencida**, ou seja cache velho que não concede
nada (`aluno.cjs` lê "SEM ACESSO"). A **rec#3 está OVERDUE** na Hotmart
(`pagou_de_verdade.cjs`, hoje): o período pago dele terminou **mesmo** em 18/09.

Escrever `plan='free'` ali seria **eu executar na mão um vencimento que o sistema
não executou**, num aluno que já pagou R$ 849,45 + R$ 97. E o gate das telas é
por **CRÉDITO** (ordem de 18/08), com os 111.650 na conta certa: **ele continua
entrando e gastando o que é dele. Não há aluno trancado neste minuto.**

**Não escrevi pro aluno.** Ele foi avisado em 08/09 (Enviados uid 1355). O que
aconteceu desde então foi defeito **interno**, sem perda de crédito nem de acesso
do lado dele; a única novidade que o afetaria seria *"sua rec#3 está em atraso"*,
que é **cobrança** e não é minha.

---

## 3. A causa: PR **#355** aberto, **não mergeado**

Escrevi o caminho **(a)** do próprio card — alinhar a implementação ao docstring
que o `vinculo.ts` **já declarava** desde 01/09 (*"o lookup por e-mail só ADICIONA
dono, nunca REMOVE"*) — somado à parte útil do **(c)**: a troca recusada **vira
linha de `audit`** em vez de sumir.

```
branch feat/titularidade-so-adiciona-dono-314 · commit f80906eb · PR #355 (base main)
```

- `donoDoEntitlement`: linha que **já tem dono** mantém o dono; órfã recebe o do
  e-mail. **Só ADICIONA.**
- `grantAccess`: a leitura do dono atual **deixa de ser condicional** — não dá
  para preservar o que não se leu. Custo: 1 leitura por evento, e o
  `exigirSucesso` passa a poder lançar em evento que antes nem lia. É o certo: o
  webhook grava o erro, devolve 500 e reprocessa; o upsert é idempotente.
- `titularidadeDivergente` + `logger.error("audit", ...)`: trocar dano silencioso
  por **recusa silenciosa** não seria conserto.

`vinculo.test.ts` **9/9** · `tsc --noEmit` limpo · `eslint` limpo.

**O 4º teste trocou de lado.** Ele se chamava *"titularidade muda quando o e-mail
da compra passa a ter conta"* e era **a linha que carimbava o defeito como
comportamento desejado**. Agora usa os **ids reais** deste caso e exige a
preservação.

**O que o PR custa, sem maquiar:** morre a transferência automática de
titularidade — quem vinculou dono errado à mão deixa de ser corrigido sozinho
pelo webhook e passa a aparecer no `audit`. **Descartei o caminho (b)**
(transferir só quando o destino tem uso): é exatamente **escolher dono por
heurística**, que já errou 7 vezes neste projeto.

**Não mergeei** porque isto muda comportamento **marcado como proposital** no
código — é decisão do Johnny, não de ronda. Levado ao grupo.

### 3.1 ⚠️ A ordem importa, para quem for mergear

O conserto **preserva o dono gravado**. Se subir com a linha apontando para a
conta fantasma, **ele congela o dano** em vez de curar. Por isso religuei
**antes** de escrever o código. Antes do merge, rode a consulta de divergência
(está no corpo do PR) e confira **0 linhas** — em 19/09 15:50Z devolvia 0.

---

## 4. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 726 = 726, 0 escrituráveis, conferida por
   instrumento independente.
2. **Conferi o Jesus, como o card mandava** — e achei a fuse **já estourada em
   16/09**, dois dias antes da data vigiada, por um `PURCHASE_COMPLETE`.
3. **Religuei a titularidade** e devolvi o perfil fantasma a free/sem acesso —
   2 escritas, **1 linha cada, conferidas na releitura**. Commit `fc7ad927`.
4. **Medi que não houve dinheiro desta vez** e, por causa disso, **não
   reexecutei o script de 08/09** — ele teria criado saldo negativo.
5. **Descobri que a consulta de exposição fica cega depois do dano** (§2.1).
6. **Abri o PR #355** com o conserto da causa, teste 9/9 e o custo declarado.
7. **Nota medida no `#314`** (1 → 2 notas), conferida na releitura, 1 linha.
8. **Postei no grupo** os dois fatos — o reparo e o pedido de decisão do PR.

## 5. O que eu NÃO fiz

- **Não fechei nenhum cartão, e o `#314` continua `investigating`.** O conserto
  **não está em produção**: só a main deploya, e o PR #355 espera decisão.
  Fechar agora seria o *"fixed sem ter resolvido"* da regra 14. Falta **uma
  coisa só**: o Johnny decidir o #355.
- **Não mergeei nada.** Os PRs **#351** e **#355** seguem abertos.
- **Não escrevi pro aluno** (§2.4), **não estornei, não concedi crédito, não
  gastei GPU, não toquei em migration, assinatura nem acesso de ninguém.**
- **Não virei ferramenta o detector de dano consumado** (§2.1) — declarado, não
  feito.
- **Não toquei no `#481`** (conserto do `pagou_de_verdade.cjs` provado e parado),
  **no `#329`** (41.600 cr na mesa do Johnny) nem no **`#311`** (R$ 252,45 do
  Hugo, idem).
- **Não li a caixa do suporte@ pra triagem.** Nada da planilha (ordem de 29/08).

## 6. Achado de arrumação: há trabalho de HOJE solto na árvore, sem commit

`frontend/src/lib/agent/mail-respond.ts` está **modificado** (+48/-4) e
`frontend/src/lib/agent/mail-regras-atendimento.test.ts` está **sem rastreio**,
na main, sem commit e sem branch. É trabalho de 19/09 sobre o fallback de
WhatsApp no atendimento (cita o `#414` e uma ordem do Johnny de hoje).

**Não é meu e eu não toquei** — `git add` desta ronda foi sempre por caminho
explícito. Fica registrado porque é exatamente a forma do incidente de 19/08
(fix de aluno preso 9h fora da main): **trabalho pronto que ninguém vê.** Quem
escreveu, commite.

## 7. Para quem pegar a próxima ronda

1. **Ordene por ÚLTIMA NOTA.** Terceira ronda seguida em que funciona. Hoje
   achou um card que **continha um aviso endereçado a quem o pegasse** e que
   ninguém leu por 11 dias.
2. **Aviso de reparo manual tem EVENTO, não DATA.** O `#314` dizia 18/09 e
   estourou em 16/09 num evento de outro tipo. Se um card disser "confira depois
   de tal dia", **confira antes**.
3. **Desconfie de instrumento que ficou mais verde.** A exposição do `#314` caiu
   de 1 para 0 **porque o dano aconteceu**. Antes de escrever "0, tudo certo",
   pergunte se o zero pode significar "já passou".
4. **Antes de mergear o #355, confira a consulta de divergência** (§3.1) — o
   conserto **congela** o dono que encontrar.
5. **O `#314` está esperando UMA coisa: a decisão do Johnny no PR #355.** Se ele
   aprovar, o card pode fechar assim que o merge estiver em produção **e** o
   Jesus for reconferido. Se ele recusar, o card precisa de outro caminho — e
   enquanto isso a bomba segue armada: o pagamento da rec#3 (OVERDUE, pode cair
   a qualquer dia) transfere de novo **e leva 100.000 créditos** para a conta
   vazia, como em 08/09.
6. **O `#481` continua com o conserto pronto pra escrever** e teste óbvio (os 17
   estornos conhecidos viram fixture).

## 8. Fim de ronda — passo fixo conferido

`git fetch origin` · `git log --oneline origin/main..HEAD` **vazio** ·
`git branch` + `git rev-list main..<branch>` conferidos: o único branch com
commit à frente da main é o `feat/titularidade-so-adiciona-dono-314`, que é o
**PR #355 aberto de propósito** — nenhum fix preso sem PR.

Entregas desta ronda: **2 escritas no banco** (titularidade + perfil fantasma,
1 linha cada, relidas), **1 nota no `#314`** (relida), **1 script de reparo**
e **este arquivo** na main, e **1 PR** no branch.
