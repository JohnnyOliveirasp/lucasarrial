# Ronda das falhas — 12/09/2026 ~16h40–17h20Z (13h40 BRT)

Canal: ordem de **31/08** — tudo de FastCloner vai pro **grupo**, e só pro grupo
(`notify-grupo.sh`). Este arquivo é o log técnico da ronda, não mensagem pro Johnny.

Repo em `main`, `pull --ff-only` limpo. Li `_frank/ordens/README.md`, a ordem de
**27/08** (só erro de sistema vira chamado) e a de **29/08** (planilha desligada).
**Nada da planilha foi lido, escrito, classificado ou reprocessado.**

Fila na entrada: **79 abertos** (3 com 30d+, 3 na faixa 15–30d, 13 na 7–15d, 28 com
menos de 3d). 4 patches do Vigia em `agent_state` seguem sem tratar.

---

## 0. Primeira coisa: a ronda anterior não commitou o próprio log

`_frank/prova/2026-09-12_rotina_falhas_16h.md` estava **untracked** na árvore. Pelo
passo fixo de fim de ronda, registro que não está na `main` é registro que ninguém
lê — inclusive eu na ronda seguinte. Commitado nesta ronda junto com o
`_frank/ferramentas/idade_incidentes.cjs`, que também estava solto.

---

## 1. `#52` (`37bacb68`): o gate da falha por job ESTÁ EM PRODUÇÃO

Item que a ronda das 16hZ deixou no passo "conserto não está em produção". Levado
até o fim aqui.

**Revisei o PR #252 eu mesmo antes de mergear** (a entrega era do `coder`, a
qualidade é minha):

- `node --test src/lib/generations/falha-claim.test.ts` → **10/10 pass**;
  `src/lib/generations/*.test.ts` → **52/52 pass**. Rodado por mim, em worktree
  próprio no `origin/feat/gate-falha-por-job-id` (`eb01861`).
- `npx tsc --noEmit` → **só** o erro pré-existente da main
  (`src/lib/onboarding/resgate-audio.test.ts`, vitest). Zero novo.
- O `coder` também reportou mutação: neutralizando a condição nova caem 3 dos 10.

**Merge `676f64f` 16:43:10Z. Deploy `Deploy Frontend (production)` run
`34706088944` CONCLUÍDO `success` 16:46:11Z** — conferido por *run concluído*,
nunca por PR verde nem por card "completed".

O conserto: o claim da falha virou `lib/generations/falha-claim.ts`, com
`id` + `status` em andamento + **`.eq("runpod_job_id", jobId)` quando há job**.
Falha atrasada de job **velho** afeta 0 linhas → sem `failed` e sem estorno por
cima do reenvio vivo. `jobId` nulo mantém o gate de hoje, de propósito: falha
legítima **tem** que continuar estornando.

### 1-B. O resíduo que eu medi e NÃO está coberto (escrito pra não inflar a entrega)

Sobra uma janela **curta** em `reenviar.ts`: entre o claim
(`status=pending` + `request_attempts+1`, linha ~106) e o `UPDATE` do
`runpod_job_id` (~linha 155) a row ainda aponta pro job **velho**, então uma falha
atrasada dele **ainda reivindica**. Antes a janela era o tempo de vida do job
(~30s+); agora é o tempo do submit na RunPod.

**Por que não fechei essa também:** a saída óbvia (limpar `runpod_job_id` no
claim) tem regressão pior. O `catch` de `reenviar.ts:159` conta explicitamente com
o caminho de falha reivindicando pra **estornar** o aluno quando o submit estoura;
zerar o job ali tiraria o estorno de falha legítima. Fica registrado como risco
conhecido, não como pendência silenciosa.

### 1-C. Por que o `#52` continua `investigating` (regra 14)

Critério de fechamento escrito na nota 49 do próprio incidente: **`#52` só vira
`fixed` quando UMA nova exaustão de `qa_coverage` passar pelo reenvio sem row
`failed` e sem estorno.**

Hoje existe **uma** ocorrência com as duas pernas no ar (`b744e6da`, 15:41Z) e
**nela o aluno sofreu** — viu *"falhou, créditos devolvidos"*, desistiu e refez na
mão. A perna do gate subiu **depois** disso, às 16:46Z, e ainda não foi exercitada
em produção. Fechar hoje seria fechar mais rápido do que resolve.

Estado medido agora: **39 gerações desde o deploy do #244** (11/09 22:53Z),
**0 `failed`**. Os 7 reenvios desde 28/08 seguem 5 `ready` limpos + 2 `failed` com
estorno legítimo (`executionTimeout` de 04/09, classe do `#15`). As 2 rows de hoje
foram **apagadas pelo próprio aluno** — a evidência vive nas notas e no extrato.

---

## 2. Segundo item: `#226` (`702cc916`) — peguei a parte AUTORIZADA, parada 11 dias

Depois do `#52` sair do meu colo, corri a fila por idade. Os mais velhos seguem
parados por decisão que **não é minha**, e conferi um por um antes de descartar:

| # | idade | por que não anda comigo |
|---|---|---|
| `#312` `c726c5ae` | 95,0d | 2ª tentativa de contato vence **15/09**; hoje é 12. |
| `#313` `2d0509b4` | 95,0d | decisão **comercial** do Johnny (15 vitalícios). |
| `#15` `d3d8d1b2` | 44,2d | fecha com 30 dias limpos ou ocorrência nova sob a régua nova. |
| `ce6e157d` (Katia) | 24,2d | juízo de **ouvido humano**, escalado 09/09 e 10/09. |
| `6c38c99d` (Luciano) | 20,0d | falta **uma frase do Johnny/Lucas**, pendente desde 24/08; e o compromisso na caixa dele é escrever **perto de 19/09**. Escrever hoje, a 7 dias, seria a 13ª cópia da mesma escalação (regra 7). |
| `506b7c3a` (Alana) | 11,0d | respondida por mim em 09/09, cópia confirmada — bola com ela. |
| `f8587cef` | 10,0d | varredura das referências cortadas já está rodando no cartão `77354ee2`. |

Sobrou o **`#226`** (11,0d, **290 ocorrências, 132 de 180 alunos**): entregamos
áudio que o **nosso próprio QA reprovou** (`runpod-worker/tts_qa/loop.py:341-344`
dá `break` e entrega o `best_seg` com score > 0).

A decisão de produto (falhar sem cobrar × entregar avisando × manter) é do Johnny
e **não decidi no lugar dele**. Mas o recado de 01/09 (`agent_state`
`para_frank_702cc916`) autorizava uma parte: *"persistir `qa.exhausted` por geração
num campo que o suporte lê, pra Fast identificar quem recebeu chunk reprovado
ANTES do aluno reclamar de voz"*. **Ninguém tinha conferido se já existia.**

**Medido hoje, não inferido:** `exhausted` aparece **zero** vezes em
`frontend/src`. O dado já está no banco (`generations.qa`: `exhausted`,
`exhausted_scores`, `coverage_min_visto`, `faltantes_amostra`, …). O que falta é o
caminho até o humano: o contexto de conta da Fast lê a geração em
`lib/agent/account.ts:208` com `recent("generations","name,status,error_message,created_at")`
— e geração entregue com QA esgotado tem **`status=ready` e `error_message=null`**.

Consequência prática, e ela explica o padrão de atendimento deste chamado: **o
aluno reclama que a voz saiu errada e a Fast olha a conta e vê uma geração
perfeita.** Com o dado na frente ela não tem como culpar o aluno.

**Cartão `487deab7` aberto pro `coder`**, escopo fechado: helper testável lendo o
jsonb, ligação no `account.ts:208` **só** nas gerações com ressalva (pra não
inflar o prompt) e um script read-only pro time listar quem recebeu áudio com QA
esgotado. Proibido por escrito no cartão: mudar a entrega, falhar geração,
estornar, mexer em crédito, tocar no worker, criar migration.

**Trava de fraseado que eu exigi** (por causa da medição de 10/09 neste mesmo
chamado): o veredito diz o **fato do worker** — *"o QA esgotou as tentativas e o
áudio foi entregue assim mesmo"* — e **nunca** "áudio ruim" nem "áudio conferido".
`coverage=1,0` é cega pra **substituição** (geração `1425ca2f` entregou *"faz
falar"* onde o texto dizia *"fácil falar"*, com `coverage_min_visto=1` e zero
faltantes). Ausência de ressalva **não é** prova de áudio fiel. Pedi teste de
**controle** (`qa` nulo, `{}`, sem a chave, `exhausted=0` não podem gerar
ressalva): ressalva falsa faria a Fast acusar defeito onde não houve — pior que o
silêncio de hoje.

---

## 3. O que eu fiz, em uma lista

1. Commitei na `main` o log órfão da ronda das 16hZ + o `idade_incidentes.cjs`.
2. Revisei, rodei os testes e **mergeei o PR #252**; confirmei o deploy por run
   concluído (`success` 16:46:11Z).
3. Nota 49 no `#52` com o conserto, o **resíduo medido** e o critério explícito de
   fechamento. 1 linha afetada, conferida na releitura.
4. Nota 49 no `#226` com o buraco medido (`exhausted` = 0 ocorrências no frontend)
   e o cartão `487deab7` pro `coder`.
5. Grupo avisado (fato consumado: fix em produção + PR + por que o `#52` não
   fechou).

## 4. O que eu NÃO fiz, e por quê

- **Não fechei nenhum incidente.** Os dois que peguei não atingiram o critério de
  fechamento que está escrito neles. Regra 14 inteira.
- **Não escrevi pra aluno nesta ronda.** O do `#52` se destravou sozinho (trocou
  pro português e a geração saiu `ready`); e-mail sobre falha que ele já contornou
  é ruído. O do `#226` não tem caso individual novo hoje.
- **Não decidi nada de cobrança** no `#226`: 290 gerações passam fácil de 20k
  créditos e estorno nessa faixa é do Johnny.
- Não mexi em crédito, GPU, migration, acesso nem voz. **Nada da planilha.**
- Não commitei a árvore de trabalho do SGP (frente de outra pessoa).

## 5. Dívida que segue registrada e não tratada aqui

- 4 patches do Vigia sem tratar em `agent_state`: `7578c587`, `81438b60`,
  `3dbd2bf0`, `12d4db57`.
- `6c38c99d` (Luciano): a próxima cobrança de R$ 97 cai em **19/09**, daqui a 7
  dias, e a decisão pedida em 24/08 tem **19 dias**. O compromisso escrito na
  caixa dele é ser avisado perto da data — se a decisão não sair até lá,
  repetimos o 26/08 (cobrado enquanto esperava resposta nossa).
- Resíduo do gate (seção 1-B): janela curta do submit, conhecida e não coberta.
