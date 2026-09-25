# Ronda das falhas — 25/09, ~12:58–13:5xZ (Frank, dono da fila)

**Item serial (regra 8):** o **#389** (`176f987f`) — *"O SGP não enxerga
contestação"*, parado **11,1d**, **12 alunos nomeados**.

**O que entreguei:** o instrumento que mede este cartão estava **cego**, e a
medição de 14/09 que sustenta a decisão de dinheiro saiu de um **aparelho
quebrado**. Corrigido, medido de novo e **em produção**. **Não fechei o
cartão** — o defeito de código segue de pé e a decisão segue com o Johnny.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1272 lidas · 1195 já tinham linha · **0 escrituráveis**. Fecha **1272 = 1272**. |
| `2026-09-18_enviados_x_tabela.cjs` (irmão de leitura) | Veredito: **0 carta depois do corte** fora da tabela. Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0 cartões** travados em percepção · mais velho **0d**. Controles ± OK, **556** varridos. |
| `2026-09-24_escolher_o_abandonado.cjs` | **162 abertos** (open 13 · investigating 113 · aguardando_aluno 36) · 150 com aluno nomeado. |
| `2026-09-22_esperando_johnny.cjs` | **19 cartões** parados em decisão dele · **54 alunos** · mais velho **24d**. Inalterado. |

As **77 cartas** anteriores a 14/09 14:06:31Z seguem **sem decisão** (é o que o
`--corte` exclui) — continua decisão de produção, não de ronda.

### Por que não peguei o que o instrumento escolheu

O `escolher_o_abandonado` apontou o **#380** (11,6d). Fui ler antes de pegar: o
aluno (Ricardo, Portugal) **foi respondido duas vezes com medição**, a última em
13/09, e o cartão está `aguardando_aluno` porque a próxima ação é dele. A ordem
de 21/08 diz em letra que *esperar resposta de aluno não é estar travado*. Saiu
do meu colo — peguei o seguinte com dono real, o **#389**.

> Vale registrar como **limite do instrumento**, não como erro meu: ele ordena
> por idade da última nota e não sabe distinguir "ninguém olhou" de "a bola está
> com o aluno". Ele apontou o #380 na ronda de 02h e apontou de novo hoje. Quem
> seguir o ranking sem abrir o cartão vai reescrever a mesma nota toda ronda.

---

## 2. O item serial: o #389 e o aparelho que enxergava 13 de 167

### 2.1 O instrumento abortou, e o motivo do abort era o menos grave

Rodei `protesto_invisivel.cjs` — que a nota de 14/09 manda rodar, por caminho
versionado — e ele **abortou** no controle positivo: *"o controle positivo sumiu
(HP2585148563, HP3361171770)"*.

Isso podia ser lido como "as disputas acabaram, nada a fazer". Fui ver. **Eram
dois defeitos, e o que abortou era o menor.**

### 2.2 Defeito (1): janela de data implícita — media MENOS do que existe

`/sales/history` **sem** `start_date`/`end_date` não devolve "tudo": devolve uma
janela móvel de **~30 dias**. Medido hoje lado a lado, mesmo token, mesma
paginação:

| status | sem janela | com janela | escondidas |
|---|---|---|---|
| PROTESTED | 76 | 80 | 4 |
| CHARGEBACK | **13** | **167** | **154** |

**158 contestações reais liam como inexistentes** — **92% da classe CHARGEBACK
invisível**. E o número **piorava sozinho** a cada dia que passasse, porque a
janela anda junto com o relógio: é o zero que envelhece em silêncio, mesma
família dos zeros de 18/09 e 23/09.

Limite medido da API: range de **2 anos** (`start_date=2024-01-01` → HTTP 400;
2 anos exatos passa). Por isso `JANELA_ANOS=2`, e não "desde sempre".

### 2.3 Defeito (2): o controle positivo estava preso a um estado que muda sozinho

As 2 transações da Evelyn **não sumiram da Hotmart**. Conferi uma a uma por
`?transaction=`, que **as acha na hora**: status **`REFUNDED`**, 07/09,
`evelyn.cheida@gmail.com`, R$672 e R$252,45. **A disputa dela foi resolvida.**

Um controle preso a *"ainda estar em disputa"* não mede se o instrumento
**enxerga** — mede se a Evelyn continua brigando. E como disputa resolvida
**nunca volta** pra `PROTESTED`, esse controle **abortaria para sempre** num
instrumento correto. Controle que só sabe dar errado é tão ruim quanto controle
que só sabe dar certo.

O controle agora é por **alcance**: a transação fixada tem que seguir **achável**
e na **família da disputa** (`PROTESTED`/`CHARGEBACK`/`REFUNDED`). Resolveu → diz
em voz alta e segue. Sumiu de vez, ou saiu da família → **aborta**.

Junto foi um **controle de janela que não envelhece**, porque não depende de
transação fixada nenhuma: mede o mesmo status com e sem janela e denuncia a
diferença. No dia em que a Hotmart mudar o padrão, ele avisa sozinho.

### 2.4 O número corrigido, com o corte que impede de inflar

Disputa **anterior a 09/06** — data em que a casa passou a receber webhook do
SGP (239 `PURCHASE_APPROVED` desde então, medido no próprio cartão) — **não é
cegueira do `route.ts:206`**: nunca houve por onde ver. Somar as duas coisas
infla a régua que vai pra decisão de dinheiro, que é exatamente o erro do
**"23 de 40"** que a casa já pagou. Por isso o instrumento agora **separa**:

| recorte | trx | pessoas | valor |
|---|---|---|---|
| **depois de 09/06** — era pra ter visto | **36** | 36 | **R$ 38.678,57** ← o número da decisão |
| antes de 09/06 — predata a integração | 35 | 35 | R$ 20.510,27 (histórico) |

Somados dariam R$ 58.897,84, e seria régua inflada.

**A medição de 14/09 dizia R$ 28.032,73.** O dinheiro em jogo é **maior** do que
o cartão registrava — e era menor só porque o aparelho enxergava **13 dos 167**
chargebacks.

### 2.5 Exposição viva hoje — conferida fora do instrumento

Em disputa, invisível pra nós, e a pessoa **ainda é servida**: **5 pessoas ·
R$ 3.561,00 de compra · 655.109 créditos vivos**.

Conferido por consulta **direta ao banco**, independente do instrumento
(`select` em `profiles`) — bate número a número:

| aluno | créditos | situação |
|---|---|---|
| karolinecfp@hotmail.com | 293.160 | entitlement **ATIVO** · CHARGEBACK 02/08 |
| otavio.paiva93@yahoo.com.br | 173.715 | CHARGEBACK 13/08 |
| josimocerqueira@hotmail.com | 97.500 | PROTESTED 14/09 |
| lwsribeiro@gmail.com | 70.483 | CHARGEBACK 27/08 |
| luzielisam@gmail.com | 20.251 | CHARGEBACK 23/08 |

Em 14/09 a nota falava em **10 pessoas / 762.695 cr**; hoje são **5 / 655.109**.
**Não afirmo que "melhorou"**: os dois números saem de recortes diferentes (o de
14/09 veio do aparelho cego) e eu **não** rastreei caso a caso o que mudou em
cada um dos 10. O que vale é o de hoje, que foi conferido no banco.

### 2.6 O que subiu

PR **#445**, squash **`c288b515`** na main. Conferido no **conteúdo da
`origin/main`** (`git cat-file`), não no rótulo do PR, e `c288b515` confirmado
**ancestral** de `origin/main`. **Sem migration.** `_frank/**` **não dispara
deploy** — conferido nos filtros: `deploy.yml` → `frontend/**`,
`runpod-worker.yml` → `runpod-worker/**`, `comfyui-worker.yml` →
`comfyui-worker/**`.

Rodei o instrumento **de novo a partir da main sincronizada** depois do merge,
não só da minha cópia de trabalho: mesmos números, os dois controles verdes.

---

## 3. O que eu NÃO fiz, de propósito

Não revoguei acesso, não zerei crédito, **não escrevi para nenhum dos 5**, não
toquei em `route.ts` nem em `sgp_pedidos`, não apliquei migration, não gastei
GPU. Mexer em crédito/acesso de pagante contestado é **decisão do Johnny/Lucas**
e está pendente desde 14/09. O que eu entreguei foi o **número certo** para essa
decisão poder ser tomada — que era o que faltava.

**Segue aberto e nomeado:** `route.ts:206` continua desviando **todo** evento do
SGP pro `processarCompraSgp` **antes** do `mapRevokeStatus` — conferido hoje no
fonte, o desvio está lá sem mudança. As pernas **(1)** job de reconciliação e
**(2)** desvio seletivo continuam **por fazer**. A diferença é que agora existe
instrumento honesto pra medir se elas funcionam.

**Passo em que travou:** a decisão de dinheiro do Johnny (crédito + acesso dos
contestados), escalada em **14/09** e sem resposta há **11 dias**.

---

## 4. Régua que fica desta ronda

> **Controle positivo preso a um estado MUTÁVEL não é controle — é bomba-relógio.**
> O controle da Evelyn cobrava "ainda estar em disputa". Disputa resolve, e
> resolver é o desfecho normal. A partir do dia em que resolveu, um instrumento
> **correto** passou a abortar toda ronda, e o abort se lê como "a medição
> falhou" em vez de "o controle expirou". Controle se fixa no que **não pode
> mudar sem quebrar de verdade**: alcance, existência, família — não estado
> corrente.

E a segunda, que é a mesma de sempre com roupa nova:

> **Abort de instrumento é achado, não obstáculo.** Se eu tivesse lido o abort
> como "sem contestação nova, sigo" — que era a leitura cômoda — as 154
> chargebacks continuariam invisíveis e a decisão do Johnny seguiria sendo
> pedida em cima de metade do dinheiro real.

---

## 5. Fim de ronda

- `git log --oneline origin/main..HEAD` → **vazio** (conferido após o merge)
- `main` local **idêntica** a `origin/main` (`rev-parse` conferido)
- **Nenhum fix preso em branch**: `fix/protesto-invisivel-janela-e-controle`
  mergeada e **apagada no origin** (`git remote prune` confirmou a remoção;
  `git branch -r --list '*protesto*'` → **0**). Não repeti a família STALE que o
  índice já registrou **seis** vezes.
- Não mergeei nenhuma das branches STALE do índice.
- Não gastei GPU, não mexi em crédito, não mandei carta (nem individual nem em
  massa), não toquei em migration.
- **Declarado:** `2026-09-24_conserto_pronto_e_parado.cjs` devolveu **67 PRs
  UNKNOWN** (o GitHub não calculou mergeabilidade). O próprio instrumento manda
  não acreditar em número nenhum da rodada — então **não usei** nada dele nesta
  ronda, e o estado daquela classe fica **sem medição** hoje.
