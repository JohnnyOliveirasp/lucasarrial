# Rotina das falhas — 01/09/2026, ~19h45Z

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`,
`2026-08-29_desligar_vigia_e_frank.md` (planilha fora do perímetro),
`2026-08-27_vigia_so_erro_de_sistema.md`, canal de 31/08 (grupo).
Método serial (regra 8, 21/08).

Placar de entrada, consulta **sem cláusula de status**: **19 não-fechados**
(1 open + 11 investigating + 7 `aguardando_aluno`). Era 18 às 18hZ; entrou o
`#227` (aluna perguntando sobre 7 dias de teste) às 19:39Z.

## O incidente que peguei

O mais antigo de fato **no meu colo** é o **`#171` / `fa0e9ca4`** — José
Ricardo, HeyGen, aberto 28/08 e **ainda disparando hoje** (14:53Z). O `#99` é
mais velho mas está `aguardando_aluno` com razão, e o `#173` segue travado em
decisão comercial do Johnny (6ª ronda pedindo). O `#172` é a mesma queixa deste
aluno pelo outro canal.

## A dúvida de 4 dias, fechada por medição em vez de dedução

Duas notas de 28/08 registraram, honestamente, que **ninguém tinha provado** que
o `/v1/asset` do HeyGen recusa `image/webp`. A ronda das 17hZ fechou a dúvida
**pela doc**, e o coder da PR #146 marcou a lacuna com todas as letras:
*"continua bloqueado está apoiado na doc, não em recusa observada"*.

Isso não era detalhe. O erro que o aluno viu —
`Content type not match image/jpeg != image/webp` — é **ambíguo**: lê-se tanto
como *"webp é proibido"* quanto como *"você mentiu o rótulo"*. Se fosse a
segunda, **a PR #146 estaria bloqueando gente que funcionaria**. Mergear em cima
da doc seria decidir no escuro sobre o caminho de um aluno pagante.

Medi contra o endpoint real (`_Bugs/medir_webp_heygen.cjs`, chave da casa, 4
imagens de 64×64; upload de asset não gera vídeo e **não queima crédito de
geração**):

| envio | resposta |
|---|---|
| PNG rotulado `image/png` | **200** — controle positivo |
| JPEG rotulado `image/jpeg` | **200** — controle positivo |
| **WebP rotulado `image/webp` (honesto)** | **400 `400543` `Content type not supported image/webp`** |
| WebP rotulado `image/jpeg` | 400 `400543` `Content type not match…` (reproduz o erro do aluno) |

Os **dois controles positivos existem de propósito**: sem eles, um 400 no webp
poderia ser chave ruim, endpoint mudado ou payload errado — e eu teria lido
falha de instrumento como resposta. E os dois casos de webp devolvem **mensagens
diferentes**, o que separa "formato proibido" de "rótulo divergente" sem
ambiguidade. **Resposta: o HeyGen recusa webp de verdade. A PR #146 está certa.**

### O caminho grátis que testei e eliminei

Se o CDN do HeyGen fizesse negociação de conteúdo, bastaria pedir PNG e não
haveria conversão nenhuma — nem dependência, nem schema. **Não faz.** O preview
do look é um objeto `.WEBP` em URL assinada; pedi com `Accept: image/png`,
`image/jpeg`, lista com `q=` e `*/*`, e as **quatro** devolveram `200` com
`content-type: image/webp` e os mesmos 408.608 bytes. A assinatura cobre o path,
então variante seria outro objeto. Não existe saída por header.

## Em produção

**PR #146 mergeada** — merge `c7e07ab`, commit `e95022a`, deploy
`33551296626` **SUCCESS** 19:47Z. Confirmado por `git merge-base --is-ancestor`
contra `origin/main` **depois** do fetch, não pela mensagem do `gh`.

**Verifiquei a PR eu mesmo antes de subir** — não herdei o "passou" do coder:
worktree sobre o branch, `tsc` exit 0, **14/14** no teste do helper. Conferi
também que a main tinha andado **2 commits** desde o branch e que **nenhum**
toca os arquivos da PR (merge limpo, não por sorte).

**O que a PR muda:** webp sai do `ACEITOS`, então a recusa passa a acontecer do
nosso lado, antes do upload, com mensagem que **dá saída** — e a saída depende da
origem, porque quem escolheu um look da conta HeyGen **não tem arquivo pra
trocar**, e ali "envie em JPG ou PNG" seria beco sem saída. Os **4** call sites
herdam do helper único (o card listava 3; `react/gerar.ts:250` faltava). Conferi
que o helper **não é usado fora do caminho HeyGen**: webp segue válido em todo o
resto do produto.

**Não há regressão, e agora isso está medido e não suposto:** todo webp que passa
a ser recusado localmente **já era** recusado pelo `/v1/asset` com `400543`. Muda
**quando** e **com que texto**, não **quem** passa.

**O defeito real que isso mata:** até hoje a nossa própria mensagem de erro
mandava o aluno *"Envie em JPG, PNG ou WebP"*. Estávamos **recomendando
ativamente** o formato que o HeyGen recusa — quem obedecesse a tela tomava outro
erro.

## O que isso NÃO resolve — e por que não marquei `fixed`

O José Ricardo **continua sem usar o avatar importado** da própria conta HeyGen.
O erro ficou claro e o workaround (PNG manual, que ele mesmo descobriu) segue
valendo e não custa nada — mas o caminho `heygen_look` nunca rodou com sucesso em
produção, por ninguém, e continua assim. Fechar aqui seria `fixed` sem ter
resolvido.

**Decisão do Johnny**, agora com as duas opções medidas e a terceira eliminada:
**(a)** migrar `heygen_look` para `/v3/videos` (aceita `avatar_id`, não sobe
imagem, **sem dependência** — mas tem status próprio, e o nosso poll é
`/v1/video_status.get` cravado sem coluna de versão em `heygen_videos`; migração
pela metade gera vídeo que **queima crédito HeyGen do aluno e nunca fecha**);
**(b)** declarar `sharp` e converter webp→png (pede aval);
**(c)** negociação de conteúdo — **eliminada hoje pela medição**.

## Aluno

**Não escrevi de novo, de propósito.** Ele foi respondido hoje às 16:46Z (uid
420) com exatamente a informação que **continua verdadeira**. O merge de agora
melhora a *mensagem de erro*; não muda nada que ele precise fazer. Segundo
e-mail em 3h para dizer "melhoramos um texto de erro" é o ruído que a ordem
manda evitar. O que ele espera é a decisão (a)/(b), que não é minha.

## Dinheiro

Nada a estornar neste incidente. Os caminhos do HeyGen não têm linha de débito
no nosso ledger — o crédito que ele gasta é o da conta HeyGen **dele**, que é
justamente por que o e-mail de hoje pediu que ele **não** ficasse testando.

## Segundo alvo: o aluno que a varredura acusa e que já está tratado

A varredura aponta `marcelopersonalthe32@gmail.com` — acesso vivo, 198.950
créditos, **sem voz há 22 dias**, sem incidente e aparentemente sem dono. Fui
atrás porque "aluno esperando vem antes da limpeza da fila".

**Já está tratado, e bem.** Três e-mails (uid 58 em 24/08, uid 182 em 27/08, uid
341 em 29/08). O de 29/08 fez o que era devido: em vez de esperar a resposta
dele, **escutaram o arquivo** em 8 pontos e confirmaram no ouvido que são duas
pessoas (consulta clínica, ~45/55), com os dois mínimos separados corretamente
(20 min de envio × 10 min de fala limpa) e **aviso do vencimento de 05/09**. O
estorno dos 10.000 saiu no mesmo minuto em 10/08, conferido por `ref_type`
(`voice_train_refund`), nunca por `kind`. **A bola é dele. Não há abandono.**

⚠️ **Registro pra próxima ronda não gastar tempo de novo:** ele vai continuar
aparecendo na varredura como "acesso vivo, com crédito e sem voz pronta" até
gravar de novo ou o acesso vencer. O sintoma é real, o caso não está aberto.

## Perímetro da ordem de 29/08

Nada de planilha foi lido, escrito, classificado ou reprocessado. O outro item
preso da varredura (`luanmarcal.com@gmail.com`, import de Drive falhado em
29/08) é **onboarding antigo por Drive** e está **fora do perímetro** por ordem
— não abri incidente e não reprocessei.

## Passo fixo de fim de ronda

`git fetch origin` + `git log --oneline origin/main..HEAD` **vazio**. A worktree
de verificação foi removida (`git worktree remove` + `prune`). O branch da PR foi
apagado no merge. **Nenhum fix ficou preso em branch.**
O check de 49 branches divergentes continua sendo ruído conhecido (card
`936eb605` **falhou**, segue sem dono útil).

## Estado final

Um incidente levado até o limite do que não depende de decisão alheia: **uma
dúvida de 4 dias fechada por medição com controle positivo, um caminho barato
testado e eliminado antes de virar proposta, um fix verificado por mim e posto em
produção com deploy verde, uma mensagem que enganava o aluno removida, e um
segundo aluno conferido e inocentado da fila.** Não fechado — porque o
desbloqueio real do José Ricardo é uma decisão de arquitetura que não é minha, e
`fixed` sem resolver é exatamente o que a regra 14 proíbe.
