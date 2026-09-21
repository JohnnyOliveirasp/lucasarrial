# Ronda das falhas — 21/09 ~14h40–15h00Z

Ronda dentro da janela do turno (08h–23h BRT). Alvo serial: **#254 `f1ada07e`**,
cobrança em dobro — 17 dias, 5 alunos pagando duas vezes.

**Três cartas a aluno, um desfecho de perna que estava aberta há 17 dias, zero
GPU, zero crédito tocado, zero migration, zero assinatura cancelada.** O cartão
**não** fechou, e a seção 5 diz por quê.

Ordem de 29/08 respeitada: nada da planilha foi lido, escrito ou reprocessado.
Canal (ordem de 31/08): **postei no grupo**, fatos consumados + dois itens
marcados como urgentes.

---

## 1. Passos fixos

**Reconciliação dos envios** (passo fixo desde 18/09):

| | |
|---|---|
| lidas da pasta `Sent` | 918 |
| já tinham linha | 841 |
| fora da janela (`--corte`) | 77 |
| **RECUSADAS (defeito)** | **0** |
| **escrituráveis dentro da janela** | **0** |

Fecha 918 = 918. Irmão de leitura independente
(`2026-09-18_enviados_x_tabela.cjs`): **0 carta depois do corte**, veredito "o
buraco é PASSIVO". As 77 anteriores a 14/09 14:06:31Z seguem sem decisão
(inalterado desde 18/09).

Nota de saúde: a pasta foi de 913 → 918 desde a ronda das 14h, e as 5 novas
**já tinham linha**. O ledger continua sendo escrito na hora.

**Fila:** 95 abertos (eram 93 às 14h), 40 com 7d+, 36 aguardando aluno.

**Percepção travada** (ordem de 17/09): **2 cartões, o mais velho parado há
3,1d** — `#450` (a própria nota diz que o casamento foi falso positivo do
detector, não é caso de percepção) e `#438` (nota de hoje, 0,0d). Nenhum dos
dois está parado por falta de olhar. **Nada a despachar nesta ronda.**

---

## 2. Por que o alvo serial não foi o cartão mais velho

O mais velho com aluno é o **#226 `702cc916`** (20d, QA esgotado). **Não o
peguei, e digo o motivo em vez de omitir:** ele está parado numa decisão de
produto, e a medição que ela pedia **já terminou** — a nota de 20/09 22h47
entrega distribuição, calibração contra perda real de palavra e o custo de cada
opção, com recomendação escrita (opção (c), avisar acima de 100).

Conferi se a trava é real antes de aceitá-la, porque a ronda das 14h de hoje
mostrou que "esperando aval" às vezes é parada inventada (o #438 passou 3 dias
esperando uma autorização que as regras dizem não existir). Aqui **a trava tem
nome**: a tabela da **9-B** não tem linha para "mudar comportamento de produto
para toda a base". A 9-B me autoriza devolver, restaurar acesso, cancelar a
pedido e mergear bug — nenhuma dessas é o que o #226 pede. **É decisão do
Johnny, e continua sendo.**

Fui então para o próximo com aluno sofrendo, que é também a exceção explícita da
regra 8 (**dinheiro sendo cobrado errado agora**).

---

## 3. A perna do Jackson: 17 dias aberta, e a queixa dele não era o que parecia

Ele escreveu **duas vezes** (a última 20/09 15:24Z): *"A Hormart me cobrou mais
uma vez. Nem a anterior a Hormart me devolveu."*

Medido em fonte viva, não herdado de relatório:

| | |
|---|---|
| rec#1 | 0 BRL COMPLETE 19/08 (trial) |
| rec#2 | 97 BRL COMPLETE 26/08 |
| **rec#3** | **97 BRL APPROVED 19/09** ← a cobrança de que ele reclama |
| assinaturas ativas hoje | **1** |

**A queixa se desdobra em duas, e fundir as duas era o que tornava a resposta
impossível de dar:**

- **A cobrança de 19/09 é a mensalidade normal dele.** Não é dobro. O Jackson
  **não aparece** no `cobrado_em_dobro_historico` desta ronda — a duplicada
  `6VHWPHB9` foi cancelada em 04/09 (#247) e de fato parou de cobrar.
- **Os R$97 duplicados de 26/08 nunca voltaram, e nisso ele está certo.** Essa é
  a dívida real, e é a que está travada no "pode".

**Carta enviada** ~14h55Z, três pernas conferidas: **uid 3087** + linha em
`emails_enviados` (origem `ronda-manual`) + chave `dobro-254-jackson-desfecho`.

**O desenho da carta, de propósito:** separei as duas queixas e **não o empurrei
pra Hotmart de novo**. Ele já tinha sido mandado pra lá em 04/09 e voltou
dizendo que não resolveu; repetir o mesmo encaminhamento transforma atendimento
em loop. Disse que o dinheiro é nosso pra devolver, **sem data**, porque não
tenho data — e que ele não vai precisar cobrar uma terceira vez.

---

## 4. Carlos: o relógio vence amanhã, e ele nunca soube a data

Remedido vivo: `MY5O3KWB` (`caplastica@`, dono **ÓRFÃO**) e `UMJP7PDY`
(`gutoassuncao16@`) as **duas active até 2026-09-22**. Renovam **amanhã** →
**R$194 em vez de R$97**, pela segunda vez.

As **5 cartas anteriores** pediam a frase do 9-C, mas **nenhuma carregava a
data**. Isso é informação nova, então mandei a 6ª — curta, com o prazo explícito
e a frase pronta pra ele só responder:

| endereço | uid | chave |
|---|---|---|
| `gutoassuncao16@gmail.com` | 3088 | `dobro-254-carlos-prazo-2209` |
| `caplastica@hotmail.com` | 3089 | `dobro-254-carlos-prazo-2209-orfa` |

Nos **dois** endereços de propósito: não sei qual ele lê, e a órfã é justamente
a que ele pode nem estar acompanhando.

**Não cancelei a órfã por conta própria.** O 9-C autoriza cancelar **a pedido do
titular**, e o Carlos não pediu; sem o pedido, cancelar é "tirar dele", que a
9-B manda parar e chamar. É o mesmo critério já aplicado ao Diego neste cartão
(não cancelar órfã no escuro). **O preço disso está escrito:** sem resposta dele
ou sem o "pode", a casa cobra errado amanhã e vira caso de devolução.

---

## 5. Por que o cartão NÃO foi pra `fixed`

Das 5 vítimas, **uma** (Solon) tem desfecho desde 13/09 e agora **uma segunda**
(Jackson) tem desfecho escrito. Sobram **três** e as duas travas de sempre:

1. **REEMBOLSO** — Jackson R$97, Carlos R$97, Leandro R$97, Nassara R$97,
   Herineth USD22. Conferi a alçada antes de repetir a palavra "travado": a 9-B
   me autoriza **estorno de crédito até 20.000 cr**; **devolver dinheiro de
   cartão não está na tabela em valor nenhum**. A trava é **real e tem nome**.
   Pedida no grupo em 04/09 ~20hZ → **17 dias**.
2. **A frase do 9-C** de Carlos (6 cartas, prazo amanhã) e Leandro (2 cartas,
   prazo 28–30/09, ainda há tempo).

Status: `investigating`, nota gravada (**38 → 39** notas no array, 1 linha
afetada, conferida na releitura).

---

## 6. O que eu NÃO afirmo

- **Não afirmo que o Carlos vai responder a tempo.** Cinco cartas não tiveram
  resposta; a sexta tem uma informação nova, e só isso. Se ele não responder, a
  cobrança dupla acontece amanhã.
- **Não afirmo que o Jackson ficou satisfeito.** Dei a ele a verdade medida,
  incluindo a parte sem data. A parte sem data é a que ele já reclamou duas
  vezes.
- **Não afirmo nada sobre as 3 vítimas que não escrevi hoje.** Herineth,
  Leandro e Nassara seguem como estavam; a Herineth continua bloqueada só no
  "pode" (a duplicada dela já está cancelada). A regra das 24h manda escrever
  pra Herineth na próxima ronda mesmo sem o "pode", como a nota de 00h45 já
  tinha deixado nomeado.

---

## 7. O que fica nomeado pra próxima ronda

1. **Conferir se o Carlos respondeu** — e se respondeu, cancelar na hora pelo
   9-C. Se não respondeu e a cobrança dupla saiu, a perna dele vira devolução.
2. **Herineth pela regra das 24h** (item acima).
3. **A coorte pós-14hZ do #438** — medição que decide se a perna (B) é real.
   Não a fiz: a coorte tem 1h de vida e mediria ruído.
4. **#343 e #324**, os outros 2 PRs da porta, ainda sem revisão.
5. **#226** — não falta mais medição, falta a escolha do Johnny.

---

## 8. O que eu NÃO fiz

Não cancelei assinatura nenhuma. Não estornei. Não mexi em crédito, carteira,
acesso, entitlement nem plano. Não vinculei conta. Não mandei carta em massa.
Não liguei nem mandei WhatsApp. Não gastei GPU, não apliquei migration, não abri
PR, não mergeei nada. Hotmart só por GET. Nada da planilha (ordem de 29/08).

---

## 9. Passo fixo de fim de ronda

Registro vai **direto na `main`**. Esta ronda **não produziu código** — nenhum
fix pode ter ficado preso em branch porque nenhum branch foi criado. Conferência
de `git log --oneline origin/main..HEAD` vazio registrada abaixo, após o push.
