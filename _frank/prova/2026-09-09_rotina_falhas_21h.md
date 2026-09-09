# Ronda das falhas — 09/09 ~20h40–21h20Z (Frank, dono da fila)

**Card:** `#226` / `702cc916` — *"ENTREGAMOS ÁUDIO QUE O NOSSO PRÓPRIO QA
REPROVOU"*. **NÃO fechado.** Segue `investigating`, com a nota 41.

**Onde emperrou, em uma linha:** o card ia fechar hoje pelo critério que ele
mesmo deixou, e **a medição disse o contrário** — apareceram 3 entregas abaixo
do piso e a *terceira porta* disparou nas 3, então a conta **reinicia**. Fechar
seria mentira.

---

## §1 — Por que o `#226` e não outro

Regra 8: o mais antigo **acionável** com aluno afetado. Conferido um a um:

| card | idade | por que não é ele |
|---|---|---|
| `#15` `d3d8d1b2` | 30/07 | espera ocorrência nova. Última em 04/09. Sem evento não há o que fazer |
| `#47` `ce6e157d` | 19/08 | **escalado ao Johnny às 19h55Z de hoje**; a decisão do `tts_silence_ms` é dele |
| **`#226`** `702cc916` | **01/09** | **a própria nota mandava re-medir depois das 18hZ. São 20h40Z** ← pegue este |
| `#223` | 01/09 | tratado na ronda das 16hZ; aluna já respondida |
| `#234` | 02/09 | espera "pode" pro retreino que gasta GPU |
| `#237` | 02/09 | travado em identificação humana desde 02/09 — ninguém respondeu quem é o aluno |

O `#226` era o único do topo com **trabalho meu pendente e horário certo**: a
nota de 11h50Z pediu explicitamente *"só vale re-medir depois das 18hZ, quando o
pico brasileiro já passou"*.

---

## §2 — A medição, e o controle antes dela

Mesma consulta do item 2 da nota de 10h44Z. Corte no deploy **08/09 15:22:32Z**,
filtro `length(text_normalized) >= 40`, base desde 04/09.

| janela | entregas | alunos | < régua 0,85 | < piso 0,65 | em zero |
|---|---|---|---|---|---|
| ANTES | 184 | 76 | 32 (17,4%) | **8** (4,35%) | 4 |
| DEPOIS (11h50Z) | 59 | 21 | 5 | **0** | 0 |
| **DEPOIS (agora)** | **104** | **40** | **15** | **3** (2,88%) | **2** |

**Controle:** a linha ANTES reproduziu **exatamente** (184/76/32/8/4) pela
terceira ronda seguida. Mesmo instrumento, mesma régua — o que mudou foi a
realidade, não a consulta.

Critério que a nota de 10h44Z fixou, por escrito: *"n≥68 com abaixo_piso=0 e
gate terminal em zero real → FECHAR; apareceu uma abaixo do piso, a conta
REINICIA e não se fecha."* Chegou o `n` (104 > 68) **e chegaram as 3**.
Aplico como está escrito.

---

## §3 — Eu estava errado sobre a terceira porta

A nota de 10h44Z afirmou: *"na população real (n=59), gate terminal disparou
ZERO vezes"*. **Hoje disparou 3 vezes, em entrega de aluno de verdade** — as 3
com `coverage_espalhada_piso_terminal = 1`:

| entrega | hora Z | aluno | chars | visto | exhausted | regens |
|---|---|---|---|---|---|---|
| `8488dc5e` | 14:02 | grupouniprox | 785 | **0,600** | 6 | 20 |
| `ea11989a` | 15:56 | ibccoaching | 1604 | **0** | 8 | 51 |
| `873fcee4` | 16:11 | ibccoaching | 1591 | **0** | 2 | 23 |

Nenhuma é artefato de população: `pt` com prob 0,998–1,0, textos reais, com
`runpod_job_id` (não são "Amostra automática"). O caminho é
`inference.py:476-483` — no gate terminal o piso **só conta** e entrega a menos
ruim, por decisão de 04/09 (commit `243aa73`).

---

## §4 — O controle que separou as 3 em dois casos diferentes

Não aceitei o zero do QA sem medir a **saída** por instrumento independente
(whisper sobre o mp3 entregue, `medir_pausas_da_entrega.cjs`), contando palavra
do áudio contra palavra do texto:

| entrega | visto (QA) | palavras no TEXTO | palavras no ÁUDIO | delta |
|---|---|---|---|---|
| `ea11989a` | 0 | 253 | 252 | −1 |
| `873fcee4` | 0 | 253 | 255 | +2 |
| `8488dc5e` | 0,600 | 139 | **131** | **−8** |

**As duas de cobertura ZERO estão completas.** O zero é do **instrumento**: as
duas têm `coverage_alucinado` 12 e 8 (e `coverage_alucinado_saida` 3 e 2) — o
whisper do QA alucinou no pedaço e leu cobertura 0 num áudio que tem tudo.

**A de 0,600 é real, e os dois instrumentos concordam em direção e tamanho:** o
QA lista `faltantes_amostra = ["de","todos","esses","anos"]` (7 faltantes, 4 no
pior pedaço) e a entrega lê 8 palavras a menos. O trecho *"Queria te agradecer
pessoalmente pela parceria de todos esses anos"* saiu do áudio **sem "de todos
esses anos"**.

➜ **Dano a aluno provado nesta janela: 1 em 104, não 3.** A taxa que interessa
não é "abaixo do piso", é "abaixo do piso **E** incompleta de verdade".

---

## §5 — Corrijo a recomendação que eu mesmo dei ao Johnny

A nota de 10h44Z disse ao Johnny, sobre o item (c): *"o número novo a favor de
mexer ficou ainda mais forte: o gate terminal disparou 0 vezes, então trocar o
comportamento lá hoje não reproduz a tempestade de 19/08"*.

**Isso está errado hoje, por dois motivos medidos:**

1. O gate **não** dispara 0 vezes. Dispara ~3 a cada 104 entregas.
2. Pior: em **2 dessas 3** o piso foi acionado por **alucinação do próprio QA**.
   Se o gate terminal passasse a falhar abaixo do piso, ele teria matado hoje
   **2 áudios COMPLETOS** e disparado 2 estornos automáticos por defeito que não
   existia — que é literalmente o mecanismo da tempestade de 19/08.

O que a medição de hoje recomenda **não** é "trocar o gate terminal para
falhar". É: **antes de o piso poder matar job, o piso precisa ser cego para
alucinação.** A alucinação já é detectada e contada (`coverage_alucinado`), mas
não invalida a leitura de cobertura. Enquanto isso não existir, entregar a menos
ruim segue sendo a escolha menos pior.

Não abri card novo: é a mesma classe e o dono é este chamado.

---

## §6 — Aluno: o que fiz e o que não fiz

- **`luisfelipe.silva@ibccoaching.com.br`** — **não escrevi, de propósito.** Os
  2 áudios dele estão completos (§4). Escrever "achamos um defeito" seria
  repassar alarme de instrumento pra dentro da caixa de um aluno que não
  reclamou (conferido: `ler_caixa --de` = nada). Registro sem agir: ele gerou o
  mesmo texto de ~1.900 chars **3×** hoje (15:56, 16:11, 17:44) pagando 1.922
  créditos cada. Se ele reclamar de qualidade, o caso começa aí — e não é
  cobertura.
- **Edésio / `grupouniprox@grupouniprox.com.br`** (tem o `#315` aberto por outro
  assunto) — defeito **real** às 14:02Z, e ele **já se resolveu sozinho**:
  regerou às 14:15Z (`ec19156e`, 779 chars), saiu limpo (visto 0,955, 1
  faltante). **Não está esperando resposta nem travado.**
- **O que sobra é dinheiro, e eu não decido sozinho:** ele pagou **785 créditos**
  pela entrega defeituosa e **779** pela regeração que só existiu por causa dela.
  Devolver crédito de aluno é decisão do Johnny (*"nunca escolha em silêncio
  quando envolve dinheiro de aluno"*). **Escalado ao grupo com o número na mão,
  não executado.** Não prometi nada a ele.

---

## §7 — Fecho da ronda

- Nota 41 gravada no `#226` (conferida na releitura: 1 linha afetada,
  `agent_notes` 40 → 41).
- Grupo avisado com os dois itens: a correção do item (c) e os 785 créditos.
- **Nenhum fix de código nesta ronda** — o defeito medido é de *decisão de
  produto* (o gate terminal existe por escolha de 04/09), não de código quebrado.
  Subir patch aqui sem o "pode" seria escolher no lugar do dono.
- Nada da planilha lido, escrito ou classificado (ordem de 29/08).
- Nenhum crédito, GPU, migration, PR, acesso ou plano tocado.

## §8 — Pra próxima ronda

1. **Não re-meça a linha ANTES:** reproduz há 3 rondas, está conferida.
2. **Não trate `coverage_min_visto = 0` como dano ao aluno** sem rodar o controle
   da saída (§4). Hoje isso teria produzido 2 avisos falsos a um aluno pagante.
3. **A conta do `#226` reiniciou hoje às 16:11Z.** Precisa de **n≥68** entregas
   com `length >= 40` **depois** de 09/09 16:11Z, todas com abaixo_piso = 0.
   Ritmo medido: 104 entregas em 29h = 3,6/h → **~19h de produção**. Não meça
   antes disso; medir cedo só gasta ronda.
