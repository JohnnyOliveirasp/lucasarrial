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

## 4ª e última correção: a condição mora em QUEM RECEBE (com log)

O Frank contestou a minha 3ª versão e pediu que eu conferisse antes de gravar
como fato. Conferi — e ele está certo. Prova no log cru do bot do Claude
(`.env.telegram.log`, campo `entities`):

```
update_id  hora      comando?  entidade bot_command?
231582780  14:13:16  NAO       nao      <- chegou
231582783  14:13:59  NAO       nao      <- chegou
231582786  14:24:52  SIM       sim
```

**Seis mensagens dele entraram sem comando nenhum.** Minha frase *"só chegou
porque o Johnny falou"* está errada: a entrega funcionou o tempo todo; o que
falhou foi o bug de offset do `--ler`.

Isso derruba também a formulação *"de bot para bot o Telegram exige comando"*.
Não é lei simétrica. **O que decide é o privacy mode de quem RECEBE**, mais o
gate que esse bot tenha no próprio código:

| bot | configuração | consequência |
|---|---|---|
| `@claude_boss_007_bot` | `can_read_all_group_messages: true` | recebe tudo do grupo, inclusive de outro bot, sem comando |
| `@Frank_agent_007_bot` | privacy + gate em `src/bot-to-bot.ts` | só aceita `/comando@bot` ou resposta |

> **Frank → Claude:** comando desnecessário.
> **Claude → Frank:** comando obrigatório.

**Correção do próprio Frank sobre o mecanismo do lado dele** (14:27Z): não é
privacy mode, é o `src/bot-to-bot.ts` — allowlist por bot, exigência de
endereçamento e o orçamento de 4 trocas. **É decisão de projeto, não acidente de
config.** Consequência prática: *mesmo que o privacy do bot dele mude, o comando
continua obrigatório na direção Claude → Frank.* Não conte com o privacy pra
afrouxar isso.

⚠️ **Quatro versões desta regra em um dia.** As três primeiras morreram do mesmo
jeito: generalizar a partir de uma observação só — uma caixa vazia, um sucesso
com causa errada, uma direção medida virando lei nas duas. Se alguém escrever
uma quinta, que traga `update_id` e timestamp.

## A distinção entre humano e bot (que continua valendo)

O agente que mantém o Frank apontou o que faltava: **as regras não são as
mesmas para humano e para bot.**

| Quem manda | O que chega no Frank |
|---|---|
| **Johnny (humano)** | `Frank, faz X` · `@Frank_agent_007_bot ...` · responder a ele |
| **Outro bot** | **só** `/comando@Frank_agent_007_bot ...` ou responder a uma mensagem dele |

O nome e o `@` simples funcionam porque o **código do Frank** os aceita — foi
feito para o Johnny chamar naturalmente. De bot para bot o bloqueio é do
**Telegram**, antes de qualquer código nosso rodar. Não há o que ajustar do
lado dele; quem muda é quem envia.

O comando pode ser qualquer palavra (`/msg`, `/ask`, `/frank`) — não precisa
existir no Frank. O que a plataforma exige é a **forma** `/palavra@nome_do_bot`,
no começo ou precedida de espaço.

## O que a ferramenta faz agora (para o erro deixar de ser possível)

`telegram.cjs`:

- `--para frank` monta `/msg@<bot>` na **primeira linha**, lendo o destino de
  `TELEGRAM_BOT_DESTINO`;
- texto que **abre** com `@algumbot` é **convertido sozinho** para a forma de
  comando (username de bot no Telegram termina em `bot`, então dá para detectar
  com segurança);
- `@bot` no **meio** do texto só gera aviso — ali o comando não valeria mesmo,
  e adivinhar a intenção seria pior que avisar.

⚠️ **Bug pego pelo próprio teste da ferramenta:** a primeira versão da conversão
prefixava o texto, e o comando acabava **depois** da linha de identidade
(`🧠 Claude`) — ou seja, fora da primeira linha, que é exatamente o que não
funciona. Agora a conversão devolve o destino e quem monta a mensagem é uma
função só, usada pelos dois caminhos.

## Armadilha operacional registrada

`--enviar "..."` passa pelo shell, que **come crase e `$`** antes da ferramenta
ver. Numa mensagem de 20/08 a palavra entre crases virou `command not found` e
sumiu do texto enviado. Para texto longo use **`--arquivo msg.txt`**, que foi
adicionado ao `telegram.cjs` por causa disto.
