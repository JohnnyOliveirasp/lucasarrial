# Ronda diaria — saude do QA de audio (qa_coverage)

**Data:** 2026-08-26 | **Medido as:** 15:10 UTC (12:10 BRT)
**Veredito:** dia LIMPO no fim. Nenhum aluno travado agora. **Nao da pra concluir
piora** na regua nova — os intervalos de confianca se sobrepoem.

---

## Passo 1 — Qual regua esta no ar

Ultimo run VERDE do `runpod-worker.yml` que tocou `runpod-worker/`:

| campo | valor |
|---|---|
| sha | `d238195` |
| conclusion | **success** |
| terminou (updatedAt) | **2026-08-25T19:12:15Z** |
| duracao | ~30 min (18:41 -> 19:12) — dentro da faixa normal (28-52 min) |

Commit: *"merge dev->main: QA de RITMO na geracao + seletor de ritmo (opcao B) +
reference_wav_path + ratio 6.0 (caso Ellen/Johnny 25/08)"*.
Tocou de fato o worker: `jobs/inference.py`, `jobs/tts_settings.py`,
`tts_qa/loop.py`, `tts_qa/rate.py` (+ `test_rate_qa.py`).

**Build NAO falhou.** A correcao mais recente ESTA no ar.

> ⚠️ **Ajuste de janela, deliberado.** O corte caiu **ONTEM a noite**, nao hoje.
> Entao "hoje antes do build" e uma janela VAZIA e o dia de hoje inteiro ja e
> regua nova. Forcar o molde "hoje antes/depois" produziria um denominador zero
> e uma comparacao falsa. Quebrei **ONTEM** em antes/depois — e a unica
> comparacao antes-x-depois honesta que existe hoje.

---

## Passo 2 — Medicao (n=1061 geracoes desde 17/08, paginado de 1000 em 1000)

| Janela | Regua | Total | Falhas | qa_coverage | Taxa qa_cov |
|---|---|---:|---:|---:|---:|
| Baseline 17/08 -> 24/08 | velha | 876 | 22 | 17 | **1.9%** |
| Ontem 25/08 ANTES do corte | velha | 97 | 0 | 0 | **0.0%** |
| Ontem 25/08 DEPOIS do corte | **nova** | 37 | 1 | 1 | **2.7%** |
| Hoje 26/08 ate 15:10Z | **nova** | 50 | 2 | 2 | **4.0%** |
| **Regua nova acumulada** | **nova** | **87** | **3** | **3** | **3.4%** |

### Regra do denominador — leia antes de olhar as %

O n bruto passa do minimo (87 > 20), mas **3 eventos nao sustentam tendencia**.
Intervalo de Wilson 95%:

| | taxa | IC95% |
|---|---:|---|
| Baseline (17/876) | 1.9% | **1.2% – 3.1%** |
| Regua nova (3/87) | 3.4% | **1.2% – 9.7%** |

**Os intervalos se sobrepoem em quase toda a extensao do baseline.**
→ **NAO da pra afirmar que piorou.** Tambem nao da pra afirmar que melhorou.
Uma falha a mais ou a menos move a taxa nova em ~1.1 ponto.

**E tem um problema de independencia mais serio que o n:** as 2 falhas de hoje
sao **o mesmo aluno, o mesmo texto, com 5 min de diferenca**. Nao sao duas
amostras independentes da taxa de falha — sao **um caso** contado duas vezes.
Contando casos distintos, hoje e **1 em 49 (2.0%)**, nao 4.0%. A taxa de 4.0%
esta inflada por um unico aluno reenviando o mesmo texto.

### Tempo de execucao (separar reprovacao de hang)

Todas as 3 falhas: 107s, 174s, 278s. Faixa de **reprovacao do QA**, nao de hang.
O 278s esta acima da banda tipica (40-230s), coerente com o QA de ritmo novo
consumindo regeneracoes — **nao** e a assinatura do hang.

**Hang (incidente d3d8d1b2):** ultima ocorrencia com esse perfil foi
**23/08 23:41 (1811s)**. **Nao voltou desde entao.** Incidente segue fechado como
aceite de risco. **Nao reabri.**

---

## Passo 3 — Quem falhou

| Aluno | email | Quando | Texto | elapsed | Estorno |
|---|---|---|---|---:|---|
| Janete Cazarotto | janetecasarotto2@gmail.com | 25/08 21:44 | ingles, 275ch | 174s | ✅ 400 |
| Alessandro Godoy | godoyalessandroadv@gmail.com | 26/08 15:01 | CAIXA ALTA, 63ch | 278s | ✅ 400 |
| Alessandro Godoy | godoyalessandroadv@gmail.com | 26/08 15:06 | CAIXA ALTA, 63ch (mesmo) | 107s | ✅ 400 |

Estorno conferido por **`ref_type='generation_refund'`** (nao por `kind` — o
estorno grava `kind='extra_purchase'` e filtrar por `kind` faria parecer que
ninguem foi estornado). As 3 geracoes: debito de -400 e credito de +400 casados.

Nenhuma conta de admin/socio na amostra — os dois sao alunos reais.

### Aluno travado AGORA: nenhum

Alessandro **se destravou sozinho as 15:09**, sem intervencao:

```
14:50  ready   —      "Oi! Esta é a minha voz clonada..."        (ok)
15:01  failed  278s   "OLÁ,  MEU NOME É ALESSANDRO E ESTA É..."  qa_coverage
15:06  failed  107s   "OLÁ,  MEU NOME É ALESSANDRO E ESTA É..."  qa_coverage
15:09  ready    19s   "Olá! Meu nome é alessandro e esta é..."   (ok)
```

Ele reescreveu o mesmo conteudo **em minusculas** e passou em 19s. Creditos
devolvidos e audio entregue → caso encerrado de fato, nao so estornado.

> Nota: a regra "falha estornada nao e caso resolvido" vale — mas aqui ele
> obteve o audio depois. Se nao tivesse obtido, entraria como travado.

---

## Sinal novo pra investigar (HIPOTESE, nao conclusao)

Texto em **CAIXA ALTA** aparece muito acima do esperado nas falhas de coverage:

| grupo | n | qa_coverage | taxa |
|---|---:|---:|---:|
| ALL-CAPS (>70% maiusculas, >=15 letras) | **14** | 3 | **21.4%** |
| texto normal | 1049 | 17 | **1.6%** |

E ~13x. **Mas o n e 14 — abaixo do minimo de 20, entao nao concluo.** Alem
disso 2 das 3 falhas sao o mesmo texto do Alessandro → **2 casos distintos em
14**. Sinal interessante, longe de provado.

Reforca a hipotese: o proprio Alessandro passou de falha (CAIXA ALTA, 278s/107s)
para sucesso (minusculas, 19s) com o **mesmo conteudo**, em 3 min. E a falha
all-caps de 23/08 (`"HI PEOPLE, WE ARE HERE, HALL'S ON AIR."`).
Contra a hipotese: 11 das 14 geracoes all-caps sairam `ready` normalmente.

Mecanismo plausivel a checar: normalizacao de texto / o TTS tratando caixa alta
como sigla e soletrando, o que derrubaria a cobertura medida pelo Whisper.

**Verifiquei e DESCARTEI** uma hipotese alternativa antes de escrever: se o QA de
ritmo novo estaria furando o gate de coverage. Nao esta —
`TTS_RATE_QA_RETRIES=2` < `TTS_COVERAGE_QA_RETRIES=3`, entao `max_attempts=3` e a
checagem de cobertura roda em toda tentativa; e a penalidade de ritmo
(`int(60*desvio)`, 12-30 pts) fica bem abaixo da de cobertura (100+), entao nunca
escolhe uma tentativa incompleta. Fragilidade latente so se alguem subir
`TTS_RATE_QA_RETRIES` acima de 3 — **nao e o caso hoje**.

---

## Ferramentas

`/tmp/perf/qacov.cjs` (reescrito com as janelas corrigidas + IC),
`/tmp/perf/quem.cjs`, `/tmp/perf/caps.cjs`, `/tmp/perf/stats.cjs`.
Colunas usadas em `generations`: `id, user_id, status, error_message, created_at,
text_raw, elapsed_seconds` (nao existe `user_email`).
`profiles`: `id, email, display_name, access_until` (nao existe `full_name`).

## Nao fiz (fora do meu escopo)

Nao respondi aluno, nao mexi em credito, nao fechei nem reabri incidente, nao
recriei endpoint do RunPod.
