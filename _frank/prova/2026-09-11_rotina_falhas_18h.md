# Ronda das falhas — 11/09/2026, 18h00Z (15h00 BRT)

Frank, dono da fila. Método serial (regra 8). Esta ronda **não fechou incidente**,
e o que ela entregou foi: **a perna de código do `#350` em produção** e **duas
correções de registro** — uma que desmente a ronda anterior, outra que desmente
o instrumento que eu mesmo subi hoje.

## 1. O `#350` teve a perna de código entregue — PR #239 na main

A ronda das 16h52Z deixou o PR **aberto**, então o instrumento existia mas **não
valia**. Mergeado nesta ronda: **`fe4d884`** (conferido com `git log origin/main`
depois do `pull`, não em relatório herdado).

Rodado em produção às **17:41Z**: 72 incidentes abertos · 16 parecem pedido de
reembolso · 57 pessoas · **controle positivo OK (2/2)** — obrigado a reencontrar
Victor e Lucila antes de afirmar qualquer coisa, e reencontrou.

**5 perderam a janela na fila · 2 vencem em 48h · 1 na perna da renovação.**

O card **segue `investigating`**, e isso é regra 14, não hesitação: a perna de
código está no ar, mas **nenhum aluno atingido foi tornado inteiro**. As 4
devoluções seguem com o Johnny desde ~16h50Z. Fix em produção não é fim.

## 2. A ronda anterior errou sobre o Leandro, e eu corrigi o registro

A ronda das 16h52Z publicou como lição de destaque:

> *"**O Leandro NÃO foi cobrado em dobro.** (…) ele tem **uma** cobrança paga"*

**Isso está errado no nível do par**, que é o nível em que a perna existe.

**Medido agora na Hotmart viva, nos DOIS endereços:**

| conta | cobrança FastCloner | status | garantia |
|---|---|---|---|
| `contato@aeroclubejf` (CNPJ, `J9HMYL9P`) | R$97 · 28/08 · `HP3355066694` | **COMPLETE** | venceu 04/09 |
| `leandro@aeroclubejf` (PF, `4XVSU9U7`) | R$97 · 05/09 · `HP0976568130` | **APPROVED** | **12/09 00:00Z** |

São **R$194 pagos pelo mesmo produto** (7851642) no mesmo ciclo. É exatamente a
classe do `#254`.

**De onde veio o erro:** a medição anterior rodou `pagou_de_verdade.cjs` **só em
`leandro@`**. Nesse endereço, isolado, a leitura está certa — 1 paga, resto
`OVERDUE`. O erro não foi ler `OVERDUE` como pago (essa armadilha, a do `#138`,
foi evitada). **O erro foi recortar o par em um endereço só e concluir sobre o
par.**

**Por que isso importa:** os e-mails **uid 1173/1174** (06/09) e **uid 1698/1699**
(11/09) dizem ao aluno, por escrito e com os dois códigos, que há duas assinaturas
somando R$194/mês. Herdar *"não foi cobrado em dobro"* faria a casa mandar ao mesmo
aluno uma **terceira** mensagem contradizendo as duas anteriores.

**O que NÃO muda:** a decisão de **não escrever hoje** segue certa, por outro
motivo. Conferido agora: avisado 2× nos 2 endereços, com a hora correta (as "21h"
publicadas = 12/09 00:00Z, confere), e **INBOX "nada encontrado" nos dois** — ele
nunca respondeu. Pela **9-C** não cancelo assinatura de titular (ainda mais no
CNPJ) sem pedido escrito. **A bola é dele; não estou travado.**

## 3. O instrumento que subi hoje tem ponto cego, e ele quase custa R$ 2.809,32

Primeira rodada em produção, o `garantia_na_fila.cjs` imprimiu:

```
#356 tuquinha36@hotmail.com · pediu em 2026-09-11 · janela (sem compra paga)
```

**"Sem compra paga" é falso no mundo real e verdadeiro no nosso banco.** É o
**maior pedido de devolução da fila**.

O Vigia já tinha medido às 16:17Z (li, não refiz por cima): `payment_events`
**zero** linhas, `entitlements` **zero**, `aluno.cjs` diz *"compras: NENHUMA"* —
e a **Hotmart viva diz PAGOU**, 4 avulsas COMPLETE, **R$2.712,12** (o chamado fala
em 5 compras / R$2.809,32).

**Causa:** o script deriva a janela de `warranty_date` no **nosso** banco. Sem
linha local, não há `warranty_date`, logo sai *"sem compra paga"*. Ele não mente
por bug — responde honestamente sobre base incompleta. **O defeito é meu e é de
rótulo:** escolhi um texto que **lê como veredito de pagamento** quando é só
ausência de linha.

É a família do `#312` e do *"pagante sem acesso: zero"* de 07/09. Desta vez a mina
foi **plantada por mim**, no mesmo dia em que a ferramenta subiu.

**Consequência honesta:** o número **"5 perderam a janela" é PISO, não total.**
Qualquer pagante invisível ao nosso banco está fora da conta.

**Não corrigi o script nesta ronda, de propósito** — exige branch + PR e eu não ia
deixar isso pela metade no fim da ronda. Fica escrito nos dois cards onde o dano
aconteceria.

## Registros gravados (todos conferidos na releitura, 1 linha afetada cada)

- **`#254`** `f1ada07e` — 25 → **26** notas: a correção do par aeroclubejf.
- **`#350`** `3a9a4854` — 6 → **7** notas: merge `fe4d884` + o ponto cego + por que
  não vai a `fixed`.
- **`#356`** `094d7b59` — 7 → **8** notas: o aviso de não ler *"sem compra paga"*
  como *"não pagou"*.

## Números da ronda

- **72 incidentes** abertos — **72 → 72. Nenhum fechado.** O que entreguei foi a
  perna de código do `#350` em produção e três registros que impedem decisão
  errada sobre dinheiro. Marcar `fixed` hoje seria mentira (regra 14).
- **1 PR mergeado** (#239 → `fe4d884`) · **3 incidentes anotados**.
- **0 e-mails** · **0 GPU, 0 crédito, 0 estorno, 0 cancelamento, 0 migration.**
- **Relógio aberto:** Leandro, R$97 de 05/09, vence **12/09 00:00Z**. Avisado 2×,
  não respondeu. Sem resposta dele, não há ação minha — e a perna **não** está
  resolvida: segue um par pagando R$194/mês pelo mesmo produto, com a casa ciente.
- 🧹 Higiene, **inalterada**: seguem **10 arquivos** modificados não commitados em
  `frontend/**/sgp*` e `frontend/messages/*`, mais não rastreados em
  `_frank/rascunhos/`. **Décima sexta ronda seguida.** Não são meus, **não toquei**.
  Meus scripts ficaram em `/tmp/frank/`, fora do git.

## O que a próxima ronda pega

1. **Corrigir o rótulo do `garantia_na_fila.cjs`** (branch + PR): *"sem compra
   paga"* → *"SEM LINHA NO NOSSO BANCO — conferir na Hotmart viva"*. É barato e
   tira o risco de leitura errada. Depois, fazer o script cair para
   `pagou_de_verdade.cjs` quando não houver linha local.
2. **Resposta do Johnny sobre as 4 devoluções** — valores e datas já apurados na
   nota do `#350`.
3. **Se o Marcelo responder "pode treinar"**: não retreinar o arquivo de 47min.
   Ver nota 24 do `#65`.
