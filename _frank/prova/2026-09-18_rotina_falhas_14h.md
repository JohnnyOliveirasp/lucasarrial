# 18/09 ~14hZ — Ronda das falhas (serial, dono da fila)

Nenhum cartão fechado. O card serial foi o **#101**, e o que ele tinha era uma
**objeção do Vigia parada há 2 dias** — nomeada, concreta e nunca respondida.
Respondi. A resposta trouxe um conserto real (27 linhas) e um furo que **ainda
está aberto**, então o cartão continua aberto de propósito.

## Card serial: #101 (`b2651a6f`, 25,7d) — NÃO fechado

Peguei por ser **o mais antigo acionável**. Os dois mais velhos seguem com
bloqueio real, conferido por mim nesta ronda e não herdado:

- **#15** (`d3d8d1b2`, 50,0d) — dormente de verdade: `last_seen_at` 04/09
  20:47Z, nenhuma ocorrência em 13,7 dias. Espera evento, não trabalho.
- **#32** (`9119254c`, 39,1d) — aluno entregue hoje 10hZ (Alexandre, voz
  `ac2d906f`); o que resta são os PRs #335/#338.

O #101 estava `fixed` desde 16/09 12:04Z e voltou pra `open` em 18/09 10:55Z
por reabertura automática de bounce. A ronda das 12hZ já tinha explicado que
**não era ocorrência nova** e registrou, corretamente, que não re-fechava
porque **a objeção do Vigia de 16/09 18:17Z nunca foi respondida**. Essa era a
dívida. Fui atrás dela.

## A pergunta que a objeção NÃO fez

A objeção dizia: o conserto do PR #311 vale pra frente, o passivo ficou, e
*"falta decidir se vale reconstruir as linhas"*. Está certa — mas ela trata o
buraco como **passado**. A pergunta que decide o cartão é outra:

> o buraco é só passivo, ou **ainda está aberto hoje**?

As duas respostas pedem ações opostas — backfill × achar o cano furado — e
ninguém pode escolher sem medir. Backfill de cano furado enche de novo amanhã.

## O instrumento, e o que ele mediu

`_frank/ferramentas/2026-09-18_enviados_x_tabela.cjs` (novo, só leitura):
cruza a pasta Enviados do suporte@ com `emails_enviados` por **Message-ID**,
com queda pra destinatário + janela de 10 min. `EXAMINE` + `BODY.PEEK[HEADER.
FIELDS]`, **zero corpo** — o #351 provou que toda cópia local de parse de MIME
apodrece contra a produção; não havendo corpo, não há parser pra apodrecer.

| medida | valor |
|---|---|
| cartas na pasta Enviados desde 14/09 | **623** |
| linhas em `emails_enviados` | 498 |
| casadas por Message-ID | **498** (100% da tabela tem cópia na pasta) |
| casadas por destinatário + janela | 10 |
| **cartas na pasta SEM linha na tabela** | **42** |
| └ antes do merge do #311 (16/09 11:26Z) | 41 — passivo |
| └ **depois** | **1** |

A de depois: **uid 2665, 17/09 17:05:25Z, `lucianodepinho@gmail.com`**,
*"Seu cancelamento esta confirmado"*. Conferi à mão antes de acreditar no meu
próprio instrumento: **zero** linha pra esse endereço naquele dia, e a tabela
tem linha às **16:47:46Z** e às **17:27:53Z**. Não é falta de cobertura — é
buraco no meio de dois registros que deram certo.

## O mecanismo — e não é "o conserto não pegou"

O conserto pegou: **39 cartas da ronda registraram em 17/09**. O que essas
cartas furadas têm de diferente é que elas também **não estão no
`envios_ledger.jsonl`** — o registro anti-duplicata, vivo desde 15/09 11:27Z e
escrito **relativo à raiz do checkout**. São **duas**: uid 2492 (16/09 01:06,
`ericb.malzone`) e uid 2665. As duas com Message-ID `frank-` e cópia em
Enviados, ou seja saíram do `enviar_email.cjs` — mas de uma **cópia que não é
este checkout**.

**Hipótese principal, e digo que é hipótese: worktree descartável.** Medido
agora: **99 dos 113 worktrees** da máquina carregam `enviar_email.cjs` **sem**
`registrarEmEnviosDaCasa`; só **10** têm o conserto. Carta mandada de lá sai
pro aluno, entra em Enviados, e não entra em livro nenhum.

**O que reforça a hipótese, achado ao commitar:** o `envios_ledger.jsonl` é
**gitignored**. Ele nunca sai do checkout onde nasceu — então o ledger de um
worktree morre com o worktree, e o da `main` **não pode** conter uma carta
mandada de lá. Isso é exatamente a assinatura das duas cartas: Enviados sim
(IMAP é remoto e sobrevive), ledger não (local e descartável).

**O que ainda enfraquece a hipótese, e registro em vez de omitir:** nenhum
worktree vivo tem `envios_ledger.jsonl` próprio. Ou o worktree foi apagado
depois (o hábito da casa é descartável), ou foi outro caminho. **Não tenho prova direta
de qual diretório rodou** — a carta não carrega essa informação e o registro
não grava host nem caminho. É exatamente o dado que faltou pra eu cravar a
causa, e é o que eu deixo nomeado pra quem pegar.

### A confissão que já estava escrita e ninguém ligou ao cartão

O log da ronda de **17/09 18hZ** abre com uma retratação que diz, com todas as
letras: *"`emails_enviados`, que **não registra envio feito pelo
`enviar_email.cjs`** — provado pelo meu próprio e-mail, que também não aparece
lá"*. Aquela ronda **viu este furo**, usou ele pra derrubar uma conclusão
errada dela mesma — e não trouxe o fato pro #101. O furo ficou 1 dia à vista
sem dono.

## Achado de brinde

`_frank/ferramentas/enviar_email.sh` manda por `curl` **sem header Message-ID,
sem cópia em Enviados e sem registro nenhum**. Carta que sair por ali é
invisível nos três livros. Ele **não** explica o uid 2665 (que tem Message-ID
`frank-` e cópia em Enviados), então não é a causa aqui — mas quem pegar o
cartão deve decidir se aposenta o `.sh`.

## O que eu consertei (confirmado pelo BANCO)

`_frank/ferramentas/2026-09-18_backfill_envios_da_ronda.cjs` (novo; ensaio por
padrão, `--confirmar` pra valer). Fonte é o **ledger**, não a pasta: ele carrega
`at`, `para`, `assunto` e `message_id` no instante do envio, e é o Message-ID
que casa o bounce — reconstruir a chave de casamento a partir de cabeçalho
decodificado seria apostar a prova no parser.

- **27 linhas inseridas**, `origem='ronda-manual-retroativo'` — nome próprio de
  propósito: **linha remontada não pode se passar por registro feito na hora**.
- **Relidas do banco: 27 linhas, nenhuma com data de hoje.** Isso importava
  porque `enviado_em` tem `default now()`: inserir sem data gravaria carta de
  15/09 como enviada **hoje**, o que é **pior que a ausência** — diria à ficha
  que a casa escreveu hoje pra quem não recebe nada há dias.
- **Efeito medido no caso que o Vigia nomeou:** `valdirtrentotrg@gmail.com`
  passou de **0 → 2 tentativas**, exatamente as duas cartas (uid 2456 e 2465)
  que ele citou. O zero cego que o cabeçalho do `contato-tentativas.ts:32`
  chama de **pior desfecho do módulo** saiu do ar nesses 27 casos.

## O que NÃO dá pra backfillar

As cartas anteriores a **15/09 11:27Z** (início do ledger) não têm fonte com
Message-ID confiável. Cai nessa faixa o **`andy.silvestre@icloud.com`** (uid
2331, 14/09 19:45Z), que o próprio Vigia citou. **A ficha dele continua lendo
zero e eu não consegui consertar isso hoje.**

## Por que não fechei

O furo do item do mecanismo é um **caminho de envio vivo**, com **uma
ocorrência depois do conserto**. Fechar agora seria trocar *"não sei se a carta
chega"* por *"achei que tinha resolvido"* — que é o defeito que este cartão
descreve, aplicado a ele mesmo. Passo nomeado pra próxima ronda: fazer o
`enviar_email.cjs` gravar **caminho do checkout e commit** na linha.

## Percepção

`percepcao_travada.cjs`: **1** card apontado (`#450`), **0 reais** — é o mesmo
falso positivo das duas rondas anteriores, prosa da nota casando por `%ouvir%`.
Conferido por mim, não herdado. **Terceira ronda seguida** com falso positivo
nessa linha; sigo **não apertando** o padrão do varredor: falso positivo custa
2 minutos, falso negativo custou os 16 dias que originaram a ordem de 17/09.

## Contagem da ronda

| medida | valor | instrumento |
|---|---|---|
| chamados abertos | **95** (sem mudança) | `varredura_travados.cjs` |
| aguardando aluno | **32**, 12 com 7d+, mais velho **20d** | idem |
| itens presos | **0** | idem |
| travados em percepção | **0 reais** (1 apontado) | `percepcao_travada.cjs` |
| linhas de envio reconstruídas | **27** | backfill, relido do banco |

## O que NÃO fiz

- **Não fechei o #101** — motivo acima, e é decisão, não esquecimento.
- **Não escrevi pra nenhum aluno**: o trabalho foi escrituração do que já tinha
  sido dito. Carta nova aqui seria ruído sobre caso encerrado.
- **Não apaguei nem mexi nos 99 worktrees furados.** Apagar worktree alheio no
  meio de trabalho de outro é estrago; o risco fica declarado e nomeado.
- Não toquei em crédito, acesso, voz, migration nem GPU. **Zero GPU.**
- Continuo sem atacar os **12 `aguardando_aluno` com 7d+**. Dívida declarada de
  novo com número e idade — e hoje ela pesa mais, porque parte dessa fila pode
  ser **carta que não chegou**, não aluno calado.
