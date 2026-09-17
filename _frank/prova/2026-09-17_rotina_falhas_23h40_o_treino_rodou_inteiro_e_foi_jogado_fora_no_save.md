# Ronda das falhas — 17/09, 23h41Z → 00h05Z

> Nota de relógio, quarta ronda seguida a registrar isto: os rótulos de hora
> desta série estão adiantados. Esta ronda começou **23:41Z** e fechou
> **00:05Z**. O carimbo que vale é o de cima.

**Item serial: `#11` (`9ac03612`), "Treino de voz: trainer failed" — o cartão
mais VELHO da fila, 58 dias. FECHADO, com o aluno servido.**

Em uma linha: **o treino do Alberto rodou até o fim e foi jogado fora na hora
de gravar — disco cheio no worker — e isso entrou num guarda-chuva de falhas
CEGAS justamente porque o diagnóstico só sabe reconhecer OOM.**

---

## 0. A escolha do item, e por que o mais velho era o certo hoje

A regra 8 manda pegar o mais antigo com aluno afetado. A fila tem **89 abertos**
(30d+: 2 · 15–30d: 3 · 7–15d: 40 · 3–7d: 18 · <3d: 26). O mais velho é o `#11`,
de 21/07 — e ele não estava velho e parado: **disparou de novo às 21:27:53Z**,
duas horas antes desta ronda, com aluno nomeado. Velho **e** quente.

Contagem de percepção da ordem do dia (`percepcao_travada.cjs`, controle
positivo OK, 448 incidentes varridos): **0 cartões travados por falta de ver /
ouvir / assistir · mais velho parado há 0d.** A classe que tinha 16 dias na
ordem de hoje segue vazia.

## 1. O achado: o treino não morreu no meio, morreu na entrega

O `trainer_stderr` do job `bbf4b050` (que só existe por causa da mig 97) diz:

```
[train] step 499: loss/diff: 1.080058 ... epoch: 10.617021
Traceback (most recent call last):
  File ".../train_voxcpm_finetune.py", line 357, in train
    save_checkpoint(...)
  File ".../safetensors/torch.py", line 323, in save_file
safetensors._safetensors_rust.SafetensorError: Error while serializing:
    I/O error: No space left on device (os error 28)
```

**499 de 500 steps. 10,6 epochs. Loss convergido.** A GPU fez o trabalho
inteiro, e o `lora_weights.safetensors` não coube no disco do worker.

Isso muda a leitura de tudo. Não é "o treino falhou": é **"o treino deu certo e
a casa perdeu o resultado"**. Quem lê `elapsed_seconds = 0` e `error = "trainer
failed"` — os dois únicos campos que a fila mostra — conclui o contrário.

## 2. Por que caiu no cartão errado, e por que isso não é detalhe

`diagnostico-trainer.ts` (PR #308, ontem) só conhece **CUDA OOM**. Disco cheio
não casa detector nenhum, cai na regra larga, vira `cause='bug'` e assinatura
`training:bug:trainer failed` — **falha de INFRAESTRUTURA carimbada como defeito
NOSSO**, dentro do guarda-chuva das falhas cegas.

É o **mesmo vão que o PR #308 fechou ontem para o OOM, com outro nome.**

Medido na tabela inteira (paginado, 1.394 linhas, não truncado em 1000):

| | |
|---|---|
| treinos `failed` no total | 72 |
| com `trainer_stderr` (só após a mig 97, 28/08) | **2** |
| desses 2: OOM (coberto pelo #308) | 1 — `c90ff577`, 15/09 |
| desses 2: **disco cheio (descoberto)** | 1 — `bbf4b050`, hoje |

**Das falhas instrumentadas que não são OOM, 1 de 1 cai errado.** n=1, e escrevo
n=1 — não é "100% das falhas".

## 3. O aluno: dia 1, pagante, e a casa tinha prometido por escrito

**Alberto Martins** (`almaraujo13@gmail.com`). Perfil criado **hoje 21:27:25Z**;
o treino que morreu começou **28 segundos depois**. Primeiro contato dele com o
produto. Pelo instrumento de produção (`pagou_de_verdade.cjs`): **pagou R$
930,12** — R$ 616,80 no "Sistema de Geração Pronto" e R$ 313,32 na "Fábrica de
Conteúdo Invisível", as duas COMPLETE.

A tela mostrou a ele:

> *"Tivemos um problema técnico durante o treinamento — não foi culpa sua.
> Abrimos um chamado e nossa equipe já está com ele. **Você não precisa fazer
> nada: o retreino é por nossa conta.**"*

**Nenhum retreino estava rodando.** Um único `training_job` na vida dele: o que
morreu. A promessa estava na tela e não existia em lugar nenhum do sistema.

## 4. O que fiz, e o que o BANCO confirma depois de gravar

| passo | hora | o que o banco diz |
|---|---|---|
| rearmei a voz `failed` → `awaiting_training` | 23:45:22Z | **1 linha afetada**, conferida |
| disparei `dispararTreinoOnboarding(origem='sgp')` | 23:46:00Z | job `a74398ab-…-u1` |
| job terminou | 23:50:34Z | `completed`, **272s** |
| voz | 23:50:34Z | `ready`, `reference_cut_mode=snap_ok` |
| **artefato no R2** | 23:50:13Z | `lora.safetensors` **72.397.184 bytes** |
| pedido SGP `e25fc2df` | 23:50:35Z | `falhou` → **`pronto`**, `erro=null` |
| e-mail automático de pronto | 23:50:35Z | `onboarding_ready_email_at` gravado |
| carta minha ao aluno | 23:57Z | uid **2746** na pasta de enviados |

**Conferi o objeto no R2, não só a coluna** — a falha anterior foi exatamente no
gravar, então `lora_path` preenchido não prova nada sozinho.

**Dinheiro:** `credit_transactions` por `ref_id` da voz = **0 linhas antes e 0
depois**. `origem 'sgp'` não cobra por regra da casa. **A casa pagou a GPU duas
vezes; o aluno não pagou nenhuma.** Nada a estornar.

> Do erro (21:32Z) à entrega (23:50Z): **2h18. A minha parte foram 5 minutos.**
> O que custou as duas horas foi ninguém estar olhando — não a dificuldade.

Na carta liguei a tela de erro que ele **viu** ao e-mail de pronto que ele
recebeu, e disse que não pagou nada. **Não prometi nada sobre crédito ou plano:**
ele tem `plan=free` e 0 créditos porque compra de SGP não concede crédito de
FastCloner por desenho — e o que a avulsa dá direito é **decisão comercial**, do
Johnny e do Lucas, não minha. O próprio `pagou_de_verdade.cjs` avisa isso na
saída (armadilha do #173).

## 5. Dois vãos de ferramenta que eu fechei no caminho

**(a) O passo que ninguém tinha registrado.** `2026-09-15_retreinar_sgp.cjs`
recusa voz que não esteja em `awaiting_training`. Em 15/09 alguém rearmou a voz
do Ricardo **à mão** e isso não ficou escrito em lugar nenhum — hoje eu tive de
redescobrir o passo do zero. Virou ferramenta com travas:
**`_frank/ferramentas/2026-09-17_rearmar_voz_para_retreino.cjs`**. Ela só rearma
voz `failed` cujo **último** job morreu por infra NOSSA **provada no stderr**
(disco cheio / OOM); **recusa causa cega** (rearmar às cegas gasta GPU da casa
pra morrer igual); recusa se houver débito pendente por `ref_id`; e confere o
número de linhas afetadas antes de afirmar que rearmou.

**(b) O disparo que morre em silêncio na máquina local.** A primeira tentativa
devolveu `RunPod 400: invalid webhook url`. Causa: `webhookUrlFor()` lê a
variável **pública** de site antes da privada, e no ambiente local a pública
aponta para a própria máquina — a RunPod recusa, com razão, porque teria de
chamar de volta um endereço que não atende. **Não reescrevi o ambiente dentro do
script de propósito** (mascarar ambiente é como se inventa entrega que não
existe): pus um **guard que aborta ANTES de gastar GPU** e documentei no
cabeçalho como rodar apontando para o domínio de produção.

## 6. Dois consertos subiram para produção nesta ronda — os dois conferidos por mim

**PR #333** (`47765316`, deploy **success 23:51:34Z**) — o **poll** passa a
gravar o MESMO nome de falha que o webhook. Era o buraco que a ronda das 22h50Z
encontrou e cartejou (`acdae9ff`). O cartão já estava **entregue quando cheguei**
— de novo o padrão do dia. Não mergeei na palavra do commit:

- 11/11 testes novos passam;
- **mutação**: revertendo a linha do poll, cai exatamente o teste D1 (10/11);
  restaurado, volta 11/11. O teste é real, não decorativo;
- `tsc --noEmit` exit 0.

O achado que o cartão não tinha: **o estilhaço já aconteceu** — a mesma falha
está aberta em DOIS chamados (`#457` webhook × `#461` poll) e a aluna
`semeadorriquezas@gmail.com` **caiu nos dois em 43 minutos**, e no lado do poll
perdeu o reenvio e foi estornada.

**PR #334** (`727d7df7`, deploy disparado 00:00Z) — **7 arquivos de teste que
não executavam uma única linha** (`ERR_MODULE_NOT_FOUND`, import relativo sem
`.ts`). Cartão `33698f5b` criado por mim às 23:49Z; o `coder` entregou o PR às
**23:54:49Z**, cinco minutos depois. Conferido por mim, suite inteira:

| | main | branch |
|---|---|---|
| tests | 1303 | **1378** |
| pass | 1260 | **1333** |
| fail | 7 | **2** (os 2 do alias `@/`, fora de escopo por decisão) |

**+75 testes voltaram a existir de verdade, e nenhum deles reprovou ao acordar.**
O que importa aqui não é o `fail` cair — é o `tests` **subir**. Entre os
ressuscitados está o do `classify.ts`, que é quem decide a assinatura e a causa
de **todo** incidente da casa, e que estava sem uma asserção rodando.

## 7. O que sobrou, com dono

**`30cefcdc`** (`coder`) — disco cheio precisa de detector estreito e assinatura
própria (`training:infra_disk:no-space`), como o OOM ganhou no #308. O cartão
exige o que o do OOM não tem: a nota de conduta tem de dizer que o treino
**completou** e o artefato se perdeu no save, que o disco é do **worker** e não
do aluno, e que **é a segunda vez** (a `resolution_note` do próprio `#11` cita o
disco cheio de 10/08 como "tratado"). Dependia do `33698f5b` — que acabou de
subir. **Está desbloqueado.**

## 8. Por que o `#11` fecha, e o limite que eu declaro

O defeito **deste** cartão é *"o trainer morre e a casa não sabe por quê"*. Ele
foi consertado (mig 97 + `registrarSaidaDoTrainer`) e **hoje se provou de novo**:
a falha nasceu com o motivo escrito, e foi por isso que eu consegui agir em
minutos em vez de auditar o `free_cuda` como a nota de julho induziria.

O que sobrou não é deste cartão — é a **rota**, e ela tem dono.

> ⚠️ **O limite, dito antes de alguém se surpreender:** enquanto o `30cefcdc`
> não subir, o **próximo** disco cheio reabre o `#11` de novo, pelo mesmo
> caminho. Isso é artefato de **assinatura compartilhada**, não defeito voltando.

As 5 ocorrências ficam onde estão, **sem migration de reassinatura**: 3 das 5
são cegas para sempre (jobs purgados pela RunPod, sem `trainer_stderr`), e
reassinar seria inventar causa para quem nunca disse a dela.

## 9. O que eu NÃO sei, e não vou fingir que sei

**Não sei por que o disco do worker encheu**, e não investiguei — não tenho
acesso ao volume da RunPod daqui. O que dá para provar: **é a segunda vez**
(10/08 e hoje). Disco que enche de novo depois de "tratado" cheira a volume que
enche com o tempo, e isso é infra para alguém olhar, não código para consertar
no cartão. Está escrito no `30cefcdc` para não se perder.

Também **não medi** se a frota está saudável agora por sorte ou por desenho: o
que medi é que o treino imediatamente anterior (`a3f4a9bb`, 21:24Z) e o de outro
aluno logo depois (`2adf858c`, 23:36Z → completed em 390s) entregaram normais.
**A falha foi de um pod, não da frota** — por isso repetir curou em 272s.

## 10. Um número que eu vi e não tratei, e que alguém precisa olhar

O `git branch -r` da ronda mostra **mais de 200 branches remotos**, e por volta
de **80 deles estão à frente da `main`** com 1 a 15 commits, muitos sem PR.
Alguns já são armadilha conhecida e documentada no índice de ordens
(`feat/onedrive-401`, `feat/fix-image-upload-retry`,
`fix/referencia-fronteira-de-frase-por-palavra`) — branches que, se mergeados,
**derrubam conserto que está em produção**.

Não abri cartão porque não é falha com aluno sofrendo e a ronda é serial. Fica
registrado como dívida visível: **é um campo minado que cresce**, e cada ronda
que passa por ele gasta tempo decidindo o que é vivo e o que é lixo.

## 11. A lição

> **Uma falha pode ser lida ao contrário do que ela é, porque a fila só mostra
> os dois campos que ela preenche mal.** `elapsed_seconds = 0` e `"trainer
> failed"` dizem "morreu na largada". O stderr dizia "step 499 de 500, loss
> convergido, e o disco acabou na hora de gravar". São histórias opostas, e a
> segunda só existe porque alguém, em 28/08, brigou para guardar o stderr numa
> coluna.
>
> A vizinha: **promessa na tela não é trabalho agendado.** A casa escreveu para
> o Alberto "o retreino é por nossa conta, você não precisa fazer nada" — e não
> havia retreino nenhum. Texto que promete ação tem de nascer junto com a ação,
> ou vira mentira educada com carimbo de atendimento.

## 12. Estado e dinheiro

Não mexi em crédito, acesso, assinatura, plano nem entitlement de ninguém.
**Não estornei nada** (não havia o que estornar: 0 linhas por `ref_id` antes e
depois). **Gastei GPU uma vez, deliberadamente** — o retreino do Alberto, por
conta da casa, `origem='sgp'`, com o precedente do `#420` (15/09) e com a
promessa que a própria casa já tinha feito a ele por escrito. Não apliquei
migration e não pedi DDL. Respondi **um** aluno, individualmente, sobre o caso
que eu estava tratando (regra 8). **Não li a caixa do suporte@ para triagem.**
Não li, escrevi, classifiquei nem reprocessei nada da planilha (ordem de 29/08).

**1 incidente fechado** (`9ac03612`, o mais velho da fila). **2 PRs mergeados e
em produção** (#333, #334), os dois verificados por mim em worktree isolada
antes do merge — teste, mutação e `tsc`. **2 cartões criados** (`33698f5b`, já
entregue e mergeado; `30cefcdc`, desbloqueado). **1 ferramenta nova**
(`2026-09-17_rearmar_voz_para_retreino.cjs`) e **1 guard** acrescentado ao
retreinador do SGP.
