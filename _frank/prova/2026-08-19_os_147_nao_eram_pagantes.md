# 19/08 — Os 147 não eram pagantes trancados

**Conclusão:** o número que estava marcado como "o problema mais grave aberto"
media a coisa errada. Conferido na Hotmart, **um por um**, os 68 de hoje se
explicam inteiros e **nenhum deles é pagante trancado**.

Não é que o problema encolheu de 147 pra 68 e depois pra 0. É que ele **nunca
teve o tamanho que o número dizia**.

## O que eu fiz

1. `varredura_travados.cjs` → 0 travados, 4 incidentes abertos.
   Reconferido com `_Bugs/2026-08-19_confere_zeros.cjs`, que imprime o `error`
   de **cada** consulta e a contagem crua por tabela: **0 consulta falhou**.
   O zero de hoje é zero de verdade.
2. `prova_raio.cjs` → **68** (era 147 em 18/08).
3. Como a queda foi grande demais pra ser real, abri a composição dos 68 e
   depois perguntei **pra Hotmart**, assinante por assinante, quem ainda paga.

## O veredito, com a fonte certa

| Situação na Hotmart, hoje | Quantos | Trancar está certo? |
|---|---|---|
| Cancelaram (`CANCELLED_BY_SELLER`/`_BY_CUSTOMER`) | 22 | ✅ sim — ordem do Johnny 13/08 |
| Inadimplentes (`DELAYED`) | 25 | ✅ sim — não pagaram |
| Trial que nunca virou pagamento | 1 | ✅ sim |
| Na fronteira das 12:00 de hoje | 20 | ⏳ nem travado nem liberado ainda |
| **Pagou de verdade e está sem acesso** | **0** | — |

## Por que o número mentia (três motivos)

1. **`entitlements.status = 'active'` é o status da LINHA, não da assinatura.**
   Ninguém volta lá pra escrever `cancelled` quando a pessoa sai. 22 dos 68
   tinham cancelado na Hotmart e continuavam `active` no nosso banco.
2. **`raw_event` é uma FOTO do último webhook.** "ACTIVE" ali é o status
   naquele dia, não hoje. O Martin (`martinmendezagiluilar7@`) tinha
   `subscription.status = ACTIVE` guardado — na Hotmart, a cobrança #2 de
   R$ 97 está `WAITING_PAYMENT`. Ele é trial que nunca pagou.
3. **O grosso do número é a virada das 12:00 UTC.** `access_until` é gravado
   com a data da **próxima cobrança**. Todo dia ao meio-dia um lote inteiro
   "vence" no mesmo segundo em que a cobrança nova fica devida. Hoje eram 20
   dos 68. É por isso que o número balança tanto: 147 e 68 mediam **o tamanho
   do lote do dia**, não o tamanho do problema.

## O que fica de verdade pra acompanhar

Os **20 da fronteira** venceram hoje 12:00 e têm cobrança devida hoje. Se o
webhook da renovação empurrar o `access_until`, eles seguem normais. **Se não
empurrar, amanhã eles viram 20 pagantes trancados de verdade** — e a
`dinicleia.nascimento93@` já pagou R$ 97 na recorrência 2 (`COMPLETE`), ou
seja, seria vítima confirmada.

É uma previsão testável: **recheca hoje à noite.**

## Eu errei no meio do caminho (e como peguei)

Meu primeiro classificador leu `.items` na resposta de
`GET /subscriptions/{code}/purchases`. Aquele endpoint devolve **array puro**.
`.items` veio `undefined`, todo mundo caiu em "sem cobranças", e o script
imprimiu **"0 pagantes trancados"** com toda a confiança — exatamente o
playbook W (o zero mentiroso), agora cometido por mim.

Só peguei porque o histórico do Martin, que eu tinha impresso cru antes,
mostrava 2 cobranças onde o classificador dizia nenhuma. **A contradição entre
duas saídas foi o que salvou.** O zero final é o mesmo, mas pelo motivo certo,
não por acidente.

Segundo erro menor: filtrei só `APPROVED` e a Hotmart também usa `COMPLETE`.
Isso escondeu justamente a `dinicleia`, a única com pagamento de verdade.

## Ferramenta nova

`_frank/ferramentas/pagante_trancado.cjs` — faz essa conta do jeito certo
(cruza com a Hotmart, separa fronteira de vítima, e diz quantos ele **não
conseguiu provar**). **Use ele na varredura no lugar do `prova_raio.cjs`.**

## Resto da varredura de hoje

- **Filas:** 0 parados. 1 voz e 3 clones em andamento, todos dentro do prazo.
- **GPU:** sem fila nos 3 endpoints. `throttled` 3 e 2 (datacenter, nada a fazer).
- **Sweeps:** vivos, rodando de 5 em 5 min.
- **Dinheiro pendurado:** 8 falhas em 48h, **todas com estorno**. 3 `react_jobs`
  com erro sem estorno são da conta do próprio Johnny (teste de 17/08).
- **Produção:** `fastcloner.com` responde 200. Houve uma janela de erros de
  módulo às 11:43 (`Cannot find module '../server/require-hook'`) durante um
  restart; o app voltou sozinho. **273 restarts acumulados** no pm2 — vale
  investigar em outro momento.
