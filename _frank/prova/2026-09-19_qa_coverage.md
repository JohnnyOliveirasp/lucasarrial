# Ronda diaria — saude do qa_coverage — 19/09/2026 (leitura 15:21Z)

## 0. O que conclui hoje

**ONTEM, 18/09, fechou LIMPO: 0 falhas em 84 geracoes.** Dia inteiro, n=84, acima do
minimo. Na faixa que quebra (1500-2500ch): 0/9. Vem logo depois do pior dia da serie
(17/09), e sem nenhum deploy no meio — ou seja, o que aconteceu em 16-17/09 passou
sozinho, nao foi corrigido por nos.

**Nenhum aluno travado.** 16 falhas desde 16/09, 5 alunos, 16/16 estornadas.

**HOJE (19/09) nao diz nada, e nem poderia** — ver secao 3, que e o achado da ronda.

---

## 1. Qual regua esta no ar (PASSO 1)

`gh run list --workflow=runpod-worker.yml`:

| run | conclusion | sha | terminou |
|-----|-----------|-----|----------|
| ultimo | **success** | b2d9f47a | 2026-09-15T03:49:41Z |
| anterior | success | 7b673a72 | 2026-09-15T02:44:36Z |
| anterior | success | 2adb0807 | 2026-09-08T15:22:32Z |

Nenhum run desde 15/09. **Nada falhou, nada travado.** Sem noticia ruim de deploy.

Verde NAO e corte de regua (licao de 15/09, reconferida HOJE na mao):

```
git log b2d9f47a..origin/main -- runpod-worker/     -> VAZIO
git log -1 -- runpod-worker/jobs/inference.py       -> 243aa73b (04/09)
git log -1 -- runpod-worker/jobs/tts_settings.py    -> 243aa73b (04/09)
git log -1 -- runpod-worker/tts_qa/loop.py          -> f8586783 (05/09)
```

Os tres arquivos do portao entraram no deploy de 08/09. Nao existe correcao escrita
e nao deployada.

> **Regua vigente: 2adb080 (08/09 15:22Z) — ONZE dias no ar.**
> Confirmada no dado, nao so no commit: `coverage_espalhada_piso` = 0 antes do corte
> e 23 depois. O contador novo so existe do lado de la.

---

## 2. Os numeros (PASSO 2)

Acumulado da regua nova (08/09 15:22Z -> agora): **17/943 = 1,80%** de falha,
**2/943 = 0,21%** de qa_coverage.

| janela | total | falhas | taxa | qa_cov | conclui? |
|--------|-------|--------|------|--------|----------|
| 15/09 | 94 | 0 | 0,0% | 0 | sim |
| 16/09 | 77 | 4 | 5,2% | 0 | sim |
| **17/09** | 76 | **12** | **15,8%** | 1 | sim — pior da serie |
| **18/09 (ONTEM)** | **84** | **0** | **0,0%** | **0** | **sim** |
| 19/09 ate 15:21Z | 29 | 0 | 0,0% | 0 | **nao — ver secao 3** |

### 2.1 O numerador tambem tem problema de denominador (licao nova)

Venho tratando cada linha `failed` como um evento independente. Nao sao. Colapsando
retry do MESMO aluno com o MESMO tamanho de texto dentro de 45 min:

| dia | falhas | episodios | maior retry |
|-----|--------|-----------|-------------|
| 16/09 | 4 | **2** | 3x |
| 17/09 | 12 | **7** | 5x |
| regua nova inteira | 17 | **10** | — |

17/09 detalhado: 12 falhas = **7 episodios em 4 alunos**. Uma aluna sozinha reenviou
o mesmo texto de 1521ch **cinco vezes em 14 minutos** — isso entrou na conta como
cinco falhas.

> **"15,8% no dia" e verdade aritmetica e exagero operacional ao mesmo tempo.**
> Por episodio: 9,2%. Na regua inteira: 1,80% vira 1,06%.
> As duas leituras vao no relatorio a partir de hoje. A taxa por linha mede
> aborrecimento do aluno (ele tentou 5x e falhou 5x, e real). A taxa por episodio
> mede quantas vezes o sistema quebrou. Sao perguntas diferentes e eu vinha
> respondendo so a primeira, chamando ela de "o indicador".

### 2.2 Integridade da base

- **(e) numerador:** falhas desde 25/08 hoje=30, vespera registrou=30. qa_cov 12=12.
  Delta 0. **Nenhuma falha de periodo fechado sumiu.**
- **(e2) denominador:** `2026-09-16: vespera=78, vivo=77, delta=-1`. **Uma linha sumiu
  de um dia fechado.** Conferido: as falhas de 16/09 continuam 4. **A linha apagada era
  um SUCESSO** — a taxa de 16/09 PIOROU de 4/78=5,13% para 4/77=5,19%. Nao e a direcao
  perigosa (falha apagada melhorando o indicador sozinho), mas fica registrado.
- (a) presas hoje: 0. (b) failed com error vazio: 0. (d) elapsed NULL em ready:
  25% (faixa normal 13-29%).
- Assinaturas de erro ineditas desde 18/09: **0** (nao houve falha nenhuma).

---

## 3. ACHADO DA RONDA — a ronda roda cedo demais pra ver o que ela vigia

A licao de 18/09 mandou comparar HOJE contra o MESMO HORARIO dos outros dias. Fiz.
O resultado nao foi o que eu esperava:

```
=== FALHAS no MESMO HORARIO (corte 15:21Z) ===
2026-09-08 | ate 15:21Z:  27 ger, 0 falhas | dia FECHADO: 0/86  =  0,0%
2026-09-09 | ate 15:21Z:  37 ger, 0 falhas | dia FECHADO: 0/116 =  0,0%
2026-09-10 | ate 15:21Z:  44 ger, 0 falhas | dia FECHADO: 0/90  =  0,0%
2026-09-11 | ate 15:21Z:  50 ger, 0 falhas | dia FECHADO: 1/100 =  1,0%
2026-09-12 | ate 15:21Z:  28 ger, 0 falhas | dia FECHADO: 0/72  =  0,0%
2026-09-13 | ate 15:21Z:  13 ger, 0 falhas | dia FECHADO: 0/50  =  0,0%
2026-09-14 | ate 15:21Z:  48 ger, 0 falhas | dia FECHADO: 0/96  =  0,0%
2026-09-15 | ate 15:21Z:  48 ger, 0 falhas | dia FECHADO: 0/94  =  0,0%
2026-09-16 | ate 15:21Z:  19 ger, 0 falhas | dia FECHADO: 4/77  =  5,2%   <<<
2026-09-17 | ate 15:21Z:  40 ger, 0 falhas | dia FECHADO: 12/76 = 15,8%   <<<
2026-09-18 | ate 15:21Z:  43 ger, 0 falhas | dia FECHADO: 0/84  =  0,0%
2026-09-19 | ate 15:21Z:  29 ger, 0 falhas | <<< HOJE
```

**Doze dias. Doze leituras de "0 falhas" no horario da ronda. Inclusive os dois
piores dias da serie.** No dia em que o indicador fechou em 15,8%, a ronda, rodando
no seu horario, teria lido 0/40 e escrito "limpo".

Distribuicao por hora na regua nova:

```
00:00-14:59Z : 0/380  = 0,00%
15:00-23:59Z : 17/563 = 3,02%
```

As 17 falhas da regua nova aconteceram **todas** as 16:00Z ou depois (pico 20h: 8/80).

**O que isso NAO prova.** Tirando 16 e 17/09, o corte por hora vira 0/324 contra
1/466 — nada. O p=1,96e-4 do teste global e carregado por dois dias, e dois dias sao
dois eventos. **Nao existe aqui evidencia de que "falha acontece a noite"** como
mecanismo, e eu nao vou escrever isso. Confundidores checados e registrados:
o texto da noite nao e maior (mediana 423ch vs 435ch de dia); a faixa 1500-2500ch da
noite falha 8/40 contra 0/17 de dia; a aluna com mais falhas tem 0/17 de dia e 8/35
de noite. Tudo sugestivo, tudo preso aos mesmos dois dias.

**O que isso prova, e nao precisa de significancia nenhuma:** a ronda roda as ~15:21Z,
e nenhuma das falhas ja observadas na regua nova aconteceu antes das 16:00Z. O
instrumento le sistematicamente a metade do dia onde o problema nunca apareceu.

> **Uma checagem que responde a mesma coisa no melhor e no pior dia da serie nao e
> uma checagem.** O "0/29 de hoje" nao e noticia boa: e o valor que essa medicao
> devolve sempre, inclusive na vespera de fechar em 15,8%.

Isso e a licao de 18/09 levada um nivel adiante. Ela dizia "compare HOJE no mesmo
horario". Correto e insuficiente: a comparacao so informa se aquele horario ja viu
falha alguma vez. Esse nunca viu.

**Recomendacao (NAO executada — depende do Johnny):** uma segunda passada as ~23:30Z,
depois da janela onde as falhas moram, fechando o dia de verdade. A ronda das 15:21Z
continua util pra deploy e integridade da base, mas ela nao deve mais ser a fonte de
qualquer frase sobre a taxa do dia corrente.

---

## 4. Quem falhou (PASSO 3)

Desde 16/09: 16 falhas, 5 alunos, **16/16 estornadas** (`ref_type='generation_refund'`;
lembrete: o estorno grava `kind='extra_purchase'`, filtrar por kind esconde todos).
Admin/socio fora da conta.

| aluno | falhas | estorno | voltou a gerar? |
|-------|--------|---------|-----------------|
| Mariana Macedo Leme | 8 | 8/8 | **sim** — 11 geracoes, 11 prontas |
| Tania Regina Espadaro | 3 | 3/3 | nao voltou desde 16/09 — ver abaixo |
| Flavio Gabbriel | 1 | 1/1 | **sim** — 5 geracoes, 5 prontas |
| Semear Riquezas | 2 | 2/2 | **sim** — 4 geracoes, 4 prontas |
| Roseni M. Pimentel | 2 | 2/2 | **sim** — 3 geracoes, 3 prontas |

**Tania Regina — verificada linha a linha, NAO esta travada.** O historico completo
dela (5 geracoes) mostra que o texto de 1350ch que falhou as 19:28 **saiu pronto as
19:40**, entre as falhas; as duas falhas seguintes (19:47, 19:51) sao retry do mesmo
texto que ela ja tinha. As 20:00 ela usou `video_clone`. Ou seja: **ela recebeu a
entrega.** Eu quase reportei "aluna travada" olhando so a coluna de falha.

Nota separada, que **nao e de QA e nao e minha pra agir**: ela e assinante desde
14/09 (`subscription_grant`), `access_until = 2026-09-21T12:00Z` (dois dias), e esta
sem atividade ha tres dias. Fica o registro pro Johnny decidir.

---

## 5. Teste pre-registrado H-idioma (12/09, n calculado 13/09)

- Acumulo: **506/828** geracoes novas. Ritmo honesto (so dias completos): 80/dia.
- **COM divergencia: 0/7 · SEM divergencia: 7/363 = 1,9% · Fisher p = 1,0000**
- **VEREDITO: AINDA ACUMULANDO (7 de 8 divergentes). NAO conclui, e nao deve.**
  Nao alargar a janela pra tras.
- **Premissa envelheceu:** divergencia observada 7/506 = 1,38%/geracao => n necessario
  pra 8 divergentes e ~579, nao 828 (delta -249). Ressalva obrigatoria: a conta se
  apoia em n=7, que e ruido. Isso NAO prova que a taxa e 1,38%; prova so que 828 nao
  e mais um alvo defensavel. Mantido 828 nesta ronda; recalcular ao bater 8 divergentes.
- Idiomas no dado novo: pt=62, de=1, en=1, es=1, tr=1, zh=1.

---

## 6. Para a ronda de 20/09

No `/tmp/perf/qacov.cjs`:

```js
ONTEM_QACOV_DESDE_2508  = 12    // inalterado, nenhuma qa_cov nova em 18-19/09
ONTEM_FALHAS_DESDE_2508 = 30    // inalterado, nenhuma falha nova em 18-19/09
ONTEM_ROTULO            = "19/09"
HOJE = "2026-09-20"; ONTEM = "2026-09-19"
```

`TOTAIS_FECHADOS_VESPERA` — acrescentar `"2026-09-18": 84` (primeira leitura de 18/09
fechado). **18/09 entra; 19/09 NAO** (hoje ele e o dia parcial; parcial como linha de
base cria delta positivo falso).
**Atencao:** `"2026-09-16"` ja esta como 78 no script e o valor vivo e **77**. Trocar
para 77, senao a ronda de amanha reporta a mesma linha apagada como se fosse nova.

Promover 18/09 a janela de dia fechado com data ABSOLUTA nos dois lados, e ONTEM
passa a `2026-09-19T00:00:00Z -> 2026-09-20T00:00:00Z`.

Um dia sem encolher e so um dia que ainda nao encolheu — 09/09 encolheu oito dias
depois do fato. Continuar comparando todos.

---

## 7. Licoes desta ronda

1. **Uma checagem que responde igual no melhor e no pior dia nao e uma checagem.**
   A comparacao "mesmo horario" so informa se aquele horario ja viu o evento. O das
   15:21Z nunca viu: 0 falhas em 12 de 12 dias. Antes de confiar numa checagem,
   pergunte qual leitura dela seria um alarme — se nenhuma leitura possivel naquele
   corte e alarme, ela nao vigia nada.
2. **O numerador tambem tem problema de denominador.** 5 retries do mesmo texto pelo
   mesmo aluno em 14 min viram "5 falhas" e inflam o dia. Reportar falhas E episodios.
3. **A coluna de falha nao conta a historia do aluno.** Tania tinha 3 falhas e 0
   geracoes depois — parecia travada. O audio dela saiu **entre** as falhas. Olhe o
   historico completo do aluno antes de chamar alguem de travado.
4. **Dia limpo depois de dia pessimo, sem deploy no meio, e informacao sobre o mundo,
   nao sobre nos.** Nada foi ao ar entre 17 e 18/09. 16-17/09 passou sozinho, o que
   aponta pra instabilidade externa (assinatura `RunPod COMPLETED` / `System error.`),
   nao pra regressao do portao de qa_coverage.
