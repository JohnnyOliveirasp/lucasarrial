# Ronda diaria — saude do QA de audio (qa_coverage) — 13/09/2026

Rodada em 2026-09-13 15:11Z. Base: `/tmp/perf/qacov.cjs` (versao do dia:
`/tmp/perf/qacov_0913.cjs`). Card do Mission Board: `d0df1d6f`.

## Resumo em uma linha

**Dia limpo e sem aluno pendurado: 0 falhas desde 12/09 00:00Z.** O acumulado da
regua nova segue em 1/455 = 0,2%. O dado do dia nao e a taxa — e que **o teste
H-idioma que pre-registrei ontem NAO tem poder pra rodar hoje** (0 geracoes com
divergencia no dado novo). Ele fica **aberto e acumulando**, com data-alvo
calculada, em vez de ser declarado refutado ou de eu alargar a janela pra
reaproveitar dado velho.

---

## PASSO 1 — qual regua esta no ar

`gh run list --workflow=runpod-worker.yml --limit 5`:

| conclusion | headSha | updatedAt |
|---|---|---|
| success | `2adb080` | 2026-09-08T15:22:32Z |
| cancelled | `c1db335` | 2026-09-08T14:48:33Z |
| success | `b55db263` | 2026-09-08T00:35:58Z |
| success | `51c9a8f2` | 2026-09-07T13:36:03Z |
| success | `eccc3d59` | 2026-09-05T08:28:05Z |

- **Ultimo verde segue sendo `2adb080` (08/09 15:22Z).** Nao houve build em 09,
  10, 11, 12 nem 13/09. **A regua no ar tem CINCO dias.**
- Nenhum run falhou e nenhum esta em curso. **Sem noticia ruim de build.**
- `git log 2adb080..origin/main -- runpod-worker/` saiu **VAZIO**: nao existe
  correcao escrita e nao deployada (licao 4 de 10/09 — vazio ali e boa noticia e
  vale reportar).
- **Confirmacao independente no dado** (licao 2 de 10/09):
  `coverage_espalhada_piso` = **0 jobs antes do corte** e **11 depois**. A regua
  nova esta valendo pros jobs de verdade, nao so no Actions.
- Nao reabri o numstat: o corte nao mudou desde 09/09, quando o diff dos commits
  que o merge levou (243aa73 + 80872f5) ja foi conferido. Nao ha build novo pra
  julgar.

### Molde das janelas
Corte em 08/09 15:22Z = **cinco dias atras**. Nao existe "hoje antes do corte"
nem "ontem antes do corte". 09 a 13/09 sao regua NOVA por inteiro (terceira forma
do molde). Quem conclui e o **acumulado**, nao o dia.

---

## PASSO 2 — medicao

### Sanidade (antes de acreditar em qualquer zero)
- (a) presas em processing/queued HOJE: **0** — o zero de hoje nao e "ainda nao
  deu tempo de falhar".
- (b) `failed` com `error_message` vazio HOJE: **0** — sem falha invisivel.
- (c) status crus hoje: `{"ready":13}`.
- (d) `elapsed` NULL em `ready` na regua nova: 114/454 = **25%** — dentro da faixa
  normal 13-29% (encerrada em 08/09). Sem alarme.

### Janelas

| janela | total | falhas | qa_coverage | >=1000ch | 1500-2500ch |
|---|---|---|---|---|---|
| CONTEXTO 25/08→05/09 (reguas misturadas) | 909 | 13 (1.4%) | 10 (1.1%) | n=153, 7 falhas | n=68, 5 falhas |
| REGUA ANTERIOR `eccc3d59` (05/09→08/09) | 180 | 0 (0.0%) | 0 | n=26, 0 | n=14, 0 |
| 08/09 depois do corte (rabo do dia) | 59 | 0 | 0 | n=5, 0 | n=2, 0 |
| 09/09 inteiro | 118 | 0 | 0 | n=9, 0 | n=3, 0 |
| 10/09 inteiro | 90 | 0 | 0 | n=12, 0 | n=4, 0 |
| 11/09 inteiro | 100 | 1 (1.0%) | 1 (1.0%) | n=14, 0 | n=5, 0 |
| ONTEM 12/09 inteiro | 75 | 0 (0.0%) | 0 | n=22, 0 | n=5, 0 |
| **HOJE 13/09** | **13** | **0 (0.0%)** | **0** | n=2, 0 | n=1, 0 |
| **ACUMULADO regua NOVA (08/09 15:22Z→agora)** | **455** | **1 (0,2%)** | **1 (0,2%)** | n=64, 0 | n=20, 0 |

**Hoje nao conclui nada**: n=13 global, n=2 na faixa longa. A ronda rodou 15:11Z
e o dia tem ritmo lento (6 geracoes ate as 5h, 6 depois das 11h). Quem sustenta
qualquer afirmacao e o acumulado (n=455, n=64 na faixa longa).

### O que o acumulado diz (e o que ele nao diz)

1. **Taxa atual:** 1/455 = 0,2% na regua nova. Taxa pos-28/08 = 1/1242 = **0,08%**.
2. **Nao houve piora.** P(ver >=1 falha em 455 na taxa baixa de 0,08%) = **30,7%**.
   A unica falha da regua nova (11/09) e o resultado esperado, nao sinal.
3. **Nao voltou ao patamar antigo.** Se a taxa fosse a historica de 1,1%, o
   esperado em 455 seria **5,0 falhas**. Observei 1.
4. **A faixa que quebrava continua sem concluir:** 0/20 em 1500-2500ch. Taxa
   historica da faixa = 7,4% → P(ver zero por sorte) = **21,5%**. Quem sustenta o
   quadro limpo e o n global, nao a faixa. (Terceiro dia seguido com essa ressalva.)

### Tempo

| | mediana | media | p90 | max |
|---|---|---|---|---|
| ready regua ANTERIOR (n=139) | 96,5s | 99s | 169,1s | 357,2s |
| ready regua NOVA (n=340) | 98,8s | 104s | 173,8s | 378,9s |
| >=1000ch ANTERIOR (n=26) | 168,9s | 190s | 330,9s | 357,2s |
| >=1000ch NOVA (n=64) | 158,1s | 161s | 253,2s | 378,9s |

Tempo **estavel**. O custo projetado do piso 0.65 nao aparece de forma relevante;
na faixa longa segue um pouco melhor. Sem regressao. Incidente de hang `d3d8d1b2`
**nao** reapareceu.

### Mecanismo (coluna `qa`)

| contador | regua ANTERIOR (n=180) | regua NOVA (n=455) |
|---|---|---|
| coverage_espalhada_piso | 0 | **11** |
| coverage_espalhada_piso_terminal | 0 | **8** |
| coverage_rescued | 12 | 16 |
| coverage_rescue_nivel2 | 9 | 14 |
| coverage_exhausted | 0 | **1** |
| tail_healed | 3 | 2 |
| rate_stretched | 49 | 107 |
| regens | 118 | 287 |
| coverage_min_visto (mediana) | 0,917 | 0,923 |

**Recomposicao segue** (licao 3 de 10/09): o total de resgate foi 12 → 16, mas por
sub-caminho o **piso soma 11** e o **organico caiu de 12 para 5**. A populacao
continua trocando por dentro, como em 10/09 e 12/09.

---

## ACHADO OPERACIONAL DO DIA — o denominador de dias passados ENCOLHE

Comparando com a tabela que eu mesmo escrevi ontem:

| dia | ontem eu contei | hoje conta |
|---|---|---|
| 09/09 | 119 | **118** |
| 11/09 | 102 | **100** |
| 25/08→05/09 | 909 | 909 (estavel) |
| 05/09→08/09 | 180 | 180 (estavel) |

**Tres linhas sumiram de dias ja fechados.** Dias antigos ficam estaveis, entao o
apagamento acontece nos dias recentes e depois assenta — cheira a aluno apagando
a propria geracao.

**Por que isso importa:** uma linha apagada nao deixa rastro na minha medicao. Se
um dia sumir uma linha de **falha**, a taxa melhora sozinha e eu nunca fico
sabendo. Conferi antes de dar de ombros:

- `qa_coverage` desde 25/08 = **11** — exatamente o que contei ontem.
- falhas totais desde 25/08 = **14** — igual a ontem (13 do contexto + 1 de 11/09).

**Nenhuma falha foi apagada; so linhas de sucesso.** Por ora e inofensivo — ate
empurra a taxa pra cima, nao pra baixo. Mas vira checagem fixa da rotina: reconferir
a contagem de falhas do periodo inteiro contra a da vespera, nao so medir o dia.

---

## PASSO 3 — quem falhou

**Ninguem. Zero falhas desde 12/09 00:00Z.** Nao ha aluno pendurado, nao ha
estorno a conferir.

### Fecho do que eu mesmo levantei ontem (Diego)

Ontem anotei que o `access_until` do aluno da falha de 11/09 vencia **hoje ao
meio-dia** e que "vira reclamacao se ele achar que perdeu acesso por causa da
falha". Fui conferir, e o estado mudou:

- `profiles.access_until`: `2026-09-13T12:00:00Z` → **NULL**; `plan` = `free`;
  `access_source` = NULL.
- `entitlements` `NIZKX9GY`: `status='active'`, `access_until` 13/09 12:00Z,
  **atualizado hoje 14:08Z** (2h depois da virada).
- Saldo: 76.511 + 400 creditos. Nenhuma geracao dele desde 12/09.

Isso e **exatamente** a assinatura que o playbook X manda desconfiar: entitlement
`active` + saldo > 0 + acesso vencido, na **virada das 12:00**. Nosso banco nao
responde essa pergunta — quem sabe quem paga e a Hotmart. Entao rodei a ferramenta
certa em vez de especular:

```
node _frank/ferramentas/pagante_trancado.cjs
  suspeitos no nosso banco (a conta antiga, a que mente): 216
  🔴 PAGANTE TRANCADO ......... 0
  🟡 NA FRONTEIRA ............. 0
  ⚪ trancar esta certo ....... 216  (16 cancelaram · 192 inadimplentes · 8 trial)
  >>> 0 pagante(s) trancado(s) · 0 na fronteira · 0 sem prova
```

O filtro da ferramenta (linha 81) inclui `access_until` NULL, entao Diego **estava**
nos 216 e caiu num dos tres baldes de "trancar esta certo". **Nao ha pagante
trancado, ele incluso.** O bloqueio dele e a ordem do Johnny de 13/08 (sem
assinatura = trancado) funcionando, nao bug, e **nao tem nada a ver com a falha de
QA de 11/09** — ela foi estornada e ele refez o audio com sucesso no mesmo minuto.

**Nao agi:** nao respondi aluno, nao mexi em credito, nao abri incidente. Era uma
pergunta de leitura, e a leitura fechou em "nao e problema".

---

## TESTE PRE-REGISTRADO H-IDIOMA — sem poder, fica ABERTO

Pre-registro escrito em 12/09, antes de ver este dado:

> **H-idioma:** `coverage_idioma_divergente > 0` associa-se a maior taxa de falha.
> Testar na ronda de 13/09 **apenas nas geracoes novas** (13/09 em diante), sem
> reaproveitar as 1182 ja vistas.

Resultado no dado novo:

| janela | n | com coluna `qa` | **com divergencia** | falhas div | falhas sem div | p |
|---|---|---|---|---|---|---|
| **PRE-REGISTRADA (13/09 em diante)** | 13 | 9 | **0** | — | 0/9 | n/a |
| sensibilidade (desde 12/09 15:09Z, **nao e o teste**) | 61 | 44 | 1 | 0/1 | 0/43 | 1,00 |

**Veredito: nao conclui. Nem confirma nem refuta.** Com **zero** geracoes
divergentes no dado novo, o teste simplesmente nao rodou.

### Por que eu errei o tamanho do dado necessario
Ontem li "32/1182 divergentes" como se fosse um sinal facil de reencontrar. Nao e:

- `coverage_idioma_detectado` so vem preenchido em **189/1545 = 12,2%** das linhas.
- `coverage_idioma_divergente > 0` em **33/1545 = 2,14%** do total.

Ou seja, preciso de ~47 geracoes pra ver **um** caso divergente. Em 13 geracoes o
esperado era 0,28 — ver zero era o desfecho mais provavel, e eu deveria ter
calculado isso **ontem**, ao escrever o pre-registro, em vez de marcar "testar
amanha" sem checar se amanha teria dado.

### Poder: quando esse teste pode ser lido
Premissa do achado pos-hoc de 12/09 (12,5% entre divergentes vs 0,8% entre os
demais), taxa de divergencia 2,14%, Fisher bilateral:

| geracoes novas | divergentes esperados | p esperado |
|---|---|---|
| 200 | ~4,3 | 0,073 |
| 400 | ~8,5 | 0,078 |
| **600** | **~12,8** | **0,009  ← conclui** |
| 1000 | ~21,4 | 0,001 |

**Alvo: ~600 geracoes novas** contadas de 13/09 00:00Z. No ritmo recente (~90/dia)
isso cai por volta de **20/09**. A janela do teste continua sendo "13/09 em
diante" — ela nao muda, so acumula.

### O que eu NAO fiz, de proposito
1. **Nao declarei refutado.** 0/0 nao e evidencia de nada; seria o erro de 11/09
   (ausencia de evidencia lida como evidencia de ausencia) com sinal trocado.
2. **Nao alarguei a janela pra achar poder.** Era so voltar as 1182 linhas e o p
   de 2,7e-4 reaparecia bonito — e seria fabricar confirmacao, que e precisamente
   o que o pre-registro existia pra impedir.
3. A linha de sensibilidade esta na tabela **rotulada**, como contexto. Ela nao
   tem poder nenhum (1 divergente) e nao vira manchete.

---

## Conclusao

- **Build:** sem novidade. Ultimo verde `2adb080` de 08/09; regua com 5 dias; nada
  escrito e nao deployado; regua confirmada no dado. Sem noticia ruim.
- **Hoje:** 0/13. **Nao conclui sozinho.**
- **Acumulado da regua nova (o que conclui):** 1/455 = **0,2%**; 0/64 em >=1000ch.
  Sem piora (P=30,7% de ver >=1) e sem volta ao patamar antigo (esperado seria 5).
- **Aluno:** nenhum afetado hoje. Diego (falha de 11/09) conferido na Hotmart:
  **nao e pagante trancado**, e o bloqueio dele nao tem relacao com o QA.
- **Faixa 1500-2500ch:** segue sem concluir (0/20, 21,5% por sorte).
- **Tempo e elapsed NULL:** normais. Hang `d3d8d1b2` nao reapareceu.
- **H-idioma:** sem poder hoje, **aberto ate ~20/09** (~600 geracoes novas).
- **Novo:** linhas de dias passados somem do banco (3 desde ontem). Conferido:
  nenhuma **falha** sumiu. Virou checagem fixa da rotina.

## Licao do dia

**Pre-registro sem conta de poder e so uma promessa de conclusao.** Ontem escrevi
"testar amanha" sentindo que tinha feito a coisa certa — e tinha, pela metade. Um
pre-registro honesto precisa dizer **quantos dados** o teste exige, senao ele chega
no dia marcado sem poder nenhum e me deixa na pior posicao possivel: com uma
hipotese aberta, um resultado vazio, e a tentacao de alargar a janela ate o numero
aparecer. A serie de licoes agora fecha um ciclo: 10/09 foi "calcule o p antes de
escolher o verbo"; 11/09 foi "escolha o limiar antes de calcular o p"; hoje e
**"calcule o n antes de marcar a data"**. As tres sao a mesma disciplina — decidir
a regra antes de ver o numero — aplicada ao verbo, ao corte e agora ao prazo.

Corolario pratico, que e o mais dificil: **o resultado certo de hoje foi nao ter
resultado.** Deixar a hipotese aberta por uma semana e menos satisfatorio que
publicar um p bonito, e e a unica versao honesta.
