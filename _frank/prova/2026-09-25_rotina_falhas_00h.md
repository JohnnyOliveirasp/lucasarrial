# Ronda das falhas — 25/09, ~23:20–00:10Z

**Item serial (regra 8):** o **#307** — o conserto mais velho da coluna "entram
hoje", 8d, na véspera do corte de 9d que a casa mediu. A ronda anterior o
nomeou: *"#307 vence amanhã"*. Amanhã era hoje.

Levado **até o fim**: achado um defeito que impedia o merge, corrigido na
origem, medido, mergeado e no ar. Instrumento escrito pra classe não voltar
invisível.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1262 lidas · 1185 já tinham linha · **0 escrituráveis**. Contagem fecha **1262 = 1262**. |
| `2026-09-18_enviados_x_tabela.cjs` (irmão de leitura) | *não rodado nesta ronda* — ver §5, é uma falha minha declarada, não um zero. |
| `percepcao_travada.cjs` | **0 cartões** travados em percepção · mais velho **0d**. Controles positivo (#310) e negativo (#518) OK, 548 varridos. |
| `2026-09-24_escolher_o_abandonado.cjs` | **155 abertos** · 144 com aluno nomeado · mais abandonado 11,2d (#340). |
| `ddl_aplicado.cjs` | **7 colunas** que o git manda existir e o banco não tem, em **3 migrations** — todas as 3 se declaram NÃO APLICADAS no cabeçalho, esperando aval. Estado conhecido, inalterado. |

As 77 cartas anteriores a 14/09 14:06:31Z seguem **sem decisão** (é o que o
`--corte` exclui) — inalterado, continua decisão de produção, não de ronda.

---

## 2. O item serial: o #307 e a migration de número colidido

### 2.1 Como o defeito apareceu

Fui mergear o #307 e abri o corpo dele antes. Ele adiciona
`scripts/118_sgp_conclusao_automatica.sql` e **justifica o número com uma
conferência feita na hora**, escrita no cabeçalho da própria migration:

> *"o cartão pediu 117+. A 117 (`117_sgp_fracassos.sql`) JÁ EXISTE na main —
> conferido em `ls scripts/*.sql` antes de escrever, não suposto. Esta é a 118."*

A conferência estava **certa em 16/09** e ficou **errada sem ninguém tocar no
PR**. Medido na `origin/main` de hoje:

```
scripts/118_virais_do_aluno.sql
scripts/118_voices_speech_rate.sql
```

Nos 8 dias de espera por merge, **duas** 118 entraram. O #307 faria a **terceira**.

### 2.2 A medição, e as 3 colisões que já estão na main

```
numero  82 → 3 arquivos   (runpod_timing · trial_expiry_cobranca_em_voo · video_projects_product_idea)
numero 100 → 2 arquivos   (image_generations_video_historico · sgp_pedidos)
numero 118 → 2 arquivos   (virais_do_aluno · voices_speech_rate)
```

113 arquivos em `scripts/`, **3 números colididos**.

### 2.3 ⚠️ A hipótese com que eu comecei foi REFUTADA pela própria medição

Escrevi o instrumento achando que a colisão **já tinha causado um pulo**: que
alguém leria "a N já foi aplicada" e pularia a gêmea. A primeira rodada parecia
confirmar — no banco vivo, `82_generations_runpod_timing` e
`100_image_generations_video_historico` estão **AUSENTES** enquanto as gêmeas do
mesmo número estão **presentes**.

**Não é isso.** Fui ler o cabeçalho dos dois **antes** de escrever a acusação, e
os dois se declaram não-aplicados **de propósito**:

| arquivo | o que o cabeçalho diz |
|---|---|
| `82_generations_runpod_timing.sql` | *"⚠️ ESPELHO — NÃO APLICADO. DDL aguardando aprovação do Johnny."* |
| `100_image_generations_video_historico.sql` | *"NÃO APLICADO. Commitado pra leitura e aval (ordem de 18/08, 'DDL pelo git')."* |

São a **política da casa funcionando**, não vítimas da colisão. O
`ddl_aplicado.cjs` já os reporta assim, com o rótulo `(NÃO APLICADA)`.

Registro porque **quase virou achado**: *estado divergente entre gêmeas NÃO é
prova de pulo*. É compatível com pulo **e** com decisão deliberada, e quem separa
as duas leituras é o **cabeçalho**. Concluir pela divergência sozinha seria
deduzir e chamar de medido — o erro que esta casa já documentou contra si mesma.

### 2.4 Então qual é o dano real da colisão

É de **escrituração**, e ele é concreto e está medido no próprio #307:

> **O número de migration não é identificador — é um palpite sobre o que os
> outros ainda não mergearam.**

E **git não acusa**: os nomes de arquivo diferem, não há conflito de texto, o PR
fica `MERGEABLE` / `CLEAN` e a medição da casa o conta como *"entra hoje"*.

É **família diferente** dos 6 branches STALE do índice — lá o defeito é
**deriva**, e o PR se denuncia ficando `CONFLICTING`. Aqui não há nada pra
denunciar. E é família diferente do **remédio obsoleto** de ontem — lá o doente
morreu; aqui o remédio está vivo e certo, só entra com o rótulo errado.

**Conferir na hora de ESCREVER não protege. Conferir na hora de MERGEAR, sim.**

### 2.5 O que eu fiz

1. **Renumerado `118` → `119`** no branch do #307 (`8cf17bf1`): o arquivo e as
   **12 referências em prosa** (`painel.ts`, `types.ts`, `cobranca.ts`,
   `conclusao-sweep.ts`, `conclusao-sweep.test.ts`, `admin/sgp/route.ts`).
   O `119` estava livre, conferido na `origin/main`.
   - Auditei **cada** ocorrência de `118` nos arquivos tocados antes de trocar.
     A única que **não** era a migration (`min-w-[1180px]` em `page.tsx`) não
     casa com `\b118\b` e ficou intacta — conferido depois, não assumido.
2. **Cabeçalho da migration reescrito** pra contar o episódio, em vez de ostentar
   a conferência vencida que enganaria o próximo leitor.
3. **Medido DEPOIS da renumeração, no branch:**
   ```
   node --test src/lib/sgp/*.test.ts   → 314 testes, 314 pass, 0 fail
   npx tsc --noEmit                    → exit 0
   ```
4. **Comentário no PR** com a medição e o motivo.
5. **Mergeado** — `cf2d3ea3`, 23:50:46Z. Conferido na `origin/main`: a
   `119_sgp_conclusao_automatica.sql` está lá e **não há terceira 118**.
   **Deploy conferido: `completed / success`** (run 36074740206) — não é "mergeei
   e presumi"; esperei o veredito. E o instrumento, re-rodado **depois** do merge,
   segue acusando **3** números colididos: o merge não criou o quarto.
6. **Instrumento novo, só leitura:**
   `_frank/ferramentas/2026-09-25_migration_numero_colidido.cjs`.

### 2.6 Por que renumerar aqui é seguro — e onde eu NÃO mexi

Este DDL **nunca foi aplicado**. Renumerar arquivo **já aplicado** seria apagar o
rastro do que rodou, e isso não se faz. Por isso as **3 colisões que já estão na
main ficam exatamente como estão** — não toquei em nenhuma, e o instrumento diz
isso na cara em vez de recomendar faxina.

### 2.7 O que o merge do #307 NÃO faz

- **Não liga o recurso.** Ele nasce DESLIGADO (`SGP_CONCLUSAO_AUTOMATICA=1` pra
  gravar; ausente = **ensaio** que conta e não escreve).
- **Não aplica a migration 119.** Ela segue NÃO APLICADA, e o recurso não depende
  dela (sentinela em `concluido_por`, com teste travando a tela honesta sem a
  coluna).
- **Não responde o go/no-go** que o PR faz ao Johnny (ligar sabendo que **42/81**
  avisados podem estar sem acesso, ou esperar o estado ACESSÍVEL). Mergear só tira
  o trabalho da fila onde ele apodrece — a pergunta continua **aberta e dele**.
- **Não fecha cartão nenhum.** Procurei: o #307 nasceu do **recado 6** do Johnny,
  não de incidente. Varri os 548 cartões por assinatura e por `#307` nas notas —
  nenhum é o dono dele. Não inventei vínculo pra ter o que fechar.

---

## 3. O que isto muda na conta da casa

Medido no **mesmo instrumento**, antes e depois do merge, na mesma ronda:

| | antes | depois |
|---|---|---|
| MERGEABLE+CLEAN ("entram hoje") | **45** | **44** |
| parados há 3d+ | **24** | **23** |
| conflitados (podres) | 21 | 21 |

**E a diferença que importa em relação a ontem:** os −2 da ronda das 23h foram
**remédio obsoleto retirado** (número parando de mentir pra cima, zero conserto
entregue). Este −1 é **conserto entregue de verdade, deployado**.

O corte medido continua de pé: **passou de ~9 dias, o conserto não é mergeado, é
retrabalhado** (14 de 14 PRs com 9d+ estão conflitados). O #307 foi pego na
véspera. **O próximo a vencer é o `#332` (7d)**, seguido de `#330`, `#328`, `#325`.

---

## 4. Dinheiro, GPU, aluno

- **Não mexi** em crédito, acesso, plano, assinatura, saldo nem status de pedido.
- **Não gastei GPU**, não pedi retreino, não regenerei áudio de ninguém.
- **Não escrevi pra aluno nenhum** — nenhum caso meu exigia carta.
- **Não apliquei migration.** A 119 sobe quando o Johnny mandar.
- **Não chamei função de dinheiro pra satisfazer instrumento**: a
  `expire_trial_credits` (82) só se prova chamando, e ela mexe em crédito de
  aluno. Sai como **NÃO-MEDIDA**, nunca como aplicada.
- **Não apaguei branch**, **não toquei** nos 6 branches STALE do índice.
- **Não toquei** em nada da planilha (ordem de 29/08).
- **Não li** a caixa do suporte@ pra triagem (a Fast marca como lido).
- **Não commitei** os `_frank/rascunhos/*` de outra ronda que estavam soltos na
  árvore — não são meus e não entram em branch de feature por carona.
- **Mergeei 1 PR** — ação que deploya, com plano herdado da ronda anterior, teste
  e tsc medidos por mim no branch, e recurso desligado por padrão.

---

## 5. Uma falha minha desta ronda, declarada

**Não rodei o `2026-09-18_enviados_x_tabela.cjs`**, o irmão de leitura
independente da reconciliação. O `reconciliar` fechou a contagem em 1262 = 1262
com 0 escrituráveis, mas o índice de ordens manda **conferir com o irmão**
justamente porque um instrumento não se audita sozinho.

**Não substituo um pelo outro no relatório.** A linha da tabela em §1 diz
"não rodado", não "0". Fica como primeiro item da próxima ronda.

---

## 6. Fim de ronda

- Log e instrumento commitados na **main**.
- Código de produção foi por **branch + PR** (`feat/fila-sgp-entregue-nao-iniciou`
  → PR #307 → merge `cf2d3ea3`). Nenhum fix meu ficou preso em branch.
- `git log --oneline origin/main..HEAD` conferido **vazio** no fim.
- Recado no **grupo** via `notify-grupo.sh` (canal de 31/08). Nada no privado.

### O que fica pra próxima ronda, com nome

1. **Rodar o `enviados_x_tabela.cjs`** — a pendência que eu criei acima.
2. **`#332` é o próximo a vencer** (7d, 2 dias do corte), depois `#330`, `#328`,
   `#325`. O #325 a ronda de 23h já tinha marcado como candidato bom (1 arquivo,
   blast radius pequeno).
3. **Os 13 candidatos a remédio obsoleto** seguem por examinar, um a um, no banco
   vivo. Nenhum se fecha pelo sinal.
4. **A fila de incidentes não andou nesta ronda.** 155 abertos, 144 com aluno
   nomeado, o mais abandonado há 11,2d (`#340`, e-mail que não chegou pro
   `ulyssemmachado@gmail.com`). Escolhi o #307 porque ele **vencia hoje** e a
   ronda anterior o nomeou — mas isso é a terceira ronda seguida em que a cabeça
   da fila de **alunos** não é trabalhada, e isso precisa parar de ser normal.
   O `#340` é barato e tem aluno com nome.

### Sobre o passo fixo do `git rev-list` (repito, porque continua valendo)

Ele acusa ~193 branches e boa parte é falso positivo (squash-merge deixa o
conteúdo na main com sha diferente); `git cherry` distingue, `rev-list` não.
Segue **proposto e não aplicado** — corrigir ordem não é alçada de ronda.
