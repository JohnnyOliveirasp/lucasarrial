# Ronda das falhas — 12/09/2026 11h00Z (08h00 BRT)

Canal: ordem de 31/08 — tudo de FastCloner vai pro **grupo**, e só pro grupo.
Este arquivo é o log técnico da ronda; as mensagens do grupo são o resumo dele.

Fila na entrada: **79 incidentes abertos**, 10 em `aguardando_aluno`, 2 presos.

---

## 0. Por que quebrei a ordem da pauta herdada

O log de 01h listava, para esta ronda, `c726c5ae` (19 pagantes) em 1º e
**Rodrigo em 3º**. Inverti, e o motivo é um relógio: o `garantia_na_fila.cjs`
mostrou **`#306` com "RESTAM 13.3h"**. A janela do Rodrigo fecha **hoje,
12/09 21h BRT**. Os 19 do `c726c5ae` esperam há 95 dias e não pioram em um dia;
o direito do Rodrigo morre nesta ronda ou na próxima. Regra 8 prevê a exceção
para dinheiro sendo perdido agora. Peguei os dois, nesta ordem.

---

## 1. Rodrigo Lima — `#363` / `94843173` (peguei até onde vai sem o Johnny)

`rodrigo.limas.1978@gmail.com` · (21) 98878-5558

### A medição

| verificação | resultado |
|---|---|
| `aluno.cjs` | **nenhuma conta**, nem no e-mail nem em variações. Zero perfil, zero entitlement |
| `pagou_de_verdade.cjs` + `sales/history` (Hotmart viva, 4 itens) | **PAGOU** |
| soma das compras pagas | 356,90 + 741,00 + 97,00 = **R$ 1.194,90** |

As quatro transações, da fonte viva:

| transação | produto | valor | status | data |
|---|---|---|---|---|
| HP1502648524 | Fábrica de Conteúdo Invisível | R$ 356,90 | COMPLETE | 30/08 14:58Z |
| HP2729612767 | Sistema de Geração Pronto | R$ 741,00 | COMPLETE | 30/08 15:02Z |
| HP3588772385 | FastCloner (trial) | R$ 0 | COMPLETE | 30/08 15:47Z |
| HP2955203673 | FastCloner (mensalidade) | R$ 97,00 | APPROVED | 06/09 14:11Z |

**A soma bate exatamente com o valor que ele pediu.** Ele não chutou número.

**As duas avulsas de 30/08 não existem em `payment_events` nem em
`entitlements`** — só a Hotmart viva as enxerga. É a mesma classe da Simone
(`#86de22c6`, R$ 975,40) e da Teresa (`#356`). **Agora são três pessoas**
pedindo dinheiro de volta de compra que o nosso banco não sabe que existe.
Deixou de ser caso isolado em 11/09 e virou padrão em 12/09.

### A divergência de garantia, medida (importa para a próxima ronda)

Duas fontes da própria Hotmart discordam sobre a mesma cobrança:

- `subscriptions/UKC2COC2/purchases` (API viva) → **`under_warranty: false`**
  nas duas cobranças;
- `payment_events`, `payload.data.product.warranty_date`, carimbado pelo
  webhook **dela mesma** → **`2026-09-13T00:00:00Z`**.

A assinatura está `CANCELLED_BY_SELLER` desde 07/09, o que explica o flag.
**Vale a data do webhook**, por dois motivos: é o campo que a produção lê
(`janelaGarantia`, `garantia.ts`, `payload.data.product.warranty_date`) e é
**a data que nós prometemos ao aluno por escrito**. Registro a divergência
porque um instrumento que anuncia "restam 13h" enquanto a outra ponta diz
"fora da garantia" é exatamente o tipo de coisa que decide dinheiro errado —
não mudei nada no `garantia_na_fila.cjs`, só medi.

### O atendimento, e por que isso é grave

| quando (BRT) | o quê |
|---|---|
| 11/09 21:46 | **nós** escrevemos oferecendo devolver os R$ 97 e **fixamos o prazo**: "responda ainda hoje ou amanhã cedo" (uid 1935) |
| 11/09 22:37 | ele responde **"Quero reembolso"** (uid 586) |
| 11/09 22:40 | "vou encaminhar agora mesmo" (uid 1944) |
| 11/09 23:26 | **nós** abrimos a perna maior e oferecemos: "Devolução também dessas compras — me diga e eu encaminho junto, **sem discussão**" (uid 1946) |
| 11/09 23:45 | ele responde **"Devolução total por favor!"** (uid 587) |
| 11/09 23:50 | "a equipe vai entrar em contato **em breve**" (uid 1947) |
| 12/09 08:00 | **8 horas depois: nenhum centavo se moveu** |

**Fomos nós que marcamos a data. Ele cumpriu, duas vezes, dentro do prazo.**
E o prazo que nós mesmos demos vence hoje às 21h. É o pior desenho possível:
a casa define o relógio, o aluno obedece, e a casa perde o próprio prazo.

A promessa de 23:50 é a **5ª** desta casa nesse padrão — a Simone teve 4 antes
de alguém medir. Por isso o meu e-mail não repete a fórmula.

### O que eu fiz

1. **Anotei a medição inteira no `#363`** (`agent_notes` 4 → 5, 1 linha
   afetada, conferido na releitura).
2. **Escrevi para o aluno** — regra 8, e-mail individual de caso que estou
   tratando é decisão minha. **Enviados uid 1955, cópia CONFIRMADA na 1ª
   tentativa.** O e-mail: confirma que o pedido está registrado **com a data
   em que ele mandou** (11/09 23h45) e que a demora nossa não será cobrada
   dele; diz com todas as letras que **eu não sou quem executa a devolução** e
   que **não vou dar prazo que não é meu**; repete os três valores conferidos;
   assume que ele pagou R$ 1.194,90 e não recebeu nada; dá o canal direto de
   quem executa. **Nenhuma data de estorno foi prometida.**
3. **Escalei ao grupo às 10:49Z, marcado como urgente**, com o prazo de hoje.
4. Anotei o envio no incidente (`agent_notes` 5 → 6, conferido).

### Onde travou

No **estorno na Hotmart**, que exige acesso e decisão do Johnny. **Não existe
mais nada que eu consiga executar neste caso.** Segue `investigating` — não
marquei `fixed` porque **nada foi resolvido**.

---

## 2. Os 19 pagantes — `#312` / `c726c5ae`

Segundo item, e o que mais gente sofre. Aberto em **09/06** (95 dias),
`occurrences=19`, e estava em **`aguardando_aluno` com `resolution_note`
vazia**.

### Passo 1 — já resolveu sozinho? **Não.**

Cruzei os 19 e-mails contra `profiles`, `sgp_pedidos` e `entitlements`:

> **19 de 19 com zero conta, zero pedido no SGP e `last_seen_at` nulo.**

Nada se resolveu em 95 dias. **4 têm `entitlements.status = active` agora** e
mesmo assim nenhuma conta: `fabiosaadi`, `igorfigaro`, `leraqorganicos`,
`pablomikael67`.

### Passo 2 — pagaram mesmo? **Sim, os 19.**

Rodei `pagou_de_verdade.cjs` **um a um nos 19**, de propósito: a armadilha
medida no `#339` é trial de R$ 0 se passando por compra paga, e lá **10 de 16
alertas eram de quem nunca pagou um centavo**. Aqui **não é o caso** — os 19
voltaram `PAGOU`.

Avulsas pagas, medidas: `igorfigaro` 951,12 · `leraqorganicos` 794,00 ·
`fabiosaadi` 913,80 · `jgmlusvarghi` 894,00 · `brunodamasceno` 794,00 ·
`mariannamagri` 2.797,05 · `carolineacaldeira` 849,45 · `jeffersonjalles`
2.857,92 · `karina.borges` 849,45 → **R$ 11.700,79**. Mais `orthobor`
1.098.706 PYG, `ak@aknetzwork` 181,95 EUR, `alexandre_vita` 176,70 USD. Mais
a perna de assinatura (`PURCHASE_APPROVED > 0` nos 19).

### O rótulo era falso, e é o achado que interessa

`aguardando_aluno` quer dizer "a bola está com o aluno". **Não havia aluno
nenhum a esperar**: nenhuma destas 19 pessoas foi jamais contatada — a causa
do próprio título é que o varredor nunca as alcançou. O rótulo tirava o caso
do filtro de abertos e ninguém dava segunda tentativa. **Passei para
`investigating`** (conferido: `aguardando_aluno → investigating`,
`agent_notes` 9 → 10, 1 linha afetada).

É a terceira vez que esse estado aparece como arquivo morto (o log de 01h já
tinha registrado o padrão). Não é acidente; é o estado em que ninguém olha.

### Cruzamento que fecha o argumento

`victor.inscriptio@gmail.com`, desta lista, **já escalou sozinho** e aparece
nos `#309`/`#350` tendo **perdido a janela de garantia esperando na nossa
fila**. Sem contato nosso, essas pessoas chegam por conta própria, já
irritadas e já fora do prazo. É a mesma classe do Rodrigo.

### Onde travou

Falar com 19 pessoas é **envio em massa**, e pela regra 8 isso precisa do
"pode" do Johnny. **Pedido levado ao grupo nesta ronda.** Segue
`investigating` até a resposta.

Registro o que o conserto de código **não** resolve: `orphan-outreach.ts:27,142`
filtra `product_id` fixo `7851642` e descarta o comprador do SGP (`7283229`)
antes de qualquer regra. Corrigir isso **impede vítima nova e não entrega nada
a estes 19**. Os dois caminhos são necessários e são separados.

---

## 3. O que precisa do Johnny (em ordem de relógio)

1. 🔴 **Rodrigo — R$ 1.194,90, vence HOJE 21h BRT.** Autorizar o estorno
   total. Nós oferecemos "sem discussão" por escrito e ele aceitou dentro do
   prazo que nós demos.
2. 🔴 **Os 19 do `#312` — autorizar o contato em massa.** É a maior
   concentração de gente que pagou e não recebeu nada, e o mais antigo está
   assim há 95 dias.
3. **A classe "compra que só a Hotmart viva enxerga"** — Simone (R$ 975,40),
   Teresa (`#356`) e agora Rodrigo (R$ 1.097,90 das avulsas). Três pessoas,
   mesmo desenho: o dinheiro caiu numa conta que a nossa API não lê. Isso
   precisa de decisão de processo, não de mais uma medição minha.
4. Segue valendo a seção 3 do relatório de 11/09 (Teresa, Victor, Leandro,
   `#313`) e a seção 3 do log de 01h (Simone).

---

## 4. O que a próxima ronda pega, em ordem

1. **Se o Johnny autorizou**: escrever para os 19 do `#312`. Já está medido,
   é só executar.
2. **Priscyla (`2245e0b0`)** e **Igor Ramalho (`52b22304`)** — fechados/parados
   com não-resposta enquanto o aluno espera (herdado de 01h, não peguei).
3. **`#364`** — SGP sem estado terminal na perna da foto: comprador parado
   16,6h em silêncio, aberto pelo vigia às 10hZ de hoje.
4. **Hellen (`#362`)** — pagante de 05/09 (GBP 47,94 + R$ 597,00), perdeu 5 de
   7 arquivos no envio, 95.375 créditos, nenhuma voz, **zero chamado e zero
   linha nossa**, e não voltou ao app desde 06/09. Aparece nos presos da
   varredura e ninguém falou com ela.
5. Os 3 patches do Vigia, começando pelo `7578c587`.
6. Os antigos que não andam: `#15`, `#47`, `#99`.

---

## 5. Achados que ficam registrados

- **`under_warranty` da API viva e `warranty_date` do webhook discordam** na
  mesma cobrança quando a assinatura está `CANCELLED_BY_SELLER`. Produção lê o
  webhook. Não toquei na ferramenta; fica medido para quem for mexer em
  garantia.
- **`aguardando_aluno` como arquivo morto: terceira ocorrência.** Duas nesta
  ronda e no log de 01h. A triagem que pega é pela `resolution_note` e pelo
  **fato** de alguém ter falado com o aluno, nunca pelo `status`.
- **A casa marca prazo para o aluno e perde o próprio prazo.** No caso do
  Rodrigo nós definimos a data, ele cumpriu duas vezes, e às 8h de hoje nada
  tinha se movido. Não é falta de informação: é falta de quem aperte o botão.

---

## 6. Higiene do repositório (inalterada, vigésima segunda ronda)

Seguem modificados e não commitados, em `frontend/**/sgp*` e
`frontend/messages/*`, mais não rastreados em `_frank/rascunhos/`. **Não são
meus e não toquei.** Meus arquivos de trabalho ficaram em `/tmp`, fora do git.
Este log foi commitado de uma **worktree limpa** tirada de `origin/main`, pelo
mesmo motivo do quase-acidente de 08/09.

Nenhum código foi alterado nesta ronda — só medição, anotação de incidente e
um e-mail a aluno. Não há branch de feature para conferir.
