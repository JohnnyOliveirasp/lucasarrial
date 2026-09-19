# 19/09 — O cron dos "147" foi trocado (e o pagante trancado de verdade não estava lá)

**Conclusão em uma linha:** o `prova_raio.cjs` deu **265** hoje (o dobro dos
"147 de 18/08" que a ordem chamava de "o problema mais grave aberto"), e o
número certo, conferido na Hotmart um a um, continua **0**. O pagante sem
acesso de verdade estava num lugar que nenhum dos dois scripts olha.

## O que a ordem mandava, e por que estava errada

O cron `dcb5c7da` (VARREDURA DIÁRIA, `0 8 * * *`) mandava, no passo (3), rodar
`_Bugs/prova_raio.cjs` e tratar 147 como baseline do problema mais grave.

Isso é **falso positivo conhecido desde 19/08**
(`_frank/prova/2026-08-19_os_147_nao_eram_pagantes.md`). Foi apontado **duas
vezes** em 29/08 (`2026-08-29_relatorio_do_dia.md:148` e
`2026-08-29_desligamento_planilha_prova.md:126`), as duas vezes com a mesma
frase — *"não troquei porque não era o pedido de hoje"*. Ficou 3 semanas no ar.

Hoje foi trocado. A troca foi `UPDATE` na coluna `prompt` (não delete+create),
pra preservar `id`, `schedule`, `next_run`, `jitter` e `agent_id`. Backup do
texto antigo em `/tmp/cron_dcb5c7da_backup.txt` na rodada. Conferido depois:
`0 8 * * *`, próxima 2026-09-20 08:00, 25 tarefas intactas.

## Os dois números, lado a lado

| instrumento | resposta | o que ele realmente mede |
|---|---|---|
| `_Bugs/prova_raio.cjs` (antigo) | **265** | suspeitos no nosso banco |
| `_frank/ferramentas/pagante_trancado.cjs` (certo) | **0** | pagou na Hotmart E está sem acesso |

Decomposição dos 265, conferida assinatura por assinatura na Hotmart:

- **221 inadimplentes** (`DELAYED`) — trancar está certo (ordem 13/08)
- **24 na fronteira das 12:00** — vencem no mesmo segundo em que a cobrança
  fica devida; não estão travados
- **16 cancelaram**
- **3 trial** que nunca virou pagamento
- **1 sem prova** (`drfabiovilhena29@gmail.com`, sem subscriber code no payload)

O 265 é maior que o 147 pelo mesmo motivo que o 147 era maior que o 68: ele
mede **o tamanho do lote do dia + o acúmulo de inadimplente**, não o tamanho do
problema. A base cresceu, então o número cresce sozinho.

⚠️ **O que vale acompanhar é 221 inadimplentes** contra 893 entitlements
ativos. Não é bug provado e trancar está correto, mas é 1 em 4 e ninguém mediu
se isso é churn normal ou webhook de renovação falhando. **Não testei.**

## O achado que importa, e ele veio de outro lugar

Nenhum dos dois scripts acha quem **pagou e nunca teve conta** — sem conta não
há linha em `entitlements`, então o varredor de entitlements é cego pra isso
por construção.

**`caplastica@hotmail.com`** (Carlos Augusto Ferreira Moreira):

- assinatura FastCloner desde 22/07; recorrências **R$ 97 COMPLETE em 13/08 e
  28/08**; mais uma avulsa de R$ 297 (COMPLETE, 09/07)
- `aluno.cjs` → **"Nenhuma conta com caplastica@hotmail.com"**
- ou seja: **pagando há ~2 meses, sem conta nenhuma na plataforma**

Estava parado na caixa `tell_frank` como `para_frank_orfa_MY5O3KWB`. Enviado
e-mail hoje perguntando com qual endereço ele entra (não se adivinha vínculo de
compra — playbook da compra órfã). Confirmado na pasta de enviados, **uid 2870**.

### O que NÃO é o mesmo caso

`neto_rocha@hotmail.com`, que chegou pelo mesmo tipo de aviso órfão, **não** é
pagante do FastCloner: a assinatura dele é trial R$ 0 com a rec#2 `OVERDUE`. O
que ele pagou (R$ 313,32) foi a **Fábrica de Conteúdo Invisível**, produto
diferente. O que a avulsa dá direito no FastCloner é decisão **comercial**, não
de script — fica pro Johnny/Lucas. É exatamente a classe do incidente aberto
*"O AVISO DE COMPRA ORFA CHAMA TRIAL DE R$ 0 DE 'COMPRA PAGA'"* (9d, 10x).

## Caixa `tell_frank`: 110 recados empilhados

A rotina 1-C manda esvaziar isso toda ronda. Estão em **110**. O caso do
caplastica estava enterrado ali — ou seja, a fila não é ruído, tem dinheiro e
aluno parado dentro. **Não tratei os outros 109 nesta ronda.** Fica como o
próximo alvo da regra 8.

Patch do Vigia esperando: **0**.

## Resto da ronda

- **Filas:** 0 travados. O `error` de cada consulta foi conferido (o script
  imprime `⚠️ <tabela>: <msg>` e não saiu nenhuma) — zero medido, não zero cego.
- **Incidentes:** 93 abertos, **47 com 7 dias ou mais**, o mais velho com 50d.
  34 aguardando aluno.
- **Saída × assinatura:** 0 sangrando, 0 a revisar, 33 já fora corretamente.
- **Produção:** `fastcloner.com` HTTP 200; pm2 `aiverse` online, 69min de
  uptime, **73 restarts acumulados**.
- **Sweeps:** ⚠️ **não conferi.** O comando de `03_ROTINA.md` §4 lê o
  `AGENT_MONITOR_TOKEN` do `.env.local` e faz `curl` na mesma linha, e o guard
  da máquina bloqueia isso como exfiltração de segredo. **Não digo que os
  sweeps estão vivos, porque não medi.** Precisa de um caminho que não junte
  leitura de segredo com canal de saída.
- **GPU:** não medida nesta ronda.

## Ferramenta nova

`_frank/ferramentas/2026-09-19_idade_dos_abertos.cjs` — idade de cada incidente
aberto (o `varredura_travados.cjs` só dá idade pro balde "aguardando aluno", e
sem idade não dá pra aplicar a regra 8) + caixa `patch_%` e `para_frank_%`.
Só leitura, e **morre** se qualquer consulta falhar, em vez de imprimir zero.
Nasceu em `_frank/ferramentas/` e não em `_Bugs/` por causa da 25-B.
