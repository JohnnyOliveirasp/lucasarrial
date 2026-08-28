# Rotina das Falhas — 28/08/2026, 12h UTC (Executor, dono da fila)

Serial (regra 8): peguei **UM** incidente e fui até o fim do que estava no meu
colo. Incidente **#166** (`9dc59356`) — Vídeo Clone que não reproduz nem baixa.
Aluno **Amaro** (`novaeraperformance@gmail.com`), plano **pro**, acesso até 02/09.

## Por que o #166, e não o mais velho

Não é o mais antigo da fila, e a escolha é deliberada: **ele já estava aberto no
meu colo, escrito e não commitado**. A ronda anterior parou no meio dele (3
arquivos modificados, 163 linhas, mtime 11:52–11:53Z) e o Vigia registrou às 12h
que o `git checkout main` dele me arrancou da branch.

**O meu próprio `git checkout main` de abertura fez exatamente a mesma coisa de
novo**, nesta ronda: o reflog mostra `moving from fix/inc166-url-presignada-expirada
to main` com as 3 modificações vindo junto. Se eu tivesse commitado sem olhar, o
conserto caía **direto na main**. Devolvi a árvore para a branch antes de tocar
em qualquer coisa. A causa que o Vigia apontou (mesma árvore de trabalho, ordem
de abertura que troca de branch incondicionalmente) **é real e me pegou na
primeira oportunidade** — não é hipótese dele.

Abandonar um conserto meio-escrito para começar outro incidente seria deixar
código solto na main **e** deixar um pagante esperando com o defeito de pé.

## O que eu herdei — e o que derrubei

Na fila havia **duas hipóteses concorrentes**, e elas não podiam ser as duas:

| hipótese | de quem | veredito |
|---|---|---|
| o MP4 nunca foi gravado; `finalize.ts` marca `ready` sem conferir o R2 | patch do Vigia (`patch_9dc59356`) | **DERRUBADA** — os arquivos existem |
| link presignado de 1h vencido, tela não renova | ronda anterior | **CONFIRMADA**, com uma correção |

O patch do Vigia **não foi aplicado**. Ele fecha um buraco de verdade (COMPLETED
sem arquivo), mas não é este caso, e tem risco de marcar clone bom como `failed`.

## O que eu medi (não inferi)

Contra o objeto real no R2, e com o **`Origin` de produção**
(`https://aiverse.jcsolutionsus.com`) — que é precisamente o que o Vigia declarou
honestamente **não** ter conferido:

| medição | resultado |
|---|---|
| os 2 MP4 do aluno | **íntegros** — H.264 High + AAC LC, 480x832, 76,37s / 77,16s, 11.035.200 B e 8.487.892 B |
| conteúdo do vídeo | frame do meio extraído e **olhado**: vídeo renderizado normal, homem falando ao microfone |
| URL recém-assinada | **206** `video/mp4`, **COM** `access-control-allow-origin` |
| URL vencida | **403 ExpiredRequest**, XML de 118 bytes, **SEM** o cabeçalho de CORS |
| chave inexistente | **404**, **COM** o cabeçalho de CORS |

### O erro de medição que eu cometi no caminho, e que corrigi

Minha primeira leitura de CORS deu `access-control-allow-origin: null` **também
na resposta 206 boa**, e por um momento isso parecia dizer que o bucket não tinha
CORS nenhum. Estava errado: eu tinha **chutado o domínio** (`app.lucasarrial.com`).
Com o Origin **real**, o 206 e o 404 trazem o cabeçalho normalmente. Fica
registrado porque a conclusão errada estava a um passo de virar achado: *medir
com o parâmetro errado devolve um número de verdade sobre uma pergunta falsa.*

## A causa, e por que os dois botões morriam JUNTOS

`video_url` é assinada com validade de **1 hora** (`video-clone/route.ts:52` e
`[id]/route.ts`) e a tela guardava a URL em estado **sem nunca renovar**. Aba
aberta há mais de uma hora — ou render de 20–35 min seguido de aba em segundo
plano — chega no clique com o link morto.

São **dois** modos de falha, com comportamentos **diferentes** no browser, e o
código antigo não cobria direito nenhum dos dois:

1. **Vencido (403 sem CORS)** → a assinatura é recusada **antes** da camada de
   CORS, o cabeçalho não vem, e por isso o `fetch` **lança** `TypeError`. O
   código caía no `catch` → `window.open` **depois de um `await`**, fora do gesto
   do usuário → morto pelo bloqueador de popup. Para o aluno: **clicar em baixar
   e não acontecer nada**.
2. **Ausente (404 com CORS)** → a resposta é legível, e o código chamava
   `res.blob()` **sem olhar o status**: gravava o XML de erro no disco como
   `<nome>.mp4` — um "download" que aparentava dar certo.

O `catch` sozinho cobria só o (1); o `res.ok` sozinho cobria só o (2).

**Corrigi a documentação do próprio patch por causa disto.** O comentário que a
ronda anterior deixou atribuía os **dois** efeitos ao 403 — dizia que o XML era
gravado como `.mp4` no caso vencido. Não é: no 403 o `fetch` nem chega ao
`res.blob()`. Comentário de código aqui é memória institucional; afirmação
"medida" que está errada é pior do que comentário nenhum.

## O que subiu — e o que NÃO subiu

**Commit `50303eb`**, branch `fix/inc166-url-presignada-expirada`, **PR #80
ABERTO** com base `main`. **Não mergeado.**

`downloadFromUrl` passa a checar `res.ok` e aceita um parâmetro `refresh`
opcional; o `<video>` ganha `onError`; ambos pedem URL nova ao
`GET /api/v1/video-clone/[id]` (que **já** devolve `video_url` presignada — contrato
conferido lendo a rota, não suposto) e tentam de novo **uma** vez. `key={video_url}`
força o remount, porque trocar só o `src` não refaz o carregamento. Renovação
**única** por clone/job: renovar a cada `onError` viraria laço infinito — o
remédio virando defeito.

**Verificação:** `tsc --noEmit` 0 erros; `eslint` 0 avisos nos 3 arquivos; e,
como o frontend **não tem test runner** (conferido no `package.json` — os 176
testes citados em rondas anteriores são do worker Python), exercitei os **4
caminhos** do `downloadFromUrl` contra o **TS real transpilado**, sem mock do
módulo sob teste: link válido; 403 que lança + refresh que salva; 404 que não
pode virar arquivo; refresh que também falha e **não** entra em laço. **Todos
passando.** Scripts em `_Bugs/inc166/` (pasta é gitignorada — é rascunho, não
entrega).

## O aluno — atendido AGORA, sem esperar deploy

Isto é o que a regra 8 chama de fim, e é a parte que não depende de aval nenhum.

E-mail enviado **12:51Z** para `novaeraperformance@gmail.com` (endereço conferido
no banco antes de mandar — a armadilha do Cláudio, endereço errado é entregue sem
bounce), bcc `suporte@lucasarrial.com`, ensaiado em `--dry-run` antes:

- que **o erro foi nosso**, não dele;
- que os **dois vídeos estão inteiros** — nada se perdeu;
- **os dois links de download direto**, válidos por 7 dias, conferidos um a um
  (**206** + `content-disposition: attachment`) antes de entrarem no e-mail;
- a **contorna imediata** no app: recarregar a página gera link novo.

Peguei uma inconsistência no ensaio: o remetente é `Fast - FastCloner
<suporte@fastcloner.com>` e eu havia assinado "Equipe Lucas Arrial". Corrigido
antes do envio.

**Crédito: não há estorno devido.** `credit_transactions` mostra
`ref_type='video_clone'` `29d5ebaa` **−6.160** e `e84dc74b` **−8.085** =
**14.245 cr**, e os dois vídeos **foram entregues e estão intactos**. Conferido
que não há estorno duplicado pela régua certa (`ref_type='generation_refund'`,
**nunca** por `kind`). **Não toquei em crédito.**

## Em que passo travou — um passo só

**Merge do PR #80.** Só a `main` deploya, e eu não mergeio (mesmo tratamento dos
outros 21 PRs abertos).

Por isso o incidente está **`fixing`**, não `fixed`. Marcar `fixed` agora seria
o **"done falso"** de 19/08: o próximo aluno bate no mesmo defeito com o chamado
dizendo "resolvido". O aluno **desta** ocorrência está servido; a **classe** só
fecha no merge. Status honesto para "conserto escrito, aluno atendido, produção
ainda não" é `fixing` — e ele existe no `STATUS_VALIDOS` da ferramenta.

## Limite do escopo, declarado em vez de escondido

A checagem de `res.ok` cura **todos** os chamadores de `downloadFromUrl` (estúdio,
edição, react, imagens) contra o modo (2). A **renovação automática só foi ligada
no Vídeo Clone** — as outras **9 telas** que chamam `downloadFromUrl` seguem com a
mesma classe de link de 1h não renovado. Não ampliei o escopo sozinho num
conserto que precisa subir para um aluno que está esperando; fica registrado
como classe conhecida, não como coisa resolvida.

## Grupo (regra 7)

Uma linha, fato consumado — escrevi para um aluno: msg 525. Sem log de terminal,
sem progresso parcial.

## Estado da fila no fim

17 incidentes não fechados: 8 `investigating`, 8 `aguardando_aluno`, 1 `open`,
mais o **#166 em `fixing`**. Não fechei nem reabri nenhum outro. Não apliquei
migration, não mergeei PR, não gastei GPU, não toquei em crédito de ninguém.

## Recado de processo (não vira chamado — 14-C)

1. **A troca de branch na abertura da ronda me pegou de verdade hoje**, no meu
   primeiro comando, exatamente como o Vigia previu às 12h. Enquanto Vigia e
   Executor dividirem a mesma árvore, isso repete a cada ronda — e uma hora
   alguém commita o conserto do outro na main sem perceber. `git worktree`
   separado resolve; é decisão do Johnny.
2. **22 PRs abertos** (21 + o #80 de hoje), o mais velho de 18/08. Mais uma
   ronda em que o passo que falta não é achar o defeito: é o merge.
