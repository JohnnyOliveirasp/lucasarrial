# Ronda das falhas — 06/09/2026 ~00:40–01:40Z (Frank, dono da fila)

Fila no início: **18 abertos + 13 aguardando aluno**. No fim: **18 + 13** —
**nenhum fechado**, e isso é o resultado honesto desta ronda, não uma desculpa.

**O que esta ronda entregou: matei uma hipótese errada antes que ela virasse
código.** O próximo passo que a ronda anterior deixou engatilhado para o **#15**
era *alargar a régua do timeout*. Medi antes de mexer: a régua não é a causa, e
alargá-la teria feito job pendurado queimar mais GPU e o aluno esperar mais,
sem salvar nenhuma das 5 falhas. Não alarguei.

---

## 1. `gh pr list` primeiro — nona ronda seguida em que paga

20 PRs abertos. Nenhum mergeado nesta janela, nenhum novo meu. O **#90**
(telemetria de fase, do próprio #15) está aberto há **8 dias** — não é bloqueio
do #15 hoje (ver item 3), mas é fix parado em branch, que é a classe que já
custou 9h em 19/08. Registro para não sumir.

## 2. Vídeo Clone continua de pé — conferido, não herdado

Régua da ronda anterior: geração `ready` no dia. Medido em `video_clones`, 8h:

| status | n | última |
|---|---|---|
| ready | 4 | **06/09 00:31:26Z** |
| generating | 1 | 00:41:13Z (em voo) |
| failed | 19 | **05/09 23:12:19Z** |

A última falha é **anterior** ao fim da build (23:15:50Z). **Zero falhas depois
do fix.** Apagão encerrado e continua encerrado.

## 3. O card da vez: **#15** (`d3d8d1b2`) — o mais antigo com aluno afetado

Escolhido pela regra 8 (mais antigo com aluno afetado): 30/07, 19 ocorrências,
18 alunos.

### 3.1 Refutei a conclusão da minha própria ronda anterior

A nota de 05/09 11:50Z concluiu *"a régua tem viés sistemático"* — a margem no
piso de 480s seria de 20s, menor que o setup medido. **O erro é de banda.**
Aquela conta comparou o **pior work global** (479,6s) contra o **piso de 480s**.
Mas o piso só se aplica a texto **curto** (`tlen<=960`); o job de 479,6s é de
texto **longo**, cujo teto é ~666–750s. Nenhum job de 480s de trabalho roda com
teto de 480s.

Remedido, **1.407 gerações `ready` em 20 dias, separadas por banda**:

| banda | n | pior work | p99 | mediana | teto | folga |
|---|---|---|---|---|---|---|
| piso (`tlen<=960`) | 1033 | 285,8s | 194,7s | 70,0s | 480s | **194s** |
| 1100–1500 chars | 157 | 410,2s | 382,9s | 125,9s | 570s | **160s** |
| teto calculado | 374 | 479,6s | 404,3s | 128,9s | até 750s | folgada |

Setup remedido com **24 amostras** (a nota anterior tinha 6): média **52,3s**,
p95 **99,7s**, máx **106,3s**.

**O cruzamento que fecha o assunto:** gerações `ready` que morreriam se eu
descontasse o setup **máximo** (106,3s) do teto delas = **0 de 1.407**. Com o
setup médio = **0**. A régua não está apertada em banda nenhuma.

### 3.2 As 5 falhas são todas a MESMA classe — hang

Cada uma estoura o pior caso **legítimo da própria banda**:

| quando | tlen | teto | elapsed | banda diz | fase |
|---|---|---|---|---|---|
| 24/08 15:49 | 79 | 480 | 492,1 | mediana 70s | — |
| 24/08 20:05 | 895 | 480 | 483,0 | pior 285,8s | — |
| 28/08 18:16 | 208 | 480 | 491,6 | mediana 70s | — |
| 04/09 20:36 | 1304 | 570 | 579,0 | pior 410,2s | `inference.chunk.generate running_s=4,9` |
| 04/09 20:47 | 751 | 480 | 484,8 | pior 285,8s | `(sem fase instrumentada)` |

**A classe (B) "orçamento estourado andando" não existe.** O de 1304 chars foi
lido como *"estava avançando, mais teto o salvaria"* — errado: 579s para
trabalho cuja mediana é 125,9s e pior caso é 410,2s significa ~4,6× mais lento
**por chunk**, de forma uniforme. Isso é worker degradado, não orçamento curto.
`running_s=4,9` é o retrato do instante, não a saúde do job.

**Confirmação independente que já estava no repo e ninguém tinha cruzado:** o
cabeçalho do `reenviar.ts` (28/08) mede a mesma coisa por outro caminho — *"média
de 619 chars nos timeouts contra 626 do geral. **Não é régua: é worker
travado**"*. Duas medições independentes, mesma conclusão.

### 3.3 Achado novo: o reenvio automático disparou e TAMBÉM falhou

`request_attempts=2` nos **dois** casos de 04/09 (os outros 6 são anteriores à
feature). Ou seja o original **e** o reenvio estouraram, com 11 min entre os dois
casos. A mitigação (#89) cobre hang **pontual**; não cobre **janela** de endpoint
degradado. É limite conhecido do desenho (`MAX_ENVIOS=2`), não defeito dele.

### 3.4 O dinheiro está limpo

Conferido pelo **ledger**, por `ref_type='generation_refund'` (nunca por `kind`
— armadilha medida): os **8** timeouts dos últimos 20 dias estão **100%
estornados**, débito e estorno batendo exatamente, um a um (749/749, 1307/1307,
400/400, 906/906, 400/400, 400/400, 456/456, 1620/1620). **Ninguém perdeu
crédito.**

Entrega: 7 dos 8 nunca tiveram o mesmo texto refeito com sucesso; só o
`44227a0c` saiu `ready` 12 min depois. Estão estornados e podem refazer — o caso
de 28/08 refez sozinho em 9 min e saiu em 89s.

### 3.5 Onde travou, e é o mesmo passo de ontem

**Migration 82 segue NÃO aplicada** — reconferido hoje pelo `information_schema`:
`generations.delay_seconds` e `generations.execution_seconds` **não existem**.
Sem elas não dá para separar *"cold start / nunca rodou"* de *"hang do worker"*,
que agora é a **única** pergunta aberta do card. Migration depende do aval do
Johnny; **não aplico**.

Continua `investigating` **com nota do que foi descartado**: régua apertada
(medido hoje, 2 caminhos), tamanho de texto (medido em 28/08) e a classe (B).
Sobra worker/endpoint degradado.

## 4. #254 — corrigi um título FALSO que me custou meia ronda

O título anunciava *"SOLON é cobrado de novo em 06/09 12h"*. Isso deixou de ser
verdade em **05/09 12:38:43Z**, quando `POTX6UYJ` foi cancelado — a nota registrou,
o título não. **Abri esta ronda tratando o card como emergência**, porque a regra
8 só deixa furar a fila por *"dinheiro sendo cobrado errado agora"* e o título
prometia exatamente isso com ~11h de prazo.

Reconferido na fonte antes de mexer: `POTX6UYJ` = **canceled**; `IJA1SHDQ` =
active até 13/09. Título corrigido (1 linha, conferida por `RETURNING`).

**Título com data vencida é alarme falso, e alarme falso gasta a ronda que outro
aluno precisava.** Lição da ronda: quando a perna com data morre, o título morre
junto — não basta anotar.

## 5. O relógio que de fato existe: **DIEGO, 08/09 12:00Z, R$194**

| entitlement | conta | até | órfã? |
|---|---|---|---|
| `MYEXXEMA` | sendzapoficial@gmail.com | 08/09 12:00 | não |
| `4UKYMN4L` | admin@ag12x.com.br | 08/09 12:00 | **sim** (`user_id` NULL) |

As duas renovam juntas → **R$194 em dobro em ~59h**. Conferi as **duas** caixas:
**sem resposta** desde 04/09 21:50Z (uids 1037/1038), ~27h.

**Não cancelei:** sem pedido escrito do titular a **9-C** não autoriza. É a mesma
trava que no Neto custou o prazo — a diferença é que aqui ainda há folga.
**Lembrete devido 07/09** (regra dos ~3 dias). Se ele não responder até ~08/09
09hZ, a decisão de cancelar sem pedido escrito é do Johnny e tem que ser levada
**antes** do prazo, não depois.

⚠️ `4UKYMN4L` é **órfã**, e o `cancelar_assinatura.cjs` **recusa** cancelar por
e-mail em órfã. Quem executar vai pelo code ou pelo `--orfa`. Não descobrir na
hora H.

## 6. Dívida das dependências — medida, e é MAIOR do que estava escrito

O handoff dizia *"`accelerate`, `diffusers` e `peft` com `>=` e sem teto"*. Fui
ler o `requirements.txt` do `WanVideoWrapper@088128b22424` (o commit que o nosso
Dockerfile fixa). São **onze**, não três:

- **`>=` sem teto (5):** `accelerate>=1.2.1`, `diffusers>=0.33.0`, `peft>=0.17.0`,
  `sentencepiece>=0.2.0`, `gguf>=0.17.1`
- **sem restrição NENHUMA (6):** `ftfy`, `einops`, `protobuf`, `pyloudnorm`,
  `opencv-python`, `scipy`

O `#192` pinou `transformers==5.14.1` **e** deixou um smoke que quebra a build se
o contrato do nó 194 sumir — isso está certo e de pé. Mas o mecanismo que
derrubou o Vídeo Clone por 12h (rebuild re-resolve dependência transitiva para a
última versão) **continua aberto para as outras onze**.

**Por que eu NÃO abri PR pinando:** não tenho as versões *sabidamente boas* da
imagem que está rodando, e pinar versão chutada pode quebrar o que hoje funciona
— o oposto do objetivo. O caminho seguro é capturar um `pip freeze` da imagem
boa e pinar contra ele. Levado ao grupo como próximo PR, com o método junto.

## 7. Próxima ronda começa por aqui

1. **`gh pr list` primeiro.** Nona seguida em que paga.
2. **DIEGO 08/09 12:00Z (R$194)** — lembrete devido **07/09**. É o único relógio
   vivo da fila. Se passar sem resposta, é decisão do Johnny **antes** do prazo.
3. **#15 está bloqueado na migration 82**, não em investigação. Régua está
   **descartada e medida** — quem reabrir precisa de dado novo, não de releitura.
4. **Dívida das 11 dependências** (item 6): capturar `pip freeze` da imagem boa
   **antes** de pinar. Pinar no chute é pior que não pinar.
5. **Os 9 alunos do apagão** seguem sem aviso de que o Vídeo Clone voltou —
   depende do "pode" do Johnny (é rajada, regra 8). Perguntado em 05/09, **sem
   resposta até agora**. Não deixar morrer.
6. Parados com o Johnny: migration 82 (`#15`), renovação-reabre-garantia
   (`#265`), proposta do Jackson (`#254`/`#247`).

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início. Fila lida
pela varredura, **não** pela caixa do `suporte@` (ordem de 19/08); as únicas
leituras de caixa foram `--de` nos dois endereços do Diego, em `EXAMINE`/`PEEK`.
Estorno em dia (10 tipos, 2.854 linhas, nenhum tipo desconhecido). **2 gravações**
via `anotar_incidente.cjs` (#15 e #254), **ambas conferidas na releitura em 1
linha afetada**, mais 1 `UPDATE` de título conferido por `RETURNING`. Nada da
planilha foi lido, escrito ou reprocessado (ordem de 29/08). **Não** mergeei PR,
**não** apliquei migration, **não** mexi em crédito, **não** estornei, **não**
escrevi para aluno, **não** gastei GPU e **não** alarguei a régua. Aviso no grupo
pelo `notify-grupo.sh` (ordem de 31/08); nada no privado. Só este log vai direto
na main.
