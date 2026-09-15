# 15/09 ~01h40Z–02h05Z — Rotina das falhas

Fila **80 abertos** na abertura, **78 no fim**. **2 fechados** (`#402`, `#47`),
nenhum aberto por mim. Um fix em produção: PR **#286**, merge **`b705df6`**,
deploy **SUCCESS conferido**.

Repo em `main`, `pull --ff-only` limpo. `_frank/ordens/README.md` lido antes de
tocar em qualquer coisa. Ordem de **29/08** respeitada: **nada da planilha foi
lido, escrito, classificado ou reprocessado** — nenhum incidente desta ronda
nasce dela. Ordem de canal de **31/08**: o aviso saiu **no grupo**, por
`notify-grupo.sh`, e só lá.

## Varreduras fixas, antes de tudo

- **Travados:** 1 `training_jobs` obsoleto (voz já `ready`, escrituração
  pendente, ninguém esperando) + 2 contas com acesso vivo e sem voz pronta,
  ambas dentro do prazo normal (0 e 2 dias). **Nada a fazer.**
- **Estorno:** 13 devolução + 13 não-devolução, **3.256 linhas** varridas,
  nenhum tipo por classificar.
- **`SEM ESTORNO CASADO: 4`** — os **mesmos 4** já conferidos na ronda de 01h:
  zero lançamentos nos quatro, ninguém foi debitado, então não há estorno a
  casar. Reconferi o placar em vez de reconferir os quatro casos: o conjunto não
  mudou. **Ninguém no prejuízo.**

## Qual peguei, e por que os três mais velhos não deram

A regra 8 manda o mais antigo com aluno afetado. Fui na ordem e **disse em que
passo cada um emperra**, em vez de fabricar movimento:

| # | idade | onde trava |
|---|---|---|
| `#15` `d3d8d1b2` | 46,5d | Instrumentação de fase **já viva em produção** (2bd3c3f + b55db26, provado pela geração `67f28d0f`). Sem reincidência há **9,7d**. Só a próxima ocorrência nomeia a fase. Nada a fazer. |
| `#47` `ce6e157d` | 26,6d | **Peguei e FECHEI** — ver abaixo. |
| `#99` `6c38c99d` | 22,4d | Decisão comercial do Johnny/Lucas, pedida pelo aluno em 24/08. E a casa prometeu por escrito escrever **perto de 19/09**; hoje é 14/09. Escrever agora é a 13ª cópia da mesma escalação, que a regra 7 proíbe. |
| `#101` `b2651a6f` | 22,2d | **Peguei**, respondi a pergunta que faltava, **não fecha** — ver abaixo. |

## `#101` — respondi a pergunta do Vigia, e a resposta é "não fecha"

O Vigia deixou em 00hZ exatamente o que faltava: *"COBERTURA DESCONHECIDA — não
li os dez pontos do código que mandam e-mail"*. Fui responder **ela**.

**O que está fechado, e ele estava certo:** o registro é **incondicional dentro
do `sendSupportMail`** (`mail-smtp.ts:180-186`) — fora de qualquer `if`, com
`origem ?? "desconhecida"`. Nenhum dos **9 chamadores** pode furar por
esquecimento. Prova de que ninguém registra cego: **129 linhas e ZERO com
`origem='desconhecida'`**.

**VÃO A — o Resend não registra nada.** `lib/email/resend.ts:32-56` manda pela
API e não chama `registrarEnvio`. Dos 3 chamadores, **um é pra aluno**:
`account/delete/route.ts:33`. Agravante que ninguém tinha dito: o Resend assina
**"AICloneVerse"**, não `suporte@fastcloner.com` — **o bounce dele nem chega na
nossa caixa.** Não é só "não registra": é invisível de ponta a ponta.

**VÃO B — o caminho de maior toque humano é o que não registra.** O
`enviar_email.cjs`, que é como a casa manda e-mail individual pra aluno (regra
8), **nunca insere** em `emails_enviados`. Provado, não inferido: (a)
`message_id like 'frank-%'` = **0**; (b) o e-mail pra Katia de 14/09 ~14:5xZ
existe nos Enviados (uid 2250), a tabela já estava no ar desde **14:06Z**, e
**não há linha dele**. Então todo e-mail escrito na mão pra aluno segue sem
linha de envio, e se voltar o bounce nasce solto — **literalmente o defeito
deste cartão, vivo.**

Logo: metade (2) fechou de verdade; metade (1) fechou **só** pro que sai por
`sendSupportMail`. **Cartão segue `open`.**

**Um alarme meu que era infundado, e conferi antes de gritar:** estranhei
`like 'fast-%'` = 0 com os ids começando em `fast-`, e fui ver se envio e bounce
normalizavam diferente — o que faria o casamento falhar **em silêncio**. Não
falha: `mail-envio.ts:84-90` **recoloca** os sinais de propósito e devolve
`<...>`, e os 2 bounces casaram de fato.

**Armadilha de verdade, pra quem vier:** existem **duas** funções
`normalizarMessageId` com saídas **diferentes** — `mail-envio.ts` devolve
`<id@host>`, `mail-dedupe.ts:62-66` devolve `id@host`. Hoje não há bug porque
cada uma só toca o seu próprio armazenamento. Quem um dia comparar chave de um
lado com a do outro vai achar **zero pra sempre, em silêncio**.

## `#402` — fechado, corrigido e em produção

Cheguei nele **pelo `#101`**: fui ler o diagnóstico cru das 2 únicas linhas com
bounce em vez de acreditar na classe que estava gravada.

O bloco de `inexistente` tem dois padrões pra falha de MX, e o **mesmo servidor**
escreve a recusa de duas formas. A da Sheila (13/09) pegava; a outra, **"No MX
server found"**, não — a alternância aceitava `record|hosts?` e **não `server`**.
**Falhava por uma palavra** e caía no fallback.

Não herdei o diagnóstico do Vigia (ele é sensor, a decisão é minha). Conferi:
tracei o código **na ordem em que ele testa** e nenhuma saída anterior casa; e
`dig` mostra que `pradocomunicacao.com` **não tem MX nem registro A** — não
recebe e-mail, logo é permanente e `inexistente` é a classe certa.

**O dano previsto aconteceu de fato:** envio 21:52Z → bounce 21:55Z → a casa
**reenviou** 22:08Z → bounce 22:10Z. A ficha sem instrução deixou o reenvio pro
domínio morto acontecer no meio.

**Teste provado nos dois sentidos: 25/25 com o fix, 24/25 sem ele (`not ok 10`).**
Teste que passa antes e depois não prova nada. Usei a string **crua** do
`bounce_diagnostico`, não paráfrase, e o teste da queda transitória ganhou **duas
guardas novas** contra o padrão ter alargado pra "DNS" solto. `eslint` exit 0;
**106 testes** de `lib/agent` com **0 falhas**; `tsc` com os mesmos **4 erros
pré-existentes**, conferidos um a um (a rota do `.next` realmente não existe mais
em `src`, `vitest` realmente não está instalado).

**Não reescrevi as 2 linhas históricas** de `emails_enviados`: elas ainda dizem
`desconhecida` de propósito, são a **prova** do defeito.

## `#47` (Katia) — fechado com a aluna confirmando, 26 dias depois

Também caiu no colo pela auditoria do `#101`: vi **4 linhas com o assunto
idêntico** pra ela em menos de 2h e li como **resposta duplicada da Fast** — que
seria regressão do `#259`, cuja trava foi construída **por causa desta aluna**.
Havia até recado de 9,6d dizendo "resposta duplicada no caso Katia". A tese
fechava redonda.

**Estava errada.** Os 4 `message_id` são distintos, mas fui ler a caixa **dela**:
ela escreveu **4 vezes** (uid 614/615/616/617), uma resposta por mensagem.
Comportamento **correto**; assunto igual é só a thread. Se eu tivesse aberto o
cartão, teria reportado regressão falsa no grupo.

E dentro das 4 mensagens estava o que ninguém tinha lido: *"ouvi a nova gravação
e realmente o final ficou inteiro agora"*, *"esses problemas não me incomodam em
nada"*, *"vocês foram o melhor time de suporte de todas as plataformas que já
trabalhei"* e **"volto a assinar a plataforma"**. O instrumento concorda com o
ouvido dela (`cauda_decepada.cjs` nas 3 gerações: sem decapitação interna nem
terminal).

**Não fechei o defeito de produto.** O `#393` (pausa ausente, **81,9%** das
entregas, 441 de 489 alunos) e o `#234` seguem abertos. Fechar o `#47` diz que **o
chamado dela** terminou, não que a casa consertou o produto.

**Levei pro grupo o que não é meu:** acesso dela vence **15/09 12:00Z (~10h)**,
compra `canceled`, 176.820 créditos parados, e ela acabou de dizer que volta a
assinar. **Não prometi nada comercial e não estendi nada por conta própria.**

## De graça, e não pedi

O pedido SGP de 14/09 21:41Z (posterior ao `fdcba70`/PR #228) tem **`cobrado_em`
NULL e a carteira em 0, não em -10.525**. É evidência de que o fix do débito
indevido do onboarding do SGP **está pegando em pedido novo**. Não mexi naquele
cartão — a devolução dos 16 perfis negativos é outra conversa.

## Dois falsos alarmes que matei antes de disparar

1. **"Aluno pagante comprou o SGP e nunca recebeu o código"** — `origem` do
   bounce era `sgp-codigo`, o que daria alarme de pagante travado **na hora**.
   Fui conferir a conta antes de gritar: o próprio dono digitou `.com`, corrigiu
   pra `.com.br` **22 segundos** depois, recebeu o código, e o pedido fechou
   `pronto`. E **não é pagante** (`cobrado_em` null, 0 créditos).
2. **"A Fast respondeu a Katia 4 vezes"** — ela escreveu 4 vezes.

Os dois tinham a mesma forma: o achado que **confirma** a própria tese é o que
menos se confere.

## O que NÃO fiz, e por quê

- **Não corrigi** o comentário de `mail-envio-registro.ts:28` (ainda diz que a
  migration não foi aplicada; está aplicada e gravando). Não ia pendurar doc-fix
  no PR do `#402`, que é outro assunto. É o passo mais barato da próxima ronda.
- **Não mexi** no formato de chave do `mail-dedupe` — mudar chave de dedupe sem
  necessidade é como se perde trava.
- **Não escrevi pra aluno nenhum** nesta ronda: no `#47` a bola está com ela, no
  `#99` a casa prometeu escrever perto de 19/09.
- **Nada de GPU, crédito ou migration.**

## Fim de ronda

- `git fetch origin && git log --oneline origin/main..HEAD` → **vazio**.
- `git branch` → nenhum fix preso; `fix/bounce-no-mx-server` foi **mergeada e
  apagada** no merge do PR #286.
- Deploy do `b705df6`: **conferido SUCCESS** esperando o run do **meu** sha — a
  primeira espera pegou o run **anterior** (`06c28de`, do PR #285) e eu não
  aceitei aquilo como prova.
- Nenhuma migration envolvida: o fix é regex puro.
