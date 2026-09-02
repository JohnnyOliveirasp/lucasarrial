# Rotina das falhas — 02/09/2026, ~14hZ (11h BRT)

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, a ordem
de canal de 31/08 (tudo do FastCloner vai no GRUPO), `2026-08-29_desligar_vigia_e_frank.md`
e `2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

Placar de entrada, consulta **sem cláusula de status**: **21 não-fechados**
(9 `investigating` + 12 `aguardando_aluno`) — igual à ronda das 13h.
Placar de saída: **20 não-fechados** (8 `investigating` + 12 `aguardando_aluno`).
**Fechei 1: o `#233`.**

## O incidente que peguei: `#47` / `ce6e157d` (Katia) — o mais antigo da fila, 14 dias

Peguei o mais antigo com aluno afetado, como manda a regra 8. Ele estava travado
num bloqueio de CÓDIGO, registrado hoje de manhã como `#233`: a ferramenta que
cura a referência de voz respondia **"nenhuma candidata"** na gravação dela.

### 1. O conserto já existia há 8 dias e ninguém tinha mergeado

Antes de escrever uma linha, olhei se já havia resposta pronta — e havia. O
**Vigia** tinha anotado no `#233` que o **PR #54**, aberto em **25/08 17:54Z**,
consertava exatamente isso e continuava OPEN. **Sem essa anotação eu teria
reescrito do zero, em 02/09, um código pronto desde 25/08.** Registro o crédito:
foi o sensor funcionando como devia.

### 2. Por que NÃO mergeei o PR #54 inteiro — e por que isso importa

O PR toca 2 arquivos. Testei o merge antes de confiar nele:

```
git merge-tree $(git merge-base main pr54) main pr54   →  2 marcadores de conflito
git log ...base..main -- fabricar_referencia.cjs         →  0 commits (main não tocou)
git log ...base..main -- refazer_audio_conta_da_casa.cjs →  1 commit: d29959b
```

O segundo arquivo do PR está **STALE**. A main recebeu depois o `d29959b`, com uma
versão **mais rica** de `refazer_audio_conta_da_casa.cjs`: `--texto-arquivo` (o
reformatador de chunk que nasceu do próprio caso Katia) **mais** a trava que
compara palavra a palavra se o texto foi reformatado ou reescrito. Mergear o #54
como estava **apagaria as duas coisas**.

É a **mesma classe de risco** já registrada no índice de ordens para o
`feat/fix-image-upload-retry` (19/08) e o `feat/onedrive-401`: branch antigo que
derruba fix que já está em produção. Trouxe só `fabricar_referencia.cjs`, o
arquivo que a main não tocou. **PR #54 fechado** com esse aviso escrito, para
ninguém reabrir e mergear por engano.

### 3. O defeito, e a medição em produção (não em fixture)

`candidatas()` só aceitava janela cuja fronteira de frase **coincidisse com
fronteira de SEGMENTO** do whisper. O whisper segmenta por janela de áudio, não
por frase — em gravação longa a pontuação cai no MEIO do segmento e era
descartada.

**Falso impossível:** o operador rodava a cura, lia "nenhuma candidata" e concluía
que a voz não tinha trecho aproveitável. Funcionava no caso curto de teste e
**starvava no caso real** — o manual da Fast exige 20min+ de áudio de treino.

Rodei as **duas regras na mesma voz real, mesmo cache whisper**:

| voz | duração | ANTIGA (main) | NOVA |
|---|---|---|---|
| Carol `04539483` | 306s (curta) | 120 | **113** — não regride |
| Katia `c127b74e` | 2979s (longa) | **0 — `FALHOU: nenhuma candidata`** | **95** |

Alinhamento texto↔palavra: **6509/6513 (99,9%)** na Katia, 664/666 na Carol.
**173 fins de frase, dos quais só 12 caem em fim de segmento** — a causa,
confirmada no dado de produção.

Junto veio a trava do transcript, e **ela se provou ao vivo na execução de hoje**:
a passada longa devolveu **49 palavras** para a janela escolhida e o clipe de 25s
diz **69** — o whisper engole trecho em áudio longo (sumiu *"conteúdos, como
alguém que já tem o clone pronto. Eu tenho que me portar como alguém que já faz"*).
Gravar o texto da passada longa instalaria o defeito do **Negrini #124**.

Em produção: **`ff06195`** (PR #151, squash na main). `#233` fechado com
`resolved_commit`, conferido na releitura do banco.

**O que eu NÃO afirmo:** não conserta a voz `1d332ef0` (Robert Ros, **#192**),
que dá 0 pelas **duas** regras porque o transcript dela quase não tem pontuação
(9 de 587 segmentos). É outro problema e continua aberto.

## O achado que muda o que a gente diz para a Katia

A referência **dela já estava curada**, e isso não estava fechado em lugar nenhum.
Conferido no R2, não deduzido:

```
auto.bak-2026-08-25-pfk3.wav   25/08 17:52:01Z   923.278 bytes   (backup)
auto.wav                       25/08 17:52:01Z   876.880 bytes   (a nova)
```

e o `reference_transcript` no banco é o texto derivado do **clipe** (69 palavras),
não o da passada longa.

**A consequência que ninguém tinha fechado:** as três gerações dela de 25/08 são
**17:53, 18:55 e 22:48** — todas **depois** das 17:52. Os áudios que ela ouviu e
marcou **já foram feitos com a referência curada**. Logo o corte da referência no
meio da palavra **não é a causa** dos dois pontos que sobraram (pronúncia de
"reconstrução" no seg 18 e a pausa do seg 5). Hipótese **eliminada por medição**.

**Isso corrige uma coisa errada que está na caixa dela.** O e-mail de **23/08**
diz, com todas as letras, que *"para consertar a sua especificamente falta uma
ferramenta que ainda não existe do nosso lado"* e que *"a sua voz continua com o
recorte antigo"*. **Deixou de ser verdade em 25/08 17:52 e ela nunca foi avisada.**
Anotado no incidente para **não repetir** essa frase.

## O que decidi NÃO fazer, e por quê

**Não mandei um quarto e-mail.** O time escreveu hoje **10:52Z** (uid 448) pedindo
as duas coisas que matam a dúvida do "cortado no final": o **nome exato** e a
**duração** que o tocador mostra. Foi há ~3h. A bola está com ela, legitimamente —
escrever de novo hoje seria ruído em cima de uma pergunta que ela ainda não teve
tempo de responder. Mantido `aguardando_aluno`, com a data anotada.

**Não toquei na referência dela** (já curada), não gerei áudio, não gastei GPU,
não mexi em crédito.

## Higiene de fim de ronda — um registro estava preso

Achei na entrada `origin/main..HEAD` **não vazio**: o commit `b8c3f83` (prova dos
cancelamentos de 01/09) estava **commitado local e nunca empurrado**. É exatamente
a falha que o passo fixo existe para pegar. Rebase mostrou que o conteúdo já
subira por outro caminho (`patch contents already upstream`), então foi dropado
sem perda. **`origin/main..HEAD` agora sai vazio.**

## Perímetro da ordem de 29/08

Nada de planilha foi lido, escrito, classificado, avisado ou reprocessado. Nenhum
incidente de planilha foi aberto ou reaberto.

## Dinheiro

Nada estornado, nada cobrado, nada liberado, nenhuma cortesia, nenhum crédito
concedido. O conserto não gasta GPU nem crédito de aluno. Custo da ronda: as
transcrições saíram do cache; o único gasto novo foi ~R$0,02 de whisper no clipe
de controle.

## Estado final, sem maquiagem

**Fechei 1 (`#233`) e a fila caiu de 21 para 20.** O que mudou de verdade: a
ferramenta que cura referência **funciona em gravação longa pela primeira vez**,
o que destrava o item 2 da ordem de 20/08 (3-4 de 14 vozes) — e um PR correto
ficou **8 dias** parado sem que ninguém decidisse o merge.

**O que NÃO aconteceu:** os dois pontos da Katia (pronúncia de "reconstrução" e
pausa do seg 5) continuam **sem causa e sem data**, agora com a referência
descartada como suspeita. Ela avisou em 01/09 que cancela se não resolver essa
semana, e essa é uma resposta que ainda não temos.

**Continua parado no colo do Johnny, não meu:** a decisão do Johnathan (`#173`,
R$ 597 do "Sistema de Geração Pronto"), escalada às 13h20Z e ainda sem resposta.
O prazo de garantia dele vence **hoje às 21h BRT**.

## Próximo passo declarado

Rodar a cura, agora que ela funciona, nas 3-4 vozes do item 2 da ordem de 20/08 —
identificar quais são e curar uma a uma, com A/B por ouvido antes de aplicar.
Não coube nesta ronda e não estou dizendo que está feito.
