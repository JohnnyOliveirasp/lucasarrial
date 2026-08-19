# ORDEM: 3 incidentes do teu QA de completude — medição FEITA, falta a cura

Data: 19/08/2026 ~19h UTC · De: agente da sessão do Johnny (desktop)
Incidentes: `2949257c` (burst paulo) · `37bacb68` (4 ocorrências) · `c4b892e9` (tiago)

## O que já foi feito (não repetir)

O Executor das :23 diagnosticou às 18:25 e deixou o plano. Eu executei o
**passo (a)**: puxei o `coverage_best` real dos jobs no RunPod
(endpoint `2jcta960kzc2m4`):

| job | aluno | coverage_best | chunk que falhou |
|---|---|---|---|
| 62b1b863…-e1 | paulogmarinho | **0.222** | 9 de 14 |
| ca27bd96…-e1 | pestanatiago | **0.609** | 0 |
| b85f2840…-e1 | pestanatiago | ~0.609 (mesmo texto, 2ª tentativa) | 0 |
| 8aee49c0…-e2 | paulogmarinho | **0.80** | 0 (borderline) |

Desde 17:00 UTC: **21 ready × 5 failed** — o guard NÃO está derrubando
geral; bate nessas 2 vozes.

## Veredito

**Hipótese 2 do Executor confirmada: cobertura REAL baixa.** 0.222 e 0.609
não são falso negativo de Whisper — o áudio sai sem pedaços do texto mesmo.
É exatamente o defeito do caso Katia; antes do teu guard esses alunos
receberiam áudio quebrado E cobrado. **O guard fica. NÃO baixar o
TTS_COVERAGE_QA_MIN por causa disto.**

## O que falta (teu, nesta ordem)

1. **Investigar a referência das 2 vozes** (paulogmarinho e pestanatiago):
   ouvir a ref, ver duração/qualidade, comparar `text_normalized` × áudio.
   ⚠️ Regra dura: **NUNCA cortar ref por timestamp do Whisper** (caso
   Carlos/DEIZI) e lembrar que a cura da Claudia PIOROU e foi revertida —
   qualquer mass-heal só com QA que pegue omissão no meio.
2. **Avaliar TTS_COVERAGE_QA_RETRIES 3→4** pelo caso 0.80 (borderline).
   Custo: +1 regeneração de GPU no pior caso. Decisão tua com número.
3. Falar com os 2 alunos SÓ depois de ter cura ou explicação (via Fast,
   SMTP suporte@). O estorno automático já cobriu o crédito.
4. Fechar os 3 incidentes (fixed/ignored conforme o desfecho) — regra:
   incidente corrigido = FECHAR na hora.

## Lembrete pendurado

O 4º incidente aberto, `d3d8d1b2` ("tempo de execução estourado", 13
alunos, reincidiu 18/08), está diagnosticado desde 31/07 (a rota
/voices/[id]/generate não passa executionTimeout por job) e **continua sem
causa-raiz corrigida — é teu também**, já estava na fila do handoff.
