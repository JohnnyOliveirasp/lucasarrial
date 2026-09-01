# Ronda diaria — saude do QA de audio (qa_coverage)

- **Data da ronda:** 2026-08-24, medido as 15:07Z (11:07 local)
- **Fonte:** tabela `generations` (paginada, 787 linhas desde 17/08), `profiles`, `credit_transactions`
- **Scripts:** `/tmp/perf/qacov.cjs`, `/tmp/perf/qacov_deploys.cjs`, `/tmp/perf/qacov_alunos.cjs`

---

## TL;DR

1. **Houve uma regressao real na madrugada.** O deploy `600ddb1` ("corte em palavra",
   23/08 22:13Z) coincide com um salto de **1,1% -> 12,0%** de falha. n=50, 6 falhas.
   Isso NAO e ruido: a janela anterior tinha 2 falhas em 182 geracoes.
2. **Sairam 3 deploys de worker hoje** (11:13, 13:36, 14:18). Desde as 11:13: **0 falhas
   em 21 geracoes**. **n=21 e pequeno demais pra declarar que a correcao pegou.**
   Com 21 amostras e zero falhas, a taxa real ainda poderia ser ~13% que eu veria zero
   do mesmo jeito. **Nao da pra concluir. Tem que remedir com mais volume.**
3. **Ninguem esta travado agora.** Nenhuma geracao em estado aberto; as ultimas 12 sairam
   `ready`. Ultima falha foi 03:41Z.
4. **3 alunos terminaram em falha e nao voltaram** (detalhe abaixo). Todos estornados —
   mas estorno nao devolve o audio que eles queriam.
5. **O hang voltou uma vez** (23/08 23:41, 1811s). Incidente d3d8d1b2 estava fechado como
   aceite de risco. **Nao reabri** (fora do meu escopo) — fica o registro pro Johnny decidir.

---

## PASSO 1 — Qual regua esta no ar

Ultimo run VERDE do `runpod-worker.yml`: **`9214e86`** — "Merge PR #47 fix/qa-coverage-idioma-do-texto"
**Termino (updatedAt): 2026-08-24T14:18:51Z.** Tocou `runpod-worker/handler.py` (+ testes,
`voice_pipeline/training.py`). Caminho completo: build -> GHCR tag do sha -> saveTemplate ->
recicla workers. **Verde aqui = no ar de verdade.**

Nenhum run falhado no topo. Nada in_progress. **Deploy esta saudavel.**

Ressalva importante: **a regua mudou 3x hoje**, nao 1x. Tratar como um unico corte
"antes/depois" esconde o que aconteceu:

| Termino (updatedAt) | sha | O que era |
|---|---|---|
| 2026-08-23T22:13:58Z | `600ddb1` | corte em palavra |
| 2026-08-24T11:13:43Z | `e91b7ce` | instrumentar hang d3d8d1b2 (nao mexe no qa_coverage) |
| 2026-08-24T13:36:10Z | `2899818` | qa_coverage: sigla soletrada (PR #46) |
| 2026-08-24T14:18:51Z | `9214e86` | qa_coverage: idioma do texto (PR #47) |

---

## PASSO 2 — Medicao

### Corte pedido pela rotina (ontem / hoje-antes / hoje-depois)

| Janela | Total | Falhas | qa_coverage | Taxa qa_cov |
|---|---:|---:|---:|---|
| Baseline 17/08 -> 22/08 | 635 | 10 | 8 | 1,3% |
| ONTEM 23/08 (dia inteiro) | 100 | 5 | 4 | 4,0% |
| HOJE ate o build verde (14:18:51Z) | 47 | 3 | 3 | 6,4% |
| HOJE depois do build verde | **4** | 0 | 0 | **n pequeno demais pra concluir** |

### Corte por deploy REAL (o que de fato explica)

| Janela | Regua | Total | Falhas | qa_cov | Hang |
|---|---|---:|---:|---:|---:|
| 17/08 -> 20/08 11:41 | anterior | 375 | 10 (2,7%) | 8 (2,1%) | 2 |
| 20/08 11:41 -> 21/08 21:46 | `aae3ba5` mede a FORMA | 158 | 0 (0,0%) | 0 | 0 |
| 21/08 21:46 -> 23/08 22:13 | `080dd74` pausa da voz | 182 | 2 (1,1%) | 2 (1,1%) | 0 |
| **23/08 22:13 -> 24/08 11:13** | **`600ddb1` corte em palavra** | **50** | **6 (12,0%)** | **5 (10,0%)** | **1** |
| 24/08 11:13 -> 13:36 | `e91b7ce` | 12 | 0 | 0 | 0 |
| 24/08 13:36 -> 14:18 | `2899818` #46 | 5 | 0 | 0 | 0 |
| 24/08 14:18 -> agora | `9214e86` #47 | 4 | 0 | 0 | 0 |

**Leitura honesta:**
- A janela do `600ddb1` e a **pior da semana** (12,0%). Comparada com as 182 geracoes
  anteriores a 1,1%, e sinal, nao ruido.
- As tres janelas de hoje somadas dao **n=21, 0 falhas**. Individualmente (12, 5, 4) nenhuma
  sustenta conclusao nenhuma.
- **Cuidado com falso alivio:** as falhas pararam as **03:41Z**, ou seja **~7h30 ANTES** do
  primeiro deploy de hoje (11:13). O silencio comecou sozinho, antes de qualquer correcao.
  **Nao da pra creditar a calmaria aos fixes #46/#47.** Pode ser so o vale de trafego da
  madrugada + o tipo de texto que estava entrando.

### Ritmo por dia (pra dimensionar o n)

| Dia | Total | Falhas | qa_coverage |
|---|---:|---:|---:|
| 17/08 | 103 | 0 | 0 |
| 18/08 | 128 | 2 | 0 |
| 19/08 | 105 | 4 | 4 |
| 20/08 | 135 | 4 | 4 |
| 21/08 | 69 | 0 | 0 |
| 22/08 | 96 | 0 | 0 |
| 23/08 | 100 | 5 | 4 |
| 24/08 (parcial, ate 15:07Z) | 51 | 3 | 3 |

~100 geracoes/dia. Pra ter n>=20 numa janela precisa de **~5h de trafego**. O deploy das
14:18 tem 49 min de vida — por construcao ainda nao da pra medir.

### elapsed_seconds (reprovacao vs hang)

Falhas de hoje: 23,6s / 148,6s / 142,3s — **todas tempo normal = reprovacao do QA**, nao hang.
Unico hang da semana recente: 23/08 23:41, **1811s**, `executionTimeout exceeded`.
Hangs anteriores: 18/08 x2. Depois 5 dias limpos, e voltou uma vez.

---

## PASSO 3 — Quem falhou

6 alunos desde 23/08. **Todos com estorno confirmado por `ref_type='generation_refund'`**
(8 estornos no total; todos gravados com `kind='extra_purchase'`, como esperado — por isso
nao se filtra por `kind`). Nenhum admin/socio na lista.

| Aluno | Falhas | Estorno | Voltou depois? |
|---|---:|---|---|
| Tullio Jeronimo — tulliojeronimo@gmail.com | 2 | SIM (1829 x2) | **Sim**, 19:43 `ready` |
| Rene Lopes — renelopes170@gmail.com | 1 | SIM (959) | **Sim**, 00:28 `ready` |
| Jonatan Silveira — j2sproducoes@gmail.com | 1 | SIM (433) | **Sim**, 03:48 `ready` |
| **Janete Cazarotto — janetecasarotto2@gmail.com** | 2 | SIM (400 x2) | **NAO** — parou no hang de 23:41 |
| **Danielle Calegari — danicale@gmail.com** | 1 | SIM (472) | **NAO** — parou na falha de 23:39 |
| **Elvislandi — drelvislandi@gmail.com** | 1 | SIM (763) | **NAO** — parou na falha de 01:35 |

**Os 3 de baixo sao os que importam.** Foram estornados, mas nao voltaram — ou seja,
continuam sem o audio que pediram. Nao sao "caso resolvido".

**Ponto extra sobre a Janete:** `access_until = 2026-08-24T12:00:00Z`, que **ja venceu**
(agora sao 15:07Z). Ela levou o hang, foi estornada em 400 creditos, e o acesso expirou
~3h atras. Pode estar com credito que nao consegue gastar. **Nao mexi em credito nem
falei com ela** — fica pro Johnny decidir.

---

## PASSO 4 — Situacao agora

- Status de hoje: `ready`=48, `failed`=3. **Nenhuma geracao presa em estado aberto.**
- Ultimas 12 geracoes: todas `ready`, elapsed 6–171s (normal).
- Ultima geracao: 14:46:49Z, `ready`.
- **Nenhum aluno travado neste momento.**

---

## O que fica pendente pra proxima ronda

1. **Remedir a taxa do `9214e86` quando houver n>=20** (~5h de trafego, ou seja depois das
   ~19:00Z de hoje). Ate la, **qualquer afirmacao de que os fixes #46/#47 resolveram e chute.**
2. Confirmar se o pico de 12% do `600ddb1` de fato morreu ou so estava dormindo no vale
   da madrugada.
3. **Hang voltou uma vez** (d3d8d1b2, fechado como aceite de risco). Nao reabri. Se aparecer
   um segundo, deixa de ser aceite de risco e vira caso.
4. 3 alunos estornados e nao retornados. Nao contatei ninguem.

---

## Fora do escopo (nao fiz, por regra)

Nao respondi aluno, nao mexi em credito, nao fechei nem reabri incidente, nao recriei
endpoint do RunPod.
