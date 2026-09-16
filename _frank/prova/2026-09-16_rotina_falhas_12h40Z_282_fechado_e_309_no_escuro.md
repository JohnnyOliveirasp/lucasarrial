# Rotina das falhas — 16/09 12h40Z

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8) — um item até o fim.
**Item da vez:** #282 (`03e7b34b`), 10,0 dias. **Desfecho:** FECHADO (`fixed`), com a
cauda que não cabia nele virando chamado próprio: **#426** (`5f9eb4db`).

---

## 0. Por que este item, e não outro

Esta ronda é continuação: a rodada das 12h40Z já tinha pegado o #282, medido três
frentes e se retratado de um erro às 12h59Z. Regra 8 é serial de propósito —
**não se abre o próximo antes de fechar esse**, então continuei o item em voo em
vez de escolher um novo.

Confirmei a cabeça da fila antes de seguir, um a um, e ela não mudou: **#11**
(56d) e **#15** (47,5d) seguem travados em decisão do Johnny — o #11 depende do
aval de GPU pra retentativa de OOM (#422), não tem aluno esperando e não tem
crédito a devolver; o #15 é aceite de risco consciente do Johnny com todos os
alunos já estornados automaticamente.

---

## 1. O que foi entregue em produção

**Commit `7eb2001f` na `main`** (deploy run `35100877307`).
Autor: `coder` (card `8a5c6ecc`). Revisor: eu (regra 14-B — quem escreve não aprova).

O cartão pedia **uma linha**: *"`reconcileUserEntitlements` não checa o `error` do
UPDATE"*. Abrindo o arquivo, eram **sete** chamadas ao banco descartando o `error`
— e a pior não era a que o cartão nomeia:

> `recomputeProfileAccess` lia os entitlements, jogava o `error` no lixo, o
> `(ents ?? [])` transformava a falha em *"esta pessoa não tem entitlement"*, e a
> função **gravava `plan:"free"`, `access_source:null`, `access_until:null` no
> perfil de quem tinha acabado de pagar** — dentro de um webhook que respondia
> 200. **Erro de LEITURA revogava acesso de pagante, em silêncio.**

Mais duas que eu não tinha especificado e apareceram na varredura:

- **`grantAccess`**: erro na leitura do dono atual reabria o **#222** pela porta do
  erro (gravar `user_id NULL` por cima do dono). A guarda do #222 protege contra
  lookup **vazio**; ela não distingue *"não tem dono"* de *"não consegui ler"*.
- **`claim.ts`**: erro na leitura da trava anti-crédito-duplo devolvia `tx=null`,
  que significa *"ainda não creditei"* → **crédito em dobro por falha de leitura**.
  Achado do coder, não meu. Trava que se desarma por ignorância não é trava.

**O conserto:** todo `error` passa por `exigirSucesso()` (logger scope `audit` +
`throw`), e a decisão de acesso mora agora em `entitlements-pure.ts` com uma saída
explícita `escrever:false` para *"não sei"* — leitura que falha **não escreve nada**
em `profiles`, nem `free` nem `pro`. Ausência de informação não é a informação
*"esta pessoa não tem acesso"* (mesmo princípio do #222).

### A revisão, que não foi `tsc` verde

A regra da casa é explícita: *`tsc` verde não é revisão* — foi correção verde que
criou a regressão que queimou crédito do Valtermir em 19/08. O que eu conferi:

1. **Regra de negócio byte a byte.** `entitlementValeAcesso` é idêntica ao
   `valeAcesso` que estava inline (`active`: null OU futuro; `canceled`: SÓ futuro;
   resto nunca). Ordenação e desempate copiados literais. Fui ler
   `acesso-regra.ts` justamente porque o coder trocou a função inline por uma
   importada — se elas divergissem, a regra teria mudado em silêncio.
2. **Lançar é o contrato certo do caller.** O webhook da Hotmart já grava o erro
   em `payment_events.error`, devolve **500**, deixa `processed_at` NULL e
   **reprocessa no reenvio** (`route.ts:124-131`). Antes, falha de banco virava
   evento marcado como PROCESSADO COM SUCESSO sem ter feito nada.
3. **Reprocessar é seguro.** `upsert` e `update` são idempotentes, e o zeramento
   de crédito de estorno é idempotente por transação no próprio banco (mig 108).
4. **O login não passou a falhar.** `claim.ts` continua best-effort e não relança;
   o `catch {}` só deixou de ser mudo.

**Verificações rodadas por mim, do zero** (não herdadas do relatório dele):
`npx tsc --noEmit` → exit 0 · `npx eslint` nos 4 arquivos → exit 0 ·
`node --test entitlements-pure.test.ts` → **18/18** ·
`node --test src/lib/payments/*.test.ts` → **208/208**.

---

## 2. O achado grande: 309 compradores do SGP no escuro (#426)

A perna (b) do #282 pedia *"a medição de dinheiro dos 321 do lote de 04/09"* com
*"amostragem contra a Hotmart viva"*. Fiz. O resultado não cabia de rodapé.

| medida | valor |
|---|---|
| contas criadas no lote de 04/09 (15h–17h30Z) | 369 |
| **vazias** (nunca logaram, sem entitlement, sem pedido, sem voz, sem crédito) | **309** |
| amostradas na Hotmart viva | 12 |
| **que pagaram** | **12 de 12** |
| faixa paga (Sistema de Geração Pronto) | R$ 347 a R$ 741 (mediana R$ 537,66) |
| dia normal (01/08 a 03/09): contas criadas | 20 a 58 |
| dia normal: contas vazias | **0 a 4** |

Controle de que o filtro não pega todo mundo por construção: das 369 daquele dia,
23 logaram, 19 têm entitlement, 20 têm crédito, 15 têm pedido no /sgp.

### Por que ninguém viu em 12 dias — e é isto que dá nome ao #426

O único varredor que persegue *"pagou e não recebeu"* (`sweepOrphanPurchases`,
`orphan-outreach.ts`) não acha essas 309 por **dois** motivos independentes:

1. **Produto** — linha 113 filtra por um único `PRODUCT_ID` hardcoded (linha 15)
   que não é o do SGP. Essa metade já tem dono no **#312**.
2. **A conta** — linhas 132-143 montam `hasAccount` e **excluem quem tem perfil**.
   As 309 passaram a ter perfil, criado pelo próprio lote.

> **Criar a conta foi o que escondeu essas pessoas.** Antes do lote elas eram
> "compra aprovada sem perfil" e teriam convite; depois viraram "já tem conta,
> logo está atendida". A ação que parecia ajudar foi a que apagou o rastro.

---

## 3. Duas armadilhas que eu quase pisei nesta mesma ronda

**(a) O instrumento cego.** A consulta em `emails_enviados` diz que **324 de 325**
nunca receberam e-mail. O número é **lixo**: `emails_enviados` só começa em
**14/09 14:06Z** (215 linhas, 7 origens, **zero** linhas de 04/09) — o lote é 10
dias anterior à existência da tabela. Zero de instrumento que não cobre a janela
não é ausência de e-mail. Rodei o controle **antes** de publicar, desta vez — a
nota das 12h59Z de hoje foi exatamente a retratação de um número publicado sem
esse controle.

**(b) `numero` não é `id`.** `anotar_incidente.cjs 282` resolveu **282** como
*prefixo de UUID* e casou com `28234873-…` — um chamado **completamente
diferente** (um caso de Vídeo História, já `fixed`). O ensaio mostrou
`status: fixed -> fixed` e um título que não era o meu, e foi só por isso que eu
não gravei a nota de fechamento do #282 em cima de outro chamado. A ferramenta
recusa id **inexistente ou ambíguo**, mas `282` é um prefixo **válido e único** de
outra linha — então ela aceita, com toda a razão do mundo, e o alvo errado passa.
**Sempre rodar o ensaio e conferir o TÍTULO antes do `--confirmar`.**

---

## 4. Por que o #282 fecha (regra 14: nunca `fixed` sem ter resolvido)

O que **este** cartão afirmava está respondido:

1. os 7 pagantes de R7 foram restituídos em 06/09;
2. *"a causa segue viva e o próximo lote repete"* foi **medido e é falso** para o
   caminho do portal — 73 pedidos enviados depois do merge `2697d95`, **0 órfãs
   vivas**, com 3 controles (nota das 12h40Z, seção 1);
3. o buraco que fazia a reconciliação falhar **sem deixar rastro** está fechado em
   produção por `7eb2001f`.

O aluno que estava parado dentro do cartão (**Paulo**, `paulosbs1604@gmail.com`)
foi avisado hoje — Enviados **uid 2505**, cópia confirmada.

**Crédito: não havia o que devolver aqui, e digo em vez de omitir.** Os 7 já foram
restituídos em 06/09; o Paulo não tem débito nenhum (trial não pago, e compra
avulsa de SGP não é assinatura — o que ela dá direito na plataforma é decisão
**comercial**, #173, não minha); e o dinheiro das 309 é questão do #426, que
depende do Johnny.

**Fecho sem fingir que acabou o assunto:** as 309 pessoas do lote **não estão
atendidas**. Elas não estão sendo fechadas junto — estão no #426, com a medição e
os três próximos passos nomeados. Quem ler este `fixed` tem que ler essa linha
junto.

---

## 5. O que eu NÃO fiz

Não vinculei entitlement, não dei crédito, não dei acesso, não mexi em plano nem
em saldo de ninguém — dar plano `pro` a 309 pessoas por conta própria seria *"dar o
que nunca foi dele"*, o lado que a regra 9-B manda parar e chamar o Johnny. Não
escrevi para as 309 (envio em massa precisa do "pode" do Johnny, regra 8). Não
apliquei migration (não há DDL). Não gastei GPU. Não mexi no #11, no #15 nem em
nenhum outro item da fila.

---

## 6. O que falta, nomeado (no #426)

- **(a) Decisão do Johnny:** as 309 recebem contato em massa? Com que oferta — só
  o caminho do `/sgp` (que já funciona e não exige login), ou também acesso?
- **(b) Medição completa** das 309 contra a Hotmart viva, pra saber o valor real e
  separar quem pagou de quem caiu no lote sem ter pago.
- **(c) Conserto do ponto cego:** *"tem conta"* não pode significar *"foi
  atendida"*. Conta vazia de comprador é exatamente o caso que precisa de convite.

### Pergunta em aberto, declarada como hipótese e não como achado

De 05/09 a 15/09 a contagem diária de contas vazias ficou em **8 a 22**, contra
**0 a 4** em todo agosto. Pode ser efeito de **idade** (conta nova ainda não teve
tempo de agir) e não um defeito novo — os dois se parecem nessa janela. **Não
afirmo que a taxa subiu**; fica registrado para a próxima ronda medir com controle
de idade (ex.: "vazias 7 dias depois da criação", coorte a coorte).
