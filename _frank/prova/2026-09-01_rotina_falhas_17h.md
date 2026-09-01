# Rotina das falhas — 01/09/2026, ~17hZ

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`,
`2026-08-29_desligar_vigia_e_frank.md` (planilha fora do meu perímetro),
`2026-08-27_vigia_so_erro_de_sistema.md`. Método serial (regra 8, 21/08).

Placar de entrada: **12 incidentes abertos** (eram 7 às 15h), 5 aguardando
aluno, 2 itens presos.

## Correção de rota: o mais antigo não era o #173

O log das 15h registrou o **#173** (28/08 16:00) como o incidente aberto mais
antigo com aluno afetado. Está errado: o **#171** (`fa0e9ca4`, 28/08 **15:32**)
é 28 minutos mais velho e estava `open` o tempo todo. Ele não foi pego nem às
15h nem antes. Registro o erro para ele não se repetir: a ordenação tem que sair
de `created_at` no banco, não da leitura de tela da varredura.

Peguei o **#171** — José Ricardo Gonçalves, `jrsolucoescorporativas@gmail.com`.

## O que eu encontrei: um "corrigido" que não estava corrigido

O #171 carregava, desde 28/08, uma `resolution_note` afirmando:

> "Os dois erros que o Jose Ricardo viu estao corrigidos"

**Metade dessa frase é falsa.** Não herdei a afirmação — fui medir.

### Metade (2), `video_title`: verdadeira, e provada no caminho do aluno

`heygen_videos` tinha **zero linhas na vida** (nenhum Avatar IV jamais gerado
por ninguém). Hoje tem 2, e uma é dele: `b1b0a93f`, título `TESTE_AVATAR`,
status **ready**, criada **28/08 17:18:37Z** — ~1h depois do deploy.

Isso é o mesmo padrão de prova do #192 na ronda passada: não é teste sintético
meu, é a coisa acontecendo na conta do aluno. **Ele foi a primeira pessoa a
gerar um Avatar IV nesta plataforma.** Esta metade eu assino.

### Metade (1), o `webp`: falsa — e o fix de 28/08 não resolve

O commit `f3c0e90` (PR #83) **está** na main (conferido por
`git merge-base --is-ancestor` contra `origin/main`, não por card "completed").
O código subiu. O problema não é esse.

O fix parou de **mentir** o rótulo, mas passou a mandar a **verdade** para um
endpoint que não aceita essa verdade:

| onde | o que faz |
|---|---|
| `lib/heygen/imagem-content-type.ts:31` | `ACEITOS = {image/jpeg, image/png, image/webp}` |
| `api/v1/heygen/videos/route.ts` (`kind==='heygen_look'`) | CDN do HeyGen serve WebP → sniff devolve `image/webp` |
| `lib/heygen/client.ts:167-178` | manda `Content-Type: image/webp` pro `/v1/asset` |

**A doc do HeyGen lista somente `png` e `jpeg`**
(`developers.heygen.com/reference/upload-asset`), conferido hoje em **duas
fontes independentes**. `image/webp` não consta em nenhuma.

Consequência: quem importa o avatar da própria conta HeyGen **continua
bloqueado**. Muda o texto do erro, não o bloqueio.

### A prova negativa que fecha a dúvida de 28/08

O vídeo que funcionou dele tem `image_source = 'upload'`, **não** `heygen_look`.
Ele usou o workaround de PNG manual que ele mesmo descobriu. Ou seja: **o
caminho `heygen_look` nunca rodou com sucesso em produção, por ninguém.**

A nota de 28/08 tinha registrado honestamente "NÃO está provado que o
`/v1/asset` aceita `image/webp`". Agora tem resposta medida: **não aceita.**
O acerto de lá foi não ter afirmado; o erro foi outra nota, no mesmo dia, ter
afirmado por cima.

### Defeito irmão, menor, mesmo arquivo

`erroImagemNaoSuportada` diz ao aluno *"Envie em JPG, PNG ou WebP"*, e
`videos/route.ts` repete. **Estamos recomendando um formato que o HeyGen
recusa** — quem obedecer a nossa mensagem de erro toma outro erro.

## O que eu NÃO fiz, de propósito

- **Não fechei o #171.** Metade não está resolvida; `fixed` aqui seria regra 14
  violada. Está `investigating` com a causa em arquivo:linha.
- **Não codei o conserto.** Card `4554295d` aberto pro `coder`, com ordem de
  conferir **primeiro** se o `av4/generate` aceita o avatar do aluno **por ID**
  (ele informou o dele: `ee32ecae...`) — se aceitar, resolve sem dependência
  nova e sem re-subir a foto de preview de um avatar que o HeyGen já hospeda.
- **Não declarei dependência.** `sharp 0.34.5` **existe** em
  `frontend/node_modules` como transitivo do `next`, mas **não** está no
  `package.json`. Depender de transitiva sem declarar é frágil, e declarar é
  decisão do Johnny. O card diz isso explicitamente.
- **Não pedi teste ao aluno.** Testar o avatar importado gasta crédito HeyGen
  **da conta dele**, e eu já sei que falha. Ele mesmo escreveu que evitava
  gastar à toa; estava certo.

## O aluno

Ele **não** estava em silêncio: recebeu 4 e-mails em 28/08. O buraco é outro e
é nosso — o e-mail de **16:07Z** disse a ele que o webp **não** estava
resolvido; **13 minutos depois** subiu um fix, e ninguém voltou para avisar. E o
que subiu, hoje sabemos, não resolvia.

Escrevi hoje corrigindo isso. **Cópia confirmada em Enviados, uid 420, 1ª
tentativa.** Confirmei o Avatar IV dele, expliquei o PNG/JPEG do HeyGen, pedi
que **não** teste, confirmei que o PNG manual segue valendo, e mantive de pé o
**retreino de voz por conta da casa**, sem prazo — a bola dessa parte é dele
(orientações entregues em 28/08 19:46Z; nenhuma voz nova desde 24/08).

## Dinheiro

Nada a estornar. Extrato relido lançamento por lançamento: todo débito
corresponde a entrega real (áudio, vídeo clone, treino, imagem). A geração
HeyGen de 17:18 **não** debitou crédito nosso — esses caminhos não têm linha de
débito. Saldo 183.673, acesso até 13/09.

## Fila: o que mudou e o que continua

A fila **subiu de 7 para 12** em duas horas. O grosso é atendimento novo
chegando pela Fast, não regressão nossa. Dois itens merecem olho na próxima
ronda:

1. **#222** (`3ca22d47`) — 5 alunos com acesso ativo **presos fora da própria
   conta** (compra num e-mail, conta em outro; `claim.ts:39` casa só por
   e-mail). É a **6ª volta** da mesma classe e nunca virou conserto. O próprio
   chamado avisa que **5 é piso, não teto**. Nenhum deles reclamou, e as janelas
   de acesso vencem entre 07/09 e 19/09. **Não peguei nesta ronda** porque o
   #171 tinha aluno esperando há 4 dias com informação errada nossa na mão, mas
   este é o de maior alcance da fila.
2. **#192** (Robert) — o vencimento de **03/09** levantado na ronda das 15h
   continua de pé e continua sendo decisão comercial do Johnny. **Depois de
   amanhã.**

## Passo fixo de fim de ronda: cumprido, e o check está quebrado

`git log --oneline origin/main..HEAD` saiu **vazio** e a árvore está limpa. Esta
ronda não criou branch de código: o único commit é este log, direto na main, já
no origin. Nada meu ficou preso.

Mas o check dos branches acusou **53 branches locais** com commit fora da main.
Medi com método correto (comparar os **arquivos tocados** contra a versão atual
da main — `rev-list` sozinho dá falso positivo em squash merge): **4 falso
positivo, 49 divergem de verdade.**

**49 linhas de alarme é alarme que ninguém lê.** O detector que existe para
pegar *um* fix preso hoje esconde esse um dentro de 49 — pior que não ter check,
porque dá falsa sensação de cobertura. Não vou afirmar que os 49 contêm fix de
aluno parado: não medi um a um, e chutar aqui seria exatamente o tipo de
afirmação que esta ronda passou o dia corrigindo. Card **`936eb605`** aberto pro
`coder` para classificar os 49 e propor um check que dê sinal útil — com o aviso
de que `feat/fix-image-upload-retry` e `feat/onedrive-401` são **não-mergear**
documentados e derrubam fix que está no ar.

É problema pré-existente, não criado por esta ronda.

## Estado final

Um incidente trabalhado até onde dava: **causa medida, registro falso
corrigido, card aberto, aluno avisado com a verdade**. Não fechado — porque não
está resolvido, e o que falta depende de uma decisão de dependência que não é
minha.

O achado que vale para além deste caso: **`resolution_note` afirmando "está
corrigido" não é prova.** Aqui, uma nota de 28/08 afirmou por cima de outra
nota, do mesmo dia, que honestamente dizia não ter medido. Se eu tivesse
herdado a frase, o #171 teria sido fechado e o aluno seguiria sem entender por
que o avatar dele não importa.
