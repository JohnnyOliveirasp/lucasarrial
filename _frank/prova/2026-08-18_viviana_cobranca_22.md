# Viviana Cotua — a cobrança de US$ 22 e por que ela aconteceu

Frank, 18/08/2026. Assinatura `KHU9LRZT` · `tecnologylegacy@gmail.com` · Visa final 4989.
Todos os horários em **UTC** (ela escreve de um fuso −05:00).

## Resposta curta

Ela entrou num **trial de 7 dias do Plano Founder**. O trial venceu e a Hotmart
cobrou a primeira mensalidade **automaticamente**. Ninguém "decidiu" cobrar —
é o comportamento normal de um trial que ninguém cancela.

O problema não é a cobrança ter existido. É que **ela pediu para cancelar 36
minutos antes de a cobrança sair, disse que não conseguia cancelar sozinha, e
nós não cancelamos.**

## Linha do tempo, com fonte

| Quando (UTC) | O quê | Fonte |
|---|---|---|
| 11/08 01:47 | Adere ao Plano Founder em **trial**, `price.value = 0` | `GET /subscriptions?subscriber_code=KHU9LRZT` |
| 16/08 | Abre um chamado: não consegue gerar vídeo | citado por ela na msg 141 |
| 18/08 01:09 | "não posso gerar o vídeo… vão passar os dias de prova e não me contestam, então **terei que cancelar** minha prova" | INBOX msg 141 |
| 18/08 02:17→02:50 | 5 idas e vindas com a Fast. Respostas genéricas repetindo o que ela já tinha tentado. Nenhuma cancela nada | msgs 142–147 |
| **18/08 13:49** | **"decidi cancelar minha assinatura, pode me dizer até que dia é free? Preciso cancelar antes de o período de prova acabar. Não tenho acesso dentro da Hotmart à página de vocês"** | INBOX msg 155 |
| **18/08 14:25** | **Cobrança de US$ 22 APROVADA**, rec#2, transação `HP3851239009` | `GET /subscriptions/KHU9LRZT/purchases` |
| 18/08 14:28 | Fast responde pedindo desculpas — **3 minutos depois da cobrança** — e não cancela nem escala | msg 156 (citação) |
| 18/08 15:53 | "acabam de fazer o meu cobro da mensalidade… ou vou ter que disputar a transação no meu cartão" | INBOX msg 156 |
| 18/08 16:26 | Eu cancelo a assinatura → `CANCELLED_BY_SELLER`. **Duas horas tarde demais** | `end_accession_date` |
| 18/08 ~16:55 | Estorno pedido: `PUT /sales/HP3851239009/refund` → **HTTP 200**. Status da compra vai de `APPROVED` para `PROTESTED` (= "Reclamada", reembolso solicitado, cai em até 7 dias) | `_Bugs/hot_estorno.cjs` |

## As três falhas, em ordem de gravidade

1. **O produto não funcionou.** Ela nunca gerou um único vídeo. O botão Gerar não
   respondia. Pagou US$ 22 por sete dias de nada.
2. **O pedido de cancelamento não virou ação.** Chegou por e-mail 36 minutos antes
   da cobrança, com a frase explícita "preciso cancelar antes de o período de prova
   acabar". A Fast respondeu, pediu desculpas, e **não cancelou**. Um pedido de
   cancelamento dentro do trial precisa cancelar a assinatura na hora, não gerar
   uma resposta simpática.
3. **Ela não conseguia cancelar sozinha** — "não tenho acesso dentro da Hotmart à
   página de vocês". Então o único caminho que restava era o nosso, e o nosso falhou.

## O meu erro

Eu escrevi para ela, por e-mail, que **nenhuma cobrança havia sido feita**. Era falso.

Como eu cheguei nisso:

- `GET /sales/history` com janela de 3 dias devolveu **zero** para ela, e eu li esse
  zero como "não foi cobrada". O mesmo endpoint, consultado por transação, devolve
  `total_results: 0` até para esta assinatura que comprovadamente tem duas compras.
  **Ele não serve para essa pergunta.**
- `GET /subscriptions` mostra `price.value = 0` — que é o preço do **trial**, não o
  da recorrência. Confirmou o que eu já queria acreditar.
- O endpoint certo, `GET /subscriptions/{code}/purchases`, devolve um **array puro**.
  Meu parser procurou `.items`, não achou, e imprimiu "(vazio)". Quarto vazio mal
  formado do dia lido como resposta.

O erro de fundo não é técnico. **A cliente afirmou um fato sobre o próprio cartão e
eu escolhi acreditar na minha consulta em vez dela.** A ordem certa é a inversa:
quando o cliente afirma e meu dado não confirma, a hipótese padrão é que meu dado
está incompleto.

## O que ficou de pé

- Estorno pedido e registrado (`PROTESTED`), até 7 dias para cair no cartão.
- Assinatura cancelada, sem cobrança futura.
- E-mail de correção enviado, admitindo o erro e dizendo que ela não precisa abrir
  disputa.

## O que ainda não está resolvido

- **Pedido de cancelamento por e-mail não cancela nada.** Hoje depende de um humano
  ler e agir. Enquanto for assim, isso se repete com o próximo aluno em trial.
- **O botão Gerar dela nunca funcionou** e a causa não foi fechada — só contornada
  pelo cancelamento.
- `_Bugs/hot_estorno.cjs` nasceu com modo seco, mas `enviar_email` continua sem
  ensaio obrigatório (ver `2026-08-19_ultimos_5.md`, item 1).
