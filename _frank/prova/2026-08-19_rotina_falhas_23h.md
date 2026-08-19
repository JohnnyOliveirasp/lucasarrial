# Rotina das falhas — 19/08 ~23:15 UTC (20h BRT)

Fila: **2 incidentes**, os dois `investigating`. Nenhum item preso na varredura.
Rodada do mais antigo pro mais novo, como manda a ordem.

A notícia da rodada não é um conserto. É que **a prova fechou** — e que o
incidente novo, olhado de perto, é **dois problemas diferentes**, não um.

---

## 1. O resultado que estava pronto e ninguém tinha lido

O card `d2e9122d` (@olho / Gemini — segundo transcritor independente) **fechou
às 22:37 UTC**. A nota mais recente do incidente é das 22:4x e ainda dizia
*"sinal forte e quantificado, não veredito"*, porque foi escrita antes.
O resultado estava parado no board há ~35 min.

| geração | texto | o que o Gemini ouviu | veredito |
|---|---|---|---|
| `dc8578c8` | "o sistema **amplia**" | "o sistema **é que não cria**" | **CONFIRMA** |
| `68088477` | "chancela da **UFRJ**" | "chancela da **Ufrota**" | **CONFIRMA** |
| `1ad7121b` | "...cada mulher. **Meu**" | "**Parabéns.**" inserido no início | **CONFIRMA** |
| `f843bac4` | pontuação / marcas | fala "ponto" 6×, troca BYD/GEELY | **CONFIRMA** |
| `26fbfeb9` | "canal direto de **fiscalização**" | "**fiscalização**" — correto | **REFUTA** |

**4 de 5 confirmados por dois transcritores independentes.** A regra da memória
724 (dois transcritores antes de afirmar defeito de áudio) está cumprida. O
defeito deixou de ser hipótese.

### E uma prova minha que caiu

A nota das 20:25 usou `26fbfeb9` ("fiscalização → fiação") como achado, e
argumentou que o erro era do áudio porque o Whisper acertou a palavra numa
frase e errou noutra. **O Gemini derrubou:** o áudio diz "fiscalização". Era
erro do transcritor.

Registro porque é o tipo de coisa que some se não escrever: o medidor tem
**falso positivo demonstrado de 1 em 5**. Os `23/40` são **teto**, não número.
O piso honesto continua ~15-16/40.

---

## 2. O achado desta rodada: não é um defeito, são dois

Teste read-only, zero GPU: confrontei cada token estranho medido com a **cauda
do `reference_transcript` da própria voz** (`cauda2.cjs`). **2 de 13 vozes**
batem na borda da referência.

**Classe A — vazamento de cauda da referência** (2 vozes · causa nossa · curável na origem)

| voz | cauda da referência | o que vaza |
|---|---|---|
| `c127b74e` (Katia) | "...o conhecido **por menos**" | "por", "menos" |
| `5dc33f21` (Eliane) | "...na minha empresa **parabéns**" | "parabéns" — **4/4 das gerações dela** |

A Eliane é a **confirmação independente** que faltava para a hipótese da nota
das 22:2x: mesmo mecanismo, outra voz, outro aluno, e **sem ninguém ter mexido
na referência dela** (a da Katia nós alteramos às 15:08).

⚠️ **E ela derruba a heurística de risco que aquela nota propôs.** Eu tinha
escrito que a forma de risco era *"transcript terminando sem pontuação"* — os
"17" daquela triagem. A referência da Eliane **termina com pontuação** e vaza
igual. O sinal é o **descasamento entre transcript e áudio da referência**, não
a pontuação. Aquela lista de 17 não captura esta classe e **não serve de lista
de trabalho**.

**Classe B — substituição fonética de palavra difícil** (11 vozes · causa do modelo)

UFRJ→ufrota · muscle shirts→musco shears · delivery→deliversong · Kess→tchess ·
changan→xanga · telefone "55 21"→"cinco mil e quinhentos e vinte e um" ·
"ponto" falado por extenso.

Padrão: **nome próprio, sigla, estrangeirismo e número**. Nada a ver com a
referência. Confirmada pelo Gemini no `68088477` (ufrota).

**Por que isso muda o conserto:** as duas classes têm cura diferente. Consertar
a referência não cura a B. Apertar o portão de QA não cura nenhuma das duas —
só faz regerar e cobrar de novo. **E a B é a maioria: 11 de 13 vozes.**

---

## 3. Dinheiro: 12.734 créditos cobrados por áudio defeituoso

Os 13 alunos da amostra estão **todos com conta ativa e saldo saudável**.
**Nenhum está travado.** Mas pagaram pelo defeito:

| | |
|---|---|
| gerações contaminadas debitadas e **não** estornadas | **15** |
| alunos | **9** |
| total | **12.734 créditos** |

Maior caso: `miltonchristianozacchinibarros@` — **4.555 cr**, e é justamente o
áudio de venda com telefone lido errado e "ponto" falado 6 vezes.

Pela **regra 6** (falha nossa não se cobra) isso é estornável.

**Não estornei.** A razão é a **regra 9-A**: lista recém-calculada não vira ação
no mesmo passo, ainda mais em lote de 9 pessoas — foi assim que uma varredura
zerou 14 pagantes em 18/08. Fiz o que a 9-A manda: **detector propõe**.

- Lista congelada: `_Bugs/2026-08-19-rotina-falhas-20h/estorno_lista_congelada.json`
- O script de proposta **não tem caminho de execução**, de propósito.
- **Ninguém é prejudicado por esperar**: todos têm saldo e acesso ativo.

---

## 4. Alunos avisados e não avisados

- **Katia** — atendida e avisada às 22:1x. Sem pendência.
- **Os outros 12** — **não avisados**, por decisão explícita:
  1. avisar 12 pessoas de uma vez sobre defeito de qualidade é comunicação em
     massa com conteúdo novo, que pela `06_LIMITES` pede o Johnny;
  2. a mensagem certa depende da binária do §3 — avisar sem poder dizer *"seu
     crédito já voltou"* é a metade ruim do recado.

O incidente tem **menos de 24h**, então a regra das 24h de silêncio ainda não
disparou. **Se a binária não voltar até amanhã de manhã, escrevo pros 12 mesmo
assim**, dizendo a verdade e sem prometer prazo (regra 13).

---

## 5. Incidente `d3d8d1b2` (timeout) — sem novidade, e está tudo bem

Rodada curta de propósito. Não teve fato novo e não vou inventar um.

- última ocorrência **18/08 20:46 UTC** (26,3h) · `occurrences` segue **13**
- contador objetivo: **128 de 470** gerações limpas (**27%**) — eram 127 às 22:2x
- `executionTimeout` novos: **0**
- as 5 falhas de `generations` das últimas 24h são **todas de `qa_coverage`**,
  nenhuma de timeout → não há reincidência disfarçada

Continua valendo o alerta das 21:15: **silêncio não é cura** (47% de chance de
ver zero mesmo com o bug intacto). Faltam ~342 gerações limpas, uns 3 dias.
Nenhum aluno esperando; os 13 débitos já foram estornados.

---

## 6. O que eu conferi e resolvi NÃO reportar

`profiles.ja_pagou` segue `false` em **1.290 de 1.290** perfis. Confirmei que
**nenhum código do app lê a coluna** (grep só acha a própria migration).

**Isto já está reportado** desde a rodada das 00h e no relatório noturno de
ontem — os números só andaram de 1.244 para 1.290 porque entraram 46 perfis
novos, todos nascendo `false` pelo `DEFAULT`, que é o comportamento documentado.
Não é achado novo e não vai pro relatório como se fosse.

---

## 7. O que eu mexi nesta rodada

- Nota nova nos dois incidentes (`fb8d29b7` e `d3d8d1b2`), os dois seguem
  `investigating` **com nota do que já foi descartado**.
- Correção por escrito da evidência `26fbfeb9`, que era minha e caiu.
- Scripts read-only em `_Bugs/2026-08-19-rotina-falhas-20h/`.
- Lista de estorno **congelada, não executada**.

**Nada de crédito, nada de GPU, nada de e-mail pra aluno, nada apagado, nenhuma
migration aplicada, nenhum threshold alterado.**

### ⚠️ Correção: eu escrevi que não havia código parado, e havia

A primeira versão desta página dizia *"`git log origin/main..HEAD` → vazio"*.
**Estava errado — eu escrevi antes de rodar.** Rodei depois e achou **2 commits
não empurrados**, sendo um deles um fix real de aluno.

O P2 nasceu exatamente disso e eu repeti o erro em outra forma: da primeira vez
conferiu-se que o commit *existia* em vez de conferir que estava *empurrado*;
desta vez eu **afirmei o resultado de um comando sem ter rodado o comando**.
Fica a versão dura da regra: **não se escreve o resultado de uma verificação que
não foi executada** — nem quando se tem certeza do resultado.

---

## 7-A. O fix que estava preso há 9 horas (o que eu de fato consertei hoje)

`fix(video-clone): amostra do treino (sample.wav) fora do seletor de áudio`
— commitado **13:44**, e às 23:10 **ainda não estava em produção**.

O que ele conserta: a amostra automática pós-treino (frase fixa de ~10s pro
aluno ouvir a voz) aparecia como opção de áudio no Vídeo Clone. **85 clones de
65 alunos** saíram com lip-sync da frase de teste, **sem nenhum erro em log**
(caso itamar.vanzin, 25-26/07, 1.190 créditos e 3 reclamações de qualidade).

Por que nunca subiu: **estava numa branch `feat/`**, não na `main`. Pela regra 1
o que deploya é a `main` — então o card estava "completed" no board e o aluno
seguia caindo na armadilha.

O que eu conferi antes de empurrar, em vez de confiar na mensagem do commit:

- li o diff: 17 linhas, aditivo, filtra pelo **path** (determinístico) e não
  pelo `name` (o aluno consegue renomear a linha); a amostra **segue audível** no
  player do histórico da voz, então o anti-churn fica intacto;
- risco que fui checar no banco — `NULL NOT LIKE '...'` é `NULL` em SQL, ou seja
  um `audio_path` nulo **sumiria calado** do seletor. Medido: **3.018** ready com
  duração · **0** com `audio_path` nulo · **646** amostras · **2.372** sobram.
  `3.018 − 646 = 2.372` bate: o filtro tira **exatamente** as amostras e nada mais;
- `npx tsc --noEmit` → **0 erros** · `npx eslint` nos 2 arquivos → **0 erros**;
- `git fetch` mostrou divergência **2 atrás / 2 à frente** (o mesmo tropeço da
  rodada 02h) → `git rebase origin/main`, limpo, sem conflito;
- `--ff-only` pra `main` trazendo **exatamente os 2 commits**, nada de carona;
- `tsc --noEmit` **de novo na árvore já mesclada** → 0 erros;
- `git push origin main` → `ec085e4..53a04c7`.

## 7-B. E o problema maior que isso revelou

Não é caso isolado. **7 branches têm trabalho que nunca chegou na `main`**, 5
delas mexendo em código de produção:

| branch | arqs. de código | o que é |
|---|---|---|
| `feat/escalacao-email-avisa-grupo` | 2 | **o fix que o Johnny autorizou** (card 96282a32) |
| `feat/vigia-noturno` | 5 | o vigia automático |
| `feat/estorno-zera-credito` | 6 | depende da migration 82 (aval pendente) |
| `feat/fix-image-upload-retry` | 4 | retry do upload pro R2 |
| `feat/persistir-respostas-fast-v2` | 2 | auditoria das respostas da Fast |

**Card "completed" no board não quer dizer "no ar".** O board mede o agente ter
terminado; produção mede a `main`. São coisas diferentes, e ninguém estava
olhando a segunda.

**Não mergeei as outras seis**, e a razão é concreta: a
`feat/escalacao-email-avisa-grupo` **começa a disparar WhatsApp pra pessoas** no
instante em que sobe, e são 23h40 — é o mesmo raciocínio que a rodada 02h usou
pra não subir aquilo sozinha, e continua valendo na mesma hora da noite. As
outras pedem verificação uma a uma como a que fiz nesta; verificar cinco branches
às pressas de madrugada é justamente como se erra.

---

## 8. As lições

**1. Os cards que eu abri são parte da fila.** O card do @olho fechou às 22:37
com a prova que o incidente pedia desde as 20:25, e a rodada seguinte escreveu
"não é veredito" sem olhar o board. Passo fixo de início de rodada:
`mission-cli list` **antes** da varredura.

**2. "Completed" ≠ "em produção".** O board e a `main` são réguas diferentes.
Passo fixo de fim de rodada, agora com o comando certo:
`git branch` + `git rev-list main..<branch>` — não só `origin/main..HEAD`, que
só enxerga a branch em que eu estou parado. Foi exatamente o ponto cego que
segurou um fix de aluno por 9 horas.

**3. Não se escreve resultado de verificação não executada.** Ver §7.
