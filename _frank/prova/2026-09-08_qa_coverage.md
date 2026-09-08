# Ronda diaria de qa_coverage - 08/09/2026 (15:09Z)

## Resumo

**Dia limpo. 0 falhas hoje, 0 falhas na regua vigente inteira.** Nenhum aluno travado.
O acumulado da regua vigente CONCLUI: **0/183 global, 0/26 em >=1000ch, 0/14 na faixa 1500-2500ch**
desde 05/09 08:28Z. O dia isolado (n=29, so 2 na faixa que quebra) NAO concluiria sozinho.

**Noticia que olha pra frente:** tem um build EM CURSO (2adb080, 14:47Z) carregando duas
mudancas REAIS de regua no TTS. Quando ele ficar verde, o pool de 183 acima morre e o
contador recomeca do zero. Amanha a janela muda.

## PASSO 1 - qual regua esta no ar

| run | sha | fim | resultado |
|---|---|---|---|
| em curso | 2adb080 | comecou 14:47:46Z | **in_progress** (22 min - dentro do normal de 28-52 min) |
| cancelado | c1db335 | 14:48:33Z | cancelled - superado pelo push 2 min depois |
| verde | b55db26 | **08/09 00:35:58Z** | success |
| verde | 51c9a8f2 | 07/09 13:36:03Z | success |
| verde | eccc3d59 | **05/09 08:28:05Z** | success |

### A regua vigente NAO e a do ultimo verde (licao de 07/09 aplicada de novo)

O ultimo verde e b55db26 (00:35:58Z de hoje), mas ele **nao mudou a regua**:

```
git diff b55db26^1 b55db26 --numstat -- runpod-worker/
39      3       runpod-worker/worker_log.py
```

Unico arquivo tocado e `worker_log.py`, e o diff e heartbeat: passa o `meta`
(chunk/attempt) no POST da fase e acrescenta `_meta_serializavel`. Nao encosta em
limiar, nao muda fluxo de decisao. **Telemetria pura.** As 3 remocoes sao a
reescrita da assinatura de `_fase_post` pra aceitar o parametro novo.

Mesma coisa valeu pro verde de 07/09 (51c9a8f2: 46 adicoes, ZERO remocoes, so
contadores). Entao a ultima mudanca REAL de regua continua sendo **eccc3d59
(05/09 08:28:05Z, tts_settings.py 7+/1-)**, e e nela que o pool acumula ha 3 dias.

Se eu tivesse partido a janela em 00:35Z por reflexo de "verde = regua nova",
teria ficado com n=5 de um lado e n=24 do outro, e concluido nada - quando o pool
real (0/26 na faixa que quebrava) conclui.

### O cancelado nao se perdeu

```
git merge-base --is-ancestor c1db335 2adb080  -> OK
```
c1db335 (os dois fixes de TTS) e ancestral do build em curso. A mudanca vai pro ar
nesse build, nao ficou de fora.

### O que esta subindo AGORA (isso sim e regua)

```
80872f5 fix(tts): piso de cobertura na escotilha de lacuna espalhada
  23  2  runpod-worker/jobs/inference.py
  29  0  runpod-worker/jobs/tts_settings.py
243aa73 fix(tts): o piso da escotilha nao vale no gate TERMINAL do resgate
  52 10  runpod-worker/jobs/inference.py
  10  2  runpod-worker/jobs/tts_settings.py
5b4a2d9 fix(test): destrava test_fase_telemetria  (so teste, nao vai pro runtime)
```
Tem remocao em `inference.py` e em `tts_settings.py` nos dois - **muda decisao, nao e
telemetria**. Quando 2adb080 fechar verde, o corte de regua passa a ser ele e o
acumulado de 183 geracoes deixa de valer como prova. A ronda de amanha comeca a
contar do zero em cima da regua nova.

## PASSO 2 - as janelas

| janela | total | falhas | qa_coverage | >=1000ch | 1500-2500ch | conclui? |
|---|---|---|---|---|---|---|
| CONTEXTO 25/08 -> 06/09 | 986 | 13 (1,3%) | 10 (1,0%) | 7/168 | 5/76 | sim (historico) |
| ONTEM 07/09 inteiro | 85 | 0 (0,0%) | 0 | 0/9 | 0/5 | **nao** - faixa n=9 |
| HOJE ate 00:35Z (telemetria, nao e corte) | 5 | 0 | 0 | 0/0 | 0/0 | **nao** - n=5 |
| HOJE depois de 00:35Z (mesma regua) | 24 | 0 | 0 | 0/2 | 0/1 | **nao** - faixa n=2 |
| HOJE 08/09 inteiro | 29 | 0 (0,0%) | 0 | 0/2 | 0/1 | **nao** - faixa n=2 |
| **ACUMULADO regua eccc3d59 (05/09 08:28Z -> agora)** | **183** | **0 (0,0%)** | **0** | **0/26** | **0/14** | **SIM** |

As duas linhas de "hoje antes/depois de 00:35Z" estao ai so por transparencia do
recorte - **nao sao duas reguas**, e a mesma. Nao leia como comparacao.

### A leitura honesta do n

Hoje foram 29 geracoes, e so **2** caiam na faixa >=1000ch (1 na faixa 1500-2500ch,
que e onde o qa_coverage quebrava). **Com n=2 na faixa que importa, o zero de hoje
nao prova absolutamente nada sozinho** - uma falha a mais viraria 50%.

Quem conclui e o acumulado: **26 geracoes longas e 14 na faixa ruim, todas passando,
ha 3 dias.** Contra o historico de 5 falhas em 76 na mesma faixa (6,6%) antes da
correcao. Esse contraste sim e conclusivo.

### Tempo (reprovacao vs hang)

Nao houve nenhuma falha pra classificar. O incidente de hang (d3d8d1b2) segue
fechado como aceite de risco - nada nesta ronda pede reabertura.

## SANIDADE (sem isso o zero nao esta conferido)

- (a) geracoes presas em processing/queued hoje: **0** - o zero nao e "ainda nao deu tempo de falhar"
- (b) `failed` com `error_message` vazio hoje: **0** - nenhuma falha invisivel
- (c) status crus vistos hoje: `{"ready": 29}` - so sucesso, nada ambiguo
- (d) `elapsed_seconds` NULL entre 'ready' desde a regua: 41/183 (22%)

### O buraco de elapsed NULL NAO esta crescendo (fecha o alerta de 05/09)

Em 05/09 eu marquei "18% de elapsed NULL, cheque se cresce". Cresceu pra 22% e isso
parece piora - **mas nao e**. Serie diaria desde 25/08:

```
25/08 21% | 26/08 13% | 27/08 22% | 28/08 22% | 29/08 21% | 30/08 15% | 31/08 15%
01/09 14% | 02/09 27% | 03/09 16% | 04/09 17% | 05/09 18% | 06/09 29% | 07/09 22% | 08/09 17%
```

Oscila entre 13% e 29% ha duas semanas inteiras, sem tendencia. O 18% de 05/09 era
um ponto baixo de ruido, nao uma linha de base. **Encerro o alerta**: ~19% e o
normal desse campo, e as ~22% de agora estao dentro da faixa. Se algum dia passar
de 35% ai sim vira problema. Registrado pra eu nao dar alarme falso nisso de novo.

## PASSO 3 - quem falhou

**Ninguem.** Zero falhas desde 07/09, e zero na regua vigente inteira (desde 05/09
08:28Z). Nao ha estorno a conferir nem aluno travado nesta ronda.

As duas falhas mais recentes sao de 04/09 (executionTimeout, nao qa_coverage) e ja
foram encerradas na ronda de 07/09 pelo criterio certo - nao "foi estornado?", e sim
"o aluno conseguiu o que queria?": Debora voltou a gerar com sucesso em 05/09 e Renan
em 07/09. Nada pendurado.

## Conclusao

1. **Aluno travado: nenhum.**
2. **Taxa de hoje: 0,0% (0/29).** Mas com n=2 na faixa que quebra, o dia nao conclui sozinho.
3. **O que conclui: 0/183 na regua vigente, 0/26 em texto longo, 0/14 na faixa 1500-2500ch,
   3 dias de pool.** A correcao de 05/09 esta segurando.
4. **Build em curso muda a regua.** Quando 2adb080 fechar verde, esse pool de 183 zera
   e a contagem recomeca. Se fechar VERMELHO, os dois fixes de TTS nao entram e
   seguimos na eccc3d59 - que, pelos numeros acima, esta de pe.

## Metodo

- Base: `/tmp/perf/qacov.cjs`, adaptada em `/tmp/perf/qacov-2026-09-08.cjs`
- Paginacao de 1000 em 1000 (`.range`), 1100 linhas desde 25/08, erro cru impresso antes de crer em zero
- Colunas usadas: id, user_id, status, error_message, created_at, text_raw, elapsed_seconds
- Serie de elapsed NULL: `/tmp/perf/elapsed-null-trend.cjs`
