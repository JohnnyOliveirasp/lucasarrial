# Ronda diária do QA de áudio (qa_coverage) — 23/09/2026

Leitura às 15:13Z. Dia **não limpo**: 1 aluno pagante travado agora.

---

## 0. O que muda a partir de hoje (a lição da ronda)

**A geração não é a unidade de análise. O ALUNO é.** As 3 falhas de
`qa_coverage` da régua nova são **o mesmo aluno, o mesmo texto**, tentado de
novo. Falha CAUSA retentativa, então contar geração como evento independente
fabrica correlação:

| teste | comparação | p | leitura |
|---|---|---|---|
| por **geração** | 3/119 vs 3/1226 | **0,0111** | "subiu 10x, a régua nova piorou" |
| por **aluno** | 1/54 vs 3/353 | **0,4354** | não há nada |

O primeiro número é o que eu teria reportado. Ele é **falso** — não porque a
conta esteja errada, mas porque o denominador conta retentativas como pessoas.
Toda a série de lições desta ronda vigia *qual janela* e *qual régua*; esta é a
primeira sobre **qual unidade**. Regra nova: quando o modo de falha provoca
retentativa, o n que vale é o de **alunos atingidos** (ou textos distintos),
e o de gerações entra só como contexto rotulado.

---

## 1. PASSO 1 — qual régua está no ar

**A régua mudou em 21/09 e a ronda daquele dia não soube.** O build
`94c2a825` terminou **21/09 19:27:52Z**, depois da ronda das 15:19Z.

Critério, não gatilho — `git diff --numstat 94c2a825^1 94c2a825`:
`tts_qa/canon.py` **NOVO** (203 linhas), `metrics.py` 196+/39−,
`loop.py` 87+/7−, `text.py` 22+/2−, `inference.py` 13+/4−.

O que muda a DECISÃO (`metrics.py`, função `chunk_coverage`):

```python
return round((d.casadas + len(d.grafias)) / len(expected), 3)
```

**Divergência de grafia passou a contar como coberta.** Mesmo piso, mas a
cobertura SOBE para o mesmo áudio ⇒ **o portão ficou MAIS PERMISSIVO**. Isso é
corte de régua. (O comentário no código diz 18/09; só chegou ao ar em 21/09
19:27Z — vale o término do deploy, nunca o commit.)

**Piso conferido no blob, não na memória** (lição de 21/09): `qa.coverage_min`
= **0.85**, valor ÚNICO em 1.535 gerações com telemetria, e **0.85** também nas
93 pós-corte. O piso não mudou de número; mudou o que entra na conta.

Builds de hoje:
- `7dc53d7a`, verde, terminou **hoje 14:16:11Z** — `inference.py` 23+/3−,
  `tts_qa/loop.py` 59+/1−, `test_tail_qa.py` 73+/0−. Li o diff inteiro: grava
  `tail_interno_entregue_pos_s` (ONDE a fronteira reprovada caiu). **Telemetria
  pura, não toca limiar nem fluxo — NÃO é corte.** Entra como contexto porque o
  `saveTemplate` reciclou a frota às 14:16Z (cold start).
- um build **in_progress** desde 14:47:53Z. Às 15:13Z são ~26 min, dentro da
  faixa normal de 28-52 min. **Não está travado.**

---

## 2. PASSO 2 — os números

| janela | total | falhas | taxa | qa_coverage | veredito |
|---|---|---|---|---|---|
| **BASELINE** f8586783 (05/09 → 21/09 19:27Z) | 1.226 | 18 | 1,47% | 3 (**0,24%**) | a base de comparação |
| 21/09 antes do corte | 46 | 0 | 0,0% | 0 | n<20, não concluo |
| 21/09 depois do corte | 28 | 0 | 0,0% | 0 | n<20, não concluo |
| **ONTEM 22/09** inteiro | 63 | 2 | 3,17% | 1 (1,59%) | 2 eventos, não tendência |
| **HOJE** até o build 14:16Z | 24 | 2 | 8,33% | 2 (8,33%) | n=24 e **as 2 são o mesmo aluno** |
| HOJE depois do build 14:16Z | 4 | 0 | 0,0% | 0 | **n=4, pequeno demais** |
| **ACUMULADO RÉGUA CANON** (21/09 19:27Z → agora) | **119** | 4 | 3,36% | 3 (**2,52%**) | ver §0 — **não concluo** |

**Alunos**, que é a unidade que vale: baseline **3 atingidos / 353 ativos**
(0,85%); canon **1 atingido / 54 ativos** (1,85%). Um aluno em 54 não cruza
p<0,05 contra base de 0,85% — a célula rara vale **1**. **Não dá pra concluir
melhora nem piora da régua canon com este n.**

Texto distinto por trás das falhas: baseline **3** (354ch, 1521ch, 28ch);
canon **1** (1944ch, repetido 3x).

### Denominador que encolhe
`qa_coverage` desde 25/08: **16** hoje vs **13** que a ronda de 21/09 registrou,
delta **+3** — exatamente as 3 novas. **Nada foi apagado.** Falhas totais desde
25/08 = 35. Presas hoje: **0**. `failed` com `error_message` vazio hoje: **0**.

### Taxonomia inteira (7 dias, lição de 17/09)
`RunPod COMPLETED` 9x (todas de 17/09, dia já conhecido) · `qa_coverage` 4x ·
`SubprocException` 1x · `unknown` 1x · `O áudio saiu incompleto` 1x ·
`executionTimeout exceeded` 1x. Nenhuma assinatura nova.

### Elapsed — reprovação ou hang?
| grupo | n | mediana | p90 | max |
|---|---|---|---|---|
| `ready` baseline | 900 | 95,37s | 173,88s | 378,88s |
| `ready` régua canon | 90 | 99,66s | 187,81s | 255,29s |

As falhas do Diego: 128,9s / 158,8s / 158,9s — **faixa normal, é reprovação de
QA, não hang**. Pós-reciclagem de hoje: n=2, **não concluo sobre cold start**.
Incidente `d3d8d1b2` **segue fechado** (1 executionTimeout em 22/09, isolado).

---

## 3. PASSO 3 — quem falhou

### 🔴 Diego Vargas — `diegoavnunes@gmail.com` — **TRAVADO AGORA**
Aluno pagante (crédito de assinatura 100.000 em 22/09, pagamento `HP2861842001`).
`access_until` = **29/09** — seis dias.

| quando | status | texto | elapsed |
|---|---|---|---|
| 22/09 21:41Z | ready | 97ch | — |
| 22/09 21:47Z | **ready** | 1944ch | 255,3s |
| 22/09 21:55Z | failed | **1944ch** | 128,9s |
| 23/09 11:43Z | failed | **1944ch** | 158,8s |
| 23/09 11:48Z | failed | **1944ch** | 158,9s |

O texto é o roteiro padrão de teste de voz. Ele treinou uma voz às 21:17Z
(−10.000 créditos) e **o mesmo texto passou uma vez e reprovou três**. Flaky
sobre entrada idêntica, não determinístico. **Não voltou a gerar desde 11:48Z.**
Estorno não é reparação: o aluno continua sem o áudio, com 6 dias de acesso.

**Anomalia de crédito — relato, não mexo.** As 2 falhas de hoje **nunca foram
debitadas** (não há linha `ref_type='generation'` para elas). E o estorno de
+1.944 das 12:31Z aponta para `1c761a52`, que é uma geração **`ready`, bem
sucedida**. No líquido ele não ficou no prejuízo, mas o estorno referencia a
geração errada. Conferido por `ref_type='generation_refund'`, nunca por `kind`
(o `kind` é `extra_purchase`).

### 🟢 Rodrigo Sirahata — `rsirahata@gmail.com` — resolvido
`executionTimeout exceeded` às 644,3s em 22/09 12:54Z (hang). Estornado às
13:15Z **e voltou**: gerou com sucesso às 17:45Z e 19:50Z do mesmo dia. Acesso
até 16/10. O indicador de dano é o retorno, e ele retornou.

Nenhuma conta de admin/sócio entra nas contas acima.

---

## 4. O que NÃO fiz
Não respondi aluno, não mexi em crédito, não fechei nem reabri incidente, não
recriei endpoint do RunPod.
