# Ronda serial 14/09 ~17hZ — #259 fechado (a Fast respondia duas vezes a mesma mensagem)

Um incidente, levado até o fim, como manda a `03_ROTINA.md §8`. Varreduras 2/2-B
já tinham rodado nesta rodada.

## Por que este e não outro

A fila tinha **82 abertos**. Os mais velhos não eram pegáveis, e isso foi
conferido um a um antes de escolher — não presumido:

| incidente | por que não | 
|---|---|
| `d3d8d1b2` (30/07) | já trabalhado HOJE 13:47Z; instrumentação viva, 718 gerações com zero timeout, 2/2 alunos estornados. O próximo passo depende de uma **nova ocorrência** — §8.4, parado legítimo, não travado |
| `ce6e157d` #47 (19/08) | trabalhado hoje 14:48Z (causa raiz achada) |
| `6c38c99d` #99 (23/08) | aluno já respondido, 630 cr já estornados, bola com ele |
| `b2651a6f` (23/08) | trabalhado hoje 10:22Z |
| `5c68eb33` #263 (05/09) | aluno respondido 05/09; o que sobra é **decisão de dinheiro do Johnny** (R$97), fora da alçada — §8.4 |

Sobrou o **#259** (`3565a46b`, 05/09): defeito de sistema **vivo em produção**,
com aluna afetada, e — o que decidiu — **um fix pronto e testado parado há 9
dias sem merge**. Quem não mergeia o patch mata o trabalho igual (regra 14-B).

## O defeito

A única trava contra responder em dobro era `markSeen(uid)`, e **uid é a
identidade da CÓPIA da mensagem na caixa, não da MENSAGEM**. Reentrega chega com
uid NOVO e não-lida, logo ganha resposta nova. O `claim_alert` do sweep também
não cobre: ele só impede duas varreduras *simultâneas*, e a reentrega da Katia
veio um dia depois.

O dano não é teórico: a aluna recebeu uma 2ª resposta pedindo um print que dois
e-mails humanos **já tinham analisado**. Ela atendeu, mandou 31MB, e o próprio
sistema recusou por `MAIL_MAX_BYTES`. **O sistema pediu a prova e recusou a
prova.**

## Duas armadilhas desta ronda

**1. Cherry-pick cego teria REGREDIDO outro incidente.** O commit `6b31c6a` era
duplo: metade #259 (`mail-dedupe`/`mail-respond`), metade **#260** (`account.ts`,
extrato por `ref_type`). O #260 **já está `fixed` desde 09/09**, corrigido na main
por outro caminho. `git am` do commit inteiro teria desfeito o #260. Descartei o
`account.ts` de propósito.
→ *Patch velho de commit duplo se confere incidente por incidente: o mundo andou.*

**2. Verde falso.** A simulação saiu com **exit 0** — e não era verde, era **8 de
8 SKIP**. O mock de `./mail-imap` não exportava `fetchThread`, que a main passou a
importar depois que o teste foi escrito, e o arquivo se auto-marca SKIP em vez de
derrubar a suíte. **SKIP sai com exit 0 e parece verde sem ter provado nada.**
→ *É a regra do "consulta que erra volta vazia" aplicada a teste: exit 0 com zero
teste executado é o mesmo zero cego.*

## Medido do zero, não herdado do relatório da branch

- `tsc --noEmit`: 1 erro, **pré-existente** (`resgate-audio.test.ts` importa
  `vitest`, ausente nas devDeps). Provado rodando o mesmo `tsc` numa worktree da
  **main limpa**: erro idêntico, mesma linha. **Zero erro novo.**
- `eslint` nos 3 arquivos: limpo.
- Simulação: **8/8 passam** com o fix e **4/8 falham** contra a main sem o fix —
  falham exatamente as asserções de dedupe (a, a2, a3, e) e passam as de guarda
  (b, c, d, f). Teste que passa em código quebrado não prova nada; este reprova o
  código velho.
- ⚠️ As devDeps não estavam instaladas: `NODE_ENV=production` no ambiente faz o
  `npm` omitir dev. Foi preciso `npm ci --include=dev`. Lockfile intocado.

## Deploy provado pelas 3 evidências (regra 5-B), não por grep no bundle

| # | evidência | valor |
|---|---|---|
| 1 | md5 do fonte no Hetzner == md5 do commit | `5cd78f0e…` / `53de400f…` — idênticos |
| 2 | `BUILD_ID` novo, mtime pós-commit | `cojmXM1b22Z7gNs2gNkSk`, 17:11:30Z (merge 17:09:50Z) |
| 3 | pm2 reiniciou no fim do Action | subiu 17:12:26.9Z, `online` (Action terminou 17:12:31Z) |

`PR #279` · commit `7023af7` · merge `6b5953f`.

## O que NÃO fiz, e por quê

- **Não escrevi pra Katia.** Decisão, não esquecimento. A ronda de hoje 14:48Z já
  achou a causa raiz da queixa real dela (#47) e escreveu às 14:5xZ; ela respondeu
  **satisfeita** (enviados uid 2261/2263/2290). Um 4º e-mail hoje dizendo
  "consertamos o bug que te mandava e-mail repetido" seria empilhar mensagem em
  cima de aluna já atendida — **exatamente o ruído que este incidente existe pra
  matar**.
- **Não mexi em crédito**: o #259 não envolve dinheiro. Conferi a conta mesmo
  assim (176.820 cr, acesso até 15/09, 2 estornos antigos casados por
  `ref_type=generation_refund`). Não havia o que estornar.
- **Corrigi uma ressalva minha do PR #279**: lá escrevi que reentrega de mensagem
  "escalada sem resposta" ficaria fora da trava. Fui conferir: **esse caminho não
  existe** — a escalação (linha 460) vem sempre depois da reserva+envio (435/437).
  O resíduo que anunciei é vazio.

## O que eu não consigo medir, dito na cara

**Não sei quantos outros alunos receberam resposta em dobro** entre 23/08 e hoje.
As duas fontes estão cegas pra trás: `emails_enviados` nasceu **hoje 14:06Z** (49
linhas) e o `pm2-out` rotaciona (1ª linha é de hoje 04:05Z). Então **não afirmo
"só a Katia foi afetada"** — afirmo que só a Katia está **provada**. Daqui pra
frente dá pra medir: `emails_enviados` + a chave `fast_mail_replied` são o
instrumento que não existia.

As 3 respostas de hoje pra Katia **não são reincidência**: são 3 perguntas
diferentes dela — é o caso (b) funcionando como tem que funcionar.

A chave `fast_mail_replied` **ainda não existe** em `agent_state`: ela nasce na
primeira resposta que a Fast mandar depois do deploy (17:12Z), e ninguém escreveu
ao suporte desde 16:40Z. Ausência agora é esperada, não é falha.
