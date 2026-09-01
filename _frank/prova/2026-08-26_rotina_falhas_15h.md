# Rotina das Falhas — 26/08/2026, ronda das 15h UTC

Dono da fila: Claude. Método serial (regra 8, ordem de 21/08).
Entrada: `git checkout main && git pull --ff-only origin main` → já em dia.
Índice de ordens lido. Ronda anterior: 14h UTC (fechou o `140`, provou a causa do `144`).

---

## 1. Incidente que peguei e FECHEI: `144` — OneDrive

Peguei pela regra 8 com a exceção declarada: os dois mais antigos com aluno
afetado (`97` e `99`) estão **ambos travados numa decisão que não é minha** —
detalhe no §3. O `144` era o único aberto que eu conseguia levar até o fim.

A ronda das 14h deixou a **causa provada** e o status corretamente em
`investigating`, porque causa provada não é fix. O que faltava era **produção**.

### O que era

As contas do OneDrive migraram pro SharePoint Online. O direito anônimo do
share deixou de ser resolvível por token na URL e virou **cookie FedAuth**,
emitido só pela cadeia de redirect do 1drv.ms. Nosso código ia direto na API
legada (`api.onedrive.com/v1.0/shares/u!<token>`), chegava sem grant e levava
**401 em todo link 1drv.ms** — inclusive nos dois que funcionavam em 22/08.

Pior que o 401: a mensagem automática traduzia isso como *"seu link venceu ou
exige login"* e **acusava o aluno de um defeito nosso** (caso Luziélia, 4 voltas
na madrugada).

### O que eu fiz

Revisei e mergeei o **PR #60** (`feat/onedrive-spo-fedauth`). Não escrevi o
código — é trabalho de coder — mas **não aceitei o PR pelo texto dele**:

| conferência | resultado |
|---|---|
| `node --test src/lib/**/*.test.ts` (rodado por mim, worktree do branch) | **100/100 pass** |
| `tsc --noEmit` | limpo, exit 0 |
| `grep linkDiretoOneDrive` | o export renomeado não deixou uso órfão |

**Teste vivo rodado por mim às 14h44Z**, contra os links REAIS de
`onboarding_runs`, com o código do branch. Isto baixou byte, não é ensaio:

```
pasta /f/ (Luziélia imagens) -> ok=true, 4 arquivos
    175603 / 145845 / 152306 / 129790 bytes, magic ffd8ffe0 nos quatro
pasta /f/ (Luziélia áudios)  -> ok=true, 9 arquivos .m4a
arquivo /u/ (lazevedo)       -> ok=true, "Gravando (11).m4a"
    46.127.898 bytes = size anunciado, magic 00000018667479706d703432
arquivo /v/ (lazevedo, cadeia SEM FedAuth)
    -> ok=false, dependeDoAluno=true, mensagem pede link novo SEM acusar o aluno
```

O último caso é o que importa pro atendimento: o discriminador agora é **se a
cadeia emite FedAuth**. Sem FedAuth o share de fato não dá acesso anônimo e
pedir link novo é honesto; com FedAuth é falha nossa, e a mensagem diz isso.

**De quebra:** link de **PASTA** (`/f/`) passou a funcionar. A API antiga nunca
soube listar pasta — os 9 áudios da Luziélia nunca teriam sido baixados pelo
caminho velho.

### Em produção, conferido DEPOIS (não "mergeei, logo está no ar")

Merge `2dd1150` na main às **14:45:41Z**. Workflow de deploy `32982298105`
concluiu **SUCCESS às 14:49:19Z**, com os passos *"Rsync para o servidor"* e
*"Install runtime deps + reload PM2"* ambos success. Li o desfecho do deploy
antes de escrever `fixed`.

### Nenhum aluno pra avisar — conferido um a um, não suposto

`onboarding_runs` tem só **3 alunos** que passaram por OneDrive (116 runs no
total, varridos):

- **luzielisam** — entregue 26/08 12:59, voz ready 32min, já produzindo.
- **marlonwsmuniz** — `ok=true` desde 22/08.
- **lazevedo** — SEM ACESSO, 0 créditos, voz `failed` por qualidade de áudio e
  **estornada em 22/08**. O link de imagem dele é justamente o `/v/` sem
  FedAuth, que continua fechado de verdade e **não é curado por este fix**.

Ou seja: ninguém estava preso nisto, o ganho é pra **aluno futuro**. Não mandei
e-mail porque não havia a quem mandar — e digo isso em vez de inflar o placar.

Fechado `fixed`, `resolution_note` com o que o banco confirma, commit `2dd1150`,
releitura confirmando **1 linha afetada**. Postado no grupo (message_id 458).

---

## 2. O check de fim de ronda achou coisa — e uma delas ameaça o fix de hoje

`origin/main..HEAD` saiu **vazio** ✓. Mas a varredura de branches (38 com commit
fora da main) revelou dois casos reais. Registro que **o check literal da ordem
dá falso positivo**: merge por *squash* faz os commits do branch nunca
aparecerem na main, então `rev-list main..<branch>` acusa branch já mergeado. O
critério útil é **branch com conteúdo fora da main E sem PR**.

### 2.1 🔴 `feat/onedrive-401` — branch STALE que derrubaria o que subiu hoje

Existe **no origin**, sem PR, com uma tentativa ANTERIOR pro mesmo defeito por
outro caminho (token *"badger"*). Ele reescreve `links.ts` com um
`resolverOneDrive` próprio e **não conhece o `onedrive.ts`**. Se alguém abrir e
mergear, **derruba o fix que acabou de entrar em produção** — o mesmo risco que
o `feat/fix-image-upload-retry` já criou em 19/08.

Registrei a trava no índice de ordens (`_frank/ordens/README.md`), que é o lugar
onde este repo já documenta branch stale. Não apaguei nada no origin.

### 2.2 `feat/incidents-resolved-guard` — 6 dias existindo só neste disco

Commit do Frank de 20/08, **sem PR e sem existir no origin**: 14 arquivos, 696
inserções, e uma migration (`scripts/85_incidents_resolved_guard.sql`). Faz o
fechamento de incidente sempre gravar `resolved_at`/`resolved_by`, em 3 camadas.

Trabalho invisível de verdade — se este disco morresse, sumia. **Empurrei o
branch pro origin** (branch feat/ não deploya, só a main deploya) pra parar de
ser um-disco-fundo. **Não abri PR e não mergeei**: carrega migration, e migration
sem aval do Johnny não passa por mim.

`feat/qa-telemetria-na-falha` está marcado pelo próprio autor como *"NAO PRONTO"*
— deixei quieto, é WIP consciente, não órfão.

### 2.3 O que eu NÃO resolvi e não vou disfarçar

**19 PRs abertos**, o mais velho de 18/08 (8 dias). Não é achado novo (a ronda
de 25/08 já abriu a seção "PRs parados"), e não é coisa que eu destrave sozinho
numa ronda: cada um precisa de review de mérito. Fica dito que continua lá.

---

## 3. O que travou, em que passo, e com quem está

**Os três incidentes que sobram abertos travam na mesma coisa: decisão do
Johnny.** Nenhum trava em código, e nenhum é meu pra decidir.

- **`97` — Video Clone, drift do rosto** (3 alunos). Os três já foram
  **estornados e respondidos**. Não há correção técnica: é limite do
  InfiniteTalk, medido nos 2 tiers. Falta decisão de produto, formulada em 24/08
  e repetida 25, 26 e agora. **Passo em que está: aguardando o Johnny há ~72h.**

- **`99` — Luciano.** Ver §4, virou o caso mais quente da fila hoje.

- **`143` — turno da noite.** A ordem de 20/08 (vigente) diz *"24 horas —
  autorizado"*; o agendador diz `40 6-21` e `10 6-21/2`. Ordem e realidade
  divergem há 6 dias. Ou liga, ou a ordem precisa ser corrigida. Não mexi em
  cron: a ordem autoriza a rotina, não autoriza a mim reescrever o agendador
  por conta própria. **Aguardando o Johnny.**

Escrevo isto sem enfeitar: **a fila não baixou de 4 pra 3 por falta de esforço
técnico, e sim porque o que sobrou não é técnico.** É a resposta legítima que a
ordem prevê, e prefiro dizer isso a fechar coisa que não resolvi.

---

## 4. `99` — Luciano: a premissa da decisão do Johnny virou, e agora tem relógio

Não fechei, não mexi em assinatura, crédito, acesso nem estorno. **Escalei.**

O Vigia anotou às 14h15Z que ele foi **cobrado R$97 hoje às 14:11:49Z**
(transação HP2024654259, recorrência #2, APPROVED). Confirmei por
`pagou_de_verdade.cjs`: **PAGOU DE VERDADE**. Ele deixou de ser trial.

**Confirmei também o que o Vigia afirmou e que decide o prazo** — e ele estava
certo: o payload da recorrência #2 traz `warranty_date` **`2026-09-02T00:00:00Z`**.
Anoto que esse campo **não está** em `payload->data->purchase` (procurei ali
primeiro e voltou nulo nas duas cobranças); ele vive em outro ramo do payload.
Quem repetir a consulta pelo caminho óbvio vai concluir "não tem garantia" e
errar.

**A correção que eu faço na leitura da própria fila:** eu ia tratar isto como
*"cobrança errada agora"* (a exceção da regra 8). **Não é.** Em 25/08 20:49 nós
avisamos a ele, por escrito, a data da garantia e a data da cobrança — está nos
Enviados (uid 105, e o complemento uid 113). Ele foi avisado e **escolheu ficar**
(*"vou fazer um último teste"*). A cobrança é legítima. Dizer o contrário seria
inventar urgência.

**O que continua verdadeiro e é grave:** ele pediu o posicionamento nominal do
Lucas e do Johnny **3 vezes** (24/08, 25/08, 26/08 11:36Z) e faz ~72h que não
sai. Na primeira janela ele **abriu mão do prazo confiando numa resposta nossa**
— escreveu isso com todas as letras em 25/08 13:15Z. Agora ele tem uma **segunda
janela, até 02/09**. Se essa vencer igual, foram duas janelas consumidas pela
nossa demora.

O que o Johnny mandou (25/08 23:45Z: *"faz o clone dele e manda mensagem"*)
**foi feito** — clone de 45s por conta da casa em 25/08 20h06, ele foi avisado, e
respondeu hoje *"melhorou, mas ainda falta muito"*. O que não foi feito é a parte
que só o Johnny e o Lucas fazem.

**Escalado ao Johnny às 14h42Z** (message_id 457) com a pergunta única — ele fica
ou sai — e com o prazo de **02/09** na mesa. Não escrevi pro aluno: o que falta
não é informação técnica minha, é posicionamento nominal deles, e prometer em
nome dos outros é a regra 13.

---

## 5. Fila conferida, sem mexer

- **Abertos:** 4 → **3** (`97`, `99`, `143`). O `144` fechou nesta ronda.
- **`aguardando_aluno`: 7** — e conferi que os dois que mais pareciam silêncio
  **não são**: Giovanna (`133`) foi respondida em 25/08 21:49 com a resposta
  técnica e o estorno; Sandra (`120`) teve as 7 perguntas respondidas em 24/08
  12:50. Leandro (`72`, 27 dias sem voz, o mais antigo do painel) foi avisado em
  25/08 00:47 de que **a falha foi nossa** — bola com ele, e ele **nunca pagou**
  (rec#2 R$97 `OVERDUE`, que não é pagamento).
- **Fechados que voltaram a disparar:** 1 de 126 — `acf8acd6` (#8), última
  ocorrência 22/08 19h26, **91h** atrás. Zero vivo em 48h. Mesmo quadro das 14h,
  já auditado lá; não reabri.
- **`d3d8d1b2` (#15, timeout), o que a ordem manda vigiar:** hoje está `fixed`
  (não mais `ignored`), última ocorrência 24/08 20:05, **43h**, e **não voltou a
  disparar depois do fecho**. Nada a reabrir.

---

## 6. Placar da ronda

- **1 incidente fechado** (`144`) com fix **em produção conferido**, não só na main.
- **1 PR revisado e mergeado** (#60) — testes, tsc e **teste vivo** rodados por mim.
- **1 branch stale identificado** (`feat/onedrive-401`) que derrubaria esse fix, e travado no índice.
- **1 branch órfão** de 6 dias empurrado pro origin (`feat/incidents-resolved-guard`).
- **1 escalação** ao Johnny com prazo duro (Luciano, 02/09).
- **1 afirmação minha corrigida** antes de virar decisão (a "cobrança errada" que não era).
- **0 e-mail pra aluno** — porque não havia a quem escrever, e §1/§5 mostram a conta.
- **0 crédito, 0 GPU, 0 migration.**

Nada foi marcado `fixed` sem estar resolvido. A fila caiu 1, e os 3 que sobraram
estão parados em decisão do Johnny, não em trabalho técnico pendente.

## 7. Pendências desta máquina

`_frank/prova/2026-08-26_agent_state_arquivado.json` (27KB, 08h07) está
**untracked** na árvore. É despejo de consulta de outro processo, não é meu.
Não commitei nem apaguei: não sei quem o quer. Fica anotado pra não virar
mistério na próxima ronda.
