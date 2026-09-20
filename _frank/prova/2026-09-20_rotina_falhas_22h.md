# Ronda das falhas — 20/09, ~21h40–22h30Z (Frank)

Item serial: **a cadeia da referência da voz — #348 / #500**, herdada da ronda
das 21h. Esta ronda **fechou o caminho de código**: o PR #92, em draft e
`CONFLITANTE` havia **24 dias**, está em produção.

E entrega junto uma coisa que vale mais que o merge: **a causa que as rondas de
hoje deram como certa estava errada**, e eu corrigi por escrito antes que alguém
fechasse dois cartões em cima dela.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — **nada no privado do Johnny**; os dois
posts do grupo estão no §5.

## Placar

- Fila: **93 abertos**, **39 com 7d+** — igual à ronda das 21h. A fila não
  baixou e eu não maquio isso.
- Fechados `fixed`: **0**. O conserto subiu; a queixa da aluna que espera **não
  era essa** (§2), então nada fechou.
- **Fix em produção: 1** — PR #379, merge `561f6867`, conferido no conteúdo da
  `origin/main`.
- **PR #92 saiu do rascunho depois de 24 dias** e consta MERGED, com autoria
  preservada (§1).
- Alunos respondidos: **0**, e é decisão, não omissão (§3).
- Crédito devolvido: **0**. GPU gasta: **0**. Migration aplicada: **0**.
- Passo fixo dos envios: **881 lidas, 0 carta fora da tabela** depois do corte.
- `pagante_trancado`: **0 trancados, 0 na fronteira**, 1 sem prova.
- Percepção travada: **1 card** (#450), o falso positivo já declarado — §4.
- Cartões: **1 revisado e aceito** (`46be0ebb`), 0 novos.

---

## 0. Passos fixos

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): **881**
cartas lidas de `Sent`, **804** já com linha, **77** fora da janela,
**0 escrituráveis, 0 recusadas**. A conta fecha (881 = 881).

Contra as 21h (também 881/804): **nenhuma carta nova no intervalo** — coerente
com §3, onde eu digo que não escrevi para ninguém. O passo fixo e o §3 se
conferem um ao outro.

O instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue **passivo**.

`pagante_trancado.cjs`: **0 pagante trancado, 0 na fronteira**, 1 sem prova
(`drfabiovilhena29@`, sem subscriber code no payload — terceiro dia igual).

`fechados_que_disparam.cjs`: nada vivo a reabrir. O único item sem `resolved_at`
comparável (`cb4ae39d`) tem `last_seen_at` de **04/09** — não é sinal de vida.

---

## 1. O PR #92 está em produção — e eu conferi cada alegação em vez de aceitar

O cartão `46be0ebb` (coder) voltou com a união feita. **Não aceitei o relatório:
medi tudo de novo.**

| o que ele alegou | como conferi | resultado |
|---|---|---|
| autoria do #92 preservada | `git log -1 --format=%P` | 2 pais: main `85fe6e7d` + **`bdd6f6dc`, que é o head do #92** |
| suíte da união 323/323 | rodei eu, nas 9 suítes, `HF_HUB_OFFLINE=1` | **323 OK / 0 fail** (87+14+27+17+51+8+35+37+47) |
| aplica sobre a main de hoje | `git merge-tree --write-tree` | **limpo, 0 conflito**, tree `b8c730b4` |
| migration 118 já aplicada | `information_schema.columns` **no banco** | as duas colunas existem |
| *(ressalva dele)* TS não checado | `tsc --noEmit` no frontend | **exit 0** |

A linha da migration é a armadilha do manual aplicada: ele justificou com
`types.ts`, que é tipo de frontend, não banco. **DDL commitado não é DDL
aplicado** — fui ao `information_schema`. Estava mesmo aplicada desde 25/08.

**A suíte morde, e provei em vez de torcer.** Verde que não morde não prova nada:
neutralizei o `rate_penalty` (mutante `return 0.0`) e **3 dos 8** testes caíram,
incluindo o central — sem a penalidade a escolha volta pro trecho acelerado de
60s em vez do clipe de 30s no ritmo da pessoa. Restaurei o arquivo e conferi
`git diff` vazio.

**Um susto que era meu, e registro porque quase virou alarme falso.** O
`git diff origin/main origin/<branch> -- frontend/` mostrava o `fala-distinta.ts`
(o fix do #501, em produção desde hoje) como **removido**. Diff de dois pontos
compara as *pontas*: o branch era 2 commits mais velho que a main, e o arquivo
nasceu no `fed87f4a`, depois da base dele. Não era reversão. Confirmei do jeito
que importa — **listei o tree do merge seco e o `fala-distinta.ts` está lá**, e
depois de mergear ele segue na main com as 95 linhas. Conferir antes de gritar
custou duas consultas.

Mergeei com **merge commit** (não squash) de propósito: squash apagaria o
`bdd6f6dc` e com ele a autoria de quem escreveu o conserto em agosto. Efeito
colateral bom: o GitHub marcou o **PR #92 como MERGED sozinho**, porque o head
dele virou ancestral da main. O PR que passou 24 dias em rascunho consta
entregue, com o nome do autor.

Conferido na `origin/main` depois do merge: `rate_penalty`/`_words_per_second`
presentes, `cut_mode` presente nos **4 caminhos** (`snap_ok`, `snap_unavailable`,
`time_retry`, `fallback`), `fala-distinta.ts` com 95 linhas. **Olhei a main, não
o board** — card `completed` não é produção.

**Custo: zero.** O `wps` é medido sobre o transcript que já existe; não há
chamada nova de whisper nem de GPU. Li o corpo de `_words_per_second` pra
confirmar isso em vez de deduzir do relatório.

### O número que mostra o tamanho do desperdício

`select count(*), count(speech_rate_wps), count(reference_rate_wps) from voices`:
**1463 vozes, 458 com `speech_rate_wps`, ZERO com `reference_rate_wps`.**

A coluna existe desde 25/08 e passou **26 dias carregando nada**, porque o único
código que a escreve estava dentro do PR que ninguém mergeava. É a mesma família
do `profiles.ja_pagou` que o README já documenta: **coluna que existe e não
significa nada é pior que coluna ausente**, porque parece dado. A partir de hoje
ela passa a ser escrita (`finalize-training.ts:759-762`, com faixa sã de 0,5 a 8).

---

## 2. A correção que vale mais que o merge: **são duas Ellens**

A ronda das 21h — a minha — escreveu que o serial era *"a cadeia da entonação —
#348 / #500 (Ellen), cujo conserto é o PR #92"*. **Isso está errado**, e eu só
descobri porque fui buscar os cartões pelo número pra escrever a nota de
fechamento.

1. **São duas alunas diferentes com o mesmo primeiro nome.** O PR #92 foi escrito
   em 25-28/08 para **`draellenca@hotmail.com`** (3 vozes, 21-24/08) — o
   cabeçalho da própria migration 118 diz *"Caso Ellen (draellenca)"*. Os cartões
   #348 e #500 são de **`ellen.atp@gmail.com`** (2 vozes, 09-11/09). Conferido no
   banco: contas distintas, meses distintos.
2. **São dois defeitos diferentes.** O PR conserta **VELOCIDADE** (o clone falava
   o texto em metade do tempo da pessoa). A queixa dos cartões é **ENTONAÇÃO DE
   PERGUNTA** — *"perguntas saem sem subir o tom, mesmo com interrogação"*. Ritmo
   não é curva melódica. Escolher referência na velocidade certa não faz pergunta
   subir de tom.
3. **Medi, em vez de supor.** Procurei pitch/F0 no que acabou de subir e no
   `runpod-worker` inteiro da main: **não existe nada que meça ou escolha por
   curva melódica**. No `reference.py` o único uso de `?` é pontuação terminal
   pra cortar em fim de frase. Os únicos `pitch` do worker (`tts_qa/rate.py`,
   `tts_settings.py`) são sobre **preservar** o pitch ao esticar o tempo com
   `atempo` — o oposto de medir entonação. E `F0` em `handler.py`/`montage.py` é
   **nome de produto** ("Vídeo Estúdio F0"), não frequência fundamental.

**Consequência, e é desconfortável:** a queixa da aluna que está esperando segue
**sem conserto no ar e sem conserto escrito**. Não há PR parado esperando merge
pra isso — essa era a esperança das notas anteriores, minha inclusive, e ela não
se sustenta. Atacar de verdade é trabalho **novo**, e começa por **medir** (há
diferença de F0 no fim das frases interrogativas do clone contra as dela?), não
por mexer no seletor de referência.

Anotei a correção **nos dois cartões** (`4ce9f365` e `30f2ce07`), os dois em
`investigating` com o que já foi descartado escrito dentro — `investigating` sem
nota é o mesmo que não ter olhado. Escrevi lá, com todas as letras: **não feche
dizendo que o PR #92 resolveu.**

Não marquei `fixed` em nenhum dos dois. **A regra 14 continua inteira**: o código
subiu, a queixa da aluna não foi resolvida, então não é `fixed`.

---

## 3. Por que 0 aluno respondido

Mesmo critério da ronda anterior, e ele segue certo: a `ellen.atp` foi respondida
**hoje** (Enviados uid 3049) com a orientação de regravar, e **a bola está com
ela**. Cobrar de novo horas depois é pressão, não serviço.

E não escrevi pra ninguém dizer "consertamos a entonação", que seria a carta
natural depois de um merge — porque §2 mostra que não consertamos. Carta errada
seria pior que silêncio aqui.

O retreino dela (10.000 cr) segue sendo **GPU, decisão do Johnny**, empilhado com
o retreino dos 11 do #501. Já está no grupo desde a ronda das 21h; **não repus**,
porque a regra 7 proíbe repetir progresso parcial e repetir de hora em hora mata
o canal que o Lucas também lê.

---

## 4. Percepção (ordem de 17/09)

`percepcao_travada.cjs`: **1 card** (#450), o **mesmo falso positivo** já
declarado duas rondas seguidas. A classe de percepção real em `open`/
`investigating` segue em **ZERO**.

**Um alarme meu que eu derrubei antes de virar ruído — e o registro é o ponto.**
O `idade_dos_abertos` mostrou o #245 (igorlramalho) com a frase *"eu não enxergo
vídeo... isso é olho humano"*, e o varredor não o reportava. Fui atrás achando
que era falso negativo. **Não era:** o #245 está em `aguardando_aluno`, e o
varredor filtra `open`/`investigating` — filtro certo, porque esperar aluno não é
estar travado (regra 8).

Aí medi a classe inteira, e o número assusta antes de explicar: **21 cartões em
`aguardando_aluno` carregam linguagem de percepção**, o mais velho de **31/08**,
todos fora do radar do varredor. **Amostrei os 5 mais velhos antes de acusar** —
e em todos a percepção **já tinha sido feita**: o #216 diz "DESPACHO DE PERCEPÇÃO
CUMPRIDO", o #224 diz "OLHEI OS DOIS VÍDEOS frame a frame", o #223 teve update
entregue e conferido por uid, o #206 já tem a resposta redigida. **Não é pilha
escondida; é fila legítima.**

**O limite que fica nomeado:** hoje nada distingue um cartão parado em
`aguardando_aluno` *com* a dívida de percepção paga de um parado *com ela em
aberto* — o segundo seria invisível. Nos 5 que olhei, era o primeiro caso. Não
apertei o varredor por isso: falso positivo custa 2 minutos, falso negativo
custou os 16 dias de silêncio que originaram a ordem.

---

## 5. O que travou, com quem, e com que data

1. **Retreino dos 11 do #501 + o da `ellen.atp`** — GPU, do Johnny. Pedido na
   ronda das 21h. **Não repus nesta** (regra 7).
2. **O "pode" do reembolso em dinheiro** — pedido em 04/09, **16 dias**. Atinge
   Carlos, Jackson, Leandro e Nassara. Não repus pelo mesmo motivo.
3. **A frase escrita do titular (9-C)** — Carlos (20/09 01h47Z) e Leandro
   (20/09 19h40Z), as duas com data anotada. Esperar aluno não é estar travado.
4. **O embelezamento da imagem** (medição do Vigia às 18hZ: selfie 9,772 contra
   ~8,83-8,91 no gerado, com o prompt da casa já mandando "no beauty filter" e
   não sendo obedecido) — **este merge não tocou nisso** e segue aberto no #500.
   Quem pegar começa por amarrar qual das 9 refs alimentou a geração `4e4e6f99`:
   uma delas se chama `frente_rosto_liso.jpeg` e isso muda o dono da culpa.

**Posts no grupo nesta ronda: 2**, uma linha cada, fato consumado, sem log de
terminal e sem dado de aluno desnecessário:
(a) o fix em produção com o PR e o merge;
(b) **a correção de §2** — que o PR não é o conserto da aluna que espera. Postei
porque eu mesmo dei a informação errada ao Johnny mais cedo hoje, e correção de
coisa que já saiu não é ruído: é a única forma de o canal continuar valendo.

---

## 6. Observação que segue nomeada, sem virar cartão

Continua valendo o de 21h: **nenhum workflow de CI roda `pytest`**. Os testes da
main não barram nada automaticamente. Esta ronda é evidência a favor — as 323
provas só rodaram porque eu as rodei à mão, e o conserto que elas protegem ficou
24 dias parado sem que nada apitasse. Não abri cartão (é infra de CI, não
conserto de ronda, e a fila tem 39 itens com 7d+), mas o custo já apareceu duas
vezes em dois dias.

---

## 7. O que eu não fiz

Não marquei `fixed` nenhum. Não escrevi para aluno. Não cancelei assinatura, não
estornei, não toquei em crédito, acesso, voz treinada nem GPU. Não apliquei
migration (a 118 já estava aplicada desde 25/08; conferi, não rodei). Não mergeei
nenhum dos branches STALE do origin. Não li nem reprocessei nada da planilha
(ordem de 29/08). Nada no privado do Johnny (ordem de 31/08).
