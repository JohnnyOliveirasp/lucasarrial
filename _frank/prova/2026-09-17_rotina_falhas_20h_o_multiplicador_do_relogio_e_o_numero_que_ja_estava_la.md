# Ronda das falhas — 17/09 ~20hZ

**Item serial: `#15` / `d3d8d1b2` (49,2 d, o mais velho da fila). NÃO FECHADO.**
O defeito não tem conserto. Mas a causa que este cartão persegue há 49 dias
está **medida, com controle**, e a hipótese que a ronda de 16/09 deixou como
"a confirmar" está **confirmada**.

---

## 0. Por que peguei este e não outro

Fila: **85 abertos** (1 com 30d+, 2 entre 15-30d, 39 entre 7-15d).
Os três cartões mais velhos do sistema são `#15` (49,2d), `#226` (16,0d) e
`#234` (15,1d). Conferi o estado de cada um antes de escolher:

| cartão | trava real | dono do próximo passo |
|---|---|---|
| `#226` 702cc916 | decisão de produto (a) falhar tudo × (b) só o grave | **Johnny**, pedida 16/09 |
| `#234` f8587cef | virar `TTS_TAIL_QA_INTERNO_MODO=reprovando` (gasta GPU) | **Johnny**, pedida 12/09 |
| `#15` d3d8d1b2 | instrumentar contagem de tentativas | **meu**, delegado em 16/09 |

Só o `#15` tinha passo meu. Peguei ele. E a aluna que o `#234` citava como
esperando (Katia, `katiasalvador32@gmail.com`, relato de 13/09) **já foi
atendida** — conferido no `#259`, nota de 14/09: *"Aluna (Katia) já atendida e
satisfeita hoje pelo #47 — não levou 4º e-mail de propósito"*. Não há silêncio
pendente ali, então não escrevi um quarto e-mail pra ela. Foi exatamente o erro
que eu cometi anteontem com o Luciano.

---

## 1. O número que a ronda de 16/09 disse que faltava já estava no banco

A nota de 16/09 fecha assim: *"instrumentar CONTAGEM DE TENTATIVAS por geração,
que é o número que falta. Delegado nesta ronda."*

Fui escrever a instrumentação e conferi antes. **`tts_qa/loop.py:588` já faz
`qa_stats["regens"] += 1`**, e o campo chega no banco em
`generations.qa->>'regens'`. O próprio arquivo cita, em `loop.py:180`, *"a
geração 97464f01 tem regens=19"*. O contador existe desde antes deste cartão.

É a **quarta vez** que este cartão conclui "o dado não existe" sem rodar o
controle positivo (12/09 denominador inflado, 14/09 denominador inflado, 15/09
"telemetria desligada", 16/09 "falta contar tentativa"). A diferença é que
desta vez a checagem custou **um grep**, e ela veio antes da conclusão em vez
de depois.

## 2. O que de fato falta é outra coisa

**Os 19 `executionTimeout` têm `regens` NULO — 19 de 19, conferidos um a um.**

Motivo estrutural, não bug: `qa_stats` só é persistido no **fim** do job. Job
morto por SIGKILL no teto nunca escreve. Nos 2 timeouts de 04/09 a coluna `qa`
existe (`tem_qa=true`), mas só com o que o heartbeat escreveu — a fase. O resto
do `qa_stats` nunca chegou.

A contagem de tentativas existe **pra quem termina** e não existe **pra quem
morre**, que é exatamente a população deste cartão.

## 3. A hipótese 5 de 16/09 está confirmada — com texto controlado

Primeiro corte, **sem** controle (e por isso não vale sozinho): `regens 0` →
elapsed médio 52 s; `regens 11+` → 188 s. Mas `chars_medio` subia junto
(404 → 1178). Regens podia ser só um apelido de "texto longo" — era o jeito
óbvio de me enganar aqui, e por isso segurei a conclusão.

**Controle: só textos ≥1500 chars**, onde o tamanho fica praticamente constante:

| regens | n | chars médio | elapsed médio | máx | ≥300 s |
|---|---|---|---|---|---|
| 0-10 | 48 | 1802 | **142 s** | 246 | **0 de 48** |
| 11-20 | 18 | 1745 | 220 s | 359 | 1 de 18 |
| 21-30 | 25 | 1913 | 271 s | 373 | 6 de 25 |
| 31+ | 21 | 1878 | **314 s** | **480** | **12 de 21 (57%)** |

Tamanho de texto varia 9% entre a primeira e a última faixa. O tempo varia
**2,2×** e a fração encostada no teto vai de **0% a 57%**.

Zero de 48 gerações de texto longo com ≤10 regens chegou perto do teto. A pior
delas parou em 246 s — **metade** do teto de 480 s.

## 4. A explicação alternativa está refutada, e ela era boa

Objeção honesta: talvez geração "difícil" (ref ruim, voz difícil) seja ao mesmo
tempo **lenta por tentativa** e regeneradora. Nesse caso regens seria sintoma,
não causa.

Teste: **segundos por tentativa** = `elapsed / (chunks + regens)`.

| regens | n | chunks | regens | elapsed | **s/tentativa** |
|---|---|---|---|---|---|
| 0-10 | 33 | 17,8 | 4,7 | 142 s | **6,8** |
| 11-20 | 17 | 15,9 | 16,0 | 219 s | **7,0** |
| 21-30 | 22 | 19,5 | 25,4 | 274 s | **6,2** |
| 31+ | 16 | 27,3 | 38,0 | 317 s | **4,9** |

O custo por tentativa é **plano** (e cai um pouco na faixa pior). O job não fica
mais lento: **ele faz mais vezes.** É o formato de um multiplicador, não de
lentidão intrínseca.

## 5. Isso derruba o `resolution_note` que está de pé desde 20/08

O cartão afirma *"job PENDURADO no worker (hang), não régua curta"* e 5 rondas
repetiram. Duas medições independentes dizem o contrário:

1. **16/09** — no instante do SIGKILL a fase corrente tinha **4,9 segundos** de
   vida (`a07e9278`). Hang apareceria com `running_s` na casa das centenas.
2. **hoje** — com texto controlado, quem leva o job ao teto é o **número de
   tentativas**, e o custo por tentativa é constante.

Procurar deadlock no handler é procurar no lugar errado, e foi isso que a ordem
permanente mandou fazer por 49 dias.

## 6. Os três cartões são um sistema só, e isso muda o preço da decisão do Johnny

`#226` e `#234` estão parados esperando o Johnny **subir o rigor do QA**.
Ninguém tinha medido o que rigor a mais custa em **tempo**. Agora está medido:
**rigor a mais = regens a mais = elapsed a mais = teto.**

E o custo não é uniforme. Sombra do `#234` por faixa de regens (desde 03/09):

| regens | n | chars | **+sombra** | elapsed médio |
|---|---|---|---|---|
| 0-10 | 694 | 564 | +1,3 | 87 s |
| 11-20 | 113 | 1018 | +3,7 | 166 s |
| 21-30 | 22 | 1673 | +5,1 | 249 s |
| 31+ | 9 | 1847 | **+7,6** | **304 s** |

A média de "+94 regens/dia" levada ao grupo em 12/09 está **certa e engana**:
a sombra se **concentra** nos jobs que já rodam a 304 s, os mais perto do teto
de 480 s. A 6 s/tentativa medidos, +7,6 regens são ~**+46 s** onde já sobra
menos.

**Limite declarado:** `tail_interno_sombra` conta **tentativa marcada**, não
regen que aconteceria — parte cai em chunk que já esgotou `max_attempts`.
Então **+7,6 é teto do acréscimo, não previsão.** A direção está provada, a
magnitude exata não.

## 7. Limites desta ronda, declarados em vez de omitidos

- Tudo aqui é medido em geração que **terminou** (`ready`). Os 19 timeouts não
  têm `regens` (item 2), então a ligação com as falhas reais é **inferência
  forte, não medição direta**. Só o item 2 resolvido fecha essa ponta.
- `corr(regens, elapsed)` por faixa de tamanho: **0,49 a 0,90**, positiva nas 9
  faixas. Correlação, não experimento.
- `coverage_medido_n` como proxy de "chunks" ignora o resgate por subdivisão,
  que cria sub-pedaços. Isso **infla** tentativas na faixa pior e portanto
  **puxa pra baixo** o s/tentativa dela — o viés trabalha **a favor** da minha
  conclusão, e eu declaro em vez de deixar passar. Medi o tamanho do viés em
  vez de supor: `coverage_rescue` por faixa deu 1 resgate em 33 gerações
  (0-10), 1 em 17 (11-20), 4 em 22 (21-30), 9 em 16 (31+). Nas duas faixas onde
  o resgate é praticamente ausente o s/tentativa **já é plano** (6,8 × 7,0),
  então o item 4 não depende da faixa contaminada.

## 8. Estado e dinheiro

`executionTimeout`: **zero ocorrência nova** desde 04/09 20:47:50Z (12,9 dias).
Classe **dormente, não curada** — regra 14, não marco `fixed` em cima de
ausência de sintoma.

Não gastei GPU, não virei chave nenhuma, não toquei em crédito, acesso, voz nem
migration. Tudo leitura no banco e no código.

## 9. O que sai daqui

- **Nota gravada** em `d3d8d1b2` (69 → 70 notas, conferida na releitura, 1 linha
  afetada). Referência cruzada gravada em `702cc916` (51 → 52) e `f8587cef`
  (36 → 37).
- **Cartão `15c6d862`** no Mission Board para o `coder`: heartbeat levar o
  `regens` acumulado (telemetria pura, sem GPU, sem mudança de comportamento).
  Branch `feat/heartbeat-regens-acumulado`, PR com base `main`. **Não mergeado
  por mim** — volta pra revisão.
- **Decisão pro Johnny**, no grupo: o `#226` e o `#234` agora têm o preço em
  tempo junto do preço em qualidade. **Uma pergunta, não três.**
- O conserto do próprio `#15` (orçamento de regen consciente do teto) é a
  **mesma troca** qualidade × entrega que está na mão do Johnny. Não decido no
  lugar dele.

## 10. Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` → **vazio**.
Nenhum fix preso em branch de feature: o único branch criado nesta ronda é o do
cartão do `coder`, que ainda não existe no origin e vai por PR.
