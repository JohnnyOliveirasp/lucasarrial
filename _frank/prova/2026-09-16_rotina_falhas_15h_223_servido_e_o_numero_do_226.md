# Rotina das falhas — 16/09 15h

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Saiu da fila aberta:** #223 (`506b7c3a`) → `aguardando_aluno`, com a dívida
desta casa zerada e conferida na fonte viva.
**Tocado e não fechado, com o passo nomeado:** #226 (`702cc916`) — medido o
número que faltava, decisão ao Johnny no grupo.

Fila: **85 → 84 abertos.** 0 patch do Vigia. 100 recados `tell_frank`.

---

## 0. Como escolhi o item

Os três cartões mais velhos não são trabalho nosso pendente e isso já estava
conferido: `9ac03612` (56,7d) e `d3d8d1b2` (48,1d) travados em decisão do
Johnny, `6c38c99d` (#99, 23,9d) escalado ontem e esperando resposta comercial —
esperar resposta não é estar travado, o item saiu do colo.

Cabeça real com aluno afetado: **#223**, 14,9 dias. Não houve empate: o #226
nasceu **2 horas depois** no mesmo dia.

---

## 1. #223 — a dívida era verificar, não escrever

Alana (`alana_pinho@hotmail.com`) cobrou em 09/09 o retorno prometido para 07/09.
A resposta automática da Fast respondeu **duas vezes repetindo o prazo morto**
("no dia 07 eu te mando") — no dia **09** (uid 1386, 09/09 12:35Z). Ela pegou o
erro na hora: *"Oi..mas hoje é dia 09."*

Um humano respondeu depois: **uid 1420** (09/09 15:49Z) e **uid 2150** (13/09
22:48Z), os dois conferidos em Enviados.

**Não acreditei na carta de 13/09 de graça, e a razão está dentro dela:** ela é
a correção de uma carta ERRADA de 09/09, que inventou um obstáculo de acesso que
não existia. Nota que corrige nota é exatamente a que precisa de fonte viva.

Conferi as três afirmações dela:

**As 5 gravações.** R2 `voices-clone-ai-verse`, prefixo `<uid>/gravador/`:
5 objetos, 4×300s + 1×2s = **1.202s = 20m02s**, de 02/09 21:22–21:23Z. Bate com
os prints dela (20:01 de 20:00).
**Desconfiei do óbvio antes de confirmar:** os quatro de 5 min têm o **mesmo
tamanho em bytes** (4.801.581). Se fossem o mesmo arquivo 4×, a carta seria
falsa e ela teria 5 min de áudio único, não 20. Conferi os **ETags**: são **5
distintos**. Não são duplicatas — tamanho idêntico é CBR 128k de 300,0s exatos.

**A porta está mesmo aberta.** `voice-cloning/script/page.tsx` só redireciona se
`!user` — não lê acesso. `app/layout.tsx` declara entrada livre. O único portão
do treino é crédito: `start-training/route.ts:101-120`, `bal.total <
TRAINING_CREDIT_COST` (=10.000 em `credits/config.ts:10`). Ela tem **99.475**.
O acesso vencido em 08/09 **não fecha nada**.

**Nenhum crédito cobrado** dela desde 02/09 (único consumo: −525 de uma imagem).

**Não escrevi de novo, de propósito.** A bola está com ela desde 13/09 — pedimos
que respondesse antes de clicar, pra acompanharmos o envio do início ao fim, e
ela já tinha dito *"vou dar um tempo nisso"*. Reping em 3 dias é ruído.

**Por que `aguardando_aluno` e não `fixed`:** ela **não tem voz treinada**
(`voices` = 0) e a promessa de acompanhar o envio segue de pé. `fixed` diria que
acabou. Acabou a dívida deste cartão, não a promessa. Fica no bloco de espera do
`varredura_travados.cjs`, que existe justamente pra honesto não virar invisível.

**Não fecha aqui:** o reembolso dos dois cursos do Lucas (R$ 1.064,36) é do time
da Liz pela ordem de 31/08, já roteado a ela por escrito duas vezes.

---

## 2. #226 — 14 dias de dado esperando alguém rodar a consulta

Em 02/09 01h37Z ficou escrito no próprio cartão: *"com o score gravado dá pra
separar o benigno do grave e decidir com número"*. O score entrou em produção em
02/09 02:32Z. **Ninguém rodou a distribuição em 14 dias** — a decisão seguia
sendo pedida ao Johnny sem o dado que ela mesma estava esperando.

Janela: `generations` `ready` desde 02/09 02:32Z, paginado de 1000 em 1000.
1.056 ready, 799 com `qa`.

**Antes de olhar o resultado, conferi o ponto cego:** das 396 entregas com
`exhausted > 0`, **396 têm `exhausted_score_max`** e **zero** têm
`exhausted_score_none > 0`. Não há fatia esgotada sem gravidade conhecida — a
armadilha que a nota de 02/09 00h10Z preveniu ao não deixar `None` virar 0.

**396 de 799 (49,6%), 160 alunos.** Não leio como piora: a série de 02/09 já
media ~50% nas últimas 24h contra 44% no acumulado, e minha janela é só pós-02/09.

**A distribuição do pior trecho ENTREGUE**, pelas faixas escritas no próprio
`loop.py:562-575`:

| faixa | entregas | |
|---|---|---|
| `<50` só ritmo (benigno) | 82 | 20,7% |
| `50-99` intrusão | 96 | 24,2% |
| `>=100` falta texto / corte | **218** | **55,1%** |

mediana **100** · p75 119 · p90 189 · max 385.

**A mediana caiu exatamente em 100.** A hipótese "quase tudo é só desvio de
ritmo" está medida e derrubada: o benigno é 20,7%, não a maioria.

**Conferi que o campo mede desfecho, não tentativa** — a objeção que o Vigia
levantou em 10/09 contra o `coverage_rescued`, e que eu não ia repetir de olhos
fechados. `loop.py:548-549` amarra `best_seg`/`best_score` na mesma atribuição e
`:562-580` grava o score do chunk **que sai**.

**O custo de cada opção** (crédito casado por `ref_id` com
`ref_type='generation'`, nunca por `kind`):

- **(a)** falhar toda entrega com `exhausted>0`: 49,6%, ~27,3/dia, 318.805 cr.
- **(b)** falhar só o grave (`>=100`): **27,3%**, ~15,0/dia, 176.225 cr, 114 alunos.
- referência: 798.187 cr cobrados no período em 1.044 gerações.

A frase que travou isto em 01/09 — *"derrubaria quase metade das entregas"* —
continua verdadeira para (a). **Para (b) ela não vale: é um quarto, não metade.**

### O limite que eu não escondo

`score >= 100` é o veredito do **nosso** medidor, não prova de que o aluno ouviu
palavra faltando. **Eu não ouvi nenhum dos 218.** Este mesmo cartão já mediu
falso alarme acima do piso (`ec985b5a`, `09f8f761`) e já mediu que a régua é
**cega a substituição** (`1425ca2f` entregou *"faz falar"* onde o texto dizia
*"fácil falar"*, com coverage 1,0 e zero faltantes). O 218 não é piso nem teto de
dano audível: é a contagem de entregas que o próprio sistema pontuou como graves
e mandou assim mesmo. Ouvir é veredito humano pela ordem de 27/08.

**Status segue `investigating`** (regra 14: `loop.py:562` continua entregando o
reprovado). Decisão (a)/(b)/manter levada ao grupo em pergunta fechada.

---

## 3. Uma dúvida da ronda das 14h, fechada de graça

A ronda anterior registrou, sem afirmar, que três cartões velhos carregam
`resolution_note` dizendo "FECHADO" e estão `investigating` no banco, e que
"três divergências iguais cheiram a classe". **Medido agora em dois deles, e não
é classe:**

- **#223**: a nota "FECHADO na ronda 21hZ 02/09" é verdadeira; ele voltou por
  **reincidência legítima** — ocorrência 7 em 09/09 12:50Z, 3 minutos depois do
  e-mail dela das 12:47Z.
- **#226**: a própria `resolution_note` diz, com todas as letras, *"SEM VALOR —
  eu REABRI às 23hZ do mesmo dia por ser falso"*.

Ou seja: reabertura declarada, não UPDATE que falhou em silêncio. **O terceiro
(`6c38c99d`) eu não medi**, então não estendo a conclusão a ele.

---

## 4. O que eu NÃO fiz

Não escrevi para nenhum aluno. Não estornei e não toquei em crédito, plano,
saldo ou acesso. Não mexi no `runpod-worker`, não abri PR, não subi código —
**esta ronda não tem commit de código, só este registro**. Não apliquei migration
(não há DDL). Não toquei nos 100 recados `tell_frank`: método é serial e isso é
item próprio. Não decidi no lugar do Johnny em nenhum dos dois cartões.
