# 18/09 ~13hZ — Ronda das falhas (serial, dono da fila)

Um cartão fechado: o **#52**, 29,8 dias aberto. O que ele tinha de novo não era
um defeito novo — era que **o conserto já estava em produção há 30 dias** e
nenhuma ronda tinha ligado os pontos. A frase herdada que segurou o cartão era
verdadeira e enganosa ao mesmo tempo, e isso está medido abaixo.

## Card serial da ronda: #52 (`37bacb68`) — FECHADO

Peguei o #52 por ser **o mais antigo acionável**. Os dois mais velhos seguem
com bloqueio real, conferido por mim nesta ronda e não herdado:

- **#15** (`d3d8d1b2`, 50,0d) — decisão de produto do Johnny + telemetria do
  PR #329. Classe dormente: zero ocorrência desde 04/09 20:47Z.
- **#32** (`9119254c`, 39,1d) — aluno entregue ontem; o que resta são os PRs
  #335 (falta ler `error_message`) e #338 (espera o Johnny decidir o deploy).

O #52 tinha, na própria nota, um passo escrito **"pro proximo que pegar"**:
*nomear a causa das 24 restantes*. Peguei esse passo.

## A resposta: as 24 não eram "outra causa". Eram a MESMA, já curada.

A nota herdada da ronda das 02hZ dizia: *"o fix explica no máximo 5 de 29; 24
das 29 têm OUTRA causa"*. O número está certo — elas não são soletração. A
conclusão é que estava errada, e ela mandou as rondas seguintes caçarem causa
nova onde o conserto já estava no ar.

**A causa estava nomeada no nosso próprio código**, em `tts_settings.py:196-205`:

> `qa_alucinacao_min` — *"Cobertura abaixo disto não é 'faltou um pedaço': é
> áudio que NÃO É o texto (chunk alucinado). Medido no Ronald (27/08): 6 falhas
> no mesmo texto com coverage_best 0-0,1 enquanto os outros chunks davam 0,96."*

Conferi no banco, nas ocorrências **deste** cartão. `coverage_best` das falhas
de 27/08: **0 · 0 · 0,071 · 0,1 · 0,1 · 0,107** — contra régua 0,85. Não é
margem. É áudio que não é o texto.

E `inference.py:565-580` explica por que regenerar não adiantava: entre uma
tentativa e outra **nada mudava** (mesmo texto, mesmos parâmetros; o VoxCPM não
expõe seed nem temperatura). Daí os `regens` 16, 18 e 22 sem sair do lugar.

## O conserto, e a prova de que curou

Commit **`7d030db3`** (27/08 **18:13:58Z**) — *"qa(#52): chunk alucinado para de
repetir e o resgate ganha o nivel 2"*: saída cedo por `qa_alucinacao_max_seguidas`
+ resgate nível 2 (parte **abaixo** da frase por `rescue_word_chars` e soma
`rescue_cfg_delta` ao cfg — a única alavanca que muda a geração).

Medi **taxa, não contagem**: o volume quase dobrou no período e a contagem crua
esconderia isso. Corte no instante exato do commit:

| período | falhas / gerações | taxa |
|---|---|---|
| **antes** de `7d030db3` | 27 / 913 | **2,957%** |
| **depois** de `7d030db3` | 2 / 1.656 | **0,121%** |

**Redução de 24,5×**, sobre 1.656 gerações e 21 dias. Isso é cura medida, não
ausência de sintoma (regra 14). As 6 falhas de 27/08 são de **17:01 a 17:30Z**,
todas anteriores ao commit das 18:13Z — ou seja **27 das 29 são anteriores ao
conserto**.

## As 2 posteriores: as duas com causa nomeada, as duas servidas

| geração | causa | desfecho |
|---|---|---|
| `d07d0d7d` (17/09, Mariana) | soletração inventada | PR #336, merge `b70a9220`, produção 18/09 01:43Z. Aluna recebeu na mesma noite (`33affa2c`, `02f7d194` READY) |
| `67f28d0f` (11/09, goudardexecutivo) | `coverage_alucinado=6`; resgate nível 2 rodou e **falhou** (`coverage_rescue_failed=1`) | aluno **refez 5 min depois e recebeu**: `cc031e3a` READY 20:58Z, `4f9a945b` READY 21:02Z |

**Dinheiro, conferido por mim nesta ronda**, nas 29: 25 debitadas e estornadas
com saldo exato, 4 nunca debitadas (não há o que estornar), **0 com saldo
devedor**. O estorno do `67f28d0f` (+400) está com `kind='extra_purchase'` e só
aparece por **`ref_type='generation_refund'`** — a armadilha de 20/08 em estado
puro: quem conferisse por `kind` diria que o aluno não foi estornado.

## Hipótese minha, derrubada na mesma ronda

Medi `coverage_flagged` >> `coverage_medido_n` em **8 de 8** falhas com
telemetria (contra 8% das `ready`) e estava pronto pra reportar como achado: "a
casa reprova chunk que nunca mediu".

**Não é achado.** O docstring do `registrar_cobertura` (`loop.py:143-147`) avisa
em letras maiúsculas que esses contadores **só descrevem entrega quando
`status='ready'`**; no job que falha, quem responde é `coverage_best`. A
inversão de 100% é artefato do desenho, não defeito.

Registro em vez de apagar, porque é o **terceiro instrumento da casa a tropeçar
na mesma suposição** — o #32 registrou os outros dois na semana passada
("habito da casa", não coincidência). E foi o código que me corrigiu, não o
contrário: eu só não publiquei o número errado porque fui ler a fonte antes.

## Por que fechar aqui não é silenciar

`reportar.ts:166`: `reopened = (status === "fixed" || "ignored") && !nasceIgnorado`
→ o cartão volta sozinho pra `open` quando a assinatura dispara de novo. E a
assinatura **está viva** (bumpou em 17/09 20:18Z, é como o `d07d0d7d` entrou).
Se o resíduo de 0,121% voltar, o cartão volta — e agora diagnosticável:
`faltantes_amostra`, o campo que **nomeia as palavras perdidas**, só passou a
ser escrito em **05/09 11:20Z**. Das 29 ocorrências do #52, só **2** têm esse
campo. As outras 27 nunca poderiam ter sido diagnosticadas por telemetria — só
por texto. Essa é a resposta honesta pra "por que ninguém nomeou isso antes".

## Percepção — despacho feito, classe segue em ZERO real

O `percepcao_travada.cjs` aponta **1** card (`#450`, parado há 0,0d). Conferi
**eu mesmo** o trecho que casou: é prosa da minha própria nota anterior — *"é
exatamente o que ele precisa **ouvir**"* — casada pelo padrão `%ouvir%`. Não há
imagem, áudio nem vídeo: o cartão é análise de dados e já está medido.

Não despachei pro `olho` nem pro `qa` porque **não existe artefato** — e é esse
o bloqueio real declarado, na forma que a ordem de 17/09 exige. Anotado no
próprio #450 pra próxima ronda não refazer.

**Segunda ronda seguida com falso positivo ocupando essa linha** (na de 12hZ foi
o #438, por `%precisa olhar%` em cima de uma consulta SQL). **Não apertei o
padrão do varredor, de propósito:** falso positivo custa 2 minutos de
conferência; falso negativo custou os **16 dias de silêncio** que originaram a
ordem. O varredor já imprime o trecho casado, e é isso que torna a conferência
barata. Assimetria de custo, não preguiça.

## Contagem da ronda

| medida | valor | instrumento |
|---|---|---|
| chamados abertos | **95** (eram 96; −1 pelo #52) | `varredura_travados.cjs` |
| aguardando aluno | **32**, 12 com 7d+, mais velho **20d** | idem |
| itens presos | **0** | idem |
| travados em percepção | **0 reais** (1 apontado, falso positivo) | `percepcao_travada.cjs` |
| fechado sobre o próprio disparo | 1 (`#407`) | `varredura_travados.cjs` |

## O que NÃO fiz

- **Não abri cartão pro resíduo** (o resgate nível 2 falhando, 2 ocorrências em
  21 dias, `coverage_rescue_failed=1` nas duas). Motivo concreto: a assinatura
  viva reabre o #52 sozinho, então o conhecimento não cai no chão, e somar um
  cartão de 0,121% a uma fila de 95 é ruído. Se voltar, volta com dado melhor.
- **Não escrevi pro goudardexecutivo nem pra Mariana**: os dois já receberam o
  áudio e foram estornados. E-mail agora seria ruído sobre caso encerrado.
- Não toquei em crédito, acesso, voz, migration nem GPU. **Zero GPU nesta
  ronda** — foi tudo leitura de banco e de código.
- Continuo sem atacar os **12 `aguardando_aluno` com 7d+** que pedem segunda
  tentativa. Dívida declarada de novo com número e idade, em vez de silêncio —
  e vale o alerta da ronda das 12hZ: parte dessa fila pode não ser aluno calado,
  e sim **carta que não chegou**.

## Faxina de fim de ronda

Commitei na main, junto deste log, o instrumento novo
`_frank/ferramentas/2026-09-18_alucinacao_antes_depois.cjs` (só leitura). Ele
reproduz a medição antes/depois e **carrega no cabeçalho o aviso da armadilha
do `coverage_medido_n`**, pra próxima ronda não repetir a hipótese que derrubei
aqui. Conferi que ele reproduz os números por um caminho de código diferente do
que usei pra medir (PostgREST × Management API): 2,957% → 0,121%, 24,5×.

Instrumento fora do git é instrumento que a próxima ronda não tem — foi assim
que o fix do #74 sumiu com o container em 21/08.
