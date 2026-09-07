# Ronda das falhas — 07/09, ~18h40–19h20Z (15h40 BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08.

Repo sincronizado (`main`, `pull --ff-only`, já estava em dia) e
`_frank/ordens/README.md` lido antes de tocar em qualquer coisa. Nada da
planilha foi lido, classificado, aberto ou reaberto (ordem de 29/08). Canal:
ordem de 31/08 — avisos no **GRUPO**, nada no privado. Turno 15h40 BRT,
**dentro** da janela 08h–23h.

---

## 0. A ronda em duas linhas

**Fechei o #231 (5 dias parado, aluno já respondido duas vezes e ninguém tinha
conferido o Sent). Depois peguei o handoff que a ronda das 12h45 deixou cravado
no #234, confirmei que a telemetria está em produção, li os contadores — e a
leitura aposentou a hipótese que o card carregava, derrubou um alarme falso que
custaria um revert, e achou um experimento controlado dentro do próprio banco
que elimina o confundidor de 5 dias.**

---

## 1. Serial: por que estes dois

Varredura: 33 abertos, 12 aguardando aluno, 4 presos, 0 fechado sem retorno.

Subi a fila do mais antigo. Os quatro primeiros seguem **presos em decisão do
Johnny**, e conferi um por um em vez de repetir a frase da ronda anterior:

- **#15** (39d) — migration 82 não aplicada, reconferido no `information_schema`.
  Dinheiro já conferido: os 8 timeouts estão 100% estornados. Ninguém perdeu
  crédito.
- **#222** (6d) — a própria nota do card recomenda REENQUADRAR ou FECHAR, e diz
  que não há aluno sofrendo sem dono; o passo que emperra é decisão, não
  investigação.
- **#226** (6d) — cobrar ou estornar, decisão de dinheiro.
- **#234** (5d) — a parte técnica **não** está presa. Foi onde eu fui.

O primeiro NÃO-preso da fila era o **#231** (5d). Peguei ele primeiro por ser o
mais antigo com aluno afetado e destravável.

## 2. #231 — FECHADO (Sidney Santos)

O card estava aberto há 5 dias com a nota da Carol dizendo *"FICA ABERTO até
alguém responder o aluno"*. **Conferi o Sent antes de fechar, um a um, em vez de
presumir** — e o aluno já estava respondido nas duas ocorrências:

| ocorrência | pergunta | resposta |
|---|---|---|
| 1 | limite máximo de áudio no treino (ele tinha 1h40) | 02/09 11:29:08Z, **Sent uid 450** |
| 2 | teto de 90s do Vídeo Clone e alternativa pra conteúdo longo | 07/09 11:31:05Z, **Sent uid 1214** |

O texto de hoje dá exatamente a resposta que a ocorrência 2 pedia: o Vídeo Clone
aceita até 90s, o áudio dele (2min28) existia e estava inteiro mas ficava fora da
lista sem aviso, e o caminho pra roteiro maior é dividir e juntar na edição.

O defeito de interface que saiu disso **já está corrigido e em produção**:
`#292`/`adc3ed99`, commit **`216417c` na main** (conferido com
`git branch --contains`, não no card e não no `gh`).

E ele não está esperando nada: `ler_caixa --de sidneysantos100` mostra que a
**última mensagem dele é de 26/08** (uid 313, *"Consegui!"*), sobre acesso.
Não respondeu ao e-mail de 02/09 nem ao de hoje.

Fechado como `fixed`, 1 linha afetada conferida na releitura. **Não escrevi de
novo pra ele** — terceiro e-mail sobre assunto já respondido é ruído, não
atendimento.

## 3. #234 — o handoff cumprido, e o que a medição disse

A nota de 12h45 terminou assim: *"QUEM PEGAR A PRÓXIMA RONDA: conferir
`gh run view 34124001025` e exigir conclusion=success ANTES de escrever que a
telemetria está no ar."* Cumprido.

### 3.1 Produção confirmada — e não parei no build verde

`conclusion=SUCCESS`, completed **13:36:03Z**. Mas run verde não é ferramenta
funcionando (é a lição inteira da fumaça do Vídeo Clone), então fui ao dado
real: **24 geracões** criadas depois de 13:36Z carregam os contadores novos, a
mais antiga 14:51:05Z, a mais nova 18:43:43Z.

**A conta fecha, como o PR prometeu:** `tail_cura_tentada` 2 = 5 bails (0) +
`tail_healed` (2). Nenhuma chamada sem desfecho, logo nenhuma exceção engolida.

### 3.2 A cura NÃO é o gargalo — hipótese de 06/09 aposentada

```
tail_cura_tentada        2
tail_cura_bail_sem_alvo  0   bail_sem_palavra 0   bail_sem_fim 0
bail_corte_invalido      0   bail_ainda_ruim  0
tail_healed              2
```

A cura não sai por porta nenhuma. Quando é chamada, **entrega: 2 de 2**.

A instrumentação foi construída pra descobrir por qual das 5 portas ela escapava,
partindo do *"5,8% de eficácia"*. A resposta é: **por nenhuma**. Ela é raramente
*chamada* — o gate é `_fim_ainda_ruim(seg)` no último chunk **depois** do laço de
QA (`inference.py:464-465`), e o regen do QA já resolve a maioria antes:
`tail_flagged` 13 por tentativa contra `tail_cura_tentada` 2 no desfecho.

O "5,8%" era razão entre populações diferentes, não taxa de falha da cura.
**Mexer em `_curar_fim_abrupto` é otimizar o que já funciona.**

### 3.3 Onde o dano está, inteiro: a sombra

```
tail_interno_checked 145 | tail_interno_flagged 66
tail_interno_sombra   66 | tail_interno_word_flagged 0
```

**100% do que a fronteira interna reprova morre em sombra.** 66 reprovadas, 66 em
sombra, zero pontuaram. E o teste de PALAVRA nunca roda internamente
(`TTS_TAIL_QA_INTERNO_PALAVRA` desligada, `loop.py:497`): decapitação de palavra
na fronteira interna é hoje **indetectável**, não apenas ignorada. O contador em
0 não é "não aconteceu", é "ninguém olhou".

### 3.4 ⚠️ Alarme falso derrubado — não revertam o PR #197 por causa deste número

Taxa de fronteira interna decepada **entregue**, por dia:

| 03/09 | 04/09 | 05/09 | 06/09 | 07/09 |
|---|---|---|---|---|
| 9,5% | 7,4% | 13,8% | 6,6% | **26,0%** |

E hoje, partido no deploy: **antes** de 13:36Z = 11,0% (8/73) · **depois** =
**40,3%** (31/77).

Lido cru isso é regressão de 4x batendo exatamente no deploy, e a conclusão óbvia
seria reverter. **Fui conferir o confundidor antes de gritar, e ele existe:** 17
das 31 decepadas do pós-deploy (55%) são de **uma voz só** (`63067ce1`, 62,5%).

A prova que fecha: o **mesmo aluno**, na **mesma janela**, com a **mesma imagem**,
tem as duas vozes — `c63cebc5` saiu **0 de 4**, `63067ce1` saiu **17 de 28**.
Não é a build.

Registro em letra grande porque o próximo que abrir o gráfico diário vai ver o
pico de hoje e propor revert de um deploy correto.

### 3.5 O dano concentra por VOZ — e o texto está eliminado

17 vozes com ≥20 fronteiras julgadas, 654 fronteiras, 70 decepadas (10,7%):

- **3 vozes** (17,6%) estão em ≥30% e carregam **58,6% de todo o dano**
- **8 vozes** (47%) estão abaixo de 5%; três delas em **0,0%** com 24 a 53
  fronteiras cada

O card afirma desde 02/09 que *"espalhado assim é defeito de PRODUTO, não de
voz"*. Na régua da **entrega**, isso não se sustenta.

E aí veio o achado da ronda. Eu tinha registrado o confundidor voz×texto como
"não consigo separar" — mas havia um **experimento controlado dentro do próprio
banco**:

> `md5(text_normalized) = 58cae5…caf7b1`, 562 chars, 4 fronteiras internas
> · voz `63067ce1`: 7 gerações, 28 fronteiras, **17 decepadas (60,7%)**
> · voz `c63cebc5`: 1 geração, 4 fronteiras, **0 decepadas (0,0%)**

Mesmo aluno, **texto byte a byte idêntico**, mesmo dia, mesma imagem de worker,
mesmo chunking (4 e 4). **A única variável que sobra é a voz.** E bate com a vida
inteira das duas: 1/54 (1,9%) contra 20/32 (62,5%).

**Ressalva honesta:** o lado limpo do par é UMA geração. O que sustenta esse lado
não é ela sozinha, é o 1/54 de vida da voz. Evidência forte, não prova definitiva.

### 3.6 O que eu não achei, e não inventei

**Não achei a propriedade da voz que explica.** Testei duas e as duas falham:

- **velocidade** (`speech_rate_wps`): a pior voz é a mais rápida (4,32), mas
  vozes de 3,78 e 3,56 wps estão em 4,3% e 0,0%. Não é monótona.
- **idade da referência** / corte do fix `ff06195` (02/09): não separa — piores
  (04/09, 05/09, 03/09) e limpas (02/09, 03/09, 06/09) estão dos dois lados.

**Ressalva de tamanho:** 17 vozes, 654 fronteiras. Efeito grande, amostra pequena.

### 3.7 O que muda no conserto

O alvo deixa de ser o pipeline de QA e passa a ser **a voz**. Isso é boa notícia
operacional: conserto de voz a gente já sabe fazer e já tem ferramenta provada
(`fabricar_referencia.cjs`, #233/PR #151), enquanto mexer no QA custaria regen e
GPU pra todo mundo. E explica por que todas as saídas anteriores fracassaram —
virar a chave da sombra, estender a cura por isca e apertar a régua são todos
consertos de **pipeline**, e o defeito não está lá.

**Próximo passo, agora mais estreito e mais barato:** medir a referência
(`ref/auto.wav`) da `63067ce1` contra a da `c63cebc5` com
`medir_ritmo_das_vozes.cjs` e `medir_velocidade_voz.cjs`. Duas vozes do mesmo
dono, uma limpa e uma podre, com o mesmo texto já medido — é o par de controle
ideal. Não fiz nesta ronda de propósito: whisper por áudio custa, e cirurgia em
voz de aluno pagante no fim de ronda é como se erra.

**Seguem valendo os NÃO-FAZER:** não virar `TTS_TAIL_QA_INTERNO_MODO=reprovando`,
não estender a cura por isca pra fronteira interna, não medir por transcrição.
Segue o acoplamento com o #226.

## 4. O que eu conferi e NÃO virou trabalho

- **Tânia Araújo** (`awaiting_training`, 3 dias, 200k créditos, sem voz pronta) —
  o alarme da varredura procede, mas ela **não está abandonada**: `awaiting_training`
  espera o clique dela (por desenho), e ela já recebeu **dois e-mails à mão**
  (05/09 uid 1071, 06/09 uid 1158). A bola é dela.
- **O sweep de lembrete de treino** (`lembretes_treino` em `agent_state`) está
  **vazio**, e isso é correto, não defeito: o corte de backfill é
  `2026-09-06T00:00Z` e a régua dispara no dia 3. A voz mais nova em
  `awaiting_training` é de **04/09**, anterior ao corte. Não há nada pra ele
  fazer ainda. Registro porque "tabela vazia" tem cara de coisa quebrada.
- Das 16 em `awaiting_training`, **14 têm outra voz `ready`** do mesmo dono —
  entulho de segunda tentativa, não gente esperando.

## 5. Saúde do sistema

Da varredura: 4 presos (1 job obsoleto sem ninguém esperando, 3 sem voz pronta,
1 import quebrado), lista de estorno em dia (10 tipos, 2.928 linhas, nenhum tipo
desconhecido), **0 fechado sem retorno humano**.

## 6. Fila

**32 abertos** ao fim da ronda (eram 33; fechei o #231), 12 aguardando aluno.

**Nada fechado voltou a disparar.**

## 7. O que eu NÃO fiz

Não gastei GPU, não mexi em crédito/acesso/plano, não estornei, não apliquei
migration, não mergeei PR, não abri branch, não escrevi código, não escrevi pra
aluno, não reabri incidente e não toquei em nada da planilha.

Escritas da ronda: **1 fechamento** (#231), **2 notas** (#234) e **1 arquivo no
git**.

## 8. Precisa de DECISÃO do Johnny (inalterado)

1. 🔴 **O "pode" dos 8 do #290** — pendente desde 04/09; código já em produção
   (`0b672b2`), falta só a autorização do e-mail em massa.
2. 🔴 **`migration 82`** — destrava o #15 (39 dias).
3. 🟡 **#254 / Diego** — relógio em 08/09 12:00Z (amanhã).
4. 🟡 **#265** — política de garantia parada; código já curado. Fica mais urgente
   com o caso Simone (compra 31/08, hoje é o dia 7).
5. 🟡 **#226 / #234** — cobrar ou estornar as gerações reprovadas pelo QA.
6. 🟡 **marcelopersonalthe32** — prazo de reembolso vence **11/09**.
7. 🟡 **#222** — o próprio card pede reenquadrar ou fechar.
