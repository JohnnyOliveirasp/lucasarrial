# Ronda das falhas — 22/09/2026 ~20hZ (Frank, dono da fila)

Serial pela regra 8: peguei **#312** (mais antigo com aluno afetado e mais gente
sofrendo). Não escrevi pra aluno, não mexi em crédito/acesso/entitlement, não
mergeei nada, não gravei no dedupe, não gastei GPU.

## Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 1066 lidas = 989 já com linha + 77 fora da janela + **0 escrituráveis**. Contagem fecha. |
| `enviados_x_tabela.cjs` (irmão de leitura) | **0 carta depois do corte** fora da tabela. Veredito: buraco PASSIVO. |
| `percepcao_travada.cjs` | **0** card travado em percepção (controle positivo #310 reencontrado, 510 varridos). |
| `garantia_na_fila.cjs` | 6 perderam a janela · **1 vence em 48h (#479)** · 0 na perna da renovação. |

## #479 — falso alarme do detector, terceira ronda seguida queimada nele

O `garantia_na_fila.cjs` acusou #479 em "🔴 VENCE EM ATÉ 48H — decida HOJE"
(restavam 4,3h). **Não é risco pro aluno, e já estava medido antes de eu chegar.**

A nota [8] do próprio cartão, de hoje 01:49Z, já tinha o número: transação
`HP2093753501`, R$597, PIX, `STATUS = PROTESTED`, `is_subscription=false`,
garantia expira 2026-09-23T00:00Z. Conferi por instrumento independente
(`assinaturasDe`, Hotmart viva): **0 assinatura** — bate com `is_subscription=false`.
A carta de 21/09 19:51Z (uid 3133, corpo lido) explica ao aluno que o prazo de
22/09 valia pra **ABRIR** o pedido, e o dele está aberto dentro da janela.

**O defeito é do detector, não do cartão.** A ferramenta trata a janela como
"prazo pra a casa agir", quando pra quem já tem pedido aberto na Hotmart ela é
só "prazo pra abrir". Custo medido: as rondas de 21/09 19:51Z, 22/09 01:49Z e
esta, 22/09 20hZ, gastaram o mesmo cartão três vezes. Pior: ruído nessa seção
rebaixa o sinal dos casos de perda REAL, que existem (`22cda8b7`, R$1.109,64
perdidos no nosso silêncio).

> **Pedido de conserto:** quem for mexer, exclua dos blocos "VENCE EM 48H" e
> "PERDEU A JANELA" o caso cujo status na Hotmart já é `PROTESTED`/devolução
> aberta. Não é perda; é dinheiro em trânsito.

## #312 — a classe tem número agora: 33 pagantes sem conta

Medi `entitlements` órfão (`user_id` NULL, `status='active'`) contra `profiles`,
um a um:

- **37** linhas órfãs active · **34** e-mails distintos · **33 SEM CONTA**
- este cartão carrega **19** em `affected_emails` → **14 pagantes da mesma
  classe não estão em cartão nenhum**
- com cartão próprio, só **3** (fila `para_frank`). **30 são invisíveis** a
  qualquer contagem.

### O que a classe custa (Hotmart viva, `assinaturasDe`, 0 erro de consulta)

**23 dos 33 sem conta têm assinatura VIVA hoje.** Quatro confirmadas cobrando
R$97/mês = **R$388/mês de gente que nunca entrou na plataforma**:

| code | status | desde | próxima cobrança |
|---|---|---|---|
| `74A6IGVU` | ACTIVE | 17/07 | 17/10 |
| `877A2RHB` | ACTIVE | 18/07 | 18/10 |
| `GGMWWE5Q` | ACTIVE | 26/07 | **26/09** |
| `OYH2CSTC` | DELAYED | 19/07 | 19/10 |

As outras 19 vivas voltam `price=0` (maioria DELAYED). **Não afirmo que essas
cobram** — `price 0` em DELAYED pode ser cobrança falhando. Ficam medidas como
"vivo", não como "cobrando".

Dois casos de quanto já entrou de quem nunca teve conta (`pagou_de_verdade.cjs`):
**~R$1.774** (4 avulsas + 3× R$97) e **~R$1.740** (4 avulsas + 3× R$97), ambos
desde 17–18/07. Um deles recebeu 5 cartas, a última **hoje** 14:00Z — a casa
está cobrando e convidando ao mesmo tempo, e ele nunca criou a conta.

### Por que os 30 são invisíveis: o conserto está escrito e parado há 14 dias

É o título do cartão. O **PR #214** (`feat/orfao-sgp-caminho-proprio`,
+712/−41 em 4 arquivos) é o caminho próprio do SGP no varredor. Aberto
**08/09**, hoje 22/09 segue **OPEN**.

O motivo de não ter mergeado está escrito no próprio PR: há **passo obrigatório
antes do merge** — semear o dedupe `orphan_invites_sgp` com quem o suporte
escreveu à mão em 08/09 (uids 1345–1348), senão saem 4 cartas repetidas.

**Rodei o dry run desse passo agora, sem gravar:** `já registrados (intocados):
0` · `a registrar: 4`. A medição de 08/09 do PR **continua valendo 14 dias
depois** e ninguém executou o passo. O PR está a **um comando** de ficar seguro.

Não semeei de propósito: semear só faz sentido na **mesma janela** do merge, e
o merge é decisão de produção (712 linhas mexendo em envio automático pra
pagante). Foi ao grupo como um "pode" de uma palavra.

## Correção de método — ancestralidade de sha não prova produção

Conferi se o fix do PR #293 (`c6b3fec`, deste cartão) estava no ar com
`git merge-base --is-ancestor c6b3fec origin/main`. Deu **NÃO**, e eu quase
reportei "fix preso em branch" — que é exatamente o alarme que a ordem de 19/08
manda dar.

**Estava errado.** O #293 foi **MERGED em 15/09 22:30Z**. Este repo mergeia por
**squash**, que reescreve o sha: o head do branch **nunca** vira ancestral da
main. Conferi por **conteúdo**: `entitlementDaPlataforma` está em `origin/main`
(`frontend/src/lib/payments/acesso-regra.test.ts`, entre outros). Está entregue.

> **Regra, pra ninguém repetir:** em repo que faz squash, ancestralidade de sha
> não prova nada. Confira por **conteúdo** (`git grep` na `origin/main`) ou pelo
> `state` do PR. Vale também pro **#331**, MERGED em 17/09 22:26Z, que a fila
> ainda descreve como "esperando merge" no cartão `c58a5da4` — esse cartão está
> com a premissa velha.

## Medição de contexto: 57 PRs abertos, o mais velho de 19/08

Não é conclusão, é número pra não se perder: `gh pr list --state open` devolve
**57**, com o mais antigo aberto em **19/08** (#9). Vários são conserto de aluno
(#42 espera aval desde 24/08 e já está na fila como `827fa746`). Não investiguei
um a um nesta ronda — registro porque "PR aberto" virou o lugar onde conserto
pronto espera, e a fila cita PR como bloqueio em pelo menos dois cartões.

## Rótulo do #312

`aguardando_aluno` → **investigating**. O motivo é NOVO em relação à oscilação de
12/09 (que foi refutada pela pasta de Enviados e desfeita com razão): o próximo
passo desta classe **não é resposta de aluno**, é ação da casa com nome e número
— semear o dedupe + mergear o #214. A ordem de 21/09 é explícita: quando é a
casa que trava, quem trava é a CASA.

⚠️ **Aviso pra próxima ronda (lição da nota 10 deste cartão):** reabrir o #312
**infla** o bloco "PERDEU A JANELA" do `garantia_na_fila.cjs`, porque a
ferramenta só enxerga incidente ABERTO e este cartão carrega 19 e-mails. Se o
bloco pular de ~6 pra ~24, **não são 18 pessoas novas machucadas** — são estas
19, que estavam escondidas pelo rótulo.

## O que falta pra fechar o #312 (não fechei, e o passo que emperrou)

1. **"pode" do Johnny** pro merge do #214 + `semear_orfao_sgp.cjs --confirmar`
   nos 4, na mesma janela.
2. **Decisão de dinheiro, que não é minha:** os 23 com assinatura viva e zero
   acesso — cancelar e/ou devolver o cobrado de quem nunca entrou. A próxima
   cobrança da classe cai em **26/09** (`GGMWWE5Q`).

Ambos foram ao grupo nesta ronda.

## Fim de ronda

- worktree de inspeção do #214 removido; repo de volta na `main`.
- `git log --oneline origin/main..HEAD` vazio depois do push deste log.
- Nenhum código tocado nesta ronda: só leitura, uma nota de incidente e este log.
