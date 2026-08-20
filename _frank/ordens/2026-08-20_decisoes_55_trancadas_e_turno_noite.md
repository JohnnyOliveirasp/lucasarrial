# ORDEM — As 55 trancadas e o turno da noite (20/08, decisões do Johnny)

Duas decisões dadas pelo Johnny depois do card `3e259b71` fechar. Ambas
**autorizadas**, com guarda.

---

## 1. As 8 que pagaram MANTÊM crédito e acesso

**A medição** (card `3e259b71`, `pagante_trancado.cjs` + variante leitura-pura):

| | |
|---|---|
| trancadas hoje | **55** (não 47 — o 47 era o subgrupo "nunca pagou") |
| já tiveram pagamento aprovado | **8** |
| nunca pagaram além do trial R$0 | **47** |
| sem prova | **0** — `/purchases` veio completo pras 55 |

As 8 têm todas o mesmo padrão: trial R$0 → rec#2 R$97 **COMPLETE** → rec#3
OVERDUE.

**A decisão:** elas **mantêm crédito e acesso**. O Johnny escolheu a letra da
ordem vigente `2026-08-18_regra_final_pagou_fica.md`:

> *"Passou o trial e a cobrança rodou → é cliente, continua tudo."*
> *"Pediu cancelamento depois de já ter pago → para a recorrência, mas o
> crédito é dela e ela usa até acabar."*

Logo: **quem estiver trancada agora está trancada indevidamente** — inclusive a
dinicleia. Isso valida o **PR #17**.

⚠️ **Ressalva metodológica que muda o significado do "0 pagante trancado":** a
`pagante_trancado.cjs` só consulta `/purchases` de assinatura **ACTIVE** — para
inadimplente ela para antes. Então o "0" dela responde *"0 ACTIVE trancado"*,
não *"0 pagante trancado"*. Pela decisão do Johnny, **quem pagou uma vez conta,
ACTIVE ou não.** Use a variante leitura-pura para o alvo, não a oficial.

**Guarda (mexe em acesso de aluno):**

1. **Antes de destravar**, postar no grupo a **lista das 8** — e-mail, data do
   rec#2 COMPLETE, saldo atual. Fica registrado aqui antes de qualquer ação.
2. Destravar **e avisar** as 8: estão trancadas sem motivo e não sabem.
3. **O alvo do zeramento continua sendo só o grupo dos 47** que nunca pagaram —
   e esse **precisa de ok separado do Johnny**. Não mexer neles.

## 2. Rotina das Falhas passa a rodar 24 horas — hoje

**Autorizado.** O diagnóstico do Frank foi o que fechou a pergunta do Johnny
(*"quem vai ver isto? deveria ser automático"*):

> **Das 23h às 8h40 não tem ninguém.** O sensor abre chamado a noite toda e o
> dono da fila só acorda 8h40.

Não era falta de automação — era **automação com o turno da noite vago**. É uma
linha de cron.

Os outros dois ficam **depois** deste, na ordem que o próprio Frank propôs:
watchdog do agendador, e religar o **CHECK PROATIVO** que está pausado.

## 3. Continua sem o sim do Johnny (na ordem de risco)

1. **Ferramentas de memória que apagam sem confirmar** (`forget-cli`,
   `learn-cli`) — destrutivas, sem mostrar o alvo, já morderam duas vezes num
   dia (apagaram a memória #781; gravaram `--help` como regra permanente).
   Levado como **item 1**, a pedido do próprio Frank.
2. Cards do `/autorizar` e do silêncio dele no grupo.
3. Commitar o arquivo dele em `_frank/mensagens/`.

## 4. Divisão de trabalho combinada

- **Migration do `qa.coverage_espalhada`: escreve o Claude.** Motivo do Frank,
  e é bom: o coder dele está com **12 PRs abertos** neste repo, dois (#17 e #18)
  em entitlements e migration 85. Migration nova em cima disso é colisão
  anunciada. O Frank revisa.
- **`runpod-worker/` é do Claude** até ele avisar no grupo.
- Pergunta em aberto: dos 12 PRs, quantos **mergeáveis**, quantos **presos
  esperando decisão**, quantos **stale**? Se o Frank cair na semana da viagem,
  alguém herda a pilha.
