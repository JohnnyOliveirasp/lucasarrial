# Ronda das falhas — 11/09/2026, 02hZ (23h BRT)

Dono da fila (14-A). Peguei **um** incidente e levei até o fim: **`#312`**
(`c726c5ae`) — *"o único varredor que acha 'pagou e nunca criou conta' é cego
para o SGP"*. Saiu de `investigating` para **`aguardando_aluno`**.

Repo em `main`, `pull --ff-only` (já em dia). `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Ordem de **29/08** respeitada: nada da
planilha. Ordem de canal de **31/08**: o aviso desta ronda foi **no grupo**.

**Não mexi em crédito, não criei conta, não estornei, não alterei código e não
mandei e-mail nenhum nesta ronda.**

---

## Por que este e não outro

Regra 8, escolha serial. Ordenei a fila por `first_seen_at`. Deu **empate no
topo**: `#312` e `#313`, ambos com origem de classe em **09/06** (abertos os
dois em 08/09). Desempate da própria regra — *quem tem mais gente sofrendo*:

| | gente | é sofrimento? |
|---|---|---|
| `#312` | **19** | sim — pagaram e não têm conta nem entrega |
| `#313` | 12 | não — estão **ganhando** plataforma de graça; quem sangra é a casa |

Fui no `#312`.

---

## O achado principal: a retratação é minha desta vez

A nota 2 deste card — **escrita por mim em 08/09 20:50Z** — diz, sobre os 4
compradores de 09/06:

> *"NÃO tem registro nenhum: **nunca receberam e-mail algum**. 91 dias, pagos,
> zero contato."*

**Está errado.** Os 4 receberam em **08/09 20:27Z** — uids **1345, 1346, 1347,
1348**, conferidos um a um na pasta de Enviados. E é um e-mail bom: abre pedindo
desculpa pelos três meses, explica o que é o SGP, dá o link do portal público,
lista o material necessário, e oferece a saída de desistir *"sem discussão"*.

Eu escrevi a nota **23 minutos depois de os e-mails saírem**.

O que eu de fato tinha medido era a ausência deles em
`agent_state.sgp_boas_vindas` — a trava do e-mail **automático** — e li isso
como "zero contato". É **exatamente** a armadilha que eu cobrei do Vigia há duas
horas, na ronda das 00h, no `#254`: afirmar silêncio da casa sem abrir a pasta
de Enviados. Cobrei dele às 01h e cometi a mesma às 20h50 de anteontem.

**Lição, que vale mais que o caso:** ausência na trava do automático **não é**
ausência de contato. Enviados é a fonte, e a consulta custa 8 segundos.

---

## O estado real das 19 pessoas

Medido agora, não herdado de nota:

- **19/19** seguem com **0 perfil** e **0 pedido** em `sgp_pedidos`. Nada se
  resolveu sozinho em 3 dias.
- **19/19 já foram contatadas.** Conferi uma a uma em Enviados: 18 têm 1
  e-mail; `victor.inscriptio` tem **8** (é o `#309`, reembolso).
- **Zero respostas** na INBOX dos 4 de 09/06, e **zero pedidos** no portal de
  qualquer um dos 19.
- **Não foi bounce.** Varri a caixa procurando retorno de entrega para os 4:
  nada. Os bounces vivos hoje são de `valdene_marques`, `hamiltocelestino1` e
  `ulyssemmachado` — ninguém desta lista. **O silêncio é do aluno, não do
  canal.**

Confirmação de dinheiro na **Hotmart viva** (o próprio card exigia conferir um
a um antes de qualquer remediação):

| aluno | Hotmart viva |
|---|---|
| `igorfigaro.nunes@hotmail.com` | **R$ 951,12** (2 avulsas COMPLETE, 09/06) |
| `leraqorganicos@gmail.com` | **R$ 794,00** (2 avulsas COMPLETE, 09/06) |
| `fabiosaadi@icloud.com` | **R$ 913,80** (2 avulsas COMPLETE, 09/06) |
| `pablomikael67@gmail.com` | ⚠️ **avulsas pagas: 0** — ver abaixo |

**`pablomikael67` fica marcado e eu NÃO afirmo que ele pagou:** o nosso banco
tem 2 `PURCHASE_APPROVED` dele (7283335 R$ 305,97, logo após um `CANCELED` do
mesmo valor, e 7283229 R$ 511,94), mas a Hotmart viva hoje devolve zero avulsa
paga. Quem for decidir dinheiro dele confere na Hotmart antes.

---

## O pedido (a) do card continua REJEITADO — agora com prova no fonte

O card pede *"o varredor passar a enxergar mais de um produto"*. Minha nota 2 já
tinha invertido isso por raciocínio; hoje fui ao código e a rejeição se sustenta
por **três** razões independentes:

1. **É no-op para 15 dos 19.** `compradorMereceConvite` (`acesso-regra.ts`) abre
   com `if (!ent) return false`. Os 15 de 04-05/09 não têm entitlement. Widenar
   o filtro não os alcança.
2. **É contra o desenho, e está escrito.** O cabeçalho da própria função:
   *"Quem pagou uma compra AVULSA mas não a assinatura fica de fora **de
   propósito** (…): o que a avulsa dá direito dentro do FastCloner é decisão
   **COMERCIAL**, de gente, não de sweeper (#173)."* Os 19 são todos avulsa do
   7283229.
3. **É ativamente danoso para os outros 4.** Eles têm entitlement `active` com
   `access_until` NULL (o `#313` — conferido hoje: 1+2+2+2 = **7 linhas
   vitalícias**). O acumulador `pagou` do laço vira `true` com a avulsa APPROVED
   de valor > 0, então eles passariam nas **três** guardas (`hasAccount`, sem
   perfil; `jaTemDono`, `user_id` null; `compradorMereceConvite`, entitlement
   vale acesso) e receberiam convite automático para *"ativar seus créditos
   reservados"*.

> **O filtro da linha 142 não é o defeito. Hoje ele é o que está SEGURANDO o
> `#313`.** Consertar o `#312` como pedido entregaria de graça, por e-mail
> automático, exatamente a plataforma vitalícia que o `#313` existe para tirar.

Deixei isso anotado **também no `#313`** (nota 3), como aviso de ordem de
execução: conserta o `#313` primeiro; só depois se discute o filtro.

---

## O dano real já está fechado para compra nova

Re-medi a fronteira do `cc6edb2` (05/09 08:01Z) — só dinheiro que entrou
(`valor > 0` **E** status APPROVED/COMPLETE), com **45 compradores a mais** do
que a medição do Vigia de 08/09:

| coorte | compradores | com perfil | com pedido |
|---|---|---|---|
| **A** (antes do `cc6edb2`) | 20 | **1** | 0 |
| **B** (depois) | **130** | **130 (100%)** | 33 (25,4%) |

O **130/130** é o ponto: a criação de conta na compra **não regrediu** em 3 dias
e 45 compras novas. A classe está fechada para quem compra hoje; o que sobrou é
o rabo histórico da coorte A.

E o modo de falha que ainda restaria — a boas-vindas não sair e a trava marcar
como tratada — **tem detector**: `boas_vindas_sgp_nao_saiu.cjs` (`#324`). Rodado
nesta ronda: trava lida 01:32Z, 146 transações, **controle positivo 2/2 OK**,
**zero vítimas**.

---

## Achado lateral, medido e registrado (não virou chamado)

`payment_events → payload.data.purchase.price.value` é **multi-moeda**.
`orthobor@gmail.com` traz `value = 733699` com `currency_value = PYG` (guarani
paraguaio, ~R$ 520) num produto que vende por ~R$ 600.

Qualquer consulta que **some** `price.value` sem olhar `currency_value` infla
esse caso em **~1400×**. Cheguei nisso porque o número saltou na conferência de
garantia e eu fui olhar em vez de deixar passar. Não abri chamado — deixo
medido, porque a casa tem consultas que somam esse campo.

Também conferido: `warranty_date` é **null** em todos os 14 da coorte de
04-05/09. Não dá pra afirmar janela de garantia fechando para eles, e eu não
afirmo.

---

## Por que `aguardando_aluno` e não `fixed`

A causa técnica está resolvida e **verificada** (130/130), o pedido (a) está
rejeitado **com prova**, e as 19 pessoas estão **contatadas**. O que falta não é
investigação — é resposta de aluno. Marcar `fixed` seria mentira (não consertei
nada nesta ronda, e as 19 seguem sem entrega); deixar `investigating` seria
dizer que ainda não sei, e eu sei.

`aguardando_aluno` é o balde que mantém essas 19 pessoas **visíveis** na
varredura em vez de fechadas — que é exatamente o motivo pelo qual esse bloco
existe (objeção do Vigia de 25/08).

**Com data:** a segunda tentativa vence em **15/09** (08/09 + 7 dias, a regra do
*"parado há 7d+ pede SEGUNDA tentativa, não silêncio"*).

---

## O que anotei

| onde | o quê | notas |
|---|---|---|
| `c726c5ae` (`#312`) | a retratação da minha nota 2, as 19 conferidas em Enviados, a rejeição do pedido (a) com prova no fonte, o 130/130, o detector `#324` verde, o PYG e a marcação do `pablomikael67` | 7 → **8** |
| `2d0509b4` (`#313`) | a nota de acoplamento: o filtro do `#312` é o que segura este defeito; ordem segura de conserto | 2 → **3** |

Os dois `UPDATE` conferidos na releitura, **1 linha afetada** cada.

## Números da ronda

- **71 → 70** incidentes em `open`/`investigating` (0 em `open`); `aguardando_aluno` **12 → 13**.
- **0 e-mails enviados.** As 19 pessoas já estavam contatadas — mandar de novo
  no 3º dia seria rajada, não cuidado; a régua da casa é 7 dias.
- Caixa lida só com `EXAMINE` + `BODY.PEEK`, busca `SEEN`. **Não toquei em não-lido.**
- Custo: leitura + 1 execução do detector do SGP. Nenhuma GPU, nenhum crédito,
  nenhuma chamada paga de visão.
- 🧹 Higiene, **estável**: seguem **8 arquivos** modificados não commitados em
  `frontend/**/sgp*` e `frontend/messages/*`, mais os não rastreados em
  `_frank/rascunhos/`. **Nona ronda seguida.** Não são meus, **não toquei**;
  commitei só este log.

## O que continua parado

| | idade |
|---|---|
| `#309` Victor — prazo **venceu**, decisão de vendedor na Hotmart | 55h |
| `#313` `2d0509b4` — 15 vitalícios de graça | 53h (18ª ronda pedindo) — **agora com a ordem de conserto anotada** |
| `#331` `3528dd59` — Mastroianni, reposição de crédito | 25h |
| `#341` `b633b18c` — 147.350 (14 pessoas), devolução do SGP | 13h |
| PR **#92** em DRAFT | 14 dias |
