> **⛔ SUPERADA.** O recorte por status da Hotmart e a ordem "Hotmart → trava"
> morreram: o critério agora é **pagamento**. Vale
> `2026-08-18_regra_final_pagou_fica.md`.

# ORDEM — Trava do débito: decisão do Johnny (18/08, fim do dia)

Resposta aos seus três números. **Trabalho bom:** você foi ao campo
estruturado `subscription.status` em vez da busca por substring, e corrigiu o
seu próprio número (145, não 147). É o playbook M funcionando um dia depois de
escrito.

---

## 1. A decisão: caminho conservador

| Grupo | Pessoas | Crédito | O que fazer |
|---|---:|---:|---|
| `CANCELED` | 99 | 8.863.098 | **Trava + zeramento.** Pediram pra sair. |
| `PAST_DUE` | 3 | 229.392 | **Não toque.** Cartão falhou, renovam amanhã. |
| `ACTIVE` na Hotmart | 43 | 3.589.114 | **Não toque.** Ver item 3 — é o contrário. |

**O zeramento é só de `credits_subscription`.** O `credits_extra` (915.712)
**fica intocado.**

**Por que o extra fica de fora:** ali dentro tem coisa misturada — recarga que
a pessoa comprou à parte **e** bônus/estorno que a casa deu por falha nossa.
Zerar bônus é justo; zerar recarga comprada fora da assinatura é tirar produto
pago. E o custo de deixar de fora é baixo: o extra é **7%** dos 12,68 milhões.
O `credits_subscription` sozinho é 11,76M — é literalmente o crédito do plano,
morre com o plano, sem discussão.

Depois, se valer a pena, separe o extra por origem em `credit_transactions`
(compra avulsa × bônus × estorno) e traga o número. Aí o Johnny decide com
dado, não com estimativa.

## 2. ⚠️ Corrigindo a MINHA ordem de execução

Na ordem anterior eu mandei **travar o débito primeiro**. Com os seus números
na mão, isso está errado, e o erro é meu: a trava usa `hasActiveAccess`, que
olha só o `access_until` — ela barraria **os 43 e os 3 junto**, exatamente as
pessoas que não podem ser barradas.

**Ordem nova:**

1. **Bater na API da Hotmart pros 43** (item 3). É leitura, está autorizado,
   faça agora.
2. **Corrigir o `access_until`** de quem a Hotmart confirmar como pagante.
   Isso conserta a causa e some com o problema — eles saem da lista sozinhos.
3. **Só então ligar a trava** por `hasActiveAccess`, limpa, sem exceção.
4. Zeramento do `credits_subscription` dos `CANCELED`.
5. Detector no vigia noturno.

**Não crie lista de exceção no código.** Nada de "menos estes 43 ids" — isso
vira dívida que ninguém entende em duas semanas. Conserte o dado, e a regra
funciona sozinha.

**Sobre esperar:** o vazamento já dura 11 dias; mais algumas horas não mudam
nada. Bloquear quem está pagando é o único erro aqui que gera reclamação
justa, e ele é irreversível na confiança do aluno mesmo depois de desfeito.

## 3. Os 43 `ACTIVE` são o achado mais importante do seu relatório

Você encontrou isso investigando outra coisa e teve o cuidado de não tocar.
Se a Hotmart confirmar que estão pagando, **isso não é vazamento — é o
contrário: são 43 clientes pagando e sem acesso**, alguns há dias. É mais
grave que o vazamento inteiro, porque tem gente lesada do outro lado.

O que preciso saber de cada um dos 43:

- A Hotmart confirma assinatura ativa **agora** (não no payload guardado)?
- Qual a data da última cobrança aprovada?
- O `access_until` daqui é anterior a essa cobrança?

Se a resposta for "pagou e o acesso não mexeu": **é bug do webhook de
renovação, me avise na hora, não espere o relatório.** Aí o card vira outro —
descobrir por que a renovação não chega — e ele passa na frente de tudo.

⚠️ Cuidado ao ler: `raw_event` é uma **foto do momento da compra**. Ele pode
estar simplesmente velho, e foi você mesmo que levantou essa possibilidade.
Só a API viva responde. E se a API disser `ACTIVE` mas sem cobrança recente,
desconfie de novo — assinatura anual, cortesia e teste também aparecem
`ACTIVE`.

## 4. O que fazer com os que gastaram depois de vencer

**Nada.** Os 4.158.888 gastos já foram, o produto foi entregue, e não vamos
cobrar ninguém retroativamente — mesma decisão que o Johnny tomou no caso do
Stripe em modo de teste. A trava é pra frente.

Guarde o número no relatório: ele é a justificativa do trabalho, não uma
conta a receber.

## 5. Viviana

Bem resolvido, e você fez na ordem certa — respondeu antes da ordem chegar,
sem prometer prazo, com o saldo conferido e o clone dela localizado. Manter
`investigating` esperando a tela e o print é o certo.

## 6. Os 145 × 147

Você mesmo notou a diferença e disse que não investigou. **Investigue.** Se o
grupo encolheu porque 2 pessoas renovaram, ótimo — é o sistema funcionando. Se
encolheu por outro motivo, isso diz algo sobre a consulta, e você vai usar
essa mesma consulta pra decidir o zeramento de 99 pessoas. Uma lista que muda
de tamanho e você não sabe por quê não serve pra mexer em dinheiro.
