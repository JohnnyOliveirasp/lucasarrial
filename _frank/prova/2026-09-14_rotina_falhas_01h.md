# Ronda das falhas — 14/09/2026, ~01hZ (13/09, 22h BRT)

Executor (14-A): eu investigo, decido, conserto e fecho. Repo em `main`,
`pull --ff-only` limpo. `_frank/ordens/README.md` lido, mais as ordens de
**27/08** (só erro de sistema vira chamado), **29/08** (planilha desligada) e
**31/08** (canal = grupo). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.** Janela do Executor: 21h41 BRT na abertura, dentro de 08h–23h.

**Consertei o instrumento que estava inventando urgência.** O
`garantia_na_fila.cjs` apontava **6 pessoas** no bloco *"VENCE EM ATÉ 48H —
decida HOJE"* e **as 6 nunca pediram reembolso nenhum**. Fix em produção:
**PR #266, merge `e585883` na main**. Fila: **80 → 80** (nenhum incidente
fechado — e explico embaixo por que não fechei nenhum).

O que esta ronda tem de diferente: eu comecei atrás de um caso de aluno e
terminei descobrindo que **o instrumento que mede urgência estava mentindo em
77% das linhas**. O alarme falso não era um detalhe do relatório: ele estava a
um passo de virar escalação minha pro Johnny.

---

## 1. Como escolhi, e por que troquei de alvo no meio

Serial (regra 8): o mais velho **acionável** com aluno afetado. Os 5 mais
velhos seguem travados por motivo próprio; `#223`, `#226`, `#234`, `#244` e
`#246` foram tratados nas rondas de hoje. Abaixo disso, quatro cards nascidos
todos em **04/09**: `#249`, `#250`, `#251` (1 pessoa cada) e `#254` (15
e-mails). Desempate da regra 8 é **mais gente sofrendo** → peguei o **`#254`
(cobrança em dobro)**, que ainda por cima é dinheiro saindo errado agora.

No meio da investigação do `#254` rodei o `garantia_na_fila.cjs` e ele acusou
**6 pessoas com 23h a 47h pra perder o reembolso**. Isso é mais urgente que
qualquer coisa que eu estivesse fazendo — então parei e fui conferir. **Não
era verdade.** O alvo da ronda virou isso.

---

## 2. `#254` remedido na Hotmart viva — e a descrição está velha em duas pernas

Rodei o `assinatura_em_dobro.cjs` (só leitura) em vez de herdar a descrição de
04/09. Pagando em dobro **hoje** (excluída a conta de teste do Johnny, R$1,
conforme o método do próprio card):

| pessoa | total | pernas |
|---|---|---|
| Carlos Augusto | R$291 | `MY5O3KWB` **órfã**, pagou sozinha 2× (13/08 + 28/08) + `UMJP7PDY` (28/08) |
| lucila blanco | R$291 | `2Q4Y1CDE` (30/07 + 23/08) + `6JEANY3Z` (03/09) |
| Nassara | R$291 | `4C8EVSH4` (31/07 + 24/08) + `ZKJBP56C` (30/07) |
| Leandro Lopardi | R$194 | `4XVSU9U7` (05/09) + `J9HMYL9P` (28/08) |

**Duas pernas saíram da lista e a descrição ainda as trata como vivas:**

- **Jackson** — a descrição manda tratar junto com o `#247` porque *"R$97 cada
  em 26/08, vence 19/09"*. Medido hoje: o entitlement órfão está **`canceled`**
  e ele **não aparece mais** na varredura viva. A cobrança de 19/09 que o card
  temia **não vai acontecer** pela perna órfã.
- **⚠️ Nassara** — a descrição diz que a duplicada `ZKJBP56C` *"VENCEU 30/08 e
  não renova"*. A medição viva mostra o par **ao contrário do que se lia**:
  quem tem **duas** cobranças é a `4C8EVSH4`; a `ZKJBP56C` é a de **uma**.
  Quem pegar essa perna **remede antes**, não confie na descrição.

### 2.1 Carlos: a bola está com ele, e eu **confirmei que ele recebeu**

Antes de escrever uma 3ª vez, conferi os Enviados: já foi escrito **2×, para os
dois endereços** — 04/09 (uids 1035/1036) e 08/09 (uids 1296/1297), os dois
dizendo qual é a duplicada e avisando da cobrança de 22/09. E conferi
**bounce**: **nenhum** dos dois endereços aparece na lista. Ou seja, **ele
recebeu e não respondeu** — não é a classe do `#249`/`#250` (e-mail que quica).

Não mandei a 3ª versão, pelo mesmo motivo registrado no jutai em 08/09: repetir
a mesma pergunta sem fato novo não é atendimento, é ruído. E **não cancelei a
órfã no escuro** — ele não pediu, e a 9-C só me autoriza a cancelar o que o
**titular** pediu. A própria descrição do card trava isso.

**Fato com data, escalado no grupo:** as duas cobram em **22/09**. Se ele seguir
calado, paga R$194 num ciclo em que R$97 vão para um acesso **sem conta nenhuma**
na plataforma (`aluno.cjs` não acha conta para o endereço da órfã). **8 dias.**

---

## 3. O achado da ronda: o instrumento de urgência mentia em 77% das linhas

### 3.1 O defeito, com `arquivo:linha`

`garantia_na_fila.cjs:66` define o `PEDIDO` como regex e `:119` aplicava esse
regex ao **TÍTULO DO CARD**:

```
const pedidos = incidentes.filter((i) => PEDIDO.test(i.title || ""));
```

Card **técnico** fala de restituição sem que ninguém tenha pedido nada. Então a
**coorte inteira** de um card de defeito entrava nos blocos *"PERDEU A JANELA
ESPERANDO NA NOSSA FILA"* e *"VENCE EM ATÉ 48H"*. **Duas afirmações falsas na
mesma linha:** o `pediu em` impresso era a data em que **nós** achamos o bug, e
não havia relógio de garantia correndo por pedido de ninguém.

### 3.2 A medição (mesmo recorte que a ferramenta varre)

| categoria | cards | e-mails | máx/card |
|---|---|---|---|
| `atendimento` | 14 | 14 | **1** |
| `tecnico` | 7 | 48 | **16** |

**Das 62 pessoas lidas, 48 (77%) nunca pediram nada.**

### 3.3 As 6 "emergências" eram todas de um card que eu mesmo abri

As 6 de *"decida HOJE"* eram **todas do `#341`**, card `reported_by='frank'`.
Conferido **nas duas pontas, não por leitura de código**:

1. query em `incidents` — nenhuma das 6 tem card próprio além do `#341`;
2. `ler_caixa.cjs --de <email>` nas 3 de 23,2h — **"nada encontrado"** nas três:
   **nunca escreveram pro `suporte@`**.

### 3.4 O efeito, antes → depois, mesma varredura

| | antes | depois |
|---|---|---|
| "PERDEU A JANELA na fila" | 10 | **4** |
| "VENCE EM 48H, decida HOJE" | 6 | **0** |
| **pessoas lidas** | 62 | **62** |

**Ninguém sumiu** — é o número que prova que não troquei falso positivo por
falso negativo. A coorte desceu pro bloco 🔵 com rótulo próprio e a linha passou
a dizer *"card aberto pela casa em ... (ela não pediu)"*. Mesmo tratamento que a
perna da **RENOVAÇÃO** já recebia: rotular ≠ decidir, e honesto não pode
significar invisível (lição do `aguardando_aluno`, 25/08). Os 4 que sobram são
pedido de verdade, todos com card de atendimento próprio: **Lucila `#299`,
Victor `#309`, Rodrigo `#363`, Evelyn `#385`**.

### 3.5 Controles — porque cortar filtro é exatamente como se cega um detector

- **Positivo:** agora exige reencontro **na perna de PEDIDO**. Contar a coorte
  ali deixaria o controle passar **justamente no cenário que ele existe pra
  pegar** (o corte novo cegar a perna que importa e a pessoa sobreviver só como
  coorte). Conferi **antes de cortar** que os dois casos do controle (`#309`,
  `#299`) são `atendimento` e sobreviveriam.
- **Negativo, rodado de verdade:** discriminador forçado a `false` → **exit 1**
  com *"CONTROLE POSITIVO FALHOU"*, e não relatório limpo e vazio.
- Perna de pedido vazia passa a **gritar**: a casa sempre tem pedido aberto,
  então zero ali é filtro cego, não fila vazia.

### 3.6 A interação que quase passou batida

O Vigia tem um patch esperando merge (`patch_6509c3bc`, `#384`) que **adiciona**
uma perna varrendo card **FECHADO**. Sem o corte de hoje, ele **multiplicaria**
o falso positivo — passaria a injetar também a coorte dos técnicos já fechados
nos blocos de urgência. Os dois são compatíveis; com o `e585883` na main, o
patch agora pode entrar em cima com segurança. Anotei isso no `#384`, que
**segue aberto**: o defeito do título dele (cegueira a card fechado) **não foi
corrigido por mim** nesta ronda.

---

## 4. Por que isso não é frescura de relatório

Urgência falsa não é só ruído: **ela afoga a verdadeira**. Em 09/09 uma
escalação urgente minha foi desmentida 4,2 dias depois e a pergunta real ficou
todo esse tempo atrás do alarme falso. Hoje o mesmo instrumento me ofereceu
**6 emergências prontas pra escalar**, com hora na cara (23,2h / 47,2h). Se eu
tivesse levado pro grupo sem conferir, teria queimado a atenção do Johnny em
seis casos inexistentes — e no dia em que houver seis de verdade, ninguém corre.

---

## 5. Placar honesto

- **Fix em produção: 1** — PR #266, merge `e585883` na main, rodado da main
  depois do merge pra confirmar (não parei no "mergeado").
- **Incidentes fechados: 0.** Fila 80 → 80.
- **Alunos escritos: 0**, e **de propósito**: o único que pedia carta hoje
  (Carlos) já recebeu duas, comprovadamente sem bounce, e a 3ª sem fato novo
  seria ruído.
- **Cards anotados: 3** (`#254`, `#341`, `#384`), os três com releitura
  confirmando **1 linha afetada**.
- **Urgências falsas desmontadas: 6.**
- **Escalação ao grupo: 1** (Carlos, R$194, data 22/09, decisão do Johnny).
- Crédito de aluno tocado: **0**. GPU: **0**. Migration: **0**. Acesso: **0**.
  Assinatura cancelada: **0**. Estorno: **0**.

**O que emperrou, na cara limpa:** eu **não fechei incidente nenhum**. O `#254`
não fecha por mim — das 4 pernas vivas, três (Lucila, Nassara, Leandro) são
devolução de dinheiro, que é alçada do Johnny, e a quarta (Carlos) depende de
uma resposta que ele não dá. O `#341` também não fecha: o resíduo de crédito são
**157.875 cr**, que passa do teto diário de 100.000 e pela 9-B é *"congela e
chama"*. **Não vou marcar `fixed` o que não resolvi** (regra 14). Se a fila não
baixa porque o que sobrou é dinheiro que não é meu, essa é a resposta honesta.

**O que eu NÃO fiz:** não herdei a descrição do card sem remedir (e achei duas
pernas erradas nela), não escrevi 3ª carta pra quem já recebeu duas, não
cancelei assinatura sem pedido do titular, não devolvi crédito acima do teto,
não marquei `fixed` sem resolver, não li a caixa do `suporte@` pra triagem (só
`--enviados`/`--de` em caso que eu estava tratando), não toquei nos branches
STALE, não relitiguei a regra de crédito e não toquei em nada da planilha.

---

## 6. Para a próxima ronda não refazer o que eu fiz

- **O `garantia_na_fila.cjs` agora só põe no vermelho quem pediu de verdade.**
  Se aparecer alguém nos blocos de urgência, é pedido real com card de
  atendimento próprio — pode tratar como dívida de fila sem reconferir a
  premissa. O bloco 🔵 é coorte e **não tem relógio correndo**.
- **`#254`: não confie na descrição.** Jackson saiu (órfã `canceled`), e o par
  da Nassara está invertido em relação ao que o texto diz. Remeda com
  `assinatura_em_dobro.cjs` antes de agir — são ~40s de leitura.
- **Carlos tem data: 22/09.** Ele recebeu 2 cartas e não respondeu (bounce
  conferido, não quicou). Ou ele responde, ou é decisão do Johnny.
- **O patch do Vigia (`patch_6509c3bc`) pode entrar agora** — depois do
  `e585883` ele soma em vez de multiplicar falso positivo.
- Medições desta ronda salvas fora do git em `_Bugs/dobro_2026-09-14.json`,
  `_Bugs/garantia_2026-09-14.txt` (antes) e `_Bugs/garantia_DEPOIS.txt`.

## 7. Passo fixo de fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` → conferido (ver
seção do commit desta ronda). Branch `fix/garantia-na-fila-so-quem-pediu`
**mergeada e apagada** no merge do PR #266 — não ficou fix meu preso fora da
main, e o fix foi **rodado da main** depois de mergear.
