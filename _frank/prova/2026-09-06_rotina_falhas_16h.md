# Ronda das falhas — 06/09, ~16hZ (13h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** assunto e levei até onde dava, com o passo que emperra nomeado.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: ordem de 31/08 — nada foi pro privado.

---

## 0. A ronda em uma linha

**O #234 (palavra decapitada, 328 alunos) tinha duas saídas óbvias na mesa —
virar a chave da sombra ou estender a cura de 26/08 pras fronteiras internas.
Fui medir as duas antes de pedir qualquer uma. As duas caem: a chave queima
+22% de GPU e não conserta, e a cura que ia ser estendida só funciona em 5,8%
das vezes na fronteira que já é dela. O card estava a um passo de ganhar um
"conserto" que não conserta.**

---

## 1. Por que peguei este

Fila no início: **21 incidentes abertos**, 13 `aguardando_aluno`, 3 presos.

Pela regra (mais antigo com aluno afetado), a ordem seria #15 → #222 → #226 →
#234. Os três primeiros **não estão parados em investigação, estão parados em
decisão**, e eu confirmei um por um em vez de herdar:

- **#15** (30/07, 18 alunos) — bloqueado na **migration 82**, que segue não
  aplicada. Migration precisa de aval do Johnny; não aplico. Reconferido nas
  rondas de 05/09 e 06/09 01hZ, sem dado novo meu.
- **#222** (01/09) — a ronda das 15hZ já mediu os dois lados e concluiu que o
  título está refutado; o que falta é **Johnny reenquadrar ou fechar**. Não é
  trabalho de investigação.
- **#226** (01/09, 132 de 180 alunos) — conserto está no **PR #176**, aberto
  desde 04/09, cobre 7 de 25. O resto é **decisão de produto** (o que fazer
  quando esgota), explicitamente registrada como "não é minha".

**#234 era o único da faixa com trabalho de investigação de verdade por fazer**:
última nota de 04/09 18:20Z, ou seja **2 dias só com o Vigia medindo** (sensor,
regra 14-A) e nenhum dono investigando. Nenhum dos 23 PRs abertos toca fronteira
interna.

Antes disso conferi os **3 presos** da varredura, porque aluno esperando vem
antes de limpeza de fila. Nenhum estava sem tratamento:

| aluno | estado | por que não é meu agora |
|---|---|---|
| Tânia Araujo | voz em `awaiting_training`, 30min de áudio, 200.000 cr | **2 e-mails** (05/09 uid 1071 e 06/09 uid 1158) explicando que falta o clique dela. Iniciar o treino por ela gastaria 10.000 cr **sem o aluno pedir** — não fiz. |
| Marcelo | voz `failed` desde 10/08, 298.950 cr, 2 ciclos pagos sem nunca ter voz | **3 e-mails** (27/08, 29/08, 05/09), o último com a pergunta "seguir ou sair?" e o prazo de garantia **11/09**. Bola com ele. |
| Luan Marçal | import quebrou 29/08 (arquivo do Drive não público) | fora do recorte desta ronda; segue na varredura. |

Pela regra 8 de 21/08: mandou o e-mail e anotou a data, saiu do colo.

---

## 2. O que eu medi no #234 (e nenhuma ronda tinha medido)

O próprio código pede esta medição por escrito. `tts_settings.py:130` e
`loop.py:481`: *"modo sombra (PADRÃO) conta e loga sem mexer no score (…)
primeiro mede-se em produção, depois vira a chave por env
(`TTS_TAIL_QA_INTERNO_MODO=reprovando`), sem deploy"*. A sombra roda desde o
build `3bc1535` (03/09 12:23:08Z). **Ninguém tinha lido o que ela gravou.**

### 2.1 O dano segue vivo (janela da sombra, 124 gerações `ready`)

- **70 de 725** pedaços entregues com veredito saíram com a fronteira interna
  decepada (**9,7%**)
- **37 de 124** gerações têm pelo menos um pedaço decepado (**29,8%**)
- **27 de 56** alunos da janela receberam pelo menos um (**48%**)

### 2.2 Virar a chave NÃO é o conserto — três provas independentes

**(a) Custo.** A sombra acrescentaria **162 regens sobre 721 = +22,5%**,
atingindo 49 de 124 gerações (39,5%). O comentário do próprio código estimava
*"~15% das gerações"*; o medido é mais alto.
*Ressalva honesta:* +162 é **teto, não valor exato** — `tail_interno_sombra`
conta TENTATIVA que ganharia +100, e a tentativa cujo score já era >0 por
cobertura/intrusão **já ia regenerar de qualquer jeito**. `qa_stats` agrega por
geração e não deixa separar. O marginal verdadeiro é menor e eu não sei quanto.

**(b) O regen não cura este defeito — está escrito no próprio código.** Caso
Carol, `inference.py:292-302`, mesma voz: `"…sua nutricionista."` deu
0,071 / 0,062 / 0,096 — *"cortado SEMPRE"* em 3 gerações do MESMO texto. A
conclusão registrada lá é a chave: ***"o que conserta não é a pontuação, é
existir fala DEPOIS"***. Somar +100 no score só manda gerar o mesmo chunk de
novo, que é exatamente o que já se provou reproduzir o corte.

**(c) 78,6% do dano está onde a chave não alcança.**

| | esgotou tentativas | não esgotou |
|---|---|---|
| **decepado** | 28 | 9 |
| **limpo** | 34 | 53 |

P(decepado \| esgotou) = **45,2%** contra P(decepado \| não esgotou) = **14,5%**
— concentração de **3,1x**. Dos 70 pedaços decepados, **55 (78,6%)** vêm de
geração que **já esgotou tentativas**, e em job que esgota o `loop.py:341-344`
(o defeito do **#226**) dá `break` e **entrega o `best_seg` reprovado**.
Ou seja: para 78,6% do dano, virar a chave queima GPU e entrega o áudio decepado
do mesmo jeito. **O #234 está acoplado ao #226 e não fecha sozinho enquanto a
escotilha do esgotamento estiver aberta.**
*Ressalva:* a correlação é por **geração**, não por chunk — `exhausted` diz que
ALGUM chunk esgotou, não que o decepado foi o que esgotou. É evidência forte de
acoplamento, **não prova causal**.

### 2.3 E a outra saída óbvia também cai

O passo natural seguinte seria *"estender pras fronteiras internas a cura de
26/08"* — `_curar_fim_abrupto` (`inference.py:292`), hoje presa ao último chunk
por `idx == len(chunks)-1` na linha 418. **Fui medir se ela funciona na
fronteira que já é dela.** Não funciona:

- desde 26/08 (696 gerações `ready`): **154** gerações tiveram a fronteira final
  reprovada e a cura entregou resultado em **9** — **5,8%**.
- no áudio **entregue** (`cauda_decepada.jsonl`, 4.345 gerações), ela não deixou
  marca: fronteira **final** decepada era **8,11%** antes de 26/08 e **11,08%**
  depois; a **interna** foi 13,05% → 11,38%. A final **piorou** e a interna
  melhorou — o oposto do que a cura deveria produzir.

*Ressalva:* antes/depois tem confundidor (janelas de tamanho e composição
diferentes, 3.614 x 731 fronteiras finais). **Não afirmo que a cura piorou
nada.** Afirmo o que os dois instrumentos concordam: **não há efeito visível
dela**, e ela só entrega em 5,8% dos casos que deveria pegar.

Consequência prática: estender pra interna uma cura de 5,8% de eficácia moveria
~6% de 199 fronteiras internas ruins ≈ **12 fronteiras**. Não resolve a classe —
e daria a **aparência** de conserto, que é pior.

---

## 3. O que eu fiz

- **Nota gravada no #234** (`f8587cef`): 20 → 21 notas, **1 linha conferida na
  releitura**. Status segue `investigating` **com a hipótese descartada escrita**
  — `investigating` sem nota é o mesmo que não ter olhado.
- **Card `4b7715a1` delegado ao `coder`**: instrumentar as **5 saídas silenciosas**
  de `_curar_fim_abrupto` (`:308 :316 :321 :325 :328`), que hoje devolvem o áudio
  original **sem contador nenhum** — só o sucesso conta (`tail_healed`, `:330`).
  Sem isso é impossível distinguir *"a cura nem foi chamada"* de *"o whisper não
  achou a palavra"* de *"tentou e continuou ruim"*, e cada um é um conserto
  diferente. Telemetria pura: sem GPU, sem migration, sem mudar comportamento.
  Passei junto a disciplina que já custou caro aqui (contador nasce em zero, campo
  ausente é indistinguível de "mediu e deu zero" — `loop.py:161-205`).

---

## 4. O que eu NÃO fiz

Não virei chave de produção, não mergeei PR, não apliquei migration, não gastei
GPU, não toquei em crédito/acesso/plano, não reabri incidente, não escrevi pra
aluno (item 1 mostra por que nenhum precisava) e não toquei em nada da planilha.

---

## 5. Precisa de DECISÃO do Johnny

1. 🔴 **#234 não fecha sem o #226.** O item 2.2(c) é o dado novo: 78,6% do dano
   está em job que já esgota tentativas, e lá a escotilha do #226 entrega
   reprovado. Decidir o #226 (falhar / avisar / entregar em silêncio) **destrava
   os dois**; decidir só o #234 não destrava nenhum.
2. 🔴 **Migration 82** — segue o único passo do **#15** (38 dias, 18 alunos).
3. 🟡 **#222** — mantida a recomendação da ronda das 15hZ: **reenquadrar ou
   fechar**. Sem isso vira card imortal.
4. 🔴 **23 PRs abertos.** O #176 (conserto parcial do #226) espera desde 04/09 e
   sua cobertura **cai sozinha** enquanto espera — o numerador está parado em 7 e
   o denominador cresce.
5. 🟡 **Marcelo** — garantia vence **11/09** e ele já pagou 2 ciclos sem nunca ter
   tido uma voz. Se não responder, é decisão de reembolso **antes** do prazo.
6. 🟡 **Diego (#254)** — renova **08/09 12hZ** (R$194). Continua o único relógio
   vivo da fila.

---

## 6. Lição que fica

**Medir a eficácia do conserto que já existe, antes de pedir mais do mesmo.**
As duas saídas na mesa do #234 eram plausíveis e as duas teriam sido aprovadas
sem discussão — "liga a chave que já está pronta" e "estende a cura que já
funciona". A segunda tinha um pressuposto que ninguém tinha testado: *que ela
funciona*. Testar custou uma consulta e derrubou 11 dias de direção.

E a lição de instrumento, para a próxima ronda: eu quase reportei
`tail_healed`/`tail_flagged` como taxa de cura de **3,7%**. Está **errado** —
são denominadores diferentes (`tail_flagged` conta TENTATIVA, `tail_healed`
conta cura entregue). Fui ao `inference.py:330` conferir a semântica antes de
afirmar, e o número honesto (5,8%, por geração reprovada desde 26/08) é outro.
**A armadilha dos contadores por tentativa x por entrega já derrubou número em
relatório em 02/09 e derrubaria de novo aqui.**
