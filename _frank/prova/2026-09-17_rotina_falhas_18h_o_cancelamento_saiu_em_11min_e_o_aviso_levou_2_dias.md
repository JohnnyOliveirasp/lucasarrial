# Ronda das falhas — 17/09 ~18hZ

> ## ⛔ RETRATADO 25 MINUTOS DEPOIS — NÃO LEIA ESTE ARQUIVO SOZINHO
>
> **A segunda metade do título deste arquivo é FALSA.** O aviso NÃO levou 2
> dias: saiu em **20 segundos** (`uid 2416`, 15/09 12:02:24Z), e teve um
> segundo aviso em 16/09 (`uid 2494`). Eu concluí "ninguém avisou" a partir de
> `emails_enviados`, que **não registra envio feito pelo `enviar_email.cjs`** —
> provado pelo meu próprio e-mail, que também não aparece lá.
>
> **Cai junto:** o número "63 de 64" (item 6) e o "achado" do item 5(a), que já
> estava medido, comunicado e `fixed` no chamado `1e133bcd` desde 16/09 01:52.
>
> **Continua de pé:** o fecho `fixed`, o cancelamento pedido pelo titular e
> executado em 11 min, e o dinheiro conferido (nada devido).
>
> Correção completa em
> `2026-09-17_rotina_falhas_18h30_eu_errei_a_nota_que_acabei_de_publicar.md`.

**Fechado:** `6c38c99d` (Luciano de Pinho). **Aluno avisado, dinheiro conferido,
sem commit — porque não havia código quebrado.**

---

## O que eu peguei, e por que não foi o mais velho da fila

A regra §8 manda pegar **o mais antigo com aluno afetado**. O mais antigo é o
`d3d8d1b2` (#15, executionTimeout, 30/07, 18 alunos). **Não peguei, e digo o
motivo em vez de omitir:** ele está em espera estrutural, não em trabalho.

- Conferido hoje: **991 gerações desde 04/09 20:47Z com ZERO executionTimeout**
  (12,9 dias). Consulta com o `error` checado, não zero cego.
- O critério de fecho dele, escrito na nota de 10/09, é (a) a próxima ocorrência
  ou (b) 30 dias limpos a partir de 10/09. Hoje é o **dia 7 de 30**.
- Dinheiro dele: 19/19 estornados, conferido em rondas anteriores por `ref_id`.
- A nota de 16/09 já registrou o estado com precisão, **ontem**. Regra 27: nota
  redundante é ruído. Não escrevi a 70ª nota pra dizer o que a 69ª já diz.

§8 item 4 é explícito: **"Esperar resposta não é estar travado."** O #15 espera
um evento. O `6c38c99d` era o mais velho com aluno afetado **acionável**.

---

## A premissa do cartão caiu por 7 minutos

A nota de **15/09 11:55Z** trata o cartão como urgente por causa de um prazo:
*"rec#3 de R$97 cai 19/09 12:00Z, assinatura ACTIVE"*.

Medido hoje na Hotmart viva: `LGKZLCLN` está **CANCELLED_BY_SELLER**, e o
entitlement virou `canceled` em **15/09 12:02:03Z** — **sete minutos depois
daquela nota ser escrita**.

A nota não estava errada quando saiu. Ficou obsoleta em 7 minutos e ninguém
voltou nela por 2 dias. **Não existe cobrança em 19/09.**

---

## O que realmente aconteceu (lido na caixa, não inferido)

| quando (BRT) | o quê |
|---|---|
| 15/09 08:51 | uid 626 — o aluno: *"Quero cancelar tudo. Obrigado pelo esforço, mas nada deu certo."* |
| 15/09 08:55 | nosso — *"Pode deixar que eu já peço pro time cancelar... **assim que o cancelamento estiver confirmado, a equipe te avisa aqui**."* |
| 15/09 08:58 | uid 628 — o aluno: *"Isso mesmo. Obrigado."* |
| 15/09 09:02 | cancelamento executado |
| 15/09→17/09 | **silêncio** |

O cancelamento foi **pedido pelo titular** (regra 9-C) e executado
corretamente em **11 minutos**. O que falhou não foi o cancelamento — foi a
**promessa de avisar**, por escrito, que ficou 2 dias sem dono.

---

## O que eu fiz

E-mail individual pelo SMTP do `suporte@` (regra 8, decido sozinho), bcc
`suporte@`, ensaiado em `--dry-run` e lido inteiro antes de sair.
**Cópia confirmada nos enviados, uid 2665.**

- Endereço conferido contra `profiles`: match **único**. Há 4 outros
  `luciano%` no banco, nenhum homônimo deste (armadilha do Claudio Sitya).
- Corpo em UTF-8 limpo, sem entidade HTML — o e-mail de 05/09 saiu com
  `&atilde;` na cara dele.
- Assumi o atraso como falha nossa. Regra 12: dizer o que aconteceu de verdade.

---

## Dinheiro: nada devido, e conferi em vez de supor

- Os **630 cr** do clipe `8a87c68c` seguem estornados (`+630`,
  `ref_type=video_clone_refund`, 29/08 01:55, casa com o `-630` de 28/08
  23:51 = 0). **Não estornei de novo** — seria pagar em dobro.
- Os **3.885 cr** do clone de 37s continuam não estornados **de propósito**:
  geração entregue com sucesso, dentro de limite declarado do produto.
  Estorno ali é cortesia comercial → decisão do Johnny, não minha.
- **Pagante de verdade: R$ 991** (R$297 Fábrica + R$597 SGP avulsas 18/08 +
  R$97 rec#2 COMPLETE 26/08). Saldo **166.035** intacto.

---

## Duas hipóteses MINHAS refutadas antes de virarem nota

Declaro em vez de omitir — as duas eram acusações prontas que não sobreviveram
ao controle.

**(a) "Ele perde os 166k créditos quando o acesso vencer em 19/09."** FALSO.
O único bloqueio duro por assinatura em todo o app é
`credits/checkout/route.ts:54` (comprar pacote avulso). `app/layout.tsx:53` é
explícito: *"Entrada LIVRE... o paywall não bloqueia mais o acesso"*. Nas rotas
de geração o `hasActiveAccess` só é consultado **dentro do ramo de saldo
insuficiente**, pra escolher o CTA — e `billed = !bypassesBilling(email)`, que
não olha assinatura. Ele entra e gasta o saldo normalmente depois de 19/09.

**(b) "A varredura de trial vai zerar o `credits_subscription` dele."** FALSO.
`expire_trial_credits` está **desativada no corpo da própria função** desde
18/08 — li o `pg_get_functiondef`, não o `.ts`. Ele **casaria** com o critério
ingênuo (rec#1 = R$0 + Hotmart marcando `trial: true`) apesar de ter pago o
rec#2: era exatamente o perfil das 14 vítimas de 18/08. A função estar
desligada é o que o protege hoje.

**Só afirmei ao aluno que o crédito fica depois de conferir as duas coisas.**
Prometer saldo a um cliente e estar errado seria o pior erro possível aqui.

---

## Um número que eu medi e NÃO vou usar como acusação

**64 entitlements viraram `canceled` desde 14/09; em 63 não houve nenhum e-mail
nosso depois.**

Não afirmo que 63 alunos ficaram sem aviso. A maioria cancela sozinho no painel
da Hotmart, que manda a confirmação **dela**, e `emails_enviados` só começa em
14/09. O denominador certo é *"quem recebeu de NÓS uma promessa de aviso"*, e
disso eu provei **um** caso: este.

Registro o número porque ele **pode** esconder um padrão, não porque prova um.
Quem for atrás: o teste é cruzar cancelamento com **conversa aberta na caixa**,
não com a tabela de enviados. Este cartão já tem histórico de denominador
inflado — não vou repetir de propósito o erro que o #15 cometeu três vezes.

---

## Por que `fixed`, e o que NÃO foi resolvido

`fixed` porque não há mais nada nosso pendente **neste caso**: o pedido dele foi
executado, o dinheiro está certo, e o aviso que faltava saiu.

**Não estou carimbando cura no motor.** A queixa de origem (Vídeo Clone sai
artificial) continua de pé e é limite conhecido do nosso clone próprio — não
defeito deste cartão. Sem commit porque **não havia código quebrado**: o
pipeline de cancelamento respeita a regra 9 (mantém acesso até o fim do período
pago) e funcionou.

### Fica para o Johnny (produto, 14-C — não abri chamado)

O blurb de `frontend/src/lib/video-clone/config.ts:45` promete que o rosto se
afasta *"em áudios longos (acima de ~40s)"*. A medição de **29/08, neste mesmo
aluno**, viu degradação num clipe de **6 SEGUNDOS**.

Enquanto a cópia disser 40s, o atendimento vai continuar culpando a foto do
aluno — foi **exatamente** o que aconteceu com ele **duas vezes**, e é a razão
de ele ter passado 3 semanas achando que o problema era a foto dele. Está
parado desde 29/08 (19 dias).

---

## Limites desta ronda

- Não gastei GPU, não toquei em crédito, acesso, voz nem migration.
- As únicas escritas foram: **o e-mail** (uid 2665) e **a nota do incidente**.
- Não li a caixa em paralelo com a Fast: `ler_caixa.cjs` usa `EXAMINE` +
  `BODY.PEEK`, não marca `\Seen` e não mexe na fila de não-lidos dela.
- **Fila continua com 88 abertos** (83 investigating + 6 open, menos este).
  Fechei um. Não vou chamar isso de tendência.
