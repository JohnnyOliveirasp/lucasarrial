# Ronda das falhas — 03/09/2026, 22:46Z (19:46 BRT)

Serial: **#222** (`3ca22d47`) — quinta ronda no mesmo serial. Segue sendo o
aberto mais antigo com aluno afetado (01/09 15:54Z).

Item levado até o fim: **Marcio Fernandes** (`cdmarciofernandes`). É o **2º
aluno consertado** do #222 e o primeiro que **derruba a premissa** com que a
ronda anterior montou o "Grupo B".

## Fila conferida antes de escolher

`varredura_travados.cjs`: **5 abertos** (era 6), **12 em `aguardando_aluno`**
(era 11), 2 presos. Nada fura o serial — não há produção fora do ar nem
dinheiro sendo cobrado errado agora.

Antes de tocar em qualquer coisa, reconferi o conserto da ronda anterior:
`aluno.cjs gestao@qooqi.com.br` → *"acesso: ATIVO até 2026-09-21"*. **Segurou.**

## Por que o Marcio, e não os outros 3 do Grupo B

Dos 4 órfãos do Grupo B, todos seguiam com `user_id` null. O Marcio é o **mais
antigo** (entitlement criado 10/08 16:48) e o de **janela mais curta**: expira
**10/09**. Era o que tinha mais a perder ficando na fila mais uma ronda.

## O que a medição mostrou — e onde ela contrariou a ronda anterior

A ronda anterior classificou o Grupo B como *"consertável na mão, igual ao
qooqi"*. **No Marcio isso não valia**, e só apareceu porque rodei o
`pagou_de_verdade.cjs` antes de escrever qualquer coisa.

| evento | data | valor | status |
|---|---|---|---|
| `PURCHASE_APPROVED` FastCloner | 10/08 16:48 | **R$ 0** | APPROVED (**trial**) |
| `PURCHASE_BILLET_PRINTED` | 17/08 14:22 | R$ 97 | boleto **impresso** |
| `PURCHASE_COMPLETE` | 18/08 10:36 | R$ 0 | COMPLETED |
| `PURCHASE_DELAYED` | 20/08 00:50 | R$ 97 | **DELAYED → OVERDUE** |

**Ele não é assinante pagante como o qooqi.** A assinatura do FastCloner é
trial R$0; o boleto de R$97 foi impresso (intenção de pagar) e **nunca
compensado** — e `OVERDUE` não é pagamento. O que ele pagou de verdade foi
**R$ 252,45 em 09/08** na *Fábrica de Conteúdo Invisível*, produto **avulso**
(decisão comercial #173 — **não mexi**).

### A linha do tempo do prejuízo

```
09/08          paga R$252,45 na avulsa (outro produto)
10/08 16:48    entra no trial do FastCloner  → entitlement ORFAO (hotmail)
15/08 21:13    cria a conta (gmail) e entra
15/08 21:19    ultima vez que abriu           (~6,5 min, zero acesso na tela)
17/08 14:22    IMPRIME BOLETO de R$97         (ele quis pagar)
20/08 00:50    boleto nao compensado -> DELAYED
```

Ele imprimiu boleto **dois dias depois** de olhar uma conta que não mostrava
acesso nenhum. Não afirmo que uma coisa causou a outra — não tenho como medir
isso —, mas a sequência fica registrada.

## Identidade: provada, sem a ambiguidade do qooqi

- **local-part IDÊNTICO**: `cdmarciofernandes`@hotmail → `cdmarciofernandes`@gmail
- `profiles.display_name` = **"Marcio Fernandes"** == `buyer.name` da Hotmart
- falso positivo `marciofcorreia@gmail.com` ("MARCIO FERNANDES CORREIA",
  assinatura própria, conta desde 11/08) — **descartado**, como a ronda
  anterior já havia anotado.

## A decisão de vincular (e o raciocínio, porque envolve acesso)

O entitlement está **`active` com janela aberta até 10/09**. A fonte de verdade
do acesso é o entitlement, e o único motivo de ele não estar na conta é o nosso
bug (`claim.ts:39` casa só por e-mail exato).

**Vinculei.** Recusar por "não pagou a assinatura" repetiria exatamente a classe
de erro do `ja_pagou` registrada no índice de ordens: **negar acesso a quem o
sistema diz que tem**. O vínculo entrega o trial que ele já tinha direito, **se
auto-expira em 10/09** e **não move dinheiro**.

O que **não** é minha alçada e foi para o grupo: a avulsa de R$252,45 (#173) e
qualquer extensão/2ª chance pelos 24 dias perdidos.

## O conserto, medido

- `entitlements.user_id` `5c261261` → `b442b394`, com `RETURNING`: **1 linha**.
- Cache do perfil recomposto **como o `recomputeProfileAccess` escreve** —
  conferi no código (`entitlements.ts:157`) que ele grava `plan:"pro"` para
  **qualquer** entitlement que valha acesso, trial ou pago, então "pro" aqui é o
  que a produção escreveria, não um valor copiado do caso pago. `RETURNING`:
  **1 linha**.
- Conferido por **instrumento independente**, não pelo eco do meu UPDATE:
  `aluno.cjs` → *"acesso: ATIVO até 2026-09-10"*, *"compras: 2026-08-10 active"*.

**Não creditei na mão, de propósito.** Zero `credit_transactions` no usuário
(conferido antes). O `claim.ts` concede os 100k no próximo login com
`ref_id = HP1509025099` — conferi que `transactionOf` acha a transação pelo
caminho **direto** (`raw_event->purchase->transaction`), então a escrituração
sai certa e não há risco de dobra.

**Durabilidade:** a guarda `donoDoEntitlement` (`ba6a235`, na main) impede que o
`grantAccess` grave `null` por cima do dono numa renovação.

## 🔴 A TERCEIRA carta errada desta classe — e a pior

A carta de **01/09 (uid 434)** para o Marcio errou **duas vezes**:

1. **"a sua assinatura está PAGA e ativa"** e *"paga até 10/09"* — **falso**.
   Era trial R$0 com boleto vencido. Nenhuma das rondas anteriores rodou
   `pagou_de_verdade` antes de afirmar pagamento.
2. **"crie uma conta usando o cdmarciofernandes@hotmail.com"** — mesma
   instrução errada do `jkakorio` (uid 480) e do `dropweb` (uid 494). Criar 2ª
   conta é justamente o mecanismo que embananou o qooqi.

**Conferido: ele NÃO obedeceu** — `select count(*) from auth.users where
email='cdmarciofernandes@hotmail.com'` → **0**. Nenhuma segunda conta foi criada.

### Carta de correção — uid 502, cópia CONFIRMADA na tentativa 1

Corrige as duas afirmações erradas de frente ("o erro foi meu"), manda **entrar
com Google** (`auth.identities` = google, desvia do #243/#244), diz que os
créditos caem sozinhos, e **avisa que a janela fecha em 10/09 e por quê** — para
ele não ser cortado de surpresa daqui a 7 dias. Sem promessa sobre a avulsa e
sem promessa de extensão. `--dry-run` conferido antes (destinatário, remetente,
corpo inteiro); corrigi no ensaio um "você comprou em 10/08" que contradizia a
própria carta e virou "você começou em 10/08".

## O que isso muda no #222

1. **O Grupo B não pode ser executado em lote.** De 4 alunos, o 1º já não era
   pagante. `pagou_de_verdade.cjs` passa a ser **pré-requisito do vínculo**, não
   etapa opcional — senão a carta afirma pagamento inexistente, como já
   aconteceu 1×.
2. O rótulo "presos fora da conta" cobre situações com **dinheiro diferente**:
   pagante (qooqi), trial com boleto vencido (Marcio), cobrança em dobro
   (Jackson, Carlos). O tratamento muda em cada um.
3. **Causa estrutural intacta**: `claim.ts:39 → reconcileUserEntitlements` casa
   só por e-mail exato. Incidente segue **`investigating`** — de propósito.

Nota no #222: **18 → 19**, 1 linha afetada, conferida na releitura.

## Limites honestos desta ronda

1. **Não consertei a causa do #222** — remediei o 2º aluno e corrigi uma carta
   errada. O bug do `claim.ts` está de pé.
2. Não toquei nos outros 3 do Grupo B (Fernanda, Jesus Peres, dropweb) nem nos
   2 casos de estorno (Jackson, Carlos): serial e alçada.
3. O `dropweb` segue com carta errada (uid 494) **não corrigida** — ele foi
   visto na plataforma em 02/09. É o candidato natural da próxima ronda.
4. Não reverifiquei **#226**, **#234**, **#47**, os dois de áudio (decapitado /
   QA reprovado) nem a Katia. **Não afirmo nada sobre eles.**
5. Não escrevi para o Marcelo (acesso vence **05/09**, 3 cartas já foram) nem
   para o Luan (import quebrado há 6 dias; gatilho de 2ª tentativa é 7 — vence
   amanhã).
6. Os recados em `para_frank_*` e o `patch_92b1cc85` seguem **não tratados** —
   sétima ronda seguida.
7. Não abri o app, não ouvi áudio, não vi imagem: banco, envelope, Hotmart e
   código lido.
8. Não sei **por que** ele não compensou o boleto. A sequência sugere, não prova.
