# Rotina das falhas — 01/09/2026, ~22hZ (19h BRT)

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`,
`2026-08-29_desligar_vigia_e_frank.md` (li INTEIRA, não só o resumo — o nome do
arquivo diz "desligar o Frank" e eu não ia agir com base no título), ordem de
canal de 31/08 (tudo do FastCloner vai no GRUPO), `2026-08-20_dono_da_fila`.
Método serial (regra 8, 21/08).

Placar de entrada, consulta **sem cláusula de status**: **19 não-fechados**
(2 open + 10 investigating + 7 `aguardando_aluno`). Mesmo número da ronda das
19h45Z, composição diferente: o `#227` saiu, entrou o `#229` às 20:50Z.

## O incidente que peguei: `#222` / `3ca22d47`

**Por que este e não o mais antigo do relógio.** Varri a fila inteira antes de
escolher e os mais velhos **não estavam no meu colo**: `#99`, `#197`, `#206`,
`#207`, `#214`, `#218` em `aguardando_aluno`; `#171`/`#172` parados em decisão de
arquitetura do Johnny; `#173` em decisão comercial dele; `#192` e `#202`
conferidos um por um nesta ronda (abaixo) e ambos já respondidos, esperando
terceiros. O `#222` era o único `open` com **gente pagante presa agora** e com
janela vencendo — e a própria nota dele dizia, com todas as letras, que
destravar os três **não dependia de ninguém**. Estava aberto desde 15h54Z e
ninguém tinha falado com eles.

### Conferi antes de escrever, em vez de herdar a nota das 21h11Z

- Os 5 entitlements órfãos seguem `user_id NULL` / `active` **agora**. Nada se
  resolveu sozinho.
- Estado real das 3 contas por `aluno.cjs`: `ftfranzolin@gmail.com` SEM ACESSO,
  0 cr; `cdmarciofernandes@gmail.com` SEM ACESSO, 0 cr; `diretoria@grupoperes.com.br`
  SEM ACESSO, 11.650 cr, compra 18/08 `canceled`.
- Os 3 e-mails **de compra** continuam sem `profile` nenhum → confirma que o
  caminho é **criar conta**, e que o botão de recovery-link não serviria.
- `ler_caixa.cjs --enviados --para` cada um: **vazio nos três**. Ninguém tinha
  escrito. (A busca também cobre o `enviados_local.jsonl`, então não houve envio
  silencioso.)

### A promessa foi verificada no código ANTES de eu fazê-la a três pessoas

Eu ia mandar três alunos criarem conta com base numa frase de nota alheia
("o acesso e os créditos caem sozinhos"). Fui ler. `claimPurchasesOnLogin()` é
chamado em `app/layout.tsx:43` com `claimEmail = profile.email`, e roda pra
**qualquer** usuário sem plano — não só no `/auth/callback` do OAuth. Ou seja
conta nova por e-mail+senha **também** dispara o resgate; ele liga o órfão e
concede a recarga do ciclo, com dupla chave (assinante + transação) pra não
creditar duas vezes. A promessa está verificada no código, além do precedente
do `#27` e `#36`.

### Entregue

Três e-mails individuais, sem BCC, **cópia CONFIRMADA em Enviados**:

| aluno | uid | o que pedi | janela paga |
|---|---|---|---|
| Fernanda Franzolin | 433 | criar conta com `fnfranzolin@hotmail.com` | 11/09 |
| Marcio Fernandes | 434 | criar conta com `cdmarciofernandes@hotmail.com` | 10/09 |
| Jesus Peres | 435 | criar conta com `iehudaperes@grupoperes.com.br` | 18/09 |

Nos três eu disse que **a culpa não é deles**, que **não precisam pagar de
novo**, e que **"esqueci minha senha" NÃO funciona** nesse e-mail — que era a
armadilha óbvia de quem lê rápido e desiste achando que o sistema está quebrado.

**No caso do Jesus eu abri o incômodo em vez de escondê-lo.** Ele é o único dos
três que já usou a plataforma: tem 11.650 créditos parados e imagens/vídeos
gerados em agosto, e **nada disso migra** pra conta nova. Falei isso no e-mail.
Descobrir sozinho depois de criar a conta seria a segunda decepção dele em uma
semana — está sem acesso desde 25/08 porque **pagou de novo** e a assinatura
nova caiu num e-mail sem conta. Ofereci levar o caso pra decisão interna, sem
prometer prazo.

**O que eu não prometi, de propósito:** transferência da assinatura pro e-mail
preferido, e prazo do conserto de fundo. Ambos proibidos pela nota anterior.

**Status: `aguardando_aluno`, não `fixed`.** O que dependia de nós está feito.
Não marquei `fixed` porque a **classe** continua viva: é a 6ª volta dela
(`#20`, `#27`, `#36`, `#195`, `#218`) e o casamento continua sendo só-por-e-mail.
Não vinculei órfão na mão — segue proibido enquanto `grantAccess()` puder
sobrescrever `user_id` não-nulo com NULL no próximo evento da Hotmart.

## Segundo alvo: `#226` — medi por que a decisão está impossível

O chamado termina dizendo, com razão, que a escolha (falhar / avisar / entregar
em silêncio) é de produto. Só que ela está sendo pedida ao Johnny **sem o dado
que a decide** — a própria descrição registra *"NÃO gradue por severidade sem
medir: eu não medi caso a caso"*. Sem severidade a pergunta vira "derrubar 44%
das entregas ou não", que ninguém consegue responder. Fui atrás da severidade.

**Achado principal — é defeito de telemetria, não falta de esforço.** Em
`loop.py:341-342`, no exato momento em que desiste, o código faz
`_log("error", "inference.qa.exhausted", idx=idx, best_score=best_score)` e
`qa_stats["exhausted"] += 1`. O `best_score` **é** a gravidade do pedaço que vai
pro aluno: é calculado, jogado no log e **descartado**. O que sobrevive no banco
é um `+1` sem gravidade nenhuma. A única coisa que responderia à pergunta do
produto é computada e perdida na mesma linha.

**Armadilha do zero, pega antes de virar conclusão.** O campo
`coverage_exhausted` dá **0 nas 296**, e a leitura óbvia seria "nenhuma entrega
esgotou por palavra faltando, então é leve". É **falso**: ele nem existe em
`loop.py` — quem incrementa é `inference.py:381`, num caminho diferente que dá
`return` e **faz o job falhar**. Entre `status='ready'` ele é 0 **por
construção**. Quase virou "medi e está leve".

**O que dá pra dizer com honestidade:** são **296** agora, não 290 (subiu 6
desde 17h52Z — segue acontecendo). Dos 296, só **1** não teve nenhum defeito
grave em nenhuma tentativa. Isso **não** prova que as outras 295 foram entregues
quebradas — os contadores somam tentativas de todos os chunks, inclusive as que
o regen consertou, então servem como **teto, nunca como veredito**. Está provado
que **não está provado que é leve**, e nada além disso.

**O conserto que destrava (telemetria pura, não é a decisão de produto):**
persistir o `best_score` do chunk esgotado no `qa_stats`. Não falha job, não
avisa aluno, não cobra diferente, não toca em crédito — só para de jogar o
número fora. Com ele, em poucos dias dá pra dizer "X% são ritmo (12 pts), Y% são
palavra faltando (100+)" e a escolha vira óbvia.

**Por que NÃO subi esse fix agora.** É no `runpod-worker` (Python, imagem
própria). Buildar a imagem **não prova** que o endpoint do RunPod passou a
servi-la, e eu não teria como provar hoje que está rodando. É exatamente a
armadilha do PR #135 **neste mesmo projeto**: módulo mergeado, testado, deploy
verde e **morto** em produção, enquanto o aluno recebia e-mail dizendo que
estava corrigido. Prefiro entregar um achado provado a um fix não provado.

## Conferidos e devolvidos (não eram meus)

- **`#192` (Robert)** — o e-mail dizendo que a correção está no ar já foi (uid
  406) e ele já gerou depois disso. Espera resposta dele + ouvido humano no
  timbre + decisão do Johnny sobre os 10.000. **Mas registrei um risco com
  data:** o acesso dele vence **03/09**, dois dias, e nós pedimos por escrito
  que ele fizesse um teste pra nós. Perder o acesso no meio de um favor que está
  prestando seria injusto e mataria justamente a resposta que destrava o timbre.
- **`#202` (Vinicius)** — a correção ("as suas compras existem sim, o erro foi
  nosso") foi enviada em 31/08 (uid 388). Trava agora em decisão **comercial**
  do Johnny: ele comprou R$ 2.697,60 em cursos, que não são assinatura do
  FastCloner.

## Erro meu, e como apareceu

A primeira gravação da nota do `#226` saiu com uma palavra comida: usei crase
dentro de aspas duplas no shell e o bash executou `` `return` `` como
substituição de comando. **Achei porque confiro o texto que o banco devolve
depois de gravar**, não porque o script reclamou — ele gravou com sucesso um
texto corrompido. Gravei errata no próprio incidente. Fica a lição: em nota
longa, aspas simples e nada de crase.

## Perímetro da ordem de 29/08

Nada de planilha foi lido, escrito, classificado, avisado ou reprocessado.
Nenhum incidente de planilha foi aberto ou reaberto.

## Dinheiro

Nada estornado, nada cobrado, nada liberado, nenhuma cortesia criada, nenhum
órfão vinculado na mão. Duas pendências de dinheiro **apontadas ao Johnny, não
decididas por mim**: (1) Jackson e Gabriela com duas assinaturas ativas
simultâneas cada um — possível pagamento em dobro; (2) o débito de -10.000 do
treino do Robert, sem estorno.

## Passo fixo de fim de ronda

`git fetch origin` + `git log --oneline origin/main..HEAD` **vazio**. Nenhum
branch novo criado nesta ronda (não houve código). Nenhum fix preso em branch.

## Estado final, sem maquiagem

**Três alunos pagantes que estavam presos fora da própria conta, e que não
sabiam disso, foram encontrados e avisados antes de perderem a janela** — o
único item da fila que dependia só de nós. Um segundo incidente teve a pergunta
travada diagnosticada: a decisão do Johnny está bloqueada por um número que o
código calcula e joga fora, e o conserto disso está especificado e é de risco
zero. Nenhum incidente foi marcado `fixed` — porque nenhum dos dois foi
resolvido, e `fixed` sem resolver é o que a regra 14 proíbe.

**A fila não baixou nesta ronda, e isso é resposta legítima e não desculpa:**
dos 19 não-fechados, **10** estão parados esperando decisão do Johnny ou ouvido
humano, não trabalho técnico. Está tudo escrito e datado nos incidentes.
