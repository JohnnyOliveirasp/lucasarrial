# Rotina das falhas — 14/09 ~11hZ

Ronda serial (regra 8). Peguei **um** incidente, o levei até o fim de verdade —
fix, aluna avisada, cartão fechado com nota — e de dentro dele saiu um defeito
de dinheiro que ninguém tinha visto.

Repo em `main`, `pull --ff-only` limpo. `_frank/ordens/README.md` lido antes de
tocar em qualquer coisa; a ordem mais nova do índice é a de **29/08**
(planilha desligada) e ela foi obedecida: **não li, não escrevi, não classifiquei
e não reprocessei nada da planilha.** Ordem de canal de **31/08**: o aviso desta
ronda foi pro **grupo**, com `notify-grupo.sh`.

---

## Estado na entrada e na saída

| | entrada (10:12Z) | saída (10:59Z) |
|---|---|---|
| abertos (`open` + `investigating`) | 81 (44 atend. + 37 téc.) | 81 (43 atend. + 38 téc.) |
| `aguardando_aluno` | 15 | 15 |
| **total** | 96 | 96 |

**Reconciliado contra a ronda anterior**, como manda a regra que herdei das 10hZ:
atendimento **44 → 43** porque fechei o `#385`; técnico **37 → 38** porque abri o
`#389`. Os dois movimentos são meus e estão explicados. Líquido zero — e digo
antes de dizer o número: **a fila não baixou nesta ronda.** Fechei um e abri um.

---

## 1. O serial: `#385` — Evelyn. Fechado, e ela não vai ser cobrada.

Escolhi este porque era o que a ordem manda priorizar: **aluna pagante esperando**,
sem resposta desde 03:10Z (**7,5 h** quando peguei), com relógio real correndo.

### O que era, medido e não herdado

A ronda das 10hZ deixou o diagnóstico certo e eu confirmei cada peça na mão:
ela estava no formulário de **reembolso** (`refund.hotmart.com`), não no de
cancelamento. A Hotmart recusa **com razão**: a entrada dela no FastCloner é
adesão de trial **R$ 0** (`HP0072294815`, 10/09), e não existe valor pago para
devolver. **Não havia defeito nosso nem da Hotmart naquela tela.**

O título do cartão dizia *"tenta cancelar assinatura e recebe erro"* e mandava
caçar um fluxo de cancelamento quebrado que **nunca chegou a ser tentado**.

Conferi o relógio por conta própria em vez de aceitar o número do log anterior:
`date_next_charge = 1789646400000` → **2026-09-17 12:00:00Z**, que na hora da
medição eram **73,3 h**, não zero.

### O que eu fiz

Cancelei a assinatura `XTCI2GJQ` com o `cancelar_assinatura.cjs`. **Não precisei
pedir autorização e registro por quê:** cancelamento é **automático pela regra
9-C** (decisão do Johnny de 21/08) — é pedido do titular, e ela pediu **duas
vezes por escrito**. A ferramenta ainda confere titularidade antes (e-mail bate
com perfil e entitlement) porque cancelar a assinatura da pessoa errada é o
único jeito de transformar um pedido banal em incidente grave.

**Conferi DEPOIS de gravar, não confiei no "✅" da ferramenta:** reconsultei a
Hotmart e o status é **`CANCELLED_BY_SELLER`**. A cobrança de 17/09 **não vai
acontecer**.

Crédito (31.690) e acesso até 17/09 **intactos** — regra 9: cancelar a
recorrência não apaga o que já foi pago.

Escrevi pra ela (regra 8, 21/08: e-mail individual sobre caso que estou tratando
é decisão minha). Cópia **confirmada** nos Enviados, **uid 2219**. Contei o que
era a tela do erro, que não era erro dela, e o que continua valendo até 17/09.

Cartão fechado `fixed` com `resolution_note` dizendo o que era e o que fiz.

### O que eu deliberadamente NÃO disse a ela

Nada sobre os **R$ 924,45 contestados** dela (abaixo). Falar em nome da empresa
sobre reembolso é alçada do Johnny (`06_RELATORIO_E_LIMITES`). O e-mail ficou
estrito ao cancelamento e ao prazo — que é justamente o que **evita** a próxima
cobrança virar a próxima contestação.

### Correção do registro (duas rondas minhas erraram isto)

Às 00hZ eu reportei que ela **perdeu a janela**. Às 10hZ eu reportei que ela
**conseguiu o reembolso** do SGP. **Nenhuma das duas.** A compra do SGP está
**`PROTESTED`** — contestação **aberta**, que não é reembolso concedido. Fui
olhar a Hotmart viva porque o `pagou_de_verdade.cjs` dizia *"avulsas pagas: 0"*
para uma pessoa que eu sabia ter comprado R$ 617 em SGP. Foi esse desencontro
que abriu o `#389`.

---

## 2. `#389` — o SGP não enxerga contestação. 12 clones entregues contra R$ 7.449,00 contestados.

Saiu de dentro do `#385`, e o defeito não é do caso dela.

**As duas portas, cada uma suficiente sozinha:**

**(a) Do SGP só chega o evento que ABRE.** Em `payment_events`, produto *Sistema
de Geração Pronto*: **239 `PURCHASE_APPROVED`** e **ZERO** de
`PURCHASE_PROTEST`, `PURCHASE_CHARGEBACK`, `PURCHASE_REFUNDED`,
`PURCHASE_CANCELED` e `SUBSCRIPTION_CANCELLATION`. 239 a zero. No mesmo banco o
FastCloner tem 12 protests e 1 chargeback, então o tipo de evento existe e chega
nos outros produtos.

**(b) Se chegasse, morreria no nosso código.** `webhooks/hotmart/route.ts:206`
desvia o SGP com o comentário *"Desvia ANTES de tudo — nada abaixo desta linha
pode rodar pra ele"*, e o `mapRevokeStatus` (linha **468**) está **abaixo**. O
desvio está **certo** no que foi desenhado pra fazer (comprar SGP não pode dar
FastCloner de graça, regra do Lucas de 31/08); o defeito é que foi escrito
pensando só em **compra** e engole também a **revogação**.

**O número que importa — serviço entregue contra compra contestada.** Cruzei os
49 e-mails com disputa no SGP contra `sgp_pedidos`: **19 pedidos batem**, e
**12 estão `pronto`** (material enviado, `foto_pronta_em` **e** `voz_pronta_em`
preenchidos) = clone **montado e entregue**, somando **R$ 7.449,00** contestados.
Outros **7 estão em produção agora** e serão entregues igual, porque nada
sinaliza a contestação pra quem monta.

**O recorte honesto:** a casa tem 168 disputas somando R$ 381.426,51, mas a
maioria é **curso/comunidade**, que este sistema não provisiona e **não é dívida
nossa**. Publicar os R$ 381 mil repetiria o erro do *"R$ 7.042 travados"* que o
README do `contato_hotmart.cjs` registra. O número nosso é: **52 disputas em
produto nosso, 49 invisíveis (R$ 28.032,73), todas SGP.**

**Não toquei em nada:** não revoguei acesso, não mexi em crédito, não escrevi pra
nenhuma das 12 pessoas. Contestação pode ser **legítima** — inclusive por falha
nossa de entrega, que é o padrão do `#387` e do caso Emanuel. **Não tratei
ninguém como caloteiro.** O que fazer com os 12 + 7 é decisão de dinheiro do
Johnny e foi pro grupo.

---

## 3. A armadilha que quase me pegou, e o instrumento que mentiu

**A prova circular que eu ia usar.** Eu ia escrever *"a Hotmart não manda evento
de revogação do SGP"* com base na ausência em `payment_events`. O próprio
`route.ts:97-107` documenta que o descarte por produto acontece **ANTES** do
insert, e que por isso procurar o produto na tabela *"só reencontra o efeito
deste `return`"*. Fui conferir a rota antes de afirmar: o `roteamentoDoProduto`
decide por **produto**, não por tipo de evento, e desde 03/09 o SGP rota como
`sgp` — logo um protest **seria** inserido. A distribuição por mês confirma a
história documentada: **13** eventos em 2026-06, **zero** até agosto, **235** em
2026-09. A janela está coberta. Só depois disso a afirmação virou legítima.

E digo o que **não** consigo afirmar: **por que** a Hotmart não manda revogação
do SGP. Isso se vê no painel dela, e a casa não tem acesso ao painel (está escrito
no cabeçalho do `cancelar_assinatura.cjs`). Por isso a correção que proponho é
**reconciliação por consulta**, não esperar webhook.

**O meu instrumento mentiu, e foi a armadilha de 13/09 repetida.** Escrevi
`select("id,credits")` e **não existe coluna `credits`** em `profiles` (é
`credits_subscription` + `credits_extra`). O PostgREST devolveu erro, `data` veio
`null`, e **toda** pessoa apareceu como *"sem conta / sem crédito"* — inclusive
as 10 com saldo. **Peguei por reconciliação**, do jeito que a ronda das 10hZ
estabeleceu como regra: eu já tinha medido na mão que a Evelyn tem **31.690**
créditos, e o instrumento imprimia `-`. Um número que eu não tivesse medido antes
teria passado. A versão commitada **levanta exceção** no erro do select em vez de
seguir com `null`.

O instrumento virou ferramenta versionada com **controle positivo que aborta**:
`_frank/ferramentas/protesto_invisivel.cjs`. Estava em `_Bugs/`, que é
**gitignored** (`.gitignore:87`) — o *"como reproduzir"* do cartão apontaria pra
um arquivo que só existe nesta máquina. Movido, rodado de lá e **números
idênticos** (168 / 163 / 52 / 49 / 10).

---

## 4. O que eu NÃO fiz

- **Não mexi em dinheiro, crédito, acesso nem entitlement de ninguém.** O único
  write no mundo externo foi o cancelamento que a aluna pediu 2× por escrito.
- **Não escrevi pras 12 pessoas do `#389`** — é decisão do Johnny.
- **Não toquei em código de produto.** Nenhum PR nesta ronda. O `#389` propõe a
  correção; não a subi.
- **Não mexi no `pagou_de_verdade.cjs`**, mesmo sabendo que ele é cego a disputa:
  é fonte de verdade de decisão de dinheiro e merece PR próprio com revisão.
- **Não toquei em nada da planilha** (ordem de 29/08).
- **Não ataquei a fila de recados.** Não olhei. Segue como estava.
- Não toquei nos branches STALE (`feat/fix-image-upload-retry`,
  `feat/onedrive-401`, `fix/referencia-fronteira-de-frase-por-palavra`,
  `feat/fabricar-referencia-fronteira-por-palavra`, `vigia/7578c587`).

---

## 5. O que fica pro Johnny

1. **`#389` — os 12 entregues (R$ 7.449,00) e os 7 em produção.** O que fazer.
   É a única coisa desta ronda que depende de decisão sua, e os 7 seguem sendo
   montados enquanto não houver resposta.
2. **Emanuel — 180,81 EUR**, parado desde 11/09. **4ª ronda** que sobe. Sim ou
   não, e o valor.
3. Os 4 reembolsos de janela vencida (`#299`, `#309`, `#363`) seguem esperando.
   O `#385` saiu dessa lista nesta ronda.
4. Marcelo (`#265`) — pedido de saída de 09/09, assinatura ainda ACTIVE. **5 dias.**

---

## Fim de ronda

- `git log --oneline origin/main..HEAD` → conferido **vazio** depois do push
  deste log.
- Não criei branch nesta ronda. Código de produto: nenhum commit.
- Conferência das `vigia/*` e demais branches: nada novo preso — não criei
  nenhuma e não mergeei nenhuma.
