# RONDA DAS FALHAS — 19/09, ~14hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_13h.md`.

**Método serial (regra 8): peguei UM item e levei até o fim.** A ronda anterior
estava no `#329` (85ca1863), que segue travado numa decisão de dinheiro do
Johnny — travado de verdade, não por falta de trabalho meu. Por isso peguei o
**item que a regra 8 manda pegar quando o anterior está parado: o mais antigo
com aluno nomeado**. E ele não era o `#329`: era um cartão de **07/09 que estava
11 dias sem uma única nota**.

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
714 lidas da pasta "Sent" = 637 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`), instrumento
independente: **0 carta depois do corte**, veredito "buraco é PASSIVO".

A pasta cresceu **703 → 714** e a tabela **626 → 637** desde as 13hZ: as 11 cartas
que saíram no intervalo **já nasceram com linha**. É o controle compensatório
funcionando, não sorte.

As **77 anteriores a 14/09 14:06:31Z seguem sem decisão** — continua decisão de
produção, não de ronda, e eu não a tomei.

## 1. Estado da fila

| status | 13hZ | 14hZ |
|---|---|---|
| fixed | 278 | 278 |
| investigating | 93 | 93 |
| ignored | 59 | **60** |
| aguardando_aluno | 34 | 34 |
| open | 1 | 1 |

**`investigating` não caiu, e o motivo é honesto: entrou um cartão novo na
janela.** O total varrido foi de 465 para 466. Eu tirei um de `investigating`
e a entrada repôs. Fechar 1 e o placar não mexer não é fechamento fantasma —
é chegada de trabalho novo, e é assim que tem que ser lido.

---

## 2. O item serial: 11 dias de silêncio num cartão que não tinha dono

`a10723ae` · `fast-email:atend:lucilablanco75@gmail.com` · aberto **07/09** ·
última nota **08/09** · **11 dias sem ninguém escrever nada**.

Não escolhi por sintoma bonito. Escolhi porque, ordenando os abertos com aluno
nomeado pela **data da última nota** (e não pela data de criação), ele era o
primeiro da lista. Essa ordenação é o que enxerga cartão abandonado: criação
velha com nota de ontem é cartão vivo; criação velha com nota de 11 dias atrás
é cartão que ninguém está olhando.

### O que ele era

Duplicata. Medido no banco, hoje:

- `lucilablanco75@gmail.com` **não tem conta** em `profiles` e **não tem
  pagamento nenhum**. É o **terceiro endereço** da mesma pessoa, de onde ela
  escreveu do iPhone em 07/09. **Não existe aluno para atender nesse endereço.**
- As contas reais: `blancolucila539` (0501f0f6, desde 23/07) e
  `contatoecocannabis` (b930d9f9, desde 30/07).
- Ela **foi respondida**: 08/09 16:18 por suporte@ (baixa forte no `#299`) e
  11/09 11:53 (`#291`, o caso da caixa cheia).
- O risco que dava urgência ao cartão — **cobrar em dobro de novo em 23/09** —
  **acabou**: as duas compras estão `canceled`, e cada conta segue com **200.000
  créditos** e acesso vivo (23/09 e 30/09).

**Antes de fechar, conferi que ela não cai de lugar nenhum:** o que resta é
dinheiro, e dinheiro está rastreado no **`#299` (investigating)** e no **`#254`
(investigating**, classe `assinatura_paga_em_dobro_duplicada_ativa`, que lista
os dois endereços dela nos `affected_emails`). Os dois abertos, verificados na
mesma ronda. Fechar duplicata sem conferir o mestre é como se perde gente.

Fechado `ignored` com `resolution_note` de 725 chars. **Gravado e conferido na
releitura, 1 linha afetada** — não ensaio.

## 3. O achado que mexe em dinheiro: a casa tinha o número errado

Isto eu não fui procurar. Apareceu porque, para fechar a duplicata, fui medir o
que ela pagou em vez de herdar o número que estava escrito.

A `resolution_note` do `1e74923a` (fechado em 17/09) diz **"Reembolso dos R91"**.

Medição própria (`pagou_de_verdade.cjs`, Hotmart viva, só `value > 0` com
`COMPLETE`/`APPROVED`):

| conta | lançamentos pagos | total |
|---|---|---|
| `blancolucila539` (**original**, 23/07) | R$0 trial + R$97 em 30/07 + R$97 em 23/08 | **R$194** |
| `contatoecocannabis` (**duplicada**, 30/07) | R$0 trial + R$97 em 03/09 | **R$97** |
| | **TOTAL PAGO** | **R$291** |

**Fora da conta de propósito:** 2 lançamentos de **R$97 em `OVERDUE`** na
`contatoecocannabis`. A cobrança existe, o pagamento não — regra da própria
casa, e é a mesma armadilha que já quase fez a casa contar cobrança como receita.

**Estorno: não houve.** Varri `payment_events` dos **três** endereços: só
`PURCHASE_APPROVED` / `COMPLETE` / `BILLET_PRINTED` / `DELAYED` /
`OUT_OF_SHOPPING_CART`. **Zero `PURCHASE_REFUNDED`, zero `CHARGEBACK`.** O
dinheiro está com a casa.

**Por que "R91" era perigoso:** não é nenhum dos dois recortes defensáveis.
R$291 é o total; R$97 é o recorte "só a assinatura duplicada" (que é
literalmente o que ela pediu: *"fiz duas assinaturas por engano, quero cancelar
uma e o dinheiro de volta"*). Quem decidisse lendo **R$91 devolveria menos de um
terço** do que ela pagou — e devolveria achando que pagou tudo.

**Corrigi nos dois lugares:** nota nova no `1e74923a` (6 → **7 notas**, sem
reabrir, porque o motivo do fechamento dele segue certo) e nota com a medição no
mestre `#299`/`eec81565` (8 → **9 notas**), que é onde a decisão mora. Os dois
gravados e conferidos na releitura, 1 linha afetada cada.

### O contrapeso, que também é fato

Não estou empurrando o recorte barato. **A própria casa já falou "R$ 291" com
ela**: é o título da baixa do suporte@ de 08/09 (*"Lucila aguardando retorno
sobre reembolso de R$ 291"*). Isso é argumento a favor de devolver tudo, e está
escrito na nota do `#299` junto com o outro recorte. **Quem decide é o Johnny**
(ordem 27/08); meu trabalho era entregar o número certo, não o número
conveniente.

E o fato que pesa mais que os dois: **ela tem ZERO voz criada nas duas contas.**
Pagou R$291 e não produziu nada.

## 4. Classe de percepção (ordem de 17/09) — o número que entrava no relatório estava inflado

A ordem manda rodar a consulta toda ronda e levar o número **com a idade do mais
velho**. Rodei, e fui **abrir os cartões** — que é o passo que faltava.

**Consulta de apoio da ordem (casamento por palavra): 14 cartões.**
**Instrumento próprio (`percepcao_travada.cjs`, que eu não sabia que existia até
achá-lo citado numa nota): 2 cartões, o mais velho parado 1,0 dia.**
**Abertos um por um: 0 travado esperando alguém da casa ver/ouvir/assistir.**

Os 14 se dissolvem assim:

| cartão | por que não é parada de percepção |
|---|---|
| `702cc916` | **já despachado** — o áudio da Katia foi baixado do R2 e **ouvido** em 18/09; a causa da classe não era a do título |
| `f8587cef` | espera **decisão de produto** do Johnny; ganhou o preço em tempo de execução em 17/09 |
| `ab5644be` | causa achada e medida, aluna respondida |
| `85ca1863` (#329) | **despachado e entregue** — veredito do `olho` chegou hoje 08:08 |
| `81438b60` | pré-requisito é **medição** (#372: recusa do gate não deixa rastro), não olhar |
| `b6486347` | decisão parada, não bug |
| `23f8123d` | é sobre o runner que mata cartão |
| `df216867` | nenhuma das duas alunas está travada; nada a fazer |
| `0c9eee9f` | teste voltou negativo em 19/09; sem aluno nos `affected_emails` |
| `75c33ee1` | **já despachado** — o `qa` viu a tela (card `40c21ef4`) e achou o aviso nascendo fora da viewport em mobile |
| `b81bc656` (#450) | a nota **já declara** "não é caso de percepção" |
| `bb97e2f1` | bounce de caixa cheia; canal de e-mail fechado em 18/09 |
| `70633cab` (#473) | quem precisa ouvir é **a aluna**, não a casa |
| `6fabb64a` | aguardando **o aluno** dizer minuto e segundo |

### O defeito do instrumento, medido

Os 2 que o `percepcao_travada.cjs` aponta hoje são **os dois falsos positivos**,
e cada um por um motivo diferente e corrigível:

1. **`#450` — o instrumento casa a prosa da nota que declara que o cartão NÃO é
   de percepção.** A nota de 18/09 diz, com estas palavras, que o casamento
   anterior foi por `%ouvir%` em prosa minha. O instrumento lê essa frase e
   reacende o cartão. **Declarar "não é percepção" hoje garante reaparecer
   amanhã** — a nota que resolve é a nota que re-dispara.
2. **`#473` — o instrumento não distingue "a casa precisa ouvir" de "a aluna
   precisa ouvir".** Despachar `olho` aqui não produziria nada: a pergunta é se
   **ela** ficou satisfeita com o áudio refeito, e isso nenhum agente responde.

**Por que isso importa e não é preciosismo:** a ordem de 17/09 existe porque
*silêncio nessa classe não pode parecer saúde*. O espelho disso é igualmente
ruim — **ruído nessa classe não pode parecer doença**. O "11 cartões, o mais
velho de 18 dias" que vinha entrando nos relatórios não media dívida de
percepção; media quantas vezes a palavra "ouvir" apareceu em prosa de agente.
Enquanto o número é inflado, ele não serve pra decidir nada, e uma dívida real
que aparecesse ali ficaria escondida no meio dos falsos positivos.

**Não consertei o script nesta ronda, de propósito:** é código, vai por branch
`feat/` + PR, e eu não abro frente nova antes de fechar a que peguei (regra 8).
Fica declarado com os dois mecanismos na mão, que é o que falta pra consertar em
minutos. **O que eu não fiz foi seguir em frente sem abrir os cartões** — foi
exatamente isso que produziu o número inflado.

## 5. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 714 = 714, 0 escrituráveis, conferida por
   instrumento independente.
2. **Fechei o `a10723ae`** (`ignored`), o cartão mais abandonado da fila com
   aluna nomeada: 11 dias sem nota. Duplicata do `#299`, com os dois mestres
   conferidos abertos antes de fechar.
3. **Medi o dinheiro da Lucila do zero:** R$291 pagos (R$194 + R$97), 2 `OVERDUE`
   de R$97 excluídos, **zero evento de estorno** nos 3 endereços.
4. **Corrigi um número errado de dinheiro num cartão já fechado** (`1e74923a`:
   "R91" → R$291), sem reabri-lo.
5. **Levei a medição ao mestre `#299`** com os dois recortes possíveis e o
   argumento de cada lado, sem escolher.
6. **Postei no grupo** os dois fatos consumados e o achado de dinheiro.
7. **Triei a classe de percepção abrindo os 14 cartões** e medi os dois
   mecanismos de falso positivo do `percepcao_travada.cjs`.

## 6. O que eu NÃO fiz

- **Não devolvi dinheiro, não prometi devolução e não escrevi pra Lucila.** Ela
  foi respondida em 08/09 e o que espera é a decisão do dono.
- **Não fechei nada como `fixed`.** O único fechamento foi `ignored` de
  duplicata. **93 `investigating` é o número honesto.**
- **Não toquei no `#329`.** Os 41.600 cr seguem na mesa do Johnny e o fio do 25s
  segue sem puxar (item 2 da passagem anterior) — não abri frente nova antes de
  fechar a que peguei.
- **Não consertei o `percepcao_travada.cjs`.** Declarado, não feito.
- **Não mergeei nada.** O PR **#351** da ronda das 13hZ segue aberto.
- **Não li a caixa do suporte@ pra triagem.**
- **Não gastei GPU**, não toquei em crédito, acesso, voz nem migration.

## 7. Para quem pegar a próxima ronda

1. **Ordene os abertos pela data da ÚLTIMA NOTA, não pela de criação.** Foi o
   que achou um cartão com 11 dias de silêncio que a ordenação por criação não
   destacava. Cartão velho com nota de ontem está vivo; cartão velho com nota de
   11 dias atrás não tem dono.
2. **Número escrito na casa não é número medido.** "R91" estava numa
   `resolution_note` de cartão fechado, pronto pra virar decisão de reembolso. O
   valor real é 3x. Antes de decidir dinheiro em cima de um número herdado,
   remeça — é a mesma lição do `ref_type` × `kind` com outra roupa.
3. **`OVERDUE` não é pagamento** — e aqui eram 2 lançamentos de R$97, ou seja
   R$194 de cobrança que inflaria o total se entrassem.
4. **Antes de fechar duplicata, abra o mestre e confirme que ele está aberto.**
   Fiz e estavam (`#299` e `#254`). É a diferença entre desduplicar e perder
   aluno de vista.
5. **O instrumento de percepção está inflado, e os dois mecanismos estão
   medidos** (§4): ele casa a prosa da nota que declara "não é percepção", e não
   distingue casa-precisa-ouvir de aluno-precisa-ouvir. Conserto curto, vai por
   branch + PR. Enquanto não for, **abra os cartões antes de levar o número pro
   relatório** — o número cru não mede o que promete medir.
6. **Os 41.600 cr do `#329` continuam na mesa do Johnny**, agora com a premissa
   certa (ronda das 13hZ). Se voltar "pode devolver": grave por `ref_type` de
   estorno, **nunca** por `kind`, e confira a linha na releitura.
