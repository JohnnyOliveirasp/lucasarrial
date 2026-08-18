# ORDEM — REGRA FINAL: quem pagou, fica com o crédito (18/08)

**Esta ordem SUBSTITUI o item 2 de `2026-08-18_ok_para_executar.md` e cancela
a tolerância de 3 dias que eu estava escrevendo.** Leia esta e ignore as
anteriores no ponto do zeramento.

---

## 1. A regra, dita pelo Johnny

> **O que decide é o PAGAMENTO, não o status da assinatura.**

| Situação | Acesso / crédito |
|---|---|
| Passou o trial de 7 dias e **a cobrança rodou** | é cliente — **continua tudo** |
| Pediu cancelamento **depois de já ter pago** | para a cobrança recorrente, **mas o crédito é dela** e ela usa até acabar |
| Cancelou **dentro do trial**, sem nunca pagar | **zera o crédito** — nunca entrou dinheiro |

O princípio: **crédito que foi pago é da pessoa.** Ela comprou, o dinheiro
entrou no caixa, e cancelar a renovação não apaga o que ela já comprou. O que
se zera é só crédito que **nunca foi pago** — o que a casa deu de graça no
trial.

## 2. O que isso derruba

- **A tolerância de 3 dias: cai.** Era pra cobrir a janela entre vencer e a
  cobrança aprovar. Não importa mais: se pagou, fica; se nunca pagou, sai.
  Webhook atrasado deixou de ser um problema de acesso.
- **A sincronização diária com a Hotmart: deixa de ser urgente.** Continua
  sendo boa ideia pro vigia (o cache mente), mas não é mais o que segura a
  regra de pé. Desce de prioridade.
- **A regra 9 do manual foi reescrita de novo** — ela dizia "cancelou = zera
  crédito", sem a distinção de pagamento.

## 3. O que muda no zeramento — refaça a conta

A lista de 99 `CANCELED` **não serve mais como está**. Ela foi montada por
status de assinatura, e o critério agora é pagamento.

Refaça, e a pergunta por pessoa é uma só:

> **Esta pessoa já teve algum pagamento aprovado, em qualquer momento?**

- **Sim** → sai da lista. Fica com o crédito, mesmo tendo cancelado.
- **Não** (só trial, valor 0.00, nunca cobrado) → entra na lista, zera.

Onde olhar: `credit_transactions` (crédito que entrou por compra),
`entitlements` e o `raw_event` da Hotmart. **Não confie num só** — cruze pelo
menos dois, e diga qual você usou como fonte. Se os dois discordarem em algum
caso, esse caso não entra na lista: traga separado.

⚠️ **Cuidado com o que parece pagamento e não é:** bônus, cortesia, campanha
e estorno de falha nossa entram como crédito mas **não são pagamento**. Quem
só tem esses nunca pagou. Separe por origem, não pelo saldo existir.

Me mande: quantas pessoas sobraram, quanto crédito somam, e as 5 maiores.
**Meu palpite é que a lista encolhe muito** — dos 99, boa parte deve ter
pagado pelo menos um mês antes de cancelar.

## 4. O que muda na trava do débito

A trava deixa de ser "não tem acesso ativo" e passa a ser:

> **nunca pagou e o trial acabou** → não gasta.

Quem pagou alguma vez continua gastando o crédito dele, com assinatura viva ou
não. Isso é mais simples de implementar e mais fácil de defender pro aluno.

Mantidos: `bypassesBilling` (Johnny, Lucas, Edu) e admins passam;
`add_extra_credits` (estorno, bônus, campanha) não entra na trava; a mensagem
diz a verdade e nunca "créditos insuficientes".

## 5. Pergunta que ficou aberta — traga com os números

Quem **pagou e cancelou** mantém o crédito. Mas as telas de **Roteiro** e
**Edição** são trancadas por assinatura ativa (`access_until`), não por
crédito. Então ela teria crédito no bolso e essas duas portas fechadas.

Faz sentido? Duas leituras, e a decisão é do Johnny:
- **Coerente** — ela comprou crédito de geração, não assinatura; gasta em voz,
  clone e imagem.
- **Incoerente** — o crédito é dela e deveria abrir tudo que crédito paga.

Não decida sozinho. Mande a pergunta binária junto com os números do item 3.

## 6. Ordem de execução

1. Refazer a lista pelo critério de **pagamento** (item 3).
2. Congelar essa lista nova (as três exigências de
   `2026-08-18_ok_para_executar.md` continuam valendo: artefato gravado,
   consulta com `ORDER BY` corrigido, saldo carimbado).
3. Aprovação do Johnny sobre a lista congelada.
4. Card do coder: trava do débito pelo critério novo.
5. Zeramento, com registro em `credit_transactions`.
6. Detector no vigia.

Continua devido: os três números de **trial × venda** das 756 assinaturas, e a
**prova de capacidade** dos 12 blocos.
