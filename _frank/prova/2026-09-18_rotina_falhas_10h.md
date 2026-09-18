# 18/09 ~10hZ — Ronda das falhas (serial, dono da fila)

Uma entrega fechada até o aluno ter a coisa na mão. A causa raiz está medida e
com conserto escrito e testado, mas **não está em produção** — e isso vai dito
aqui como bloqueio declarado, não como pendência escondida.

## Card serial da ronda: #32 (`9119254c`) — aluno ENTREGUE, cartão SEGUE ABERTO

Peguei o #32 por ser **o mais antigo acionável com aluno afetado** (39,0d) e,
principalmente, por estar **disparando agora**: a 2ª ocorrência foi hoje às
**09:17Z**, uma hora e meia antes da ronda começar.

Não peguei o #15 (`d3d8d1b2`, 49,9d), que continua sendo o mais velho da fila,
pelo mesmo motivo registrado na ronda das 02hZ: os dois próximos passos dele
estão fora da minha mão (telemetria no PR #329 e uma decisão de produto do
Johnny). Dormente desde 04/09.

## O aluno

**Alexandre Scalzitti** (`derinsulanerjp@gmail.com`), pedido SGP `251b2b1e`.

Às 09:17Z o treino da voz dele morreu com `[Errno 28] No space left on device`.
O pedido foi para `falhou` — **estado sem saída**: os três caminhos de retreino
são fechados para o aluno (cabeçalho do `2026-09-15_retreinar_sgp.cjs`). A tela
dele dizia *"Você não precisa fazer nada: o retreino é por nossa conta"*, e ao
mesmo tempo o e-mail das 09:19Z pedia que **ele** respondesse para a casa
retomar. Duas mensagens contraditórias, e a segunda cobrando ação de quem não
tinha nada a fazer.

Ficou parado **1h30** até esta ronda passar por ali.

### O que o BANCO confirma depois de gravado

| o quê | antes | depois |
|---|---|---|
| voz `ac2d906f` | `failed` | **`ready`**, `trained_at` **10:53:58Z** |
| job de treino | `b76f9ec0` failed, 0s | `97c7e0b5` **completed, 295s** |
| pedido SGP `251b2b1e` | `falhou` | **`pronto`**, `voz_pronta_em` 10:53:59Z, `erro` limpo |
| `credit_transactions` por `ref_id` | 0 linhas | **0 linhas** |

O zero de crédito não é cego: ele tem **zero lançamento no livro-razão inteiro**,
nunca foi debitado por este treino nem por nada. Não há o que estornar. A GPU
saiu por conta da casa (`origem: "sgp"` não cobra — `deveCobrarOnboarding`).

### Aluno avisado

E-mail individual enviado, **cópia confirmada em Enviados (uid 2782)**:
desfazendo o pedido errado da manhã, dizendo que a falha foi nossa, que o áudio
dele estava perfeito (42min38s, bem acima do portão de 20min), que já está
pronto e que não custou crédito nenhum.

A casa também disparou sozinha o `sgp_voz_pronta` às 10:54:04Z.

## O instrumento que estava cego — e quase deixou o aluno parado

O resgate **não rodou de primeira**. O `2026-09-17_rearmar_voz_para_retreino.cjs`
recusou:

```
❌ NÃO REARMO:
   - último job sem trainer_stderr — causa CEGA, não rearmo às cegas
```

A causa **não era cega**. Estava escrita, em outra coluna. A falha tem duas
formas e o instrumento só enxergava uma:

| forma | `started_at` / `rc` / `stderr` | onde está a marca | exemplos |
|---|---|---|---|
| **A** — trainer subiu e morreu | rc=1, stderr 2000 chars | `trainer_stderr` | `bbf4b050` (Alberto, 17/09) |
| **B** — morreu **antes** do trainer | **todos NULL** | `error_message` cru | `b76f9ec0` (18/09), `76cdefc2` (10/08) |

**As duas ocorrências do #32 são da forma B** — ou seja, o instrumento era cego
justamente na classe para a qual ele foi escrito. A trava tinha razão de existir
(rearmar às cegas gasta GPU pra morrer igual); ela só olhava para o lugar errado.

Corrigido e **na main**: PR **#337**, merge **`9d157083`**. Varre as duas colunas
pela **mesma lista fechada** e diz em qual achou. O que não afrouxou: sem marca
nas duas, a recusa continua — `"trainer failed"` sozinho e material do aluno
seguem barrados, com teste em cada fronteira. **6/6 pass, 0 skipped**, incluindo
teste de **mutação** que roda a linha velha e exige que ela reprove a forma B.

## A causa raiz, medida no código

A faxina de disco existe desde 10/08 — **mas só no `finally`**. Ela conserta o
worker *depois*; o job que encontrou o disco cheio já morreu. Quem paga a
sujeira é sempre o aluno seguinte.

E o mais caro: **`handler.py:35` já lia o disco no `job.start` desde 10/08 e só
logava**. A medição existia. A ação, não.

Por que o `finally` sozinho não segura — três buracos no próprio código:

1. job SIGKILLado pelo `executionTimeout` (a classe do `d3d8d1b2`) **nunca chega
   no `finally`**: deixa a sujeira inteira e pula a faxina;
2. `purge_dir` engole toda exceção (`except Exception: continue`), então
   *"faxina rodou"* nunca significou *"liberou espaço"*;
3. container novo herda camada de imagem e cache que a faxina de outro worker
   jamais tocou.

### Hipótese descartada com número

*"Áudio grande enche o disco"* é **falso**. As três vítimas têm **2825s, 1218s e
1767s** — em torno ou **abaixo** da média de **2002s** de **666 treinos que
deram certo** em 30 dias, e muito abaixo do maior que passou (**8121s**). Não é
tamanho de material do aluno.

## Por que o cartão NÃO fechou (regra 14)

O conserto — faxina também na **entrada** do job — está escrito e testado no
**PR #338** (7/7 OK, com mutação). **Não está em produção, e não mergeei.**

Merge nessa branch dispara o build da imagem **e recicla o endpoint de produção**
(`workersMax 0` → N). É capacidade de GPU saindo do ar com aluno treinando ao
vivo — hoje houve treino às 09:31, 10:03, 10:30 e 10:53Z. Não é decisão que eu
tomo sozinho no meio do dia, e não é algo que eu verifique daqui como verifiquei
o frontend (md5 / BUILD_ID / pm2).

Vai como **pergunta ao Johnny no grupo**, com o caminho de verificação já
apontado: push na `dev` aponta o endpoint isolado `fast_cloner_TESTE_dev`, onde
nenhum aluno cai.

Registro que isto **repete o padrão que a ronda das 02hZ denunciou** (fix parado
em PR aberto). A diferença é que este está declarado, com dono da decisão e
próximo passo — não esquecido numa lista de 27.

### O teste pegou defeito na minha própria mudança

A faxina de entrada estava **sem `try/except`**: um erro nela mataria o job
*antes* de começar, trocando um defeito raro por um pior. Consertei o código,
não o teste.

## O mesmo ponto cego, agora num TERCEIRO instrumento (PR #335)

Na conferência de fim de ronda achei a branch `feat/trainer-disco-cheio` —
**PR #335, aberto desde 18/09 00:07Z**, escrito ontem para esta mesma classe:
tira o disco cheio do guarda-chuva cego do #11 e dá a ele causa
(`infra_disk`) e assinatura (`training:infra_disk:no-space`) próprias.

É trabalho bem feito. Mas **não aceitei o relato: rodei o código da branch**
contra as ocorrências reais do #32, num worktree descartável:

```
forma A — bbf4b050 (Alberto 17/09)
   causa: infra_disk    assinatura: training:infra_disk:no-space        ✅

forma B — b76f9ec0 (Alexandre 18/09, HOJE)
   causa: unknown       assinatura: training:unknown:[errno #] no space…  ❌

forma B — 76cdefc2 (10/08)
   causa: unknown       assinatura: training:unknown:[errno #] no space…  ❌
```

**As duas ocorrências registradas no #32 são da forma B.** O PR escrito para
este cartão não classifica nenhuma das duas — pelo mesmo motivo que travou meu
rearme hoje de manhã: `ehDiscoCheio()` lê **só** `trainer_stderr`, e na forma B
não existe stderr *por desenho*, porque o subprocess nunca chegou a existir.

É o **terceiro instrumento** com a mesma suposição — a de que toda falha de
treino passa pelo trainer. Não é coincidência, é um hábito da casa que vale
nomear: *"o texto está no traceback"* é verdade na forma A e se inverte na
forma B, onde a marca está no `error_message` curto e estável.

Não mergeei: fechar meio detector divide a classe em dois cartões (forma A
ganha um novo, forma B fica no antigo) e cria trabalho de reconciliação depois.
Deixei a medição comentada no PR, com a sugestão — a `ASSINATURA_DISCO_CHEIO`
já é constante, então basta o detector olhar as duas colunas para A e B caírem
no **mesmo** cartão, que é o certo: é uma causa só.

## Ritmo da classe: ela acelerou

3 ocorrências — 10/08, **17/09 21:27Z**, **18/09 09:17Z**. Duas em **13 horas**
depois de 38 dias limpos. Não é mais evento raro, e é por isso que ela virou o
card serial em vez de continuar dormindo.

## Contribuição medida no #438, sem pegar o cartão

O varredor de percepção apontou **1 card travado** (`#438`, 0,0d). Conferi:
é **falso positivo** do scanner — a frase que casou foi *"quem pegar precisa
olhar `auth.users.created_at`"*, que é **consulta SQL, não imagem, áudio ou
vídeo**. A classe de percepção segue de fato em **zero**.

Como a pergunta era respondível com uma consulta, respondi em vez de deixá-la
pendurada (ordem de 17/09: despacha ou declara o bloqueio real). A resposta é o
ramo ruim:

```
almaraujo13@gmail.com                  pedido 16/09 20:43Z · conta criada 17/09 21:27Z · sign_in NULL
luisrocha@mattosrochaadvogados.com.br  pedido 17/09 16:57Z · conta criada 17/09 17:18Z · sign_in NULL
```

`conta_ja_existia = FALSE` nos dois: **não** é o caso inocente de "a conta já
existia, não havia recovery a carimbar". São contas que a casa criou depois do
pedido e (pela medição do vigia, que não refiz) sem recovery nenhum. Ficaram
**sem chave alguma** — pior que os 536 do título, que ao menos receberam um
carimbo gasto cedo demais.

E um cruzamento que só aparece juntando os dois cartões: **`almaraujo13@gmail.com`
(Alberto Martins) bateu nos dois defeitos em 24h** — o treino dele morreu no
disco cheio às 17/09 21:27Z (`bbf4b050`, ele refez sozinho 2h depois) e a voz
está **`ready` desde 23:50Z**, mas ele **nunca conseguiu entrar pra ver**. São
causas diferentes e não juntei os cartões; registro porque, no lugar dele, o que
conta é a soma.

Não carimbei recovery pra ninguém: link de senha em massa é ação externa e
precisa do "pode" do Johnny. Fica como **candidato óbvio ao card serial da
próxima ronda**.

## Contagem da ronda

| medida | valor | instrumento |
|---|---|---|
| chamados abertos | **94** | `varredura_travados.cjs` |
| aguardando aluno | **32**, 12 com 7d+, mais velho **20d** | idem |
| itens presos | **0** | idem |
| travados em percepção | **0** (o 1 apontado é falso positivo, ver acima) | `percepcao_travada.cjs` |
| fechado sobre o próprio disparo | **1** (`#407`) | `varredura_travados.cjs` |
| fila de recados | 96 | `idade_incidentes.cjs` |

## Os três PRs desta classe, e o que falta em cada um

| PR | camada | estado | o que falta |
|---|---|---|---|
| **#337** | ferramenta de resgate | **na main** (`9d157083`) | nada — fechado |
| **#335** | classificação do chamado | aberto desde 18/09 00:07Z | detector também ler `error_message` (medido acima) |
| **#338** | worker: faxina na entrada | aberto hoje | Johnny decidir o momento do deploy (recicla GPU) |

## O que NÃO fiz

Não mergeei o #338 (motivo declarado acima, é pergunta ao Johnny) nem o #335
(está incompleto para a forma B, medido). Não toquei em
crédito, acesso, migration nem em voz de ninguém além do resgate do Alexandre.
Não carimbei recovery. Não mandei e-mail em massa.

Continuo sem atacar os **12 `aguardando_aluno` com 7d+** que pedem segunda
tentativa — dívida repetida da ronda anterior, declarada com número e idade em
vez de silêncio.

A única GPU gasta foi o retreino do Alexandre: 295s, por conta da casa, num
treino que ele já tinha pedido e que a casa tinha prometido refazer.
