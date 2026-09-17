# Ronda das falhas — 17/09/2026, 11hZ (08h BRT)

Dono da fila (14-A). Peguei **um** caso e levei até o fim: a Maria Teresa.
Fechei **`#356` e `#408`**, escrevi para a aluna (entrega conferida), parquei
a perna que sobrou no **`#412`** com data de segunda tentativa, e deleguei o
código do **`#446`** com um PR pendente.

Ordens lidas antes de tocar em qualquer coisa: `_frank/ordens/README.md`, a de
**29/08** (planilha desligada) e a de **31/08** (canal — FastCloner só no
grupo). **Nada da planilha foi lido, escrito, classificado ou reprocessado.**
O aviso desta ronda saiu **no grupo**, com `notify-grupo.sh`.

---

## 1. O que esta ronda entrega, em uma frase

**O dinheiro da aluna já tinha voltado e ninguém tinha ido contar pra ela.**
R$ 2.712,12 estornados, 44 horas de silêncio em cima disso, e ela a um passo
de contestar no cartão — o que faria a casa perder o valor **e** a relação.

---

## 2. O caso: Maria Teresa (`#356` + `#408`) — FECHADOS

### 2.1 Por que escolhi este e não o mais velho da fila

A regra 8 manda pegar o mais antigo **com aluno afetado**, e a prioridade diz
que **aluno esperando vem antes da limpeza da fila**. Aqui as duas apontaram
pro mesmo lugar: 44 h de silêncio, valor alto, segunda cobrança dela, e a
leitura de risco que a ronda de 15/09 já tinha escrito com todas as letras —
*"o próximo passo natural dela é contestação no cartão"*.

### 2.2 O primeiro passo do manual é o que resolveu: **já resolveu sozinho?**

O manual abre com *"(1) JÁ RESOLVEU SOZINHO? é o caso mais comum — confira o
estado atual do aluno antes de qualquer coisa"*. Era exatamente isso.

Medido hoje na **Hotmart viva**, transação por transação
(`/sales/history?transaction=...`), não no nosso banco:

| transação | produto | valor | status |
|---|---|---|---|
| `HP1172761139` | Fábrica de Conteúdo Invisível | R$ 313,32 | **REFUNDED** |
| `HP0096249040` | Sistema de Geração Pronto | R$ 478,32 | **REFUNDED** |
| `HP3867617411` | Comunidade Presença Lucrativa | R$ 1.803,60 | **REFUNDED** |
| `HP3223951041` | Gerador de Ganchos Inteligente | R$ 116,88 | **REFUNDED** |
| | | **R$ 2.712,12** | **4 de 4** |

**A janela do estorno, sem chute:** em **15/09 12:32Z** a mesma consulta dava
`COMPLETE` nas quatro — está escrito na nota do Frank no próprio `#408`. Hoje
dá `REFUNDED`. Então o estorno saiu **entre 15/09 12:32Z e 17/09 10:55Z**.

**A data exata eu não tenho e não inventei.** Dei dump no payload inteiro de
`HP3867617411` pra procurar: o `/sales/history` devolve `order_date`,
`approved_date` e `warranty_expire_date` — **não existe campo de data de
estorno**. Escrever "estornado em 16/09" seria inventar.

### 2.3 O que eu escrevi pra ela

Enviado hoje, assunto *"Seu reembolso saiu - conferi as 4 compras uma a uma"*,
chave `reembolso-confirmado-tuquinha36`. **Entrega conferida**: cópia na pasta
de enviados, **uid 2617**, e linha gravada em `emails_enviados`
(origem `ronda-manual`). Ensaiei com `--dry-run` antes.

Na carta: as 4 transações com código e valor, o total, e três coisas que eu
fiz questão de não maquiar —

1. **Por que a resposta de segunda-feira dizia o contrário.** Naquela hora as
   compras ainda constavam pagas. A resposta estava certa; o erro foi outro,
   e é nosso: **ninguém voltou pra avisar quando mudou**.
2. **O prazo do dinheiro na mão dela não é nosso.** Estorno de cartão volta
   pela fatura da administradora (a de R$ 1.803,60 era **12x**). Prometi o que
   depende de mim — se passarem duas faturas, ela me escreve e eu levanto de
   novo com os códigos — e **não prometi data de crédito na fatura**, que não
   é minha pra prometer. Foi prometer o que não dependia da casa que deixou
   ela 4 dias no vazio.
3. **O pedido de desculpas pelos dois erros de verdade**: o WhatsApp inventado
   que caiu no comércio de outra pessoa (`#414`) e o loop de respostas
   automáticas se corrigindo umas às outras quando ela pediu para falar com
   uma pessoa (`4a591522`).

O contato certo eu **conferi no código antes de escrever** —
`WHATSAPP_SUPORTE_CURSO` em `sgp-boas-vindas.ts:100` = **(41) 99148-1573**.
Repetir de cabeça um número que já saiu errado uma vez era o jeito mais fácil
de errar duas.

### 2.4 Fechamento, com a contagem de linhas conferida

`update ... returning id, numero, status` devolveu **2 linhas**: `094d7b59`
(`#356`) e `8cc795ba` (`#408`), ambas `fixed`, `resolved_at 10:48:01Z`.
Conferi o retorno **porque update por id inexistente afeta 0 linhas em
silêncio** — a armadilha que já fez ronda declarar feito o que não gravou.

**Sem commit: não era defeito de código.** Era promessa parada mais ninguém
avisando. Os defeitos que este caso expôs continuam **abertos e intocados**:
`#410` (a signature legada que rachou o cartão em dois), `#414` (WhatsApp
inventado) e `4a591522` (a Fast responde sozinha depois do caso ir pra humano).

### 2.5 O que eu NÃO fechei — a perna dos R$ 97,20 (`#412`)

A diferença entre os R$ 2.809,32 do recado e os R$ 2.712,12 conferidos são
**R$ 97,20**, o "FastCloner parcelado" que ela afirma ter pago e cujo
comprovante diz ter mandado.

Procurei hoje no `/sales/history` pelo e-mail dela em **todos os status que a
API aceita** — `APPROVED`, `COMPLETE`, `REFUNDED`, `CHARGEBACK`, `PROTESTED`,
`CANCELLED`, `EXPIRED`. **Só as 4 linhas da tabela acima. Zero cobrança de
R$ 97,20 em qualquer status.** Rondas anteriores já tinham varrido por nome,
CPF e telefone em `payment_events`: zero também.

**E mesmo assim eu não concluí "ela não pagou".** A classe `#222` já voltou
sete vezes, e o padrão é sempre o mesmo: comprou num e-mail, entrou com outro
(`#214`, `#218`). Pedi o código da transação. **Negar com base em busca por um
e-mail é o erro que essa casa já cometeu sete vezes.**

O `#412` foi pra `aguardando_aluno` **com data**: se ela não responder até
**20/09**, segunda tentativa. Não vira `ignored` sem isso — a varredura já
avisa que `aguardando_aluno` parado 7 d+ pede segunda tentativa, não silêncio.

### 2.6 Crédito e acesso: não toquei, e conferi antes de dizer isso

Perfil `675e7e88`: `credits_subscription` **0**, `credits_extra` **74.516**,
`access_until` **NULL** (sem acesso). A porta já estava fechada e
`credits_extra` é **dívida nossa com o aluno** — por regra nunca é tocado em
estorno. Não havia o que revogar nem o que zerar.

---

## 3. `#446` — o que é meu, o que é do Johnny, e o que eu deleguei

O Vigia abriu hoje às 10hZ. **Conferi a causa no catálogo, não no log dele:**

```sql
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname ilike '%zero_subscription%';
```
→ **0**, medido 10:41Z. A função não existe. O chamador subiu na main em
**14/09** (`0776768`). Medido em `payment_events`:

| janela | eventos de dinheiro devolvido | falharam |
|---|---|---|
| 10/09 → 11/09 (antes) | 4 | **0** |
| 16/09 (depois) | 2 | **2** |

**A separação que importa**, e ela não é minha pra apagar:

- **Aplicar a `scripts/111` é do Johnny.** Mexe em crédito de conta de aluno,
  regra 21. **Não apliquei e não vou aplicar sem o "pode" dele.** Foi pro
  grupo como decisão, marcada como travando produção.
- **O webhook quebrado é defeito de código/deploy, e esse é meu.** Mergear um
  chamador na frente da sua migration não é decisão de negócio.

Deleguei o patch ao **`coder`** (card `88aacb16`, em execução). O escopo que
escrevi é estreito de propósito: reconhecer **só** `PGRST202` / `42883` /
*"Could not find the function"* e devolver `ok:false` em vez de lançar —
**qualquer outro erro de RPC continua lançando**, porque falha transitória de
verdade *precisa* seguir dando 500 pra Hotmart reenviar. Generalizar o `catch`
aqui trocaria um defeito visível por um silencioso.

E exigi que o erro **não** fique só em `payment_events.error`: esse bucket já
provou que ninguém olha — foi onde o defeito passou 26 h gritando. Tem que
disparar o aviso interno pelo caminho que já existe no repo.

**O que continua quebrado mesmo depois desse patch, e está dito em voz alta:**
o crédito de estorno **segue sem ser zerado**. A ponte só tira o webhook do
chão; a regra 9 continua sem efeito até a DDL ser aprovada e **aplicada**.
Mergear o PR #189 não resolve — **merge não aplica DDL**.

---

## 4. O que eu NÃO fiz

Não apliquei DDL, não rodei migration, não mexi em crédito ou acesso de
ninguém, não mergeei PR, não reabri incidente, não li a caixa do `suporte@`
pra triagem, não toquei em e-mail não lido, não mandei e-mail em massa, e não
li nem reprocessei nada da planilha.

---

## 5. Passo fixo de fim de ronda

Conferido abaixo, no rodapé deste arquivo (commit do log vai **direto na
main**; código vai por branch + PR).

---

## 6. Lição

**"Não processado" tem validade curta, e ninguém carimba a data de vencimento.**

O diagnóstico de 15/09 estava impecável: mediu na Hotmart, achou as quatro
compras `COMPLETE`, concluiu com razão que a promessa estava parada, escreveu
pra aluna sem prometer data e escalou. Trabalho certo. E foi justamente por
ser tão bem feito que ele virou **o descanso de todo mundo que veio depois**:
o caso tinha um parecer, o parecer tinha números, os números tinham fonte. Por
dois dias a casa leu aquilo e entendeu *"já foi apurado"*.

Só que o parecer era uma **fotografia**, e o mundo andou por baixo dela. O
dinheiro voltou e o parecer continuou dizendo que não. A aluna, do lado dela,
não estava esperando apuração — estava esperando **o desfecho**, e o desfecho
já tinha acontecido sem que ela soubesse.

É exatamente a mesma forma do `#446`, no mesmo dia: lá, o comentário honesto
no `scripts/111` dizia *"a regra segue sem efeito"* e envelheceu para menos
grave do que a realidade quando o chamador subiu por baixo dele. Dois casos,
um padrão: **documentação de estado é verdade com data, e a data não aparece
no texto.**

O que me tirou do automático nos dois foi a mesma coisa, e é a única regra que
eu levo daqui: **quando um caso está parado esperando terceiro, a primeira
pergunta não é "o que já sabemos", é "isso ainda é verdade agora?"** — e a
resposta se busca na fonte viva (o `pg_proc`, a Hotmart), nunca na nota da
ronda anterior, por melhor que ela seja. Nota boa informa. Fonte viva decide.

E a segunda, menor e mais dura: **fechar um caso inclui voltar pra contar.**
Uma promessa só termina na caixa de entrada da pessoa. Enquanto ela não sabe,
o caso continua aberto pra ela — e foi o silêncio, não o erro, que quase
transformou R$ 2.712,12 devolvidos em uma contestação de cartão.

---

## 7. ADENDO — o passo fixo pegou um, e era o meu

Escrevi a seção 5 dizendo "conferido abaixo" e por pouco não repeti
literalmente o acidente que o manual manda evitar. O `git fetch origin &&
git log --oneline origin/main..HEAD` **não saiu vazio**.

**O que aconteceu:** eu deleguei o `#446` ao `coder` e ele foi trabalhar na
**mesma árvore de trabalho que eu estava usando** — criou e deu checkout em
`feat/446-estorno-nao-derruba-webhook` por baixo de mim. Quando commitei o log
da ronda, `git checkout main` já tinha sido desfeito pelo agente e o commit
`cd23760` caiu **na branch de feature dele**, não na main.

**O detalhe que quase me enganou:** `git push origin main` respondeu
**"Everything up-to-date"** e saiu com código 0. E era verdade — ele empurrou
a ref local `main`, que continuava em `5fb5eac`. O push não falhou; ele
empurrou **outra coisa**. Saída limpa, exit 0, e o log da ronda invisível.

**O que me salvou** não foi o `push`, foi comparar `git rev-parse HEAD` com
`git ls-remote origin refs/heads/main`. `git branch --show-current` devolveu
`feat/446-estorno-nao-derruba-webhook` e fechou o caso.

**Conserto, sem atropelar o operário:** o `coder` está **rodando agora**
naquela árvore. Resetar a branch dele podia destruir trabalho não commitado,
então não encostei. Criei uma árvore separada em `origin/main`, fiz
cherry-pick do commit e empurrei de lá.

**Fica uma dívida declarada, e eu prefiro escrevê-la a escondê-la:** o commit
deste log também existe na branch do `coder`, então o **PR do `#446` vai nascer
com um commit de log que não é dele**. Trato na revisão do PR (rebase ou
`--onto`), não agora, porque agora significaria mexer na árvore de um agente em
execução.

**A lição de processo, que é minha e não dele:** delegar trabalho de código
sem **exigir worktree própria** faz dois agentes disputarem o mesmo `HEAD`. A
casa já tem worktree como padrão (`2026-08-20_correcoes_da_ronda.md`) e eu não
carimbei isso no card. O card seguinte leva a exigência explícita.

E a lição técnica, que vale além deste caso: **"Everything up-to-date" não é
prova de que o seu commit está no remoto.** Só o `ls-remote` é. O `push`
responde sobre a ref que você mandou, não sobre a que você está.
