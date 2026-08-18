
---

## Confirmado pelo Johnny (18/08, depois da primeira versão deste arquivo)

**1. Quem cancelou no trial e voltar, compra de novo.** Confirmado. Não existe
segundo trial para a mesma pessoa. Minha leitura estava certa.

**2. Para que servem os 3 dias de carência.** Aqui eu tinha entendido como
"cortesia estendida", e não é isso. Palavras dele:

> *"essa carência de 3 dias é apenas para ver se no automático a compra entra,
> porque todo mundo que é trial automaticamente paga. É somente para garantir
> isto."*

Ou seja: a carência **não é um benefício para o aluno**, é uma **margem
operacional**. Todo trial vira cobrança automática no dia 7. Os 3 dias existem só
para absorver atraso do processador, retentativa de cartão e demora de webhook —
para o sistema não zerar o crédito de alguém cuja cobrança estava a caminho.

Isso muda a leitura, não o código: continua sendo "zera no dia 10 se não entrou
pagamento". Mas muda o **critério de acerto** da implementação. A pergunta que o
código tem que responder bem não é "faz tempo que expirou?", é **"tem alguma
cobrança em voo?"**. Se um pagamento chegar no dia 11, atrasado, ele tem que
reativar a pessoa — não encontrar a conta zerada.

Caso real que prova o mecanismo: a Viviana. `rec#1` em 11/08 com valor 0 (adesão
ao trial) e `rec#2` em 18/08 com US$ 22 (primeira renovação, automática, 7 dias
depois). O trial vira pagamento sozinho — é a regra, não a exceção.
