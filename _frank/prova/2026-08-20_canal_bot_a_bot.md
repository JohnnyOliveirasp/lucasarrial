# Canal bot↔bot: medido, funciona — e as duas conclusões erradas que ele derrubou

Data: 20/08/2026 · Grupo **BrothersAI** · Registrado por: Claude
Status: **canal ativo nos dois sentidos, com endereçamento**

> **Para que serve este arquivo:** o Telegram é o canal, mas conversa não tem
> histórico pesquisável nem sobrevive a troca de sessão. Aqui fica o que foi
> **decidido** e o que ficou **pendente**, pra ninguém refazer o que o outro já
> fez ("cavalar as coisas"). **Isto NÃO é o transporte** — não escreva aqui
> esperando que o outro leia em tempo real.

---

## O que foi medido

| | |
|---|---|
| Bots | `@claude_boss_007_bot` (Claude) · `@Frank_agent_007_bot` (Frank) |
| Claude → Frank | ✅ entrega confirmada — Frank respondeu ao conteúdo |
| Frank → Claude | ✅ entrega confirmada — Claude leu `[14:02:31]` e `[14:07:55]` |
| Condição | **forma de COMANDO** — `/msg@bot` na 1ª linha, ou resposta direta |
| Mensagem solta no grupo | ❌ não chega ao outro bot |
| Menção simples `@bot texto` | ❌ **também não chega** (ver 3ª correção) |
| Mensagem própria de volta | ❌ nunca (bot não recebe o que ele mesmo mandou) |
| Freio anti-loop | **4 trocas**, depois o Frank cala até um humano falar |

## As duas conclusões erradas, uma de cada lado

**1. Claude:** escrevi na ordem `2026-08-20_canal_telegram.md` e no cabeçalho do
`telegram.cjs` que *"o Telegram não entrega a um bot as mensagens de outro bot,
é limite da plataforma"*. Errado. O que me enganou foi o `--diagnostico` marcar
**0 mensagens de bot** — tirei conclusão grande de um zero. Corrigido nos dois
arquivos.

**2. Frank:** afirmou a mesma coisa categoricamente, e se corrigiu sozinho em
`[14:02:31]` ao receber a mensagem. Achou a explicação lendo o código:
`src/bot-to-bot.ts`, com `ALLOWED_BOT_IDS=claude_boss_007_bot`, exigência de
endereçamento e o orçamento de 4 trocas.

**3. Claude, de novo (a segunda vez no mesmo dia):** depois de derrubar o "bot
nunca lê bot", escrevi que **bastava mencionar `@nome_do_bot`**. Também errado.
A resposta que pareceu confirmar isso chegou logo depois de o Johnny digitar
*"Frank responde o Claude"* — **foi o humano que destravou, não a menção**. A
mensagem seguinte, com `@` simples e sem humano no meio, ficou sem resposta.
Pego pelo agente que mantém o Frank.

O que vale, medido:

| forma | chega ao outro bot? |
|---|---|
| mensagem solta no grupo | ❌ |
| `@nome_do_bot texto` (menção) | ❌ |
| `/msg@nome_do_bot texto` (comando, **1ª linha**) | ✅ |
| resposta direta a uma mensagem dele | ✅ |
| a própria mensagem de volta | ❌ nunca |

> **A lição, que vale mais que o caso: zero não é prova de impossibilidade — e
> UM sucesso não é prova de causa.** Errei nas duas pontas em algumas horas:
> primeiro concluí impossibilidade de uma caixa vazia, depois atribuí ao `@` um
> resultado que veio do humano. A cura não foi prometer atenção: o `--para` do
> `telegram.cjs` monta o `/msg@` sozinho e a ferramenta **avisa** quem tentar
> menção simples. Quem escreve mensagem não precisa mais saber disto.

## Decisões tomadas (não reabrir)

1. **`_frank/mensagens/` NÃO será construído** como fio de conversa. O canal
   resolve. — *cancela a proposta que o Frank tinha feito.*
2. **Regra de canal:** se eu preciso **EXECUTAR**, vai no **git** (ordem, DDL,
   código, saída de comando — histórico, autoria, diff). Se é pra alguém
   **SABER**, vai no **Telegram**. Segredo nunca vai em nenhum dos dois canais
   públicos.
3. **Mensagem densa, uma vez.** Com 4 trocas de orçamento, "recebido"/"ok"
   queima uma troca sem conteúdo. Proibido.
4. **Sempre `@destino_bot`.** Sem o @, você falou sozinho achando que conversou.
5. **Frank abre os cards** do `/autorizar` sem resposta e do silêncio no grupo.
6. **`runpod-worker/` está reservado ao Claude** até ele avisar no grupo. Quem
   precisar mexer, fala antes.

## Pendente — esperando resposta do Frank (mandado 14:1x)

| # | Assunto | O que foi pedido |
|---|---|---|
| 1 | 🔴 **dinicleia e as 47** | Das 47, quantas tiveram pagamento aprovado alguma vez, quantas nunca pagaram, e quantas do 1º grupo estão trancadas AGORA. **Não destravar ninguém** — medir e reportar. Regra vigente: `2026-08-18_regra_final_pagou_fica.md` (decide o PAGAMENTO, não o status). |
| 2 | `qa.coverage_espalhada` | O worker devolve no output do job; o webhook descarta (não há referência a `qa` em `frontend/src/app/api/v1/webhooks/runpod/route.ts`). Quem escreve a migration — Claude ou Frank? |
| 3 | `forget-cli` | Apaga por semelhança sem mostrar o alvo. Card aberto; até existir confirmação com alvo à vista, **não usar com termo largo**. Ele já apagou a memória #781 por engano (recriada como #848). |
| 4 | Refator do worker | Aviso dado. `handler.py` 1.683 → 93 linhas; QA em `tts_qa/`, jobs em `jobs/`. Nenhuma regra mudou (37 funções idênticas por AST, 50 eventos de log e 38 env vars intactos, erro `qa_coverage` byte a byte igual). Branch local, sem push. |
| 5 | `--corte auto` (`bd9042f`) | Nada a fazer — está certo e é melhor do que o Claude ia pedir. |

## Armadilha operacional registrada

`--enviar "..."` passa pelo shell, que **come crase e `$`** antes da ferramenta
ver. Numa mensagem de 20/08 a palavra entre crases virou `command not found` e
sumiu do texto enviado. Para texto longo use **`--arquivo msg.txt`**, que foi
adicionado ao `telegram.cjs` por causa disto.
