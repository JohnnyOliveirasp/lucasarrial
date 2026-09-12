# Ronda das falhas — 12/09/2026 ~15h40–16hZ (12h40 BRT)

Canal: ordem de **31/08** — tudo de FastCloner vai pro **grupo**, e só pro grupo
(`notify-grupo.sh`). Este arquivo é o log técnico da ronda, não mensagem pro Johnny.

Repo em `main`, `pull --ff-only` limpo. Li `_frank/ordens/README.md`, a ordem de
**27/08** (só erro de sistema vira chamado) e a de **29/08** (planilha desligada).
**Nada da planilha foi lido, escrito, classificado ou reprocessado.**

Fila na entrada: **79 abertos** (3 com 30d+, 13 na faixa 7–15d, 28 com menos de 3d).

---

## 0. O que eu peguei, e por quê

Pela regra 8 os quatro mais velhos estão parados por decisão que **não é minha**, e
conferi um por um antes de descartar:

| # | idade | por que não anda comigo |
|---|---|---|
| `#312` `c726c5ae` | 95,0d | 2ª tentativa de contato **vence 15/09**; hoje é 12. Item com data = saiu do meu colo (regra 8). |
| `#313` `2d0509b4` | 95,0d | decisão **comercial do Johnny** (honrar ou revogar 15 vitalícios), parada há 5 dias. |
| `#15` `d3d8d1b2` | 44,1d | critério de fechamento é **30 dias limpos** ou ocorrência nova com a régua nova. |
| `ce6e157d` (Katia) | 24,1d | o que sobrou é **juízo de ouvido humano** (repor `tts_silence_ms=466`), escalado 09/09 e 10/09. |

Peguei o **`#52` (`37bacb68`, 23,9d, 19 alunos na lista)** — o mais antigo em que a
bola era **nossa**. E ele estava disparando: `last_seen_at` de **hoje**.

---

## 1. O fix do PR #244 está em produção — e hoje ele foi exercitado pela 1ª vez

Conferido por **run concluído**, não por PR verde: merge `7bcf686`, workflow
*Deploy Frontend (production)* **success em 11/09 22:53:31Z**.

Desde o deploy: **37 gerações, 36 `ready`, 1 falha** — a de hoje, 15:41:31Z.

**A perna mecânica funciona.** Geração `b744e6da` (aluno
`gabriel.reis2212.pt@gmail.com`, conta nova de 11/09, assinatura de 100k créditos,
105 chars): falhou `qa_coverage`, o **reenvio automático disparou**
(`request_attempts=2`) e o reenvio **entregou** — li a row com `status=ready`,
`error_message=null`, `duration 8,432s`, `elapsed 34,91s`.

---

## 2. Mas o aluno não foi poupado — que é exatamente o defeito que o #244 dizia curar

Enquanto o job do reenvio ainda corria, o **caminho de falha rodou por cima**:

- estorno de **+400 às 15:42:27Z** (`ref_type=generation_refund`, conferido por
  `ref_type` e **nunca por `kind`** — a armadilha de 20/08);
- row marcada **`failed`** com o erro `qa_coverage` — eu li a row **nesse estado**
  às ~15:42:5x, e li ela **`ready`** ~60s depois.

Uma row só vai de `failed` para `ready` se a falha foi escrita com trabalho **vivo**
em andamento. Consequência medida, e é ela que importa: o aluno viu *"falhou,
créditos devolvidos"*, **desistiu daquela geração e refez na mão** às 15:43:59Z
pagando outros −400 (`1af72d91`). Ou seja, **a casa jogou o trabalho no aluno** —
a frase que abre o PR #244 como sendo o defeito a corrigir.

**Dinheiro:** aluno **não** está no prejuízo. `b744e6da` (−400/+400) e `1af72d91`
(−400 às 15:43:59, +400 às 15:47:11) somam **zero**, casados por `ref_id`. Quem
pagou foi a casa: entregou um áudio pronto **e** estornou. **Não estornei nada.**

---

## 3. Causa, lida no fonte

O gate idempotente da falha reivindica **só por status**:

- `frontend/src/app/api/v1/webhooks/runpod/route.ts:~264`
- `frontend/src/app/api/v1/generations/[id]/route.ts:~92`

```
.in("status", ["pending", "generating"])
```

Só que o reenvio **deixa a row em `pending` de propósito** (`reenviar.ts:105-108`,
claim atômico `status=pending` + `request_attempts+1`). Então a falha **atrasada do
job velho** cai em `tentarReenviar`, lê `request_attempts=2`, recebe **`"nao_aplica"`**
(`reenviar.ts:100` — que confunde *"tentativas esgotadas"* com *"não é caso de
reenvio"*), passa reto pro caminho de falha, **acha a row em `pending`** e reivindica:
estorna e marca `failed` por cima de um job vivo.

O comentário de `reenviar.ts:154-157` afirma que o webhook atrasado é neutralizado
porque *"o gate de status já terá mudado de mãos"*. **É falso** — o status
pós-reenvio é justamente `pending`, que é o que o gate aceita.

### Limite da prova (escrito de propósito)

**Provado:** o reenvio disparou; o estorno existe no extrato (sobrevive ao DELETE da
row); a mesma row foi `failed` e depois `ready`.
**Leitura de fonte, não medição:** *qual* dos dois chamadores escreveu a falha.
Descrevi o **poll** porque é o único que fecha com o relógio — o estorno caiu 16s
depois do reenvio ser submetido, cedo demais pra ser exaustão legítima da 2ª
tentativa (que precisa de 5 regenerações). Não tenho log de servidor pra cravar.
A hipótese alternativa é improvável pelo tempo, **mas não a refutei** — e as duas
caem no mesmo buraco, então o conserto não muda.

---

## 4. Tamanho, sem inflar

Varri as **1.187 gerações desde 28/08**. Só **7** tiveram reenvio
(`request_attempts>=2`):

| desfecho | n |
|---|---|
| `ready` **sem** estorno (reenvio limpo) | 5 |
| `failed` **com** estorno legítimo (as duas tentativas morreram, `executionTimeout` 04/09) | 2 |
| entregue **e** estornado | **0 até hoje** |

A de hoje é a **primeira** — 1 em 8. **Não é sistêmico**, é corrida de janela
estreita. O que mudou: o #244 trouxe a classe `qa_coverage`, **muito** mais
frequente que timeout, então a janela passa a ser sorteada bem mais vezes.

---

## 5. O que NÃO virou achado (registro pra ninguém reaproveitar errado)

O texto de hoje era **espanhol numa voz pt** (`language:"pt"`, transcript da
referência em português) e as faltantes eram palavras espanholas. **Tentei virar
isso em classe e não virou:** nas 28 falhas `qa_coverage` desde 01/08,
`coverage_idioma_divergente>0` aparece em **4**, e as 4 são o **whisper errando o
idioma de prosa portuguesa comum** (o caso do Ronald, 27/08, lido como `id` 0,841 e
`en` 0,34). A divergência medida é **cegueira do QA**, não aluno escrevendo em outra
língua. Espanhol-em-voz-pt fica como **observação de n=1**, não como causa.

---

## 6. O que eu fiz

- **2 notas** no `#52` (46 → 47 → 48), 1 linha afetada em cada, conferido na releitura.
- **Card `fba6ffd6` aberto pro `coder`**: pôr o `runpod_job_id` no próprio gate
  (`.eq("runpod_job_id", jobId)` junto do `.in("status", ...)`). Se a row já trocou de
  job, o UPDATE afeta 0 linhas, `claimed` volta vazio, não há estorno nem `failed`.
  É o mesmo padrão idempotente que já está ali — sem tabela nova e **sem migration**.
  Pedi teste de corrida, **teste de controle** (falha legítima tem que continuar
  estornando — regressão aqui seria pior que a corrida) e teste de mutação.

## 7. O que eu não fiz, e por quê

- **Não fechei o `#52`** (regra 14): o conserto não está em produção.
- **Não escrevi pro aluno.** Ele se destravou sozinho enquanto eu media: às 15:48:57Z
  trocou pro português (`df65ae14`), e o texto português dele de 14:18 (`f23dd5e9`)
  saiu `ready` com cobertura 1,00. Não perdeu crédito, não está sem áudio. E-mail
  sobre falha que ele já contornou seria ruído.
- Não mexi em crédito, GPU, migration, acesso nem voz. Nada da planilha.
- Não commitei a árvore de trabalho do SGP (frente de outra pessoa, não minha).

## 8. Dívida que segue registrada e não tratada aqui

- 4 patches do Vigia sem tratar em `agent_state`: `7578c587`, `81438b60`, `3dbd2bf0`,
  `12d4db57`.
- As duas rows de hoje (`b744e6da`, `1af72d91`) foram **apagadas pelo aluno** do
  histórico. O débito órfão no extrato é o comportamento normal do DELETE (armadilha
  já registrada), **não bug novo** — mas significa que a evidência do `#52` só existe
  agora nestas notas e no extrato.
