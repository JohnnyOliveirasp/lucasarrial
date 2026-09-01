# Ronda das falhas — 31/08/2026, 13h40–14h05 UTC (Frank)

Método serial (regra 8, ordem de 21/08). Ordem de 29/08 respeitada: **nada da
planilha foi lido, escrito, classificado ou reprocessado**, nenhum import foi
rodado e nenhum incidente de causa-planilha foi aberto ou reaberto. Canal: a
comunicação desta ronda saiu **no grupo** (`notify-grupo.sh`), conforme a ordem
de 31/08 — nada foi para o privado do Johnny.

## Placar

- Fila no início: **7 abertos + 3 aguardando_aluno** (10 no total).
- Fila no fim: **5 abertos + 5 aguardando_aluno**.
- Alunos respondidos: **2** (Cristina/#205 e Wallana/#206), os dois com o caso
  levado até onde ele podia ir hoje.
- Fechados como `fixed`: **0** — e nenhum dos dois casos podia ir para `fixed`:
  em ambos **nada estava quebrado** (teste de bolso da ordem de 27/08).
- Fix em produção: **0**. Os 4 PRs que destravariam a fila técnica seguem OPEN.
- Achado de escala: **117 alunos** com conta criada por nós, material entregue e
  acesso nunca liberado.

## Por que não peguei o #99, o #192, o #200, o #201 nem o #203

O serial manda o mais antigo com aluno afetado. Conferi os cinco antes de
seguir, em vez de herdar a leitura da ronda das 13h:

- **#99 Luciano** (23/08): o passo técnico não existe. O que trava é a decisão
  dos R$ 97, que **vence amanhã (01/09)**. Ele já tem o prazo certo por escrito
  (Enviados uid 365, ronda das 11h43Z), então não perde o direito.
- **#192 Robert**: PR #135 aberto, esperando a decisão binária do Johnny, mais
  um humano **ouvir** o timbre. Nenhum dos dois é meu.
- **#200 Ritmo**: causa medida, conserto escrito, **PR #132 OPEN**. PR aberto
  não é produção (regra 14).
- **#201 Bounce**: branch `feat/triagem-de-bounce` pronta e não mergeada; o que
  falta é corrigir o texto de `ORIENTACAO["spam-saida"]` e o aval de merge.
- **#203 Jussara**: aluna já escrita na ronda das 01hZ, **PR #134 OPEN**.

Cinco travados em outra pessoa, todos com o passo nomeado. Segui pro próximo
**acionável**, que era o #205.

---

## Caso 1 — #205 Cristina: o chamado descrevia um trial que nunca existiu

### O que a descrição dizia, e o que o banco diz

O chamado abre com *"aluna no período de teste (cadastro 28/08), créditos
zerados"*. Medido na fonte, e isso muda o caso inteiro:

| campo | valor |
|---|---|
| `profiles.access_until` | **NULL** — nunca teve acesso, nem trial |
| `purchases` | **0 linhas** |
| Hotmart (`pagou_de_verdade.cjs`) | **NUNCA PAGOU** · 0 assinaturas · 0 `PURCHASE_APPROVED` |
| `payment_events` | **0 eventos** (busquei por e-mail e por payload) |

Ela não teve um período de teste que acabou. Ela **nunca teve acesso nenhum**. A
conta foi criada **por nós** às 14:51:19Z de 28/08 pelo import do onboarding
(`onboarding_runs` linha 566, `ok=true`, 5 imagens + 3 áudios) — no mesmo
segundo do primeiro e-mail da régua.

### A queixa dela está certa quanto ao que saiu daqui

Os quatro e-mails de 28/08, na ordem (Enviados, uids 245–248):

| uid | horário (BRT) | assunto | fala em assinatura? |
|---|---|---|---|
| 245 | 11h51 | Começamos a preparar a sua plataforma | não |
| 246 | 11h51 | Processando as suas imagens | não |
| 247 | 11h51 | Processando o seu áudio | não |
| 248 | **11h57** | Seus arquivos estão prontos — falta só o acesso | **sim, e só aqui** |

A assinatura só aparece **depois** de ela já ter mandado voz e fotos e de nós
termos processado tudo. O que foi dito no convite que a levou a mandar o
material está fora do nosso sistema e eu **não tenho como ver** — por isso
perguntei a ela, em vez de afirmar.

### O que eu respondi

E-mail em ~13h55Z. Conferi cada afirmação na fonte antes de escrever: não há
cobrança nenhuma; a voz (32 min) e as imagens estão prontas e guardadas; a falha
de comunicação é nossa; e o modelo real, sem enfeite — **R$ 97/mês, 100.000
créditos/mês, 7 dias de garantia, e NÃO existe avulso**. Este último ponto está
travado no código, não é opinião minha:

> `app/[locale]/app/credits/page.tsx`: *"avulso é complemento do plano, não porta
> de entrada — regra travada com o Lucas"* — os pacotes só aparecem pra assinante
> e a rota de checkout barra com 403.

Não ofereci crédito de cortesia (não é minha alçada, ninguém autorizou), não
prometi data, não prometi estorno e não assinei como Johnny.

### ⚠️ Armadilha nova, medida nesta ronda — não repetir a conclusão errada

O `enviar_email.cjs` devolveu **"✅ enviado"** (SMTP aceitou) **e em seguida
"⚠️ a cópia NÃO foi gravada em enviados: IMAP timeout"**. Reconferi duas vezes:
a pasta Enviados dela tem **só os 4 e-mails da régua de 28/08**. A minha
resposta **não está lá**.

**Para esta aluna, ausência em Enviados NÃO é prova de silêncio.** O que eu
tenho: aceite do SMTP + **nenhum bounce** (INBOX com 0 não-lidos, mais recente
uid 384 de outra aluna; o bounce do #201 volta em ~2s, então silêncio é sinal).

Isso é exatamente a **metade não consertada do `b2651a6f`** — *"não existe
registro do que foi enviado"* — que foi fechada como `fixed` tendo consertado só
o lado da Fast. Agora atinge o canal do próprio Frank. O envio da Wallana, 3
minutos depois, gravou a cópia normalmente (uid 371), então é falha
**intermitente**, não permanente — o que é pior de detectar.

### Status: `aguardando_aluno`, nunca `fixed`

Nada quebrou: conta criada, voz `ready`, 5 imagens `ready`, régua inteira
entregue. É lacuna de comunicação + expectativa de cobrança, não defeito.

---

## Caso 2 — #206 Wallana: o beco sem saída, e a porta que existia

### Ela mandou três vezes, não uma

Conferido na caixa (EXAMINE + BODY.PEEK, 0 não-lidos antes e depois, flags
intactas):

| uid | quando (BRT) | o que veio |
|---|---|---|
| 354 | 28/08 12h59 | *"Realizado ajuste no vídeo"* |
| 383 | 31/08 09h56 | **dois .m4a** (14,0MB + 14,1MB): *"novo áudio separado em duas partes para dar 20 minutos"* |
| 384 | 31/08 10h04 | link do Drive — **os mesmos dois áudios** |

### Não consegui abrir os áudios, e não vou fingir que abri

Os dois anexos passam do teto de 10MB/anexo do `_anexos.cjs` (*"14,0MB passa do
teto — NÃO baixado"*). E a URL do Drive **não é recuperável** com as ferramentas
de hoje: o `ler_caixa` entrega o `text/plain`, o iOS Mail põe o `href` só na
parte HTML, e o link vira o texto morto *"Audio fast - Google Drive
drive.google.com"*. A descrição do próprio incidente também está truncada em
`https://drive.google.com/...`.

**Consequência assumida:** não medi a duração e **não afirmei a ela** que os 20
minutos estão cumpridos. Falei o contrário — que a tela vai medir e dizer.

### Por que ela estava parada, e por que o beco era duplo

`onboarding_runs` linha 568, `ok=false`, `etapa_falha="audio"`, motivo *"Arquivo
1SrkbIjEioFzTJ... tem 10377MB (teto 419MB)"* — ela mandou o **vídeo de ~10GB**.
As fotos seguiram normal (9 `image_generations` `ready`).

As duas saídas estavam fechadas ao mesmo tempo:

1. **O caminho antigo morreu.** Pela ordem de 29/08 a planilha está desligada e
   não há reprocessamento de import.
2. **O autosserviço também estava trancado.** `app/voice-cloning/page.tsx`:
   `canTrain = team || creditsTotal >= TRAINING_CREDIT_COST`. Com 0 créditos ela
   cai no **paywall** e não treina voz sozinha pelo `/app`.

Mandar ela pro app seria mandar pra uma porta trancada — e é o erro que eu quase
cometi antes de medir.

### A porta que existe (verificada no código ANTES de indicar)

O **`/sgp`**, que substituiu a planilha em produção em 29/08, é autosserviço e
não depende de assinatura:

- `https://fastcloner.com/sgp` responde **200** (`localePrefix: "as-needed"`,
  `defaultLocale: pt-BR`, então a URL sem locale vale).
- **m4a é aceito**: `ALLOWED_AUDIO_MIME` em `lib/r2/presigned.ts` tem
  `audio/x-m4a`, `audio/m4a`, `audio/mp4` e `video/mp4` — este último posto lá
  justamente pra gravador de celular.
- `SGP_AUDIO_MIN_SEGUNDOS = 20min`, `SGP_AUDIO_MAX_SEGUNDOS = 60min`,
  `MAX_ARQUIVOS = 20` (`lib/sgp/types.ts`).
- **A tela MEDE a fala e devolve na hora** (`sgp_pedidos.audios[].segundos`) —
  que é precisamente o que o e-mail não dava, e a razão de ela ter gravado três
  vezes no escuro.
- Conta já existente é tratada (`conta_existente` / senha opcional no
  `enviarPedido`).

### O que eu respondi

E-mail 13h51:18Z, cópia em Enviados **uid 371** (conferida), sem `--bcc`, sem
bounce. Passo a passo do `/sgp`, mais **"não grave de novo antes de subir esses
dois — deixa a tela dizer quanto tem"**, pra ela parar de gastar esforço no
escuro.

E o item que eu não teria escrito ontem: **avisei da assinatura ANTES**, não
depois. R$ 97/mês, 7 dias de garantia, sem avulso, e que hoje ela não tem
cobrança nenhuma. É a lição do #205 aplicada na mesma ronda — lá a aluna só
descobriu a assinatura **depois** de mandar o material, e a Wallana ia bater na
mesma parede daqui a alguns dias.

### Status: `aguardando_aluno`, nunca `fixed`

Nada quebrou: o import recusou um arquivo de 10GB corretamente **e avisou a
aluna**. É atendimento.

---

## O número que eu não esperava — e que é decisão do Johnny, não incidente

Contei perfis criados **desde 01/08** com voz `ready` e `access_until` NULL — ou
seja: conta feita por nós, material entregue, **acesso nunca liberado**:

> **117 alunos.**

A Cristina é **1 de 117**. Pela ordem de 27/08 isso **não é erro de sistema**
(nada quebrou) e o destino é o grupo/Johnny, não a fila de incidentes — por isso
não abri chamado. Registro aqui só para o número não se perder, e porque ele
muda a leitura do #205: não é uma aluna confusa, é uma classe.

## O que fica para quem mexer nas ferramentas (não é bloqueio de ninguém hoje)

O teto de 10MB/anexo do `_anexos.cjs` **e** o fato de o `ler_caixa` não expor o
HTML deixam o suporte **cego** quando o aluno manda áudio grande ou link só no
HTML — dois canais que o aluno usa de verdade, e os dois aconteceram na mesma
mensagem hoje. Não abri incidente porque não há aluno travado por isso agora (a
Wallana tem o `/sgp`).

## Fim de ronda

`git log origin/main..HEAD` vazio antes de commitar este registro; `git status
--porcelain` conferido. Nenhum fix preso em branch, nenhuma branch criada nesta
ronda.

## Precisa de gente (nesta ordem)

1. **#99 Luciano — VENCE AMANHÃ (01/09).** Devolver ou segurar os R$ 97. O aluno
   já sabe o prazo certo por escrito; a decisão é do Johnny e amanhã fecha.
2. **#200 — os 8.422 créditos dos 12 alunos** (achado da ronda das 13h). 8 nunca
   foram avisados, ninguém foi estornado. É dinheiro + e-mail em massa, precisa
   do "pode".
3. **#132 / #133 / #134** — aval de merge; 3 incidentes fecham no mesmo dia, e o
   #200 e o #203 seguem fazendo vítima nova enquanto isso.
4. **#135** — decisão binária (guarda inteira ou só o bucket reverte-protegida;
   a recomendação registrada é a segunda).
5. **#192** — alguém **ouvir** o timbre. Pedido aberto desde 30/08 02h.
6. **Os 117** — decisão de comunicação do onboarding: a assinatura é dita só no
   último e-mail, depois do aluno já ter trabalhado.
