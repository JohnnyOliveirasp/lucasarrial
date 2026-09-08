# Ronda das falhas — 08/09/2026, ~13h30–14h10Z (Frank, dono da fila)

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Nada da planilha foi lido, classificado,
aberto ou reaberto (ordem de 29/08). Canal: **grupo** (ordem de 31/08).

**Card levado até o fim:** `#306` (aberto e fechado nesta ronda).
**Estado no fim:** fix **em produção** (PR #212, merge `e449783`, deploy
SUCCESS), incidente `fixed` com nota e commit, 1 nota cruzada no `#305`, 1
aviso no grupo.

---

## 0. A ronda em uma linha

**Achei código de produção conserto-pronto largado SEM COMMIT na árvore de
trabalho, medi o que ele faria antes de deixá-lo sair, e o subi. Ele conserta um
defeito caro: o convite de compra órfã deduplicava por e-mail e PARA SEMPRE, e
por isso assinante mensal cobrado todo mês, que nunca conseguiu entrar, nunca
mais era procurado. Cinco pessoas nessa situação — e as cinco cancelaram.**

---

## 1. Por que este card, e não o mais antigo da fila

Fila no início: **36 abertos**, 12 `aguardando_aluno`, 4 presos.

O mais antigo com aluno no título é o **`#222`** (01/09, "5 alunos presos fora
da própria conta"). **Não é meu hoje, e isso não é fuga:** a ronda de 06/09
(`14h52Z`) já o mediu pelos dois lados e o resultado está gravado — o título
está refutado (os 3 alunos que o card nomeia têm conta paga funcionando), e os
pagantes que sobraram **não têm conta em lugar nenhum pra casar**, então nenhum
algoritmo os resgata. Ele está travado em **decisão do Johnny**, não em
investigação. Pela regra de 21/08, digo o passo e sigo.

O que me fez parar antes de pegar o próximo da lista foi o `git status`:

```
 M frontend/src/lib/payments/orphan-outreach.ts
?? frontend/src/lib/payments/orphan-ciclo.ts
?? frontend/src/lib/payments/orphan-ciclo.test.ts
```

**Código de produção, escrito hoje 08:52–08:54, não commitado, não reportado.**
A ronda das 10h escreveu textualmente *"não subi código (nenhuma linha de
produção mudou)"* — e de fato não subiu, mas também não disse que isto existia.
Não estava nem em branch: estava solto na árvore, a um `checkout` de sumir. É a
mesma classe do fix que ficou 9h preso em branch em 19/08, só que pior, porque
branch pelo menos está no git.

Peguei este. Trabalho pronto e invisível é trabalho que não aconteceu.

---

## 2. O defeito

`frontend/src/lib/payments/orphan-outreach.ts`. O dedupe do convite morava em
`agent_state.orphan_invites` e era **por e-mail, para sempre**: quem recebia o
convite e o lembrete único de 3 dias **nunca mais era procurado**.

Em compra avulsa isso está certo. Em **assinatura mensal** está errado, e o erro
tem a forma mais cara que existe: a pessoa é **cobrada todo mês** por uma
plataforma onde **nunca conseguiu entrar**, e a casa, que sabe disso, fica
calada.

---

## 3. O que eu NÃO fiz: confiar no código que achei

Não era meu, não estava revisado e ninguém o tinha medido. Antes de qualquer
commit:

| verificação | resultado |
|---|---|
| `node --test orphan-ciclo.test.ts` | **11/11 passando** |
| `tsc --noEmit` | **limpo** (nada em `orphan/payments`) |
| leitura da integração no sweeper | comportamento preservado; guarda nova `jaTemDono` correta |

E o passo que de fato importava: **medir o raio de alcance antes de deixar o
código falar com gente.**

### 3.1 Por que medir era obrigatório

Tornar o dedupe cíclico significa que, na **primeira** varredura depois do
deploy, todo comprador com pagamento mais novo que a âncora do ciclo vira
convite **no mesmo dia**. O comentário do próprio módulo dizia *"66 compradores
tiveram PURCHASE_APPROVED pago depois do último contato"*. Se 66 virassem
e-mail, isso é **rajada** — e pela regra 8 de 21/08 e-mail em massa precisa do
"pode" do Johnny. E-mail individual eu decido sozinho; rajada, não.

Escrevi `_frank/rascunhos/medir_convite_ciclico.ts`: usa as funções de decisão
**de produção** (`orphan-ciclo`, `acesso-regra`) importadas de verdade —
reimplementa só a parte de **consulta** do sweep, espelhada linha a linha — e
**não manda e-mail nem grava nada**.

```
contraprova: 1883 PURCHASE_APPROVED lidos (paginado)
compradores do produto 7851642: 1134
agent_state.orphan_invites: 180 e-mails com registro

               REGRA VELHA (produção hoje)   REGRA NOVA (o PR)
  convites            1                        5
  lembretes           1                        0
  TOTAL de e-mails    2                        5
```

**Não é rajada: são 5 pessoas.** O "66" do comentário estava certo como
contagem bruta, mas a maioria já criou conta e o `hasAccount` os poupa. Medir
transformou um risco de 66 num fato de 5 — e foi isso que me autorizou a subir
sem esperar o "pode".

### 3.2 As 3 que estavam caladas para sempre

| pessoa | convite | lembrete | pagou **depois** |
|---|---|---|---|
| `gustavocasarotto` | 04/08 | 07/08 | **12/08** |
| `herysilva.27` | 04/08 | 07/08 | **30/08** |
| `jkakorio` | 20/08 | 24/08 | **26/08** |

### 3.3 Conferido um a um no banco, não herdado

| e-mail | perfis | `user_id` | `access_until` | status |
|---|---|---|---|---|
| `alinecuida` | 0 | NULO | **10/09** | canceled |
| `gustavocasarotto` | 0 | NULO | 12/09 | canceled |
| `jkakorio` | 0 | NULO | 19/09 | canceled |
| `herysilva.27` | 0 | NULO | 21/09 | canceled |
| `rodrigo.limas.1978` | 0 | NULO | 30/09 | canceled |

**Os cinco cancelaram.** Pagaram, não conseguiram entrar, ninguém falou com eles
de novo, e foram embora. O custo do dedupe eterno não é teórico: está visível na
coluna `status`. `canceled` com data futura **ainda dá acesso** (regra de
20/08), então os 5 ainda podem usar o que pagaram — por isso convidá-los é
certo, não ruído.

⚠️ A janela da `alinecuida` fecha **10/09**. O cron tem ~2 dias pra alcançá-la.

---

## 4. O achado contra o trabalho de hoje de manhã

O **`5aef886` (PR #211)**, mergeado às 11:55Z **de hoje**, alargou
`compradorMereceConvite` citando **6 pagantes** com janela viva e sem conta.
Conferido contra o estado do dedupe: ele alcançaria **2 dos 6 que ele mesmo
nomeia**. Os outros 4 (`herysilva.27`, `gustavocasarotto`, `jkakorio`, e a
`alinecuida` só até o lembrete) seguiam calados pelo dedupe eterno.

**PR mergeado não é PR que funciona.** O deploy ficou verde, o merge está no
histórico, e dois terços do efeito prometido não aconteciam.

---

## 5. As duas armadilhas que não entraram

**A guarda `jaTemDono`.** A guarda `hasAccount` procura perfil com o e-mail **da
compra**, e por isso é cega pra quem compra com um endereço e usa a plataforma
por outro (a classe do #20/#27/#36/#195/#218). Tornar o dedupe cíclico **sem**
essa guarda recriaria o incidente `72a4c9db`: "crie sua conta" mandado pra
cliente **ativo**. Agora compra já ligada a uma conta (`entitlement.user_id`
preenchido) não recebe convite.

**A comparação como string.** `received_at` chega `...982633+00:00` e o estado
grava `...982Z`. Lexicograficamente o `6` vem antes do `Z`, então o **mesmo
instante** compararia como mais antigo e o ciclo **nunca reabriria** — falha
silenciosa, sem erro, sem log, sem nada. Compara-se em **milissegundos**, de
propósito. Data ilegível **não** reabre ciclo (falha fechada: na dúvida, não
manda e-mail).

---

## 6. O que subiu, e a prova

| passo | prova |
|---|---|
| branch | `feat/convite-orfa-ciclo-por-cobranca` |
| PR | **#212**, base `main` |
| merge | **`e449783`** |
| deploy | `Deploy Frontend (production)` run `34234175338` → **completed success** (esperado com timeout, não presumido) |
| incidente | **`#306`** `fixed`, `resolved_commit=e449783`, 5 afetados — **relido no banco depois de gravar** |
| `#305` | 1 nota de cruzamento (agent_notes 1 → 2, releitura confirmada) |
| grupo | 1 aviso, fato consumado |

O `#306` nasceu `fixed` de propósito: causa medida, corrigida, testada e
mergeada na mesma ronda. O chamado existe pra deixar **rastro da classe** —
senão o defeito volta e ninguém lembra que já foi visto.

---

## 7. O que NÃO está feito (não confundir com resolvido)

1. **As 5 pessoas ainda não receberam nada.** Quem escreve pra elas é a
   varredura diária do cron, na próxima passada. **Se na próxima ronda elas
   seguirem sem convite, o defeito não é este — é o cron**, e é lá que se olha.
   Deixei isso escrito na `resolution_note` do `#306` pra ninguém ler "fixed"
   como "aluno avisado".
2. **O `#305` continua aberto e sem causa.** O `rodrigo.limas.1978` aparece nos
   dois cards, mas por caminhos **diferentes**: o `#305` é o `avisarCompraOrfa`
   do **webhook**, que não disparou em 06/09 e segue sem explicação; o `#306` é
   a **varredura diária**, que é outro código. A varredura passa a alcançá-lo
   por outra porta, e isso **não fecha** o `#305` — um pagante sem janela paga
   viva continuaria invisível, porque a varredura só fala com quem passa no
   `compradorMereceConvite`.
3. **`#222`** segue travado em decisão do Johnny — item 1 da seção 6 do log de
   06/09 14h52Z. Não reabri, não redecidi.

---

## 8. Para a próxima ronda

1. **Conferir se o cron falou com as 5** (`ler_caixa.cjs --enviados --para
   <email>`). Prioridade na `alinecuida`: janela fecha **10/09**.
2. `#254`, perna DIEGO: a confirmação da cobrança em dobro aparece quando
   `4UKYMN4L`/`MYEXXEMA` rolarem para **15/09 12:00**. Continua sendo esse o
   campo a olhar — não presumir pelo relógio.
3. `#304` (Emanuel) segue precisando de **decisão comercial**, não de conserto.

---

## 9. Higiene de fim de ronda

- `git log --oneline origin/main..HEAD` → **vazio**.
- `git rev-list main..feat/convite-orfa-ciclo-por-cobranca` → **vazio** (o
  branch está contido na main; nada preso).
- Código foi por **branch + PR**; só este log vai direto na `main`.
- Nada de crédito, GPU, migration, assinatura cancelada ou e-mail em massa.
