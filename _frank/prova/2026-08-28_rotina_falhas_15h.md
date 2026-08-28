# Rotina das Falhas — 28/08/2026, 15h UTC (Executor, dono da fila)

Abertura: `git checkout main && git pull --ff-only origin main` → já atualizado.
Índice de ordens lido antes de tocar em qualquer coisa.

**A troca de branch da abertura NÃO me pegou desta vez, e eu conferi em vez de
supor.** O Vigia registrou às 12h e às 14h que o `git checkout main` de abertura
arrancou o Frank da branch dele duas vezes hoje. Antes de qualquer comando eu li
o reflog: `checkout: moving from main to main`, árvore limpa
(`git status --short` vazio) — o Vigia já tinha devolvido a branch e commitado o
log dele na main. Nada pendurado, nada perdido. O risco descrito por ele é real e
estrutural; hoje, nesta ronda, não se materializou.

---

## Serial (regra 8): peguei o `#133`

Escolha declarada. Não é o mais antigo da fila em dias corridos — o `#11`
(37,7 d) é. Peguei o `#133` porque a régua é **"o mais antigo com aluno
afetado"**, e conferi antes de escolher:

| candidato | idade | tem gente esperando? |
|---|---|---|
| `#11` trainer failed | 37,7 d | **não** — os 3 afetados apurados, nenhum sem entrega; travado em migration que é aval do Johnny |
| `#108` referência | 4,7 d | classe, sem aluno cobrando |
| `#120` Sandra | 4,2 d | respondida 3×; o que resta é decisão jurídica do Johnny |
| **`#133` Giovanna** | **2,9 d** | **sim — respondeu HOJE 14:50Z e foi reaberto sozinho** |

## O que eu encontrei, e é o achado que justifica a ronda

O `#133` foi reaberto automaticamente às 14:50Z porque a Giovanna respondeu
**autorizando o retreino**. A resposta automática que ela recebeu no mesmo minuto
(Sent uid 244) disse, com estas palavras:

> *"Vou colocar o retreino na fila agora mesmo. Quando ficar pronto, eu te mando
> um e-mail avisando — você não precisa ficar verificando na plataforma."*

**As duas afirmações são falsas.** O retreino estava pronto desde **26/08
00:56Z** (voz `a648e9d5`, `status=ready`, `trained_at` conferido em `voices`).
Não havia nada para enfileirar e ninguém ia mandar aviso nenhum, porque não havia
trabalho pendente que disparasse aviso.

Efeito prático se esta ronda não pega: ela fica esperando uma notificação que
nunca sai — **pela segunda vez**, e o silêncio da primeira vez é exatamente o que
a fez escalar em 25/08 depois de 15 dias. Ela não estava travada por defeito
técnico. Estava travada por **informação errada nossa**.

## A armadilha de tela que nenhuma nota tinha visto

Esta sozinha derrubaria o caso mesmo com tudo o mais certo.

Ela tem **duas vozes** e até hoje as duas se chamavam `Giovanna Vilas Boas`. A
tela ordena por `created_at` **DESC** (`voice-cloning/page.tsx:41`,
`generate/page.tsx:46`, `api/v1/voices/route.ts:81`). E:

| voz | criada | treinada | posição na tela |
|---|---|---|---|
| `88efa5a9` — **defeituosa** | 12/08 **20:25** | 12/08 20:34 | **1ª** |
| `a648e9d5` — **retreinada, boa** | 12/08 **12:36** | **26/08 00:56** | 2ª |

A voz **boa** é a que ela criou **primeiro**, então aparece **embaixo**. Se eu
tivesse escrito "usa a mais recente" — que é o que a intuição manda — eu a teria
mandado direto para a **defeituosa**. Ela ouviria o mesmo problema e concluiria,
com toda a razão, que ninguém fez nada.

**Corrigido:** renomeei a boa para `Giovanna Vilas Boas (retreinada 26/08)`.
UPDATE com guarda por `id + user_id + nome antigo` e `RETURNING` — **1 linha
devolvida pelo banco**, conferida na releitura, não foi update silencioso de 0
linhas. Não toquei na defeituosa (ela some da tela se eu mexer, e apagar dado de
aluna não é meu).

## A amostra que mandei, medida ANTES de mandar

O Vigia deixou uma objeção no `#133` em 27/08: a geração `16b59071` saiu pela
escotilha `_entregar_mesmo_com_cobertura_baixa`. Isso é **insumo para a minha
decisão**, não ordem — e eu não podia mandar como prova um áudio possivelmente
truncado. Então medi, em vez de ignorar ou de acatar sem conferir:

| | texto | áudio antigo `27c3f582` | áudio novo `16b59071` |
|---|---|---|---|
| palavras | **74** | 75 transcritas | **74 transcritas** |
| duração real | — | 29,39 s | 28,97 s |
| tempo falando | — | 14,94 s | 15,10 s |
| articulação | — | 5,020 pal/s | 4,902 pal/s |

**A entrega nova não está truncada**: a escotilha disparou, mas não comeu
conteúdo neste caso. Limite declarado: contagem de palavra igual prova que **não
falta bloco**, não prova que toda palavra está correta.

## O e-mail — a parte que não depende de aval nenhum

Enviado ~15h50Z para `giovannaveterinaria@gmail.com` (endereço conferido no banco
contra `affected_emails` **antes** de mandar — armadilha do Cláudio, endereço
errado é entregue sem bounce), bcc `suporte@`, ensaiado em `--dry-run` com os
acentos lidos na saída, assinatura conferida contra o remetente real
(`Fast - FastCloner`) — foi o erro que o `#166` pegou às 12h.

Conteúdo: corrige a informação falsa de hoje; diz que a voz está pronta desde
26/08; explica **qual das duas usar e por que a errada aparece primeiro**; manda
**antes/depois do mesmo texto** para ela julgar de ouvido **sem gastar crédito**;
avisa que os **+7 dias já estão aplicados** (`access_until` 19/09 — aprovado em
26/08 e **ela nunca foi informada**); saldo 70.000 com os 8.527 já devolvidos; e
diz que os **30.000 seguem pendentes** com o sócio, **sem prometer prazo nem
resultado**.

Os dois links são presignados de **7 dias**, não de 1 hora (lição do `#166`), e
cada um foi conferido com `Range` **antes** de entrar no corpo: **HTTP 206**,
`audio/mpeg`, 346.941 B o antes e 338.613 B o depois.

**Não afirmei que a voz ficou boa.** Regra 9-D: quem julga de ouvido é gente — e
neste caso a gente certa é ela.

## Dinheiro: não toquei, e reconferi pela régua certa

Extrato inteiro relido por `ref_type` e **nunca** por `kind`: existe **1 única**
linha de estorno, `ref_type='generation_refund'`,
`ref_id='incidente-c15ece48-testes-12-08'`, **+8.527** em 25/08 21:48Z, gravada
com `kind='extra_purchase'` — quem filtrasse por `kind` concluiria que ela não
foi estornada e pagaria em dobro. Saldo fecha: 100.000 − 38.527 + 8.527 =
**70.000**. Sem estorno duplicado.

**Anotação para quem decidir os 30.000:** os três débitos de treino são −10.000
em 12:38 (`a648e9d5`), −10.000 em 19:51 (**`a648e9d5` de novo, a MESMA voz**) e
−10.000 em 20:30 (`88efa5a9`). Ela pagou **dois treinos na mesma voz**.

## Por que o `#133` NÃO foi para `fixed`

O defeito da referência está corrigido e medido nesta voz, mas **quem diz se a
voz ficou utilizável é ela, e ela ainda não ouviu** — e os 30.000 seguem
pendentes de decisão do Johnny. `fixed` agora seria fechar em cima de trabalho
técnico feito, não de aluna atendida. Voltou para `aguardando_aluno`: a bola está
com ela (veredito de ouvido) e com o Johnny (os 30.000).

---

## Segundo item: o `#169` já estava resolvido — conferir antes salvou a ronda

O Vigia escalou às 14h que o `jrsolucoescorporativas@gmail.com` estava com
**zero e-mails no histórico inteiro** e 26h+ de silêncio. Apliquei o passo (1) do
manual (*"já resolveu sozinho? confira o estado atual ANTES de qualquer coisa"*)
e **a escalação estava vencida**: uma ronda anterior pegou o caso às 14:47Z,
curou o transcript da voz `f0738839` e **escreveu ao aluno às ~14:50Z**. A
medição do Vigia é das 14:15Z. Não refiz nada, não escrevi segundo e-mail.

## O que sobrou disso, e é defeito NOVO de verdade

`#171` e `#172` entraram às 15:32Z e 15:35Z — **mesmo aluno, mesmos dois erros,
3 minutos de diferença, dois canais** (chat do app e e-mail). Ele relatou nos
dois lugares porque não estava sendo respondido em nenhum.

A metade `video_title` já tem dono (`#169`, PR #82). Mas a **outra metade não
estava coberta por nada**, e a causa eu provei lendo o código:

```
const ct = res.headers.get("content-type")?.includes("png") ? "image/png" : "image/jpeg";
```

Fallback binário: **qualquer imagem que não seja PNG é rotulada `image/jpeg`**.
Se é WebP, mandamos bytes webp com header jpeg e o HeyGen devolve a string que
ele printou, palavra por palavra: `Content type not match image/jpeg != image/webp`.

A mesma linha está copiada em **três** lugares:

| # | arquivo:linha | caminho |
|---|---|---|
| 1 | `api/v1/heygen/avatars/route.ts:101` | criar avatar |
| 2 | `api/v1/heygen/videos/route.ts:73` | `platform_image` |
| 3 | `api/v1/heygen/videos/route.ts:92` | **`heygen_look` — o caminho do aluno** |

O (3) é exatamente o caso dele: importou o avatar **do próprio HeyGen**, cujo CDN
serve WebP. E isso **explica o workaround que ele mesmo achou** — subir PNG à mão
funciona porque aquele caminho (`videos/route.ts:104`) valida o tipo **real** via
data URL em vez de chutar. `uploadImageAsset` (`lib/heygen/client.ts:158-161`)
ainda **tipa** `contentType` como `'image/jpeg' | 'image/png'`: webp não tem nem
como ser expresso.

**O que eu NÃO afirmo:** não está provado que o `/v1/asset` do HeyGen **aceita**
`image/webp`. Não dá para testar sem queimar crédito HeyGen do aluno — e ele
escreveu que parou de tentar justamente para não gastar. Mandar o tipo verdadeiro
é o passo certo; se o HeyGen recusar webp, o passo seguinte é converter para PNG,
o que pede dependência nova (`sharp`/`jimp`/`file-type` estão **todos ausentes**
do `package.json`) e portanto aval.

**Card aberto pro `coder`** com a spec: magic bytes (nunca o header — o header já
mentiu aqui), helper único para os 3 call sites, sem dependência nova, PR sem
merge. Corrigir 1 dos 3 e deixar 2 é reincidência garantida.

**`#172` fechado como duplicata** do `#171` (nota + `resolution_note` apontando
para os dois donos). **Nenhuma das duas metades foi fechada junto** — `#171` fica
`open` porque a bola está com a gente, não com o aluno.

**Dinheiro: nenhum.** Reli os dois caminhos e **não há linha de débito/crédito**
em `videos/route.ts`, `avatars/route.ts` nem `react/gerar.ts` — a tentativa que
falha **não cobra**. Nada a estornar. O crédito que ele queima nessas tentativas é
o **do HeyGen, na conta dele**, fora do nosso ledger — mais um motivo para não
mandá-lo "testar de novo" antes do fix.

---

## Grupo (regra 7)

Duas linhas, só fato consumado: escrevi para uma aluna (msg 541) e fechei o
`#172` como duplicata. Sem log de terminal, sem ronda vazia.

## Pro Johnny — o que é decisão sua

1. **A Fast fabricou um compromisso operacional.** Ela prometeu por escrito
   *"vou colocar o retreino na fila agora mesmo"* e *"te mando um e-mail
   avisando"* — uma **ação técnica que ela não executa e que não tem dono**. Não
   é o `#150` (chat sem chamado) nem o `#153` (abre e fecha no mesmo segundo): é
   a auto-resposta **inventando trabalho**. Nesta ocorrência só não virou segundo
   silêncio porque a ronda pegou. **Se você mandar, abro chamado com a classe
   escrita** — não abri sozinho porque quero teu aval sobre o recorte.
2. **Os 30.000 da Giovanna** seguem parados com você desde 25/08. Ela foi
   avisada hoje, de novo, de que está pendente. É sim ou não, não tem pressa de
   hoje, mas tem dono.
3. **O merge continua sendo o gargalo.** O `#169` está tecnicamente resolvido e
   preso no PR #82; o `#171` vai gerar mais um PR. São 23+ PRs abertos, o mais
   velho de 18/08. Diagnóstico não é o que falta.
4. **Migration `scripts/97`** (o `#11`, aberto há 37 dias) continua sem aval. Ela
   não é puramente aditiva — estreita grant — e por isso eu não aplico sozinho.

## O que eu NÃO fiz

- Não gastei GPU, não disparei retreino, não cobrei nem devolvi crédito.
- Não apliquei migration, não mergeei PR, não commitei código na main.
- Não marquei `fixed` nada que não esteja resolvido.
- Não escrevi segundo e-mail para o `jrsolucoes` — ele foi respondido às 14:50Z e
  a resposta que falta depende do fix, não de mais um e-mail.
- Não reclassifiquei o `#169` (segue `atendimento` carregando defeito de sistema,
  observação herdada do Vigia que eu confirmo e não executo sozinho).
