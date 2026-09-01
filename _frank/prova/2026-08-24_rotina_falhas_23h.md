# Rotina das Falhas — 24/08/2026, ~23h UTC (Frank, dono da fila)

Método serial (regra 8): peguei **um** incidente e levei até onde a decisão é
minha. Não abri outro caso de aluno.

## Por que o `#99` e não o mais velho da fila

A regra manda o mais antigo com aluno afetado. Percorri de cima pra baixo e
justifico cada pulo, porque pular sem dizer por quê é o que faz caso morrer na
fila:

| nº | idade | por que não é ele agora |
|---|---|---|
| `#15` | 609,7h | **travado no Johnny** desde a ronda das 21h: falta provisionar a env da telemetria de fase. Esperar resposta não é estar travado comigo — mas o passo seguinte é dele, não meu. |
| `#65` | 348,0h | trabalhado às 22h; **esperando resposta do grupo** sobre o áudio da Ivanilde antes de retreinar por conta da casa. Saiu do meu colo. |
| `#52` | 124,5h | 16 alunos, mas **ninguém preso agora**: a Kessuly conseguiu na 3ª tentativa (`ready` 19:00Z). O que falta ali é telemetria e código, não aluno esperando. |
| `#97` | 30,8h | Rafael **já respondido** por e-mail às 13:25Z. Sobra defeito de produto sem correção possível hoje. |
| **`#99`** | **29,9h** | **aluno pagante, pedido de reembolso por escrito hoje, acesso vence 26/08, 5 e-mails sem resposta de verdade.** É este. |

A regra de prioridade ("aluno esperando vem ANTES da limpeza da fila") aponta
pra cá sem ambiguidade.

---

## O `#99` estava órfão, e isso é o padrão que já produziu Pepe e Viviana

A nota de 23/08 mandou o caso pro `#95` ("a thread viva é o 95"). Estava certo
naquele dia. Só que o `#95` foi marcado **`fixed` hoje às 13:21** com a nota
*"entregue ao time no grupo do WhatsApp"* — e o Luciano escreveu **mais cinco
vezes depois disso**.

Resultado: caso vivo, aluno escrevendo, e **nenhum incidente aberto com dono**.
"Entregue ao time" virou fechamento. Reabri o `#99` como a thread viva, comigo.

## O que ninguém tinha medido em 5 rondas: eu assisti o reel

A Fast escreveu ao aluno às 21:05Z: *"não consigo abrir o link do Instagram
(a plataforma não me deixa navegar fora do sistema)"* e escalou. O `#95` foi
entregue ao time citando *"o reel que ele indicou"* — **sem que ninguém tivesse
aberto o reel**. Duas rondas classificaram o caso como "reclamação de realismo".

Abri: `instagram.com/p/DcKoD8rsByS` — perfil **@lucasarrial** (verificado),
publicado **17/08/2026**, 58s. Peguei o mp4 pela `og:video`, baixei e transcrevi
com Whisper. **Transcrição integral, com timestamps do áudio:**

```
[0.0s]  Ninguém te mostrou o passo a passo para criar um clone em 7 dias e eu vou te mostrar agora.
[3.7s]  7 dias do zero ao clone funcionando.
[5.9s]  Deixa eu te mostrar exatamente como.
[7.3s]  No dia 1, você grava 45 minutos de vídeo modelo.
[10.2s] Pode ser no celular, sem roteiro perfeito, sem estúdio.
[12.6s] Só você falando naturalmente sobre o seu trabalho.
[15.2s] No dia 2 e 3, você sobe o material no sistema.
[17.6s] O sistema analisa seu rosto, voz, expressões, cadência de fala.
[20.8s] Você não faz nada.
[21.5s] No dia 4, o clone está pronto.
[22.9s] Você escreve o primeiro roteiro sobre qualquer assunto do seu nicho.
[26.0s] O sistema gera o vídeo.
[27.1s] Dia 5, você assiste, testa e ajusta o que precisar.
[29.6s] Primeira vez que vai ver você mesmo falando sem ter falado nada.
[32.7s] No dia 6, você escreve mais 5 roteiros.
[34.7s] Uma tarde de trabalho normal.
[36.2s] No dia 7, você agendou os primeiros 7 dias de conteúdo.
[39.2s] E nunca mais precisou ligar uma câmera.
[41.1s] Eu fiz isso e levei 10 meses do dia 1 até 300 mil seguidores.
[44.6s] 30 milhões de views por mês, com uma gravação a cada 90 dias.
[47.8s] E eu gravei uma apresentação completa mostrando o passo a passo que eu usei para construir
[51.5s] esse sistema de 1 hora.
[52.4s] O link está aqui embaixo.
[53.4s] Você foi selecionado para ter esse acesso.
[55.5s] E cuidado, que esse tipo de material sai do ar rápido.
```

Legenda do post: *"Você é bom no que faz, mas trava na câmera? Eu descobri como
ter presença digital todo dia sem aparecer de novo."*

### O que o produto faz hoje, lido no código

`frontend/src/app/api/v1/video-clone/route.ts:81-99` — o POST aceita
`{ image_key | image_generation_id, audio_key | generation_id, tier }`.
**Uma foto + um áudio**, InfiniteTalk. Não existe entrada de vídeo, não existe
treino de rosto, não existe análise de expressão nem de cadência. Vídeo, na
plataforma, serve só pra **extrair áudio e treinar voz**.

### A conclusão, sem verniz

**O Luciano não entendeu errado.** Ele leu a peça certa e cobrou exatamente o
que ela promete. A distância entre o reel e o produto é **real e medida**, e
não é defeito técnico que eu conserte — é decisão de Lucas/Johnny.

**A nuance que eu não escondo:** o reel é peça de funil (fecha com *"você foi
selecionado"* e *"esse material sai do ar rápido"*, chamando uma apresentação
de 1h) e **não mostra a tela do produto em nenhum frame** — conferi os 14
frames extraídos, é talking-head com legenda. A promessa é falada, não
demonstrada na UI. Isso muda o peso comercial; não muda o fato de que o aluno
comprou por causa dela.

---

## O que eu fiz, e é fato consumado

**1. Avisei o Johnny NA HORA** (regra de prioridade — aluno pagante travado sem
solução não espera relatório). Telegram do grupo, `message_id 385`: as 4 frases
do reel, a leitura do código, o pedido de reembolso por escrito e a ressalva do
funil. Pedi decisão dos dois em (a) reembolso e (b) o que fazer com quem
comprou por essa peça.

**2. Escrevi pro aluno.** E-mail individual, decisão minha (regra 8, 21/08).
Enviado **22:48:12Z**, assunto *"Assisti o reel. Você leu certo - e eu preciso
te contar o que a plataforma faz hoje"*. **Conferido na pasta Enviados depois
de gravar: uid 62, 4KB.** (Ressalva do chamado `101`: isso prova **envio**, não
prova **entrega**.)

O que o e-mail diz: (a) assisti o reel, com as 4 frases citadas literalmente
pra ele; (b) ele **leu certo**, não foi mal-entendido dele; (c) o que a
plataforma faz hoje, e por isso **não grave os 45 minutos**; (d) ele gastou
**3.360 créditos em 2h** testando por um caminho que não muda de patamar —
avisei pra parar de queimar crédito; (e) a oferta dos ~90s por conta da casa
segue de pé e **depende de um "pode fazer" dele**; (f) reembolso e a promessa
do reel são decisão do Lucas e do Johnny, o caso foi pra eles com a
transcrição, e **eu não daria prazo**.

**O que eu deliberadamente NÃO disse:** "a equipe responde em breve". Ele já
ouviu isso três vezes hoje. É literalmente a promessa quebrada que abriu o
`#123` (Pepe).

**3. Não gastei GPU nem crédito.** A oferta dos 90s continua sem o "pode fazer"
dele. Não gerei nada.

### O detalhe que decidiu escrever hoje em vez de esperar a decisão

O aluno gerou **dois Vídeo Clone de 16s hoje, 21:47Z e 22:00Z, -1.680 créditos
cada**, ou seja **depois** de dizer *"ok, fico no aguardo"* às 21:06Z. Cada hora
de silêncio custava crédito dele perseguindo um realismo que esse caminho não
entrega. Por isso o e-mail não esperou Lucas/Johnny.

## Por que o `#99` NÃO está `fixed`

A causa não é técnica e a decisão não é minha. Fechar aqui seria trocar
"medi e avisei" por "resolvi" — exatamente o que a regra 14 proíbe. Segue
`investigating` comigo.

**Relógio correndo:** acesso dele vence **26/08**. Se a decisão não sair antes,
ele perde o acesso enquanto espera resposta de um pedido que a casa reconheceu
por escrito ter recebido.

---

## Achado do passo fixo: "completed" no board de novo não era produção

O card `942fb737` estava **`completed`** no Mission Board desde 17:55. Conferi
a main: `resgatar_voz.cjs` **ainda tinha o gate `uploading` na linha 128**.

Não era falha do coder — ele entregou certo, por **PR #49** (branch nova,
base main, delta reescrito em cima da main fresca). "Completed" significava
*PR aberto*, não *em produção*. É a armadilha escrita na ordem, na terceira
roupa: commitado ≠ aplicado, card ≠ main.

**Revisei e mergeei.** O que confiri antes:
- 1 arquivo só (`_frank/ferramentas/resgatar_voz.cjs`, +87/-17). Sem código de
  app, **sem migration**.
- `node --check` passa; `path_` importado (linha 31).
- Modo `uploading` **inalterado** (mantém o mínimo de 20min e o filtro `/raw/`).
- Modo `failed`: filtra `raw_audio_paths` por extensão de áudio, descarta o que
  mede duração 0 no ffprobe, aborta abaixo de 10min (gate matemático do worker)
  e só **avisa** entre 10 e 20min. Persiste a lista refiltrada.
- **Não cobra crédito**; `--confirmar` obrigatório, sem a flag simula.

**Conferido na main depois do merge: linha 146 aceita `uploading` e `failed`.**
O fix que estava preso há 3 dias está na main.

**Fechei o PR #29** (o da branch STALE `feat/resgate-voz-failed`, 179 arquivos
/ ~16.400 deleções) com comentário explicando que o conteúdo entrou pelo #49.
Estava aberto desde 21/08 e era uma armadilha esperando alguém com pressa.

**Ressalvas que eu não mascaro** (não bloqueiam, ficam registradas):
- o `.update()` do resgate **não tem `.select()`**, então não confere linhas
  afetadas. Aqui o id vem de uma row já lida, então não dá o "0 linhas em
  silêncio" — mas o padrão da casa é conferir.
- `language: "pt"` está **hardcoded** (linha 191) e é **pré-existente**, não
  veio deste PR. Conferi no diff. Cruza com a causa [B] do `#52` (idioma da voz
  ≠ idioma do texto): resgatar voz de aluno que fala espanhol por aqui treinaria
  em pt. Não mexi — fora do escopo desta ronda, fica anotado.

## Regra 7: continuo sem canal pro grupo, e desta vez eu medi

A ronda das 22h registrou que não dá pra postar fato no grupo desta máquina.
**Não repeti a suposição, conferi:** `avisar_grupo.cjs` depende de
`WAHA_API_URL`/`WAHA_API_KEY`, e as duas estão **ausentes** nesta máquina
(testado sem imprimir valor). A WAHA só escuta em `127.0.0.1` no servidor.

Detalhe novo: o **PR #37** (`avisar_grupo: modo --fato para post de fato
consumado`) está **aberto desde 23/08** — mas ele resolve o *formato*, não a
*credencial*. Mesmo mergeado, não postaria daqui. O que falta é acesso, não
flag.

Então os fatos desta ronda (aluno avisado, PR mergeado, incidente reaberto)
foram **pro grupo do Telegram**, que alcança o Johnny, e **não** pro grupo do
WhatsApp onde está o Lucas.

## Colisão de dono na fila, registrada

Listei a fila às **22:41Z** com o `#125` (`open`). Às **22:43:55Z** ele foi
marcado `ignored` por `frank` com a nota *"Falso alarme: amostra automática +
admin isento + ferramentas da equipe"*. **Não fui eu** — eu estava no `#99`
nesse minuto.

Ou seja: **outro processo estava mexendo na fila ao mesmo tempo que eu**. O
desfecho do `#125` parece correto e não contesto o mérito. O que registro é o
risco: "um incidente, um dono" (regra 14-A) não se sustenta com dois agentes
escrevendo na mesma fila no mesmo minuto. Não investiguei quem — não era o meu
incidente e não vou abrir frente nova pra isso.

## Fila no fecho

**7 abertos:** `#15`, `#52`, `#65`, `#97`, `#99`, `#108`, `#123`.
(`#125` saiu — `ignored` por outro processo às 22:43Z.)

## Sobra pro próximo turno

- **Decisão de Lucas/Johnny no `#99`**: reembolso do Luciano + o que fazer com
  quem comprou pelo reel. **Acesso dele vence 26/08.**
- **`#15`** segue travado no Johnny (env da telemetria de fase).
- **`#65`** espera a resposta do grupo sobre o áudio da Ivanilde.
- **`#123`** (Pepe) e **`#108`** não foram tocados nesta ronda.
- **Card `734937eb` está `cancelled`** — era o que faria a telemetria de QA
  gravar no caminho de FALHA, e o `#52` depende dele pra sair do achismo.
  Quem pegar o `#52` precisa reabrir ou refazer esse card; hoje ele não existe.
- **`#124`** (Dr. Negrini) está `aguardando_aluno` e o **acesso vence 25/08
  12:00 UTC** — o Vigia sinalizou às 20h e o relógio não parou.
- Ferramenta: `anotar_incidente.cjs` ainda não tem flag pra **zerar**
  `resolved_at`/`resolved_commit`. O `#52` e o `#65` seguem `investigating` com
  esses campos preenchidos, mentindo pro detector.

## Fim de ronda, passo fixo

- `git fetch origin && git log --oneline origin/main..HEAD` → **vazio**.
- Branches conferidas por `git rev-list main..<branch>` cruzando com os
  arquivos tocados: as duas que mexiam em `resgatar_voz.cjs`
  (`feat/resgate-voz-failed`, `feat/resgate-voz-failed-main`) estão
  **resolvidas** — a segunda mergeada pelo #49, a primeira fechada.
- **Nenhuma migration** nesta ronda. Nada a conferir no banco por DDL.
