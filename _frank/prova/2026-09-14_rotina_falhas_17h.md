# 14/09 ~17hZ — Rotina das falhas

Método serial (regra 8): peguei **um** caso e levei até o fim. Fila **83 abertos**
na abertura (1 com 30d+, 3 entre 15-30d, 30 entre 7-15d).

Varreduras fixas da ronda, antes de tudo:

- **2 (travados):** 3 presos, nenhum novo — Marcelo (já tratado em rondas
  anteriores), Eric e Euneiva em `awaiting_training`, ambos esperando o clique
  **deles**, no dia 0-1 da régua. Nada a fazer.
- **2-B (pedido de saída × assinatura viva):** **0 sangrando**, e com os dois
  controles OK (esquerda reencontrou o Marcelo, direita devolveu `SUR21VU9`).
  Zero de instrumento com controle vivo é zero de verdade, não cegueira.

## Qual peguei, e por que não foi o mais velho

Peguei o **`cacca8a1` (Ernanda, 10 min de idade)** sob a exceção declarada na
ordem — *dinheiro sendo cobrado errado agora*. A queixa dela, chegada 16:30Z,
era literalmente *"o sistema cobrou os créditos e deu erro"*.

**A exceção se dissolveu na primeira medição: não houve cobrança.** Mas nessa
altura eu já tinha a causa na mão, e ela destravava um cartão de 10 dias. Segui
com ele e registro o desvio: pela letra da regra, o próximo da fila seria o
`6c38c99d` (22,0d, aluno que mandou áudio de 30+ min por link). **Ele fica como
a escolha serial da próxima ronda.**

Não peguei o `d3d8d1b2` (46,2d) nem o `ce6e157d` (26,2d, Katia) pelo mesmo
motivo das duas rondas anteriores: ambos dependem de decisão do Johnny ou de
observação de dias, não de sessão.

## O que era, de verdade

Duas afirmações na queixa. Fui nas duas, no banco.

**1. "Cobrou os créditos" — FALSO, e isso é a boa notícia.**

| o que | valor |
|---|---|
| linhas no extrato desde 11/09 | **2** (`-525` imagem 16:21, `+100.000` ciclo) |
| linhas em `video_clones` | **0** |
| estornos | **0** |
| saldo | **99.475** = 100.000 − 525, fecha na unha |

O vídeo **nunca chegou a existir**. Não há o que devolver. Ela não perdeu
dinheiro — perdeu a explicação, e por isso *achou* que tinha perdido dinheiro.

**2. "Deu erro" — verdade, e o erro genérico é defeito nosso.**

Caminho provado por eliminação, não por chute: ela tem **0 vozes e 0
`generations`**, então o ramo de áudio gerado (TTS) era impossível — sobrou o
upload próprio → `transcribeUploadedAudio`. E *"tente novamente"* só existe, em
**todo** o fluxo do clone, na mensagem genérica do `catch`.

## O defeito, no código

`transcribeUploadedAudio` lança erro **rico**: `Whisper API 413: Maximum content
size limit exceeded`, `Whisper API 400: Invalid file format`,
`OPENAI_API_KEY not configured`. Os **5** pontos que a chamam jogavam tudo fora:

| arquivo | o que fazia |
|---|---|
| `video-clone/route.ts:207` | `catch {}` vazio |
| `video-clone/transcribe/route.ts:37` | `catch {}` vazio |
| `video-clone/import-take/route.ts:62` | `catch {}` vazio |
| `videos/route.ts:89` | `catch {}` vazio |
| `videos/[id]/audio/route.ts:102` | `catch {}` vazio |

Sem linha em `video_clones`, sem débito, sem contador e **sem um
`console.error`**. A única coisa no sistema que sabia o motivo era a exceção, e
a casa a destruía. O aluno recebia sempre a mesma frase.

**É a explicação do `#1dd204f5`**, que estava há **10 dias** em `investigating`
sem uma pista: *não havia o que investigar*. Mesma família do `#371` (gate de
rosto barra sem deixar rastro). A Ernanda é a **2ª vítima medida** da mesma
cegueira.

## O que fiz

- **Corrigi em produção.** `falhaDeAudio(e, ctx, opts)` registra o erro real com
  rota + usuário + chave, e traduz **só o que sabe distinguir**: 413 (acima de
  25 MB) e 400 (formato) viram frase que o aluno resolve sozinho. **401/429/500
  caem no genérico de propósito** — acusar o arquivo do aluno quando a chave da
  OpenAI venceu é mandar ele caçar defeito nosso. Toda saída diz que não houve
  cobrança, **conferido nos 5 pontos: a transcrição roda ANTES de qualquer
  débito**.
  PR **#278** → merge **`86b4acb`** → deploy **SUCCESS** (run `34870902793`).
- **Escrevi pra Ernanda** (uid **2291**): não foi cobrada, a mensagem genérica
  era falha nossa, e o contorno (MP3, abaixo de 25 MB, teto de 1min30s).
  Mandei **depois** do deploy fechar, de propósito: o e-mail afirma que a
  mensagem nova está no ar, e afirmação que depende de deploy não pode sair
  antes dele.
- **Escrevi pro Aroldo** (uid **2292**): assumi os 10 dias de silêncio.
- **Fechei o `#1dd204f5`** com ressalva explícita (abaixo).
- **Apaguei o recado** `para_frank_1dd204f5` — ele pedia exatamente duas coisas,
  e-mail pro aluno e patch na transcrição, ambas entregues hoje. `DELETE` com
  releitura conferida em **0**.
- **Postei no grupo**: o fix, o fechamento, os 2 alunos — e, separado, a decisão
  comercial que não é minha.

## O que NÃO fiz, e por quê

- **Não marquei `fixed` o `cacca8a1`.** A causa **específica** da falha dela
  segue desconhecida: o sistema não guardou. Ficou `aguardando_aluno` — pedi que
  ela repita, e agora a mensagem diz o motivo. Contorno entregue não é conserto.
- **Não decidi o acesso do Aroldo.** Ele está **sem acesso** (`access_until`
  NULL, assinatura R$ 0 cancelada em 02/09) com **75.136 créditos** parados, e
  pagou **R$ 313,32** numa compra **avulsa** (Fábrica de Conteúdo Invisível,
  28/08) — **não** pela assinatura do FastCloner. O que a avulsa dá de direito
  aqui dentro é **decisão comercial** (classe `#173`), não de script. Levei ao
  grupo e disse a ele que trago a resposta. Não prometi nada.
- **Não mexi em status HTTP, não criei tabela, não pedi migration, não gastei
  GPU.**

## O `#1dd204f5`: fechado com ressalva, e a ressalva importa mais que o status

**Resolvido:** o aluno destravou **sozinho no mesmo dia** — chamado 04/09
17:55Z, Vídeo Clone de 77s `[ready]` às **19:14Z** (1h19min depois, −8.085 cr).
Não está sofrendo, não há crédito a devolver. E a causa de o cartão ter passado
10 dias sem pista está corrigida.

**Não resolvido, e não vou fingir que está:** a causa **específica** do
travamento dele em 04/09 é hoje **indeterminável**. Não ficou dado nenhum — e
essa ausência de dado *era* o defeito. Se a classe voltar, agora é legível.

## Prova

`_frank/rascunhos/2026-09-14_provar_falha_de_audio.cjs` executa a função **de
produção** por jiti, não uma cópia (cópia de regra foi o que criou o vão do
`#351`). **7 casos, todos passando**, com **controle negativo**: se o
`console.error` não for chamado, o teste **reprova** — senão eu estaria provando
a string e não a visibilidade, que é o defeito inteiro.

A prova pegou **duas coisas que a leitura não pegou**:

1. **`"Esse gravação"`** — o `import-take` passa rótulo feminino e a concordância
   quebrava **na cara do aluno**. Virou `opts.feminino`.
2. **Um erro meu no próprio teste**: comparava substring crua do erro e reprovava
   o caso 400 por causa das aspas escapadas do JSON. O log estava certo, o
   **teste** errado. Passou a desserializar e comparar o campo.

`tsc --noEmit` limpo nos 6 arquivos. Sobra 1 erro **pré-existente** (`vitest`
ausente) num arquivo que não toquei — conferido que `vitest` não está instalado
e não há script de teste no `frontend`, então é ambiental, não meu.

## Lições

1. **A queixa do aluno pode estar errada no fato e certa no sintoma.** Ela disse
   "me cobraram" e não cobraram. Se eu tivesse tratado como pedido de estorno,
   teria devolvido crédito que não foi tirado (o erro que quase pagou 3.600 em
   dobro no `#152`) — e o defeito real, que atinge todo mundo, seguiria de pé.
   O que desempatou foi conferir as duas afirmações **separadamente**.
2. **Cartão velho parado nem sempre é caso difícil: às vezes é caso cego.** O
   `#1dd204f5` não estava aberto porque era duro, estava aberto porque o sistema
   tinha apagado a evidência. Dez dias de `investigating` sem nada pra
   investigar. Quando um cartão não anda, vale perguntar antes **se existe dado**
   pra ele andar.
3. **`catch {}` vazio é decisão de produto, não detalhe de estilo.** Cinco deles
   custaram 10 dias de um aluno, um chamado novo, e a crença de uma pagante de
   que tinha sido roubada.
4. **Teste que erra sozinho treina a gente a ignorar teste.** Meu primeiro
   controle reprovou um caso correto. Se eu tivesse "ajustado a expectativa" pra
   ficar verde em vez de olhar por que, teria perdido o `"Esse gravação"` junto.

## Estado do repo ao fim da ronda

Conferência da ordem, feita **no instante do commit** (é a 3ª vez hoje que essa
conferência é a única coisa entre ronda registrada e ronda perdida — o vigia em
`fd8aacf`, a ronda das 15h no adendo dela):

- branch reconferida **imediatamente antes** do commit deste log;
- `git log origin/main..HEAD` **vazio** após o push;
- código foi por worktree isolada (`/tmp/wt-audio-cego`, branch
  `feat/audio-clone-erro-visivel`, já removida no merge) — de propósito, pra não
  disputar o checkout do clone compartilhado com os outros agentes;
- nenhuma branch `feat/` com commit preso: o `86b4acb` está no `origin/main`.
