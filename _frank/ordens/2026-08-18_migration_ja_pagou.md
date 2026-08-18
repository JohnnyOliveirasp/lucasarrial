# ORDEM — Migration aprovada: marcar "já pagou" (18/08)

Resposta ao seu achado sobre o `payment_event` contaminado.

---

## 1. O achado é o mais importante do dia

**`payment_event` não prova pagamento** — o trial gratuito gera o mesmo
carimbo de +100.000 que uma venda. Se o card tivesse saído com aquele
predicado, a trava não pegaria **ninguém** do trial, que é o único grupo que
ela existe pra pegar. Você achou a armadilha sozinho, testando antes de
escrever, e ainda corrigiu a própria afirmação sobre os 4 trials quando o
`martinmendezagiluilar7` apareceu com 120.000 de Stripe.

O caso dele é o que fecha a questão: **está em trial pela Hotmart e pôs
dinheiro pelo Stripe.** Qualquer regra do tipo "está no trial → zera" apagaria
crédito de quem pagou. O critério é **pagamento**, e só ele.

## 2. Migration APROVADA pelo Johnny — é a 79

Caminho escolhido: **marcar de uma vez**, como você recomendou.

- **É a migration `79`** (`scripts/79_*.sql`) — a última é
  `78_react_legenda.sql`. Confira antes de nomear; se o vigia já tiver pegado
  a 79, use a próxima livre e diga qual.
- **Coluna nova em `profiles`**, nada de `ALTER` destrutivo, nada de `DROP`,
  nada que toque em dado existente. Se der errado, remove a coluna e acabou.
- Guarde mais do que um booleano: **quando** foi constatado e **por qual
  origem** (`stripe_session` / `payment_event` não-trial). Um `true` pelado
  não se audita depois — e você vai zerar crédito com base nele.
- **Backfill separado do schema.** Primeiro a coluna, depois o preenchimento
  cruzando com as 756 assinaturas. Dois passos, dois commits, cada um
  reversível sozinho.
- Traga o **DDL exato** antes de aplicar. O Johnny aprovou o caminho, não um
  texto que ele não leu.

## 3. ⚠️ Exigência que vem junto: não deixe o campo envelhecer

Marcar de uma vez resolve **hoje**. Sem a segunda metade, em um mês o campo
está desatualizado e o problema volta igual.

**O webhook precisa passar a gravar a distinção na hora.** Quando chegar um
evento de pagamento da Hotmart, o payload já diz se é trial — grave isso no
momento em que a informação existe, em vez de precisar cruzar com a API
depois. É a diferença entre consertar e remendar.

Se o payload do webhook **não** trouxer o `trial`, me diga: aí a regra é
outra e vamos ter que pensar junto. **Não invente um jeito de adivinhar.**

## 4. O que a trava lê

Só o campo. Nada de chamar a Hotmart no caminho do débito — você estava certo:
seria lento, e se a Hotmart cair ninguém gera nada.

Mantidos: `bypassesBilling` (Johnny, Lucas, Edu) e admins passam;
`add_extra_credits` (estorno, bônus, campanha) fora da trava; mensagem
verdadeira pro aluno, nunca "créditos insuficientes".

## 5. As origens que você levantou — congele isso por escrito

Sua tabela de origens vale mais que esta ordem, porque a próxima pessoa que
mexer em crédito vai precisar dela. **Coloque no `04_PLAYBOOKS.md`** como
playbook novo: quais `ref_type` são dinheiro entrando e quais não são, com o
aviso de que `payment_event` mistura trial e venda.

Hoje: só `extra_purchase | stripe_session` é dinheiro limpo;
`subscription_grant | payment_event` é contaminado; estorno, bônus, cortesia,
campanha, winback, `stock_seed`, `admin_grant` e compensação **não são
pagamento**.

## 6. Sobre o "trial pelo valor"

Você disse que não testou e não ia afirmar sem olhar — certo. **Não gaste
tempo nisso:** mesmo que os valores diferissem hoje, seria coincidência de
configuração, e uma campanha de 100.000 amanhã quebraria a regra em silêncio.
Descarte essa via.

## 7. Fila

Você já está no caminho certo: siga corrigindo o `ORDER BY` e montando a lista
congelada, que é leitura e não depende disso. Quando o DDL estiver pronto,
manda que eu confiro.

Continua devido: os três números de **trial × venda** das 756, e a **prova de
capacidade** (crons, RunPod, e as três perguntas do fim).
