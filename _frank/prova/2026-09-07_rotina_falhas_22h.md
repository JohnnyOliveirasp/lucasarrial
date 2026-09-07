# Ronda das falhas — 07/09, ~21h40–22h40Z (18h40 BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08.

Repo sincronizado (`main`, `pull --ff-only` — entrou 3 commits) e
`_frank/ordens/README.md` lido antes de tocar em qualquer coisa. Nada da
planilha foi lido, classificado, aberto ou reaberto (ordem de 29/08). Canal:
ordem de 31/08 — aviso no **GRUPO**, nada no privado. Turno 18h40 BRT,
**dentro** da janela 08h–23h.

---

## 0. A ronda em duas linhas

**Não fechei incidente: 34 abertos na entrada, 34 na saída** (eram 32 às 20h;
entraram 2 pela Fast, nenhum meu). O que a ronda produziu foi no **#234**:
executei o passo que a ronda anterior deixou marcado, ele **se refutou**, e a
medição feita para testá-lo **promoveu o achado central do card de anedota
(n=2 vozes) a medição de população (99 vozes, 10.940 fronteiras)**. De quebra
achei que **os dois instrumentos do card não concordam** e que o "0%" do
experimento controlado nunca existiu.

Custo da ronda: **zero**. Sem GPU, sem whisper, sem banco escrito além de
1 nota. Só leitura de um JSONL que já estava gravado.

## 1. Serial: por que o #234, e por que os quatro da frente não

Varredura: **34 abertos**, 12 aguardando aluno, 5 presos, 0 fechado sem retorno.

Subi a fila pelo mais antigo e **reconferi na fonte** em vez de herdar o
"preso" da ronda anterior:

- **#15** (39d, 18 alunos) — reli as 3 últimas notas. Continua parado na
  **migration 82**, que depende de aval. Fui atrás de uma saída: a ordem
  `2026-08-19_ddl_aprovado_e_achados.md` aprova DDL, mas **nominalmente para o
  `scripts/79_profiles_ja_pagou.sql`**, não em geral. Não serve de aval para a
  82. Segue preso, e preso pelo motivo certo. Último disparo 04/09 — não está
  sangrando. Dinheiro já conferido em ronda anterior: 8/8 estornados.
- **#222** (6d) — li as 2 últimas notas (34 no total). A nota 33 recomenda
  REENQUADRAR ou FECHAR e a 34 fecha o encargo do crédito dos 8. Não há aluno
  sem dono. O passo que emperra é **decisão**.
- **#226** (6d) — cobrar ou estornar as gerações reprovadas: **decisão de
  dinheiro**.
- **#234** (5d, 609 ocorrências, 237 alunos) — o primeiro **não preso**. Peguei.

## 2. Antes da fila: o único candidato a "aluno travado" da varredura

A varredura marcou `tania-araujo@uol.com.br` — pagante, 200.000 créditos, voz
`9c145745` em **`awaiting_training` há 3 dias**. Cheira a job preso, e aluno
esperando vem antes da limpeza da fila. Fui ver antes de tratar como incidente.

**Não é defeito.** `awaiting_training` é o estado de quem subiu o áudio e
**ainda não clicou em treinar** — a própria tela diz isso
(`voice-cloning/page.tsx:142`: alunos ficaram *"até 43 dias em
awaiting_training sem clicar"*). A voz tem 6 arquivos e 1800s, e o `updated_at`
é 4 segundos depois do `created_at`: nada tentou rodar e falhar. A bola é dela.

A outra da lista, `roseneidemaia35` (voz `2f893a44`, `training`), **ficou
`ready` durante a própria ronda** (21:36→21:41Z). Resolveu sozinha.

## 3. #234 — o passo recebido era inexecutável, e eu digo isso primeiro

A nota das 19h40 (item 9) mandava medir *"fronteira a fronteira dentro da
63067ce1"*, afirmando que *"a telemetria por fronteira já está gravada"*.

**Não está, para essa voz.** O `cauda_decepada.jsonl` cobre **22/05 a 04/09** e
a `63067ce1` tem **zero** gerações nele — as gerações do experimento controlado
são de **07/09**, depois do fim da varredura. O passo, como escrito, não tinha
como rodar no par de controle.

Fiz o equivalente na **população inteira**, que responde a mesma pergunta com
muito mais força.

## 4. O achado principal: a taxa é propriedade **estável** da voz

Teste de heterogeneidade binomial (qui-quadrado por voz, a **geração** como
unidade), 99 vozes com ≥30 fronteiras internas, 10.940 fronteiras, taxa global
12,8%:

| onde mora a variância | X²/gl |
|---|---|
| **entre vozes** | **10,46x** |
| **entre gerações da mesma voz** | **1,07x** |

1,07 é praticamente 1,00: **dentro de uma voz, as gerações são
indistinguíveis de um sorteio com uma taxa fixa.** Só 5 de 63 vozes testáveis
dão p<0,05 — 8%, contra os 5% esperados por puro acaso.

O achado do experimento controlado (n=2 vozes, com a ressalva honesta de
"evidência forte, não prova definitiva") **agora está medido em 99 vozes, e não
depende do par de controle.** É a confirmação mais forte que este card já teve.

## 5. E o passo que eu recebi está refutado: **posição não explica**

Taxa por ordinal da fronteira, base inteira: **#1 = 8,0%**, e de **#2 a #30**
fica chapado em torno de **13%** (13,8 / 12,9 / 14,4 / 13,1 / 12,5 / 14,2 /
13,2 / 13,0 / 11,1 / 12,7 / 15,8 / 17,1 …).

Não existe posição de chunk que concentre o defeito. O único desvio é a
**primeira** fronteira ser mais limpa que as demais, coerente com o modelo
estar melhor condicionado logo depois da referência — **observação, não causa**.

## 6. A armadilha que eu quase comprei — imagem espelhada da de ontem

Olhando a `c63cebc5` sozinha, fronteira a fronteira, as 3 decepadas caem
**todas numa única geração** (`ef1c0aa4`: 3 de 8) e as outras 6 gerações são
100% limpas. Isso grita *"não é a voz, é o job"* — e teria virado achado.

Testei na população **antes** de escrever: é **ruído de número pequeno**. A
`c63cebc5` é justamente uma das 5 vozes com p<0,05, e com 44 fronteiras e 3
eventos, agrupar assim acontece por acaso.

Ontem o par de controle sustentou lindamente uma hipótese **falsa**; hoje uma
voz sozinha sustentou a hipótese **contrária**, também falsa. Mesma lição, lado
oposto: **amostra pequena gera hipótese, não fecha nenhuma.**

## 7. Achado novo e incômodo: os dois instrumentos não concordam

Nas 17 vozes que têm as duas medidas, comparei a régua da **ENTREGA**
(`qa.tail_interno_entregue`, contador do worker) contra a do **ENVELOPE**
(`cauda_decepada`, medida no áudio que o aluno recebeu):

- **Pearson 0,788** — concordam no ranking, e por isso as conclusões de
  **direção** do card sobrevivem;
- média QA **10,0%** contra média envelope **18,1%**;
- **de 7 vozes que o QA declara 100% limpas, 5 têm decapitação no áudio
  entregue.**

**Consequência direta no experimento controlado:** o polo "limpo" está escrito
como *"0/4 decepadas (0,0%)"*. Medida no áudio entregue, a `c63cebc5` é
**3/44 = 6,8%**. O contraste continua de pé e é enorme (60,7% contra 6,8%), a
direção está certa — mas **o zero nunca foi verdade**: era o contador cego, não
uma voz limpa. Quem for consertar não deve usar "0%" como alvo nem essa voz
como controle limpo.

É da mesma família da tese do próprio card (*"o QA só olha o último chunk"*): o
contador do worker **subestima justamente o defeito que ele existe pra pegar**.

## 8. Mais duas propriedades refutadas (4ª e 5ª deste card)

Volume de treino não prediz: **duração** Pearson −0,006 / Spearman −0,003
(nada); **nº de arquivos** Pearson −0,165 / Spearman −0,228 (fraco e
confundido). Já estavam mortas: velocidade, idade da referência, cauda da
referência.

## 9. Um lead — e eu chamo de lead de propósito

As 5 vozes com duração <600s dão **29,5%** (136/461) contra **11,9%**
(752/6336) das outras 94 — 2,5x. E são exatamente as 5 **sem `lora_path`**.
Parece a propriedade que o card procura há 4 rondas.

**Não afirmo.** As 5 são do **mesmo dono** (`a661ec71`), criadas na **mesma
rajada de 10 segundos** (05/08 15:29:04→15:29:14), com nome de catálogo (Will,
Brian, Rafa, Dutra, Paulo) e duração de 3 a 10s. "Sem LoRA", "referência
curta", "mesmo dono" e "mesmo lote" estão **100% confundidos** — é **um cohort
de 5**, não 5 observações independentes. E dentro do grupo a taxa vai de 5,3% a
49,4%, quase 10x, o que já é argumento contra "ausência de LoRA basta".

Este card já enterrou três hipóteses que ficaram lindas em amostra pequena.
**Não vou plantar a quarta.**

O achado do item 4 **não depende deste cohort**: entre as 94 vozes **com** LoRA
a taxa vai de 0,0% a 54,1%.

## 10. Fila

**34 abertos** na entrada e **34** na saída. Eram 32 às 20h: entraram `#302`
(21:23Z, rosto do Vídeo Clone diferente da foto) e o de 20:58Z (insatisfação
com realismo do Vídeo Clone) — **ambos abertos pela Fast, nenhum meu**. 12
aguardando aluno. **Nada fechado voltou a disparar.**

Escrevo o placar parado sem maquiagem: os quatro mais antigos estão presos em
**decisão do Johnny** (reconferidos hoje na fonte, não herdados), e o quinto é
um problema de **causa** que já derrubou cinco hipóteses. O passo que emperrou
hoje é decisão, em quatro cards, e identificação de causa, em um.

## 11. O que eu NÃO fiz

Não gastei GPU, não gastei whisper, não mexi em crédito/acesso/plano, não
estornei, não apliquei migration, não mergeei PR, não abri branch, não escrevi
código de produção, não escrevi para aluno, não reabri incidente, não mudei
status de nada e não toquei em nada da planilha.

Escritas da ronda: **1 nota** (#234), **1 aviso no grupo** e **2 arquivos no
git** (este log + nada de código). Scripts de uso único ficaram em `_Bugs/`
(fora do git): `2026-09-07_fronteira_a_fronteira.cjs`,
`2026-09-07_overdispersao.cjs`, `2026-09-07_duas_reguas.cjs`,
`2026-09-07_treino_prediz.cjs`.

## 12. Precisa de DECISÃO do Johnny (inalterado desde as 19h40)

1. 🔴 **O "pode" dos 8 do #290** — pendente desde 04/09; ~800k créditos parados,
   7 nunca entraram. Já foi ao grupo às 19h40; **não repeti hoje pra não virar
   ruído**.
2. 🔴 **`migration 82`** — destrava o #15 (39 dias). Reconfirmei hoje que a
   aprovação de DDL de 19/08 **não** cobre essa migration.
3. 🟡 **#254 / Diego** — relógio em **08/09 12:00Z (amanhã)**.
4. 🟡 **#265** — política de garantia parada; código já curado.
5. 🟡 **#226 / #234** — cobrar ou estornar as gerações reprovadas pelo QA.
6. 🟡 **marcelopersonalthe32** — prazo de reembolso vence **11/09**.
7. 🟡 **#222** — o próprio card pede reenquadrar ou fechar.

## 13. Para quem pegar a próxima ronda

- **A causa NÃO está em:** texto (experimento controlado), posição de fronteira
  (item 5), nível de geração/job (item 4), volume de treino (item 8),
  velocidade / idade / cauda da referência (rondas anteriores). São seis "não"
  medidos — não repita nenhum.
- **Não use `qa.tail_interno_entregue` como verdade de "limpo"** (item 7). Ele
  lê pra menos e chama de 100% limpa voz que tem defeito no áudio entregue.
- **O `cauda_decepada.jsonl` está desatualizado** (para em 04/09). Qualquer
  conclusão sobre voz de 05/09 em diante precisa de `--varrer` antes.
- **Próximo passo sugerido, ainda de graça:** pegar as ~10 vozes de taxa mais
  alta e as ~10 de taxa 0,0%, **todas com LoRA** (para tirar o cohort do item 9
  do caminho), e comparar o que já está gravado delas no banco — em vez de
  medir áudio por atacado, que já deu três "não".
