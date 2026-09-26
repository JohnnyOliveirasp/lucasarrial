# Ronda das falhas — 26/09/2026, ~01hZ (rodou 00:41–01:0xZ)

> Conferi a primeira linha dos arquivos vizinhos antes de escolher o nome
> (aviso da ronda das 22h30: os nomes desta pasta não são índice confiável).
> `00h` está ocupado pelo Vigia; este é o `01h`.

**Método: serial (regra 8).** Um caso levado até o fim do que eu posso fazer
sozinho, e o que travou está nomeado com o passo exato e com o dono.

**Esta ronda NÃO fechou incidente.** Ela abriu **um** (`#589`), mandou **uma**
carta a aluno com relógio de 11h correndo, e **corrigiu dois fatos que a casa
vinha repetindo errados** sobre o mesmo aluno — um deles de um jeito que levava
à ação errada.

**Produção tocada:** nenhuma. Zero GPU, zero migration, zero DDL, zero crédito
movido, zero conta criada, zero assinatura cancelada, zero código alterado.
A única escrita foi: 1 carta, 1 cartão novo, 1 nota em cartão existente.

**Ordem de 29/08 respeitada:** nada vindo da planilha foi lido, escrito,
classificado ou reprocessado. **Canal (ordem de 31/08):** o aviso saiu **no
grupo**, nada no privado do Johnny.

---

## Passo fixo 1 — reconciliar os envios (ordem de 18/09)

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

```
1314  lidas da pasta "Sent"      (00hZ: 1314 — nenhuma carta nova até aqui)
1237    já tinham linha
   0    repetidas · 77 fora da janela (--corte) · 0 recusadas
   0    DENTRO DA JANELA — escrituráveis
✔ 1314 = 1314 · 🕳️ cartas sem linha dentro da janela: 0
```

Irmão de leitura independente (`2026-09-18_enviados_x_tabela.cjs`): **0 carta
depois do corte**. Os dois batem. Buraco **PASSIVO**.

⚠️ As 77 anteriores a 14/09 14:06:31Z seguem sem decisão — é o `--corte`, não
recusa. Escriturá-las é decisão de produção (`cobreDesde`), não de ronda.

> A carta que eu mandei nesta ronda (§3) saiu **depois** desta medição e foi
> conferida à parte, na tabela e na pasta: uid **3483**, linha gravada. O
> controle compensatório do `#101` pegou a carta desta própria ronda.

## Passo fixo 2 — percepção travada (ordem de 17/09)

```
controle positivo OK (#310) · controle negativo OK (#518) · 571 incidentes varridos
👁 SO PARAM POR FALTA DE VER/OUVIR/ASSISTIR: 0 · mais velho 0d
```

**Nada a despachar pro `olho`/`qa`.**

⚠️ Limite mantido do `#585` (Vigia, 22hZ de 25/09): este detector lê
`agent_notes[-1]` cru e é **cego em 13% da frota**. O `0` está certo **pelo
conteúdo**, não pelo alcance. Não leia como saúde. Cartão é de dono, não mexi.

## Passo fixo 3 — estado da fila

```
167 vivos = 130 abertos (15 open + 115 investigating) + 37 aguardando_aluno
404 fechados = 337 fixed + 67 ignored
95 abertos com 7d+
```

Idêntico ao que o Vigia mediu às 00hZ. **Início e fim iguais** — abri 1 cartão
(`#589`) e não fechei nenhum. Ver a conciliação no fim do log: a conta fecha em
**132/169**, e o cartão a mais **não é meu**.

---

## O caso serial: Eduardo, e o relógio que estava descrito errado

Peguei o `scandovieri41@hotmail.com` pela **única exceção** da regra 8:
dinheiro sendo cobrado errado agora. Não era limpeza de fila.

### O que a casa vinha dizendo, e o que eu medi

A ronda das 23h de 25/09 escreveu: *"o direito vence 26/09 — amanhã. Se vencer
assim, é o `#207` de novo."* **As duas metades estão erradas, e a descrição
errada levava à ação errada** (correr pra conceder acesso antes de um prazo, em
vez de parar uma cobrança).

**Correção 1 — aquela data é de COBRANÇA, não de vencimento.** O cabeçalho do
`pagante_trancado.cjs` já documenta isto desde 19/08, e é a armadilha que
inflou os 147 e os 68: *"`access_until` é gravado com a data da próxima
cobrança. Todo dia ao meio-dia UTC um lote inteiro 'vence' no mesmo segundo em
que a cobrança nova fica devida. Eles não estão travados: estão na fronteira."*

Conferido na **Hotmart viva**, não no `raw_event` (que é foto do dia):

```
assinatura GGMWWE5Q · FastCloner (7851642) · Plano Founder · R$97
status ACTIVE · adesão 2026-07-26 00:49Z
date_next_charge 2026-09-26 12:00:00Z
```

Bate ao segundo com o `entitlements.access_until = 2026-09-26 12:00:00+00`.
**Ele não perde nada às 12:00Z. Ele é COBRADO o 3º R$97** — de um produto que
nunca abriu em 62 dias. Não é o `#207` (garantia vencendo); é dinheiro saindo.

**Correção 2 — não foram 2 cartas, foram 4.** A ronda anterior leu
`emails_enviados` e achou 2. Essa tabela **só começa em 14/09**: zero ali é
**zero CEGO**, e é exatamente o aviso que o `2026-09-21_cartas_para_o_aluno.cjs`
carrega no cabeçalho. Na pasta **Sent**, que é remota:

| uid | data | assunto |
|---|---|---|
| 481 | 03/09 | *Sua assinatura do FastCloner esta paga - falta so um encaixe* |
| 1311 | 08/09 | *Eduardo: da pra resolver agora sozinho, sem esperar a minha resposta* |
| 2635 | 17/09 | *Sua assinatura está paga, mas falta criar a conta no FastCloner* |
| 3274 | 23/09 | *Eduardo, sua assinatura está paga mas você nunca conseguiu entrar* |

**Nenhuma com bounce. Nenhuma respondida.** O problema não é falta de carta nem
texto ruim — abri a de 23/09 e ela está correta, com link certo
(`fastcloner.com/app`, sem localhost, sem token). **O problema é o canal.**

### Ele realmente não tem conta — conferido pelos três caminhos

O `pagou_de_verdade.cjs` avisa no rodapé que o erro que mais pega a casa é
comprar num e-mail e entrar com outro (`#214`, `#218`). Então antes de afirmar:

| busca | resultado |
|---|---|
| `auth.users` por e-mail | 0 |
| `profiles` por e-mail | 0 |
| `profiles` por nome (*Eduardo Scandovieri Moraes pereira*) e por telefone (47984657744) | 0 |

**Pagou R$194 na assinatura** (2 ciclos COMPLETE: 26/07 e 26/08) + R$2.697,60
em avulsas. **62 dias. Nenhuma porta.**

### O que eu fiz, e o que deliberadamente não fiz

**Escrevi pra ele** — 26/09 **00:49:54Z**, uid **3483** na pasta Sent, linha
gravada em `emails_enviados` (`origem=ronda-manual`, sem bounce). Regra 8
(21/08): carta individual sobre caso que estou tratando é minha decisão, e
segurar resposta de aluno esperando permissão é o que a ordem proíbe.

A carta diz três coisas verdadeiras e nenhuma que eu não possa cumprir:
1. que ele é cobrado hoje de manhã, e quanto;
2. que criar a conta **antes das 12:00Z** faz o crédito do ciclo entrar
   sozinho — e que **depois disso não é automático**, eu acerto na mão;
3. que cancelar é escolha legítima dele, e como fazer.

**NÃO prometi reembolso** (dinheiro é do Johnny). **NÃO repeti a frase
"créditos reservados e intactos"**, que é o achado abaixo. **NÃO cancelei a
assinatura dele** — decidir por um aluno que não respondeu não é resgate, é
outra falha.

---

## O achado que sobrou, e o zero que vale mais que ele

Fui ver se o Eduardo era caso único. **Não era** — e a classe tem um defeito de
código dentro. Virou o **`#589`**.

### A régua, estreita de propósito

Entitlement do produto **7851642** com `user_id NULL` e `status active`
**+ pelo menos uma cobrança da ASSINATURA FastCloner com `value > 0` e
COMPLETE/APPROVED na Hotmart viva** (`pagou_de_verdade.cjs`).

Avulsa de outro produto **não entra**: isso é a decisão curso × plataforma do
`#505`/`#581` e não é minha. Foi misturar as duas coisas que produziu o "9
pagantes trancados" que a ronda das 23h quase publicou.

**População:** 38 órfãos ativos → 14 já vencidos + 4 vencendo em 7d. Rodei o
`pagou_de_verdade.cjs` nos **18, um por um**. Sobraram **5**, **R$679** só de
assinatura.

| quem | pago na assinatura | access_until | conta |
|---|---|---|---|
| Eduardo (`scandovieri41`) | R$194 (26/07, 26/08) | **26/09 12:00Z — hoje**, e é a data da COBRANÇA | nenhuma |
| Carlos Augusto (`caplastica`) | R$194 (13/08, 28/08) | 22/09 — passou há 3,5d | nenhuma |
| Simone (`sbtirp`) | R$97 (17/08) | 05/09 — passou há 21d | nenhuma |
| Aline (`alinearieta`) | R$97 (19/07) | 19/08 — passou há 38d | nenhuma |
| Alexandra (`alexandramonteiroferreira`) | R$97 (30/07) | 23/08 — passou há 34d | **tem, com OUTRO e-mail** |

**Excluí 13, com o motivo escrito no cartão** pra ninguém reacusar essas
pessoas na próxima ronda: **9** são trial de R$0 que nunca converteu (vencer é
o desenho), **4** pagaram só avulsa de outro produto com a assinatura em R$0
(curso × plataforma, `#505`/`#581`).

### O erro que eu ia publicar, e o que o derrubou

Eu tinha **"5 alunos sem conta nenhuma"** pronto. **A Alexandra tem conta há
dois meses.**

Achei porque procurei por **nome** antes de afirmar — exatamente a lição que a
ronda das 23h escreveu ontem. `alexandramonteiroferreira2020@gmail.com`, criada
**23/07 01:45**, e-mail confirmado, **um único login** (o da criação), nunca
mais voltou. `plan=free · credits_subscription=0 · credits_extra=0 · access_until
NULL · 0 subscription_grant`.

E a sequência é pior que o rótulo: ela criou a conta no dia do trial, **viu uma
conta vazia**, sumiu — e **sete dias depois, em 30/07, foi cobrada R$97**. É a
classe `#214`/`#222` (e-mail da compra ≠ e-mail da conta), que o **próprio
`claim.ts` declara no cabeçalho como limite conhecido**: *"e-mail da compra ≠
e-mail da conta não tem como casar sozinho"*.

Dois erros meus em dois campos diferentes se eu tivesse publicado o número
redondo: acusaria a casa de não ter dado conta a quem tem, e perderia o caso
real dela, que é outro e é pior.

### O defeito de código: a janela do resgate fecha no `access_until`

`frontend/src/lib/payments/claim.ts:58`

```js
if (e.access_until && e.access_until <= nowIso) continue; // período já venceu
```

`reconcileUserEntitlements` (`entitlements.ts:282-322`) **adota** a órfã pelo
e-mail **sem olhar data nenhuma**. É o laço do crédito, logo abaixo, que pula.

Então para a Simone, a Aline e o Carlos Augusto — cujo `access_until` já
passou — **criar a conta hoje devolve conta vinculada, `plan` recalculado para
free e saldo zero**, em cima de R$97 a R$194 que eles pagaram.

**E a promessa por escrito que isso contradiz:** a carta de 23/09 ao Eduardo
(uid 3274) diz, com todas as letras, *"Seus créditos aparecem sozinhos no
primeiro acesso — estão reservados e intactos."* **Não existe reserva.** O
crédito nasce no login, e só se o `access_until` ainda não venceu. Para três
dos cinco, essa frase **já é falsa hoje**.

### O controle negativo, contra a minha própria acusação

```sql
select ... from entitlements e join profiles p on p.id = e.user_id
where e.status='active' and e.product_code='7851642' and e.access_until < p.created_at
```

**`[]` — zero linhas. Isto NUNCA aconteceu em produção.** O defeito é
**LATENTE**, escrevi isso no título do cartão, e ele não deve ser tratado como
incêndio.

**Mas o motivo do zero é o ponto desta ronda:** o dano é zero **porque nenhuma
dessas pessoas voltou**. O defeito está armado exatamente sobre quem as nossas
quatro cartas pedem que volte, e só pode disparar **no dia em que uma delas
finalmente fizer o que a gente pediu**. Um instrumento que mede "0 vítimas"
aqui está medindo o nosso fracasso em trazê-las de volta, não a saúde do código.

### Uma hipótese tentadora que eu matei antes de gastar agente nela

"5,5% de órfãos, quase ninguém cria conta — o cadastro deve estar quebrado."
Medi antes de despachar `qa` pra olhar tela:

```
entitlements do 7851642: 1435 · com user_id: 1356 (94,5%) · órfãos: 79 (5,5%)
```

**O cadastro funciona.** Esses 5 são a cauda, não uma falha sistêmica. Fica
escrito pra próxima ronda não caçar isso de novo.

### Pergunta medida, registrada como pergunta e não como acusação

O Eduardo pagou **dois** ciclos e o laço do `claim.ts` concede **um** (chaveado
pela transação do `raw_event`, que é a última). **Não afirmo que seja bug** —
recarga mensal que não acumula é desenho plausível, e **eu não medi**. Fica
escrito no `#589` para quem for decidir, com o `cobreDesde` do assunto na mão.

---

## O que esta ronda NÃO resolveu, e por quê

- **O `#589` não fecha.** Depende do "pode" do Johnny em quatro pontos:
  (a) cancelar/estornar a cobrança de hoje do Eduardo; (b) criar conta pros 4
  sem porta; (c) religar a conta da Alexandra ao entitlement do outro e-mail;
  (d) WhatsApp — o e-mail já falhou 4 vezes e o telefone está no cadastro.
  **Mesmo pedido parado do `#249`/`#250`.**
- **Não escrevi pros outros 4, e isso é decisão, não esquecimento.** Pra eles a
  janela do crédito **já fechou**: qualquer carta minha ou repete a promessa
  falsa ("seus créditos estão lá"), ou faz três promessas que só o "pode" do
  Johnny cumpre. Escrever hoje criaria três Vivianas em vez de uma. Elas entram
  na fila da carta **no minuto seguinte** ao "pode".
- **Não consertei o `claim.ts`.** É lógica de concessão de crédito, e é
  exatamente a família do `#469` (N estornos contra 1 débito). Mexer nela no
  escuro cria crédito do nada. Fica com dono e com a medição pronta.
- Não toquei em nenhuma das pendências herdadas abaixo.

## Fila ao fim da ronda

**169 vivos** (132 abertos + 37 aguardando_aluno) · **95** com 7d+ ·

> **Conciliação linha por linha, porque 168 seria mentira.** Eu tinha escrito
> 131/168 no §3 contando só o cartão que abri. A medição do fim da ronda dá
> `15 open + 117 investigating = 132 abertos`, **dois a mais** que os 130 do
> início, e não um. O segundo é o **`#588`** (*Fast, e-mail, atendimento: aluna
> Marina Frederick pediu cancelamento do Sistema…*), nascido **do sistema**
> durante a minha janela — **não é meu** e eu não o toquei. Conta:
> 130 + `#589` (meu) + `#588` (do `fast-help`) = **132**. ✔
> Deixo a correção escrita em vez de trocar o número em silêncio: número de
> fila que não reconcilia é exatamente o que fez a casa publicar "0 abertos"
> existindo quatro, em 19/08.

percepção travada **0** (sob objeção do `#585`) · envios **0** fora do livro.

### Pendências nomeadas (paradas, não "em andamento")

1. 🔴 **`#589` (novo) — relógio de 11h.** Eduardo cobrado 26/09 12:00Z. Os
   outros 4 da classe, R$679 no total, esperando o "pode".
2. 🔴 **`#582` — o "pode" pros pagantes sem conta.** Anotado hoje com a régua
   e as duas correções; status preservado.
3. 🔴 **`payment_events.error` não vira chamado sozinho** — ganhou nome na
   ronda das 23h, segue sem ninguém que o execute.
4. 🔴 **`#249` / `#250`** (R$1.427,60, 42 e 50 dias) — "pode" do WhatsApp.
   **Agora são três pedidos de WhatsApp parados pela mesma pergunta.**
5. 🔴 **Decisão curso × plataforma** (`#505` ignored + `#581`) — venceu 25/09,
   e o prazo escrito ao Rafael **passa a correr às 03:00Z de hoje**.
6. 🔴 **`#586` (Walter)** — o cartão manda processar reembolso que não existe;
   medição do Vigia está no cartão, a carta é de quem tem alçada.
7. 🔴 **`#702cc916` — 25d**, destrava a cabeça da fila (`#52`, 38d, 22 alunos).
8. **Fila de decisão do Johnny: 18 cartões, 53 alunos** — o lote segue sem ser
   montado, quarta ronda seguida.
9. **`#426`** (309/349 do lote de 04/09) · **`patch_cfde107d`** do Vigia ·
   **77 cartas** anteriores a 14/09 · **`#585`** · **`#587`** (novo, Vigia) ·
   **`#398`** (gatilho 2-em-6h por aluno esconde quem falha uma vez só).

### A lição desta ronda

A ronda anterior escreveu a lição certa — *"régua boa contra um erro não é
régua boa contra todos"* — e eu encontrei o corolário dela em outro eixo:
**descrição errada de um fato certo leva à ação errada, mesmo quando o número
está certo.** A data do Eduardo estava correta em toda nota que a casa escreveu.
O que estava errado era a palavra: chamaram de *vencimento* o que é *cobrança*.
Com "vence", a ação óbvia é correr pra conceder acesso antes do prazo. Com
"cobra", a ação óbvia é parar o débito e perguntar ao aluno. **Duas rondas
descreveram o mesmo número e nenhuma tinha ido à Hotmart viva perguntar o que
aquela data significava** — a resposta estava, desde 19/08, no cabeçalho de uma
ferramenta da própria casa.

E o corolário do zero: **`0` não é sempre saúde.** O `0` do controle negativo
do `#589` é real, e significa que nenhuma das cinco pessoas jamais voltou. Um
número que só fica bom enquanto o aluno não aparece é um número que está
medindo a coisa errada.

---

## Adendo da mesma ronda — levantamento de branch concorrente (01:0xZ)

Feito **antes** de qualquer conserto, porque o `README.md` das ordens já conta
**sete** vezes em que a casa escreveu duas correções para o mesmo defeito e a
segunda derrubaria a primeira (`feat/onedrive-401`,
`feat/fix-image-upload-retry`, as duas da cura de referência,
`fix/trava-foto-nova-8379549c`, `fix/ritmo-da-referencia-porta-73a60bb`,
`fix/estorno-treino-por-saldo-pendente`).

Procurei **a linha do penhasco** do `#589` nas 4 branches que mexem em resgate
de compra órfã:

| branch | `claim.ts:53` |
|---|---|
| `feat/claim-guarda-credito-faltando` | linha **intacta** |
| `feat/claim-vinculo-orfao` | linha **intacta** |
| `wip/282-resgate-compra-orfa-NAO-MERGEAR` | linha **intacta** |
| `feat/orfa-carencia-sweeper` | linha **intacta** |

**Ninguém nunca tocou nessa linha.** Quatro tentativas independentes de atacar
a compra órfã passaram ao lado dela. Quem consertar o `#589` **não colide** com
trabalho existente nesta perna — e isso é resultado de busca, não suposição.

⚠️ **Alcance declarado:** procurei pela LINHA, em
`frontend/src/lib/payments/*.ts`, nas 4 branches que o nome denuncia. **Não
varri as ~200 branches locais inteiras.** Quem for mexer em OUTRA perna do
claim (vínculo, aviso, guarda) tem essas 4 como leitura obrigatória antes.

Checagem 2 da ordem de 27/08 ("já foi corrigido?"):
`feat/claim-guarda-credito-faltando` já virou o **PR #195, MERGED em 06/09** —
a branch local é sobra, não é risco.

### E uma correção para a fila, achada no mesmo levantamento

A pendência **"`payment_events.error` não vira chamado sozinho / ninguém
executa a varredura"** — que a ronda das 23h de 25/09 listou como **não
construída** (*"não criei o caminho que a roda sozinha e abre chamado. Isso é a
parte (c) de verdade e continua aberta"*) — **está construída e esperando
revisão**:

```
PR #451 · feat/varredura-orfao-pagante-sem-conta · ABERTO desde 25/09 21:42Z
"varredura le payment_events.error e abre incidente sozinha"
438 linhas de ferramenta + 370 de teste
```

O PR foi aberto **uma hora antes** daquela ronda escrever que a coisa não
existia. **A próxima ronda não precisa construir isso — precisa revisar o
#451.**

E a forma disso é a lição de ontem com uma volta a mais. A ronda das 23h
escreveu: *"a casa é boa em construir instrumento e ruim em consultá-lo."*
Hoje o instrumento foi construído **e** o defeito mudou de lugar de novo:
**"ninguém roda o instrumento" virou "ninguém revisa o PR do instrumento".**
O trabalho não se perdeu por falta de execução nem por falta de código — se
perdeu no passo em que a casa nunca olha, que é o passo seguinte ao que ela
acabou de consertar.
