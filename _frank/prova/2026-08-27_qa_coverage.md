# Ronda diaria — saude do QA de audio (qa_coverage)

**Data:** 2026-08-27 · medido as 15:08 UTC (12:08 BRT)
**Veredito:** dia limpo ate agora, mas **o n nao autoriza dizer que melhorou**.

---

## 1. Qual regua esta no ar

| item | valor |
|---|---|
| ultimo run VERDE do `runpod-worker.yml` | `d399d78` |
| terminou (updatedAt) | **2026-08-27T01:37:42Z** |
| conclusao | success (deploy real: GHCR + saveTemplate + reciclagem dos workers) |
| tocou `runpod-worker/`? | sim — `jobs/inference.py`, `tts_qa/loop.py`, `tts_qa/__init__.py`, `test_coverage_qa.py` |
| o que era | PR #63 — *"telemetria de cobertura mede o audio ENTREGUE, nao o descartado"* |

**Build NAO falhou.** A correcao mais recente ESTA no ar. Corte da regua nova = `01:37:42Z` de hoje
(horario de TERMINO do build, nao do commit).

⚠️ **Ressalva sobre "ontem":** 26/08 teve **4 builds verdes** (18:42, 19:27, 20:08, 21:31 UTC).
O dia de ontem nao e uma regua unica, e um borrao de varias. Serve de contexto, nunca de baseline limpo.

---

## 2. Numeros (denominador na mao)

| janela | total | falhas | qa_coverage | taxa |
|---|---:|---:|---:|---:|
| Baseline 17/08 → 26/08 (historico) | 1009 | 23 | 18 | **2.3%** |
| ONTEM 26/08 inteiro (regua velha, borrao) | 120 | 3 | 3 | **2.5%** |
| HOJE antes do build (00:00→01:37Z) | 9 | 0 | 0 | n=9 — **pequeno demais** |
| **HOJE depois do build (01:37Z→agora)** | **24** | **0** | **0** | **0.0%** |

### O n de hoje passa no limiar mecanico, mas NAO sustenta a conclusao

Isto e o ponto central do relatorio e o motivo desta rotina existir.

- n=24 passa do corte de 20, entao o script marca `conclusivo: true`. **O script esta errado aqui.**
- Na taxa base de 2.3%, o esperado em 24 geracoes e **0.55 falha**. Ver zero e o resultado normal.
- **P(ver ZERO falhas mesmo se NADA tiver mudado) = 57%.** Mais provavel que nao.
- Com 0/24, a taxa real cabe em qualquer lugar entre **0% e 11.7%** (limite superior 95%).
  Esse intervalo *contem* a taxa base de 2.3%. Nao da pra distinguir melhora de acaso.

**Traducao:** hoje nao houve falha, e isso e uma boa noticia factual. Mas dizer "o PR #63 reduziu a
taxa" seria inventar. Precisa de mais 2-3 dias de acumulo na regua nova pra ter n suficiente.
Errar pra mais custa tanto quanto errar pra menos.

### Ritmo diario (pra dimensionar o n esperado)

```
2026-08-17 | 102 | falhas=0  | qacov=0
2026-08-18 | 127 | falhas=2  | qacov=0
2026-08-19 | 105 | falhas=4  | qacov=4   <- reescrita do portao
2026-08-20 | 135 | falhas=4  | qacov=4   <- reescrita do portao
2026-08-21 |  67 | falhas=0  | qacov=0
2026-08-22 |  96 | falhas=0  | qacov=0
2026-08-23 | 100 | falhas=5  | qacov=4
2026-08-24 | 144 | falhas=7  | qacov=5
2026-08-25 | 134 | falhas=1  | qacov=1
2026-08-26 | 120 | falhas=3  | qacov=3
2026-08-27 |  33 | falhas=0  | qacov=0   <- dia em curso (12h BRT)
```

O dia fecha tipicamente em 100-140 geracoes. As 33 de hoje ate 15:08Z estao dentro do normal
pro horario (das 02h as 10h UTC quase nao ha trafego).

---

## 3. Quem falhou

**Ninguem hoje.** As 3 falhas de ontem sao todas do **mesmo aluno**:

- **Alessandro Godoy** — `godoyalessandroadv@gmail.com` (`0affeca0…`), acesso ate 2026-09-02. Aluno ativo, nao e admin/socio.

| horario (26/08) | id | chars | elapsed | leitura |
|---|---|---:|---:|---|
| 15:01:09Z | `17cd7665` | 63 | 278.6s | tempo normal → reprovacao do QA |
| 15:06:25Z | `2ba45f4e` | 63 | 107.8s | tempo normal → reprovacao do QA |
| 15:47:57Z | `03af4c2b` | 621 | 212.5s | tempo normal → reprovacao do QA |

Erro cru, identico nos tres: `qa_coverage: audio gerado nao contem o texto completo apos esgotar regeneracoes`

**Nenhuma e hang.** Os tres tempos ficam na faixa normal (40-230s; o de 278s esta acima da faixa
mas bem abaixo do patamar de hang). Incidente `d3d8d1b2` **segue fechado** — nao ha motivo pra reabrir.

### Estorno: 3 de 3, conferido por `ref_type='generation_refund'`

| geracao | creditos | estorno em |
|---|---:|---|
| `17cd7665` | +400 | 15:06:01Z |
| `2ba45f4e` | +400 | 15:08:15Z |
| `03af4c2b` | +621 | 15:51:43Z |

(Os tres gravam `kind='extra_purchase'` — filtrar por `kind` faria parecer que ninguem foi estornado.)

### O aluno esta travado agora? **Nao.**

Estorno nao e caso resolvido, entao verifiquei o que ele conseguiu entregar de fato:

```
14:50Z ready  103ch
15:01Z FAILED  63ch  <- estornado
15:06Z FAILED  63ch  <- estornado
15:09Z ready   46ch   <- reduziu o texto, passou
15:12Z ready   34ch
15:26Z ready   85ch
15:47Z FAILED 621ch  <- estornado
15:56Z ready  625ch   <- refez praticamente o MESMO texto, passou
16:33Z ready  542ch
16:40Z ready  542ch
16:44Z ready  542ch
```

Ele se destravou sozinho nas duas vezes, e as 4 ultimas geracoes sairam limpas. **Nao ha aluno
travado agora.** Vale registrar o padrao: no caso das 621ch ele refez quase o mesmo texto e passou —
sinal de reprovacao **intermitente**, nao de texto que o portao rejeita deterministicamente.

---

## 4. Conclusao

1. Build no ar e verde; a correcao do PR #63 esta valendo desde 01:37Z de hoje.
2. Zero falhas hoje, mas **n=24 nao permite concluir melhora** — 57% de chance de ver isso mesmo sem mudanca nenhuma.
3. Nenhum aluno travado. As 3 falhas de ontem foram do Alessandro Godoy, todas estornadas, e ele concluiu o trabalho depois.
4. Nada de hang. `d3d8d1b2` continua fechado.
5. **Proxima ronda:** acumular a janela pos-`01:37Z` de hoje. So com ~100+ geracoes na regua nova da pra afirmar se o #63 mexeu na taxa.

---
*Medicao: `/tmp/perf/qacov.cjs` (paginado de 1000, campo `error_message` impresso cru) + `/tmp/perf/quem.cjs`.
Corte = termino do ultimo build verde, nao do commit.*
