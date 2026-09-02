# Rotina das falhas — 02/09/2026, ~13hZ (10h BRT)

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, a ordem
de canal de 31/08 (tudo do FastCloner vai no GRUPO), `2026-08-29_desligar_vigia_e_frank.md`
e `2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

Placar de entrada, consulta **sem cláusula de status**: **21 não-fechados**
(9 `investigating` + 12 `aguardando_aluno`). Eram 19 nas três rondas anteriores;
os 2 novos são `#232` e `#233`, ambos abertos hoje de manhã.

## O incidente que peguei: `#173` / `954ca6c9` (Johnathan)

**Por que este, e não o mais antigo do relógio.** É o único da fila com **prazo de
dinheiro vencendo hoje** — a garantia das 3 compras de 27/08 (R$ 2.391) termina
**02/09 às 21h BRT**. Peguei às 12h40Z; restavam ~8h.

Ele estava travado numa pergunta comercial parada desde 27/08 (*"as três compras
dão direito ao processamento de voz dentro do FastCloner?"*). A ronda das 23h50Z
deixou o próximo passo **especificado**: a promessa está falada num VSL, não
escrita — precisa transcrever. Foi o que eu fiz, e ele não era decisão comercial
inteira: **uma das três compras É o processamento de voz**.

### 1. Transcrevi o VSL (o passo que faltava)

Landing `/fci/` é SPA com player converteai. Peguei o manifesto HLS, **197
segmentos**, 786s de áudio, e transcrevi por whisper (485 segmentos, ~16k chars).
Transcrição em `/tmp/vsl_fci_transcript.txt`.

**Três armadilhas de método que eu só peguei porque conferi, e registro as três:**

- **1 dos 197 segmentos caiu em silêncio no download.** O laço leu 197 linhas e
  gravou 196 arquivos; só a conferência da numeração (`0180` faltando) pegou.
  Sem isso eu teria transcrito um **buraco de 4s** no meio e não saberia.
- **Whisper degradou em duas janelas** (6:00–6:59 e 9:40–10:59): segmentos de 1s
  repetindo frase (*"E o Conteúdo. E o Conteúdo."*, *"vendedor de trânsito"* 5×).
  Texto que loopa é whisper falhando, não locutor repetindo.
- **Um vão de 31s entre 10:59 e 11:30** — exatamente onde mora o empilhamento de
  valor, que é onde uma promessa de ferramenta moraria. **Re-transcrevi as duas
  janelas em separado** antes de concluir qualquer coisa. O vão não tinha promessa
  de ferramenta nenhuma: era benefício-família e ancoragem de preço.

Sem a re-transcrição, a frase "o VSL não promete ferramenta" seria um palpite
sobre um trecho que eu não tinha ouvido.

### 2. O que o VSL prova — e o que ele NÃO cobre

**FCI (R$ 297) é curso, sem dúvida.** 7 módulos nomeados, *"12x de R$ 30,72 ou
R$ 297 à vista"*, bônus = *"1 ano de treinamento e todas as atualizações"*. Em 13
minutos a palavra **"plataforma" aparece UMA vez**, e no sentido de área de
membros: *"assim que você recebe acesso à plataforma no seu e-mail, imediatamente
você vai receber um cronograma de estudos e já vai assistir o primeiro módulo"*.
**Zero** ocorrência de ferramenta, software, crédito, FastCloner, HeyGen,
ElevenLabs. O módulo 7 ensina a *"manter o sistema funcionando sem depender de
terceiros"*. Até aqui, o que dissemos ao aluno estava certo.

**Só que ele não comprou só o FCI, e o VSL do FCI não responde pelas outras duas.**
São 3 produtos DIFERENTES, e isso não estava separado em nenhuma nota:

| produto | valor | transação |
|---|---|---|
| Fábrica de Conteúdo Invisível | R$ 297 | HP2705120177 |
| **Sistema de Geração Pronto** | **R$ 597** | HP3595813880 |
| Comunidade Presença Lucrativa | R$ 1.497 | HP0272337557 |

### 3. O achado: o produto de R$ 597 é o nosso próprio SGP

*"Sistema de Geração Pronto"* é o nome do **SGP que nós construímos e subimos em
produção em 29/08**. Pela nossa própria fonte, não por interpretação:

- `lib/sgp/types.ts:2` — *"SGP — Sistema de Geração Pronto **dentro do FastCloner**"*.
- `lib/sgp/ajuda.ts` — *"a pessoa entrega o material bruto (fotos e áudio) e o
  sistema monta o clone dela: a FOTO base e a **VOZ CLONADA**. É o mesmo
  FastCloner — só que a conta na plataforma nasce no FIM"*; a tela 3 se chama
  literalmente **"Áudio (clonagem de voz)"**.
- `app/[locale]/sgp/page.tsx` — página **pública e sem conta**; **nenhuma
  assinatura** em ponto nenhum do fluxo.
- `lib/sgp/codigo.ts` — o e-mail diz *"é o seu código do Sistema de Geração Pronto
  … pra continuar a configuração do seu clone"*, assinado **Equipe FastCloner**.

O produto de R$ 597 que ele pagou tem, na **nossa** definição, entrega de **voz
clonada dentro do FastCloner e sem assinatura**.

### 4. A contradição interna, que eu não vou esconder

`lib/agent/manual.ts:125` classifica o SGP como compra de **CURSO**, junto com FCI
e CPL. As duas fontes são nossas e **não podem as duas ser a história inteira**.

A leitura que concilia tudo: **o manual está certo em dizer que SGP não é
assinatura** do FastCloner (não é mesmo — é pagamento único); **o código do /sgp
está certo em dizer que o que o SGP entrega é a construção do clone (foto + voz)**.
*"Não é assinatura"* não é sinônimo de *"não tem direito à voz"* — e foi essa troca
que entrou nas nossas respostas ao aluno.

### 5. O que isso faz com o que já escrevemos a ele

Dissemos por escrito **duas vezes** (uid 427 e uid 444) que as três compras *"são
produtos de curso"* e não incluem o FastCloner. **A parte de assinatura está
correta.** A parte que virou resposta à pergunta que ele fez — se a compra dava
direito ao tratamento da voz — **não está medida, e a evidência aponta para o
contrário no item de R$ 597**.

### 6. E a nossa esteira já o tinha tratado como tendo direito

Em **28/08 02:12** o onboarding **gastou crédito e gerou os 5 avatares dele**,
marcados `[onboarding: pode ficar negativo]` (perdoados em 30/08 pelo Johnny).
A esteira que serve comprador de SGP **rodou para ele e entregou a metade FOTO do
produto**. O que nunca saiu foi a metade VOZ.

Ele não é comprador de curso pedindo cortesia: é **entrega iniciada pela nossa
esteira e deixada pela metade**.

**Por que caiu no vão:** comprou em 27/08, quando isso saía **pela planilha**; a
planilha foi desligada em 29/08 e o `/sgp` que a substituiu **nasceu depois dele**.
`sgp_pedidos` tem **2 linhas no total** e nenhuma é dele. Ficou na costura entre os
dois processos — daí o *"ninguém estava encarregado"*.

## Conferido agora, não herdado

- `aluno.cjs`: conta 27/08, **SEM ACESSO**, **10.000 créditos**, **0 vozes**, 5
  imagens `ready` de 28/08.
- **Conferi que o reparo de ontem FUNCIONA de verdade**, em vez de acreditar na
  nota: `voice-cloning/page.tsx` calcula `canTrain = team || creditsTotal >=
  TRAINING_CREDIT_COST` (crédito é o único gate desde a ordem de 10/08) e a API
  `start-training` também só olha saldo. Com 10.000 exatos, **`canTrain = true`**.
  O botão está liberado de fato, não no papel.
- **Eu ia reportar "ninguém contou pra ele" e estava ERRADO.** Conferi os enviados
  antes de escrever: **uid 444, 02/09 01:34Z**, com o passo a passo completo. Ele
  foi avisado. Ainda **não começou** (0 vozes às 13hZ).

## O que decidi NÃO fazer, e por quê

**Não mandei um quarto e-mail.** Ele já tem na mão as duas coisas de que precisa
para se proteger: o prazo (hoje 21h BRT) e o caminho do cancelamento. Escrever
agora *"talvez você já tivesse direito e a gente errou"*, **8h antes do
vencimento e sem decisão tomada**, empurraria ele a esperar e a perder o
cancelamento automático — que é exatamente o dano que a ronda de ontem trabalhou
para evitar. **Direito de reembolso na mão vale mais que hipótese minha.** Se a
decisão sair antes das 21h, ele recebe resposta de verdade; se não sair, ele
decide protegido.

Não liberei acesso, não estornei, não criei cortesia, não prometi data.

## Escalado ao grupo

Postado às ~13h20Z com o achado, a contradição interna declarada, e a pergunta
**com nome**: a compra de **R$ 597 "Sistema de Geração Pronto"** dá direito ao
tratamento da voz dentro do FastCloner? Pelo nosso código, **é o próprio produto**.
Se sim, o Johnathan não precisa de cortesia — precisa do que já pagou, e o mesmo
vale para os outros 5 parados (**R$ 7.644**).

## O que eu NÃO medi (fica como próximo passo, declarado)

- **Não li a página de vendas do produto de R$ 597 na Hotmart.** Então **não sei o
  que o anúncio dele promete** — só o que a nossa entrega faz. É a peça que falta
  para a decisão ser tomada com os dois lados na mesa.
- **Não dimensionei a classe.** SGP tem **1.922 vendas / R$ 3.312.712,42**
  (medição de 31/08) e eu **não sei quantos desses têm conta sem voz**. Exige
  cruzar Hotmart com a nossa base, e-mail a e-mail; não coube nesta ronda.
- **A Rosilene** (`rosilenevc@gmail.com`, 27/08) é o **mesmo padrão**, já
  registrado no log do Vigia de 27/08: comprou curso + SGP, mandou fotos e áudios,
  e foi informada de que precisaria assinar. Foi classificada na época como
  *"expectativa comercial, não defeito"* — classificação que este achado põe em
  dúvida, e que **não reabri por conta própria**.

## Perímetro da ordem de 29/08

Nada de planilha foi lido, escrito, classificado, avisado ou reprocessado. Nenhum
incidente de planilha foi aberto ou reaberto. A planilha aparece aqui **só como
causa histórica** de por que o pedido dele nunca foi entregue.

## Dinheiro

Nada estornado, nada cobrado, nada liberado, nenhuma cortesia criada, nenhum
crédito concedido nesta ronda. A pendência de R$ 7.644 continua **apontada ao
Johnny, não decidida por mim** — mas agora com o produto certo nomeado.

## Estado final, sem maquiagem

**Nenhum incidente foi fechado nesta ronda e a fila não baixou** (21 não-fechados,
subiu 2). O que mudou: a pergunta que trava o caso mais quente **deixou de ser uma
questão de opinião comercial** e passou a ter evidência do nosso próprio código,
com o produto certo nomeado — e apareceu uma classe de **R$ 3,3 milhões** que
ninguém tinha olhado.

O que **não** aconteceu: ninguém ligou para o Johnathan, que é o que ele pede
desde 28/08. Quinta ronda seguida em que essa frase precisa ser escrita.
