# Ronda das falhas — 23/09/2026 ~13h30–14h15Z

Dono da fila (regra 14-A). Serial (regra 8). **Produção tocada: 2 merges**
(PR #408 e PR #409). Zero GPU, zero migration, zero crédito movido, zero carta
nova a aluno.

---

## 1. Passos fixos — os dois limpos, os dois com instrumento independente

**Reconciliação dos envios** (passo fixo desde 18/09):
`1092 lidas da pasta Sent · 1015 já tinham linha · 77 fora da janela (--corte) ·
0 escrituráveis`. A contagem fecha (1092 = 1092).
Conferido com o **irmão de leitura** (`2026-09-18_enviados_x_tabela.cjs`):
**0 carta depois do corte** fora da tabela. Buraco segue passivo.

⚠️ As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão — é o que o
`--corte` exclui, não é defeito novo.

**Percepção travada** (ordem de 17/09): **0 cartões**, controle positivo (#310)
e negativo (#518) OK, 515 varridos.

**Fila de patches do Vigia:** 0.

---

## 2. A cabeça da fila — conferida um a um antes de escolher

Não escolhi pelo topo da lista: abri os mais velhos e perguntei de cada um *o
que, exatamente, falta, e de quem é a bola*. **Nenhum dos 12 primeiros espera
trabalho meu:**

| cartão | idade | o que falta |
|---|---|---|
| `c726c5ae` | 105,9d | "pode" do Johnny (PR #214 + dinheiro de 23 assinaturas) |
| `d3d8d1b2` | 55,0d | PR #404 aguardando merge |
| `b706b32e` | 40,5d | decisão dos 10.000 cr |
| `37bacb68` | 34,8d | hipótese rebaixada na ronda 13hZ; próximo passo é *entrada que não é fala corrida*, não lista |
| `af06731f` | 25,9d | 2ª tentativa feita 22/09, espera legítima |
| `99a20692` | 23,0d | aluna respondeu, carta 22/09 (uid 3197), bola dela |
| `719c9af6` | 22,6d | decisão de **produto** (motor não anima corpo) |
| `506b7c3a` | 21,9d | palavra do Johnny sobre 10.000 cr de quem nunca pagou |
| `7ed72ad0` | 21,9d | resposta A/B do Johnny sobre 7.455 cr |
| `702cc916` | 21,8d | decisão parada há 21d |
| `b0ddd483` | 21,7d | carta 21/09 (uid 3141), bola dele |

⏰ **A cobrança do `GGMWWE5Q` cai em 26/09 — 3 dias.** Segue no colo do Johnny.

---

## 3. Item serial: `#f8587cef` (20,9d · 609 gerações · 237 alunos)

Mais antigo **com passo concreto ao meu alcance**. O próprio cartão nomeava o
passo (a): **merge do PR #408**. Feito — merge `7dc53d7a`, conferido no
**conteúdo** da `origin/main`.

### 3.1 A revisão é minha, não herdada (regra 14-B)

1. **Stale check primeiro**, que é a família que já queimou 5 vezes aqui.
   Base `06c69229` × main `8ba19de4`: a main andou **20 commits**, e **nenhum**
   tocou os 3 arquivos do PR. Não era stale — e eu sabia disso *antes* de
   mergear, não depois.
2. **`cfg.crossfade_ms` existe** (`tts_settings.py:66`, default 60). Risco real,
   não formalidade: o campo entra no `qa_stats` inicial, roda em TODA geração.
3. **`seg.size` como contagem de amostras não é suposição nova**: a main já usa
   exatamente isso em `inference.py:534`, e `_gerar` devolve `np.asarray` 1-D.
4. **Testes rodados por mim, nos DOIS lados, mesmo instrumento** (venv
   descartável): branch 35 passed/7 failed · main 30 passed/7 failed. Os
   **nomes** das 7 falhas são idênticos (diff vazio) — `huggingface_hub`
   ausente, pré-existente.
5. **Mutação: 3 mutantes, 3 mortos** (baseline 7 failed) → 8 / 8 / 11.
   Restaurado: 7 failed/35 passed, md5 idêntico.

> ⚠️ **A régua de 12h30 pegou a minha própria medição.** A primeira leitura
> saiu `EXIT=0` — e era o exit do `tail` depois do pipe, não do pytest.
> Repetido com redirecionamento: `EXIT_REAL=1`. A régua se pagou no mesmo dia
> em que foi escrita.

### 3.2 O que muda e o que não muda

Toda geração **nova** passa a gravar ONDE a fronteira reprovou. É **telemetria
pura**: nenhum portão lê os campos, e `dur_s=None` preserva o comportamento
anterior. O histórico de 609 **não** ganha posição retroativa.

### 3.3 O que segue bloqueado, com motivo concreto

O passo (b) — escuta ponto a ponto — **continua bloqueado por falta de ouvido**,
e isso não é desculpa minha: reconferido hoje, o `qa` responde *"Not logged in"*.
Declarado pela opção 2 da ordem de 17/09. **Não inventei laudo.**

---

## 4. Fora da ordem serial, e por quê: `#2609241a` (Hellen)

A aluna já estava tratada (carta uid 3249, a primeira em 16 dias). O que **não**
estava era o **defeito**: a nota das 12h12Z deixou escrito *"PENDENCIA CRITICA…
NAO MERGEADO… pode repetir com outro aluno"*.

> Cartão de aluno parado é uma coisa. **Defeito vivo que fabrica vítimas novas
> em silêncio é outra.** Peguei só depois de levar o item serial ao limite.

**PR #409 mergeado** — merge `a35066f4`, deploy do frontend **SUCCESS**.

### 4.1 O risco que este PR tinha e o #408 não: tradução auto-mergeada

Os 3 arquivos de **código** tinham 0 commits na main desde a base. Os **3 JSON
de tradução** tinham 3 cada. JSON auto-mergeado **perde chave em silêncio**, e
"Automatic merge went well" não é prova de nada. Então medi em vez de confiar:
merge de ensaio num worktree, JSON válido nos 3, **1877 → 1878** chaves,
achatadas e comparadas dos dois lados. Sai exatamente 1 chave, trocada por 2.

### 4.2 Suspeita minha, levantada e derrubada por mim

Procurei órfão da chave apagada e achei **dois** arquivos ainda chamando
`uploadFailed`. **Quase virou objeção.** Não é defeito: usam **outros
namespaces** (`sales.voice`, `videoWizard.images`), e as duas chaves seguem
existindo. Registro porque **quase reprovei um PR correto** — e "quase reprovei"
merece o mesmo registro que "quase aprovei errado".

### 4.3 Por que aceitei mergear sem teste de navegador — limite declarado

**Não testei tela, e não escondo.** Sem `qa`, não há navegador. O que me
convenceu foi que **todo caminho de falha é conservador**:

- listagem do R2 falha → `objetosNoR2 = null` → **degrada pro comportamento
  antigo**, não tranca o aluno no fim de um upload longo;
- envio incompleto → **nada é gravado**, a voz fica em `uploading`, só um 409.

O pior caso do que não testei é uma mensagem ruim numa tela que **hoje já dá a
mensagem errada** (acusa a aluna). Não é regressão de espécie. E li o ciclo
ponta a ponta: rota devolve `missing_keys` → `voice-creator.tsx:754` lê →
renderiza `incompleteUpload` com os nomes.

**Anotação pro próximo:** o `ListObjectsV2` **não pagina** (teto 1000). Não
morde com ~20 arquivos; vira teto silencioso se o limite subir.

---

## 5. Fim de ronda

- Produção: **PR #408** (`7dc53d7a`) e **PR #409** (`a35066f4`), os dois
  conferidos no **conteúdo** da `origin/main`.
- Deploy frontend (#409): **SUCCESS** conferido.
- Build do worker (#408): **EM ANDAMENTO**, ~30 min. Histórico da mesma
  esteira: 24–47 min, então está **dentro da faixa normal**.
  ⚠️ **NÃO declaro o #408 em produção** — merge conferido, deploy não.
- Controle negativo pós-merge nos dois: `grep MUTANTE` na `origin/main` = **0**.
  Nenhuma adulteração de teste vazou.
- Migration: nenhuma. DDL: nenhum. GPU: nenhuma. Crédito: nada movido.
- Grupo: postado (fato consumado, sem código, sem saída de terminal).

### Pendências nomeadas (paradas, não "em andamento")

1. 🔴 **Frota morta, 5ª ronda seguida.** Os 9 operários de assinatura Anthropic
   respondem *"Not logged in · Please run /login"*. Sem isso a casa não tem quem
   escreva código, quem teste em navegador nem quem revise entrega. **Hoje
   revisei dois PRs sozinho e não testei tela nenhuma.** É o gargalo real.
2. ⏰ **Cobrança `GGMWWE5Q` em 26/09 — 3 dias.**
3. **PR #214** — "pode" + semear o dedupe na MESMA janela.
4. **PR #404** — aguardando merge (`d3d8d1b2`).
5. **10.000 cr do `b706b32e`** — código em produção, falta a decisão.
6. **`702cc916`** — decisão parada há 21d.
7. **7.455 cr do `7ed72ad0`** — resposta A/B **prometida por escrito ao aluno**.
8. **`f8587cef` passo (b)** — bloqueado por falta de ouvido, não por falta de
   caminho. Destrava junto com a frota.
9. **Hellen (`2609241a`)** — defeito de classe consertado; **a entrega dela
   não aconteceu**. Se passar 7d, 2ª tentativa ou WhatsApp.
10. **77 cartas anteriores a 14/09** — sem decisão de escrituração.
