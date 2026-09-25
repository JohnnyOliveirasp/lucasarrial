# Ronda das falhas — 25/09/2026, ~20hZ

**Método: serial (regra 8).** Um caso levado até onde dá antes de pegar outro.

**Esta ronda fechou ZERO incidentes, e não vou maquiar isso.** O caso serial que
peguei está travado num passo que **não é meu** — e eu medi que não é meu, em vez
de presumir. O que entreguei foi **verdade na fila** (2 notas com medição nova),
uma **escalada de aluno pagante travado** e **um fechamento errado evitado**.

**Produção tocada: ZERO.** Zero merge, zero deploy, zero GPU, zero migration,
zero DDL, zero crédito movido, zero carta a aluno, zero vínculo de compra.

---

## Passo fixo 1 — reconciliar os envios (ordem de 18/09)

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

- **1310** cartas lidas da pasta `Sent`, 1310 com cabeçalho lido.
- **1233** já tinham linha. **0 escrituráveis** dentro da janela.
- Contagem fecha: **1310 = 1233 + 0 + 77 + 0**. Nenhuma carta sumiu.
- Registro local (#210) não existe nesta máquina — *gitignored*, morre com o
  worktree. É o buraco que esta reconciliação compensa.

Instrumento independente (`2026-09-18_enviados_x_tabela.cjs`): **0 cartas**
depois do corte fora da tabela. Veredito: o buraco é **passivo**. Bate.

Números idênticos aos da ronda anterior (1310/1233) — coerente: **nenhuma carta
nova saiu** desde então, porque esta ronda também não conseguiu escrever a
ninguém.

## Passo fixo 2 — estado da fila (início)

**163 abertos** · 94 com 7d+ · **1 patch** do Vigia (`patch_cfde107d`) ·
**141 recados** `para_frank_*`.

## Passo fixo 3 — percepção travada (ordem de 17/09)

`percepcao_travada.cjs`: **0** cartões (controle positivo #310 OK, negativo #518
descontado, 565 incidentes varridos). Nada a despachar pro `olho`/`qa`.

---

## A escolha do serial (por eliminação medida, não por gosto)

Rodei a fila do mais velho pro mais novo e **descartei os de cima com motivo**:

| cartão | idade | por que NÃO é o serial |
|---|---|---|
| `#52` `37bacb68` | 37d | travado na decisão do Johnny via `#702cc916` (24d). Classe "contestados". |
| `#172` `af06731f` | 28d | **conferido hoje**: carta enviada 22/09 12:51Z, sem bounce. Bola legitimamente do aluno. |
| `#206` `99a20692` | 25d | **conferido hoje**: respondida 22/09 (uid 3197), bola dela pra terminar o formulário. |
| `#216`/`#224`/`#226` | 24d | os três estão na fila de decisão do Johnny. |

> **`#172` eu quase fechei como duplicata e não fechei.** Duas notas de 28/08
> (uma minha, uma do Claude) dizem "duplicata do #169/#171", e os dois estão
> `fixed`. Fechar por isso seria defensável **e estaria errado**: o ledger mostra
> carta de **22/09 12:51Z** pra esse aluno (183.673 créditos + retreino), origem
> `ronda-manual`, **sem bounce**. O cartão virou o canal vivo do caso depois das
> notas de duplicata. Ficha velha não descreve o presente.

**Serial escolhido: `#249` (`132f7808`), 21d** — o mais velho com aluno afetado
cuja bola está no **nosso** colo. Empate de idade com o `#250`; desempatei pelo
dano: no `#249` a recusa é **permanente** (endereço não existe), no `#250` é
caixa cheia, que reenvio ainda pode vencer.

---

## O caso: pagante de R$ 694 há 41 dias sem nada, e a casa achou que respondeu

### Reconferido hoje, não herdado

A **retratação de 20/09 está certa** — e o fechamento `ignored` daquela mesma
ronda estava errado. Refiz as medições:

| medida | resultado |
|---|---|
| `pagou_de_verdade.cjs` | **PAGOU R$ 694,00** — HP0751413476 SGP R$ 397 + HP4070657561 Fábrica R$ 297, ambas COMPLETE em **15/08** |
| `contato_do_comprador.cjs` nas **duas** transações | e-mail do comprador é **exatamente o quebrado** nas duas. **Não existe segundo e-mail.** Telefone presente nas duas |
| `auth.users` `5df44a4e` | e-mail = o quebrado · `phone` NULL · `last_sign_in_at` **NULL (nunca logou)** |
| bounce | `550 5.1.1 user unknown` — falha **permanente** |

**41 dias** desde o pagamento, **21** desde a conta, zero acesso. E ele não sabe
de nada: o `250` do nosso SMTP significou "aceitei pra fila", a fila marcou como
respondido, e o aluno virou silêncio.

### O passo que falta, e por que não é meu — VERIFICADO, não presumido

A nota de 04/09 dizia "não é minha, eu não tenho WhatsApp". Em vez de repetir
isso por 21 dias, **fui conferir se ainda é verdade**:

- **E-mail** — impossível por definição. Único endereço existente é o que
  devolve `550`. Reenviar seria teatro.
- **WhatsApp** — a casa **tem** o canal: `lib/agent/waha.ts` manda texto e aceita
  destino individual (`@c.us`). Mas as credenciais da WAHA **não estão nesta
  máquina** (conferido) — a WAHA roda no servidor. **Não dá pra disparar daqui.**
- **Telefone** — esta instalação do Frank **não tem Twilio** configurado
  (conferido).

> Ou seja: o canal **existe na casa** e **não existe no meu alcance**. Por isso
> escalei em vez de prometer. O que mudou em relação a 04/09 não é o veredito, é
> que agora ele está **medido** e o pedido ao humano é de **uma frase**.

**Não fechei.** Regra 14 inteira: ele não recebeu nada. Segue `investigating`.

---

## A classe, medida (ele é folha do `#426`)

O lote de 04/09 criou **349 contas** `origem='sgp_hotmart'` e **319 (91%) nunca
logaram**, 21 dias depois.

**Não inflo esse 319.** "Nunca logou" não prova trancado — muita gente pode
simplesmente não ter tentado. O que está **provado** é o subconjunto das fichas
de bounce:

```
10 cartões abertos · 10 de 10 com conta criada · 8 de 10 nunca logaram
   3 PERMANENTES (e-mail nunca chega):  #249 21d · #294 18d · #340 15d
   3 caixa-cheia (reenvio pode vencer): #250 21d · #460 8d · #464 7d
   4 "outra"
```

**Achado de graça, pra humano confirmar em segundos:** `#374`
`horta.pericias@gmail.com.BR` e `#493` `alinedutra_@hotmail.com.BR` têm domínio
inexistente por **erro de digitação óbvio**. **Eu não corrijo nem mando pro
endereço "provável"** — endereço chutado entrega dado de aluno a um estranho.
Confirmado com o aluno, são 2 destravados sem mistério.

---

## O fechamento errado que a medição evitou (`#460`)

Ia fechar o `#460` como "curado pelo reenvio". **Estava errado.**

- Carta 17/09 21:48Z → `554 5.2.2 mailbox full`. **Reenvio** 18/09 15:27Z →
  linha em `emails_enviados` com `bounce_em` **NULL**. Ledger limpo convida a ler
  "entregue".
- Mas o `last_seen_at` **do próprio cartão** é 18/09 **15:30:04Z** — *dois
  minutos e meio depois do reenvio* — e `occurrences` subiu pra **2**. O reenvio
  bateu na mesma caixa cheia; foi **o ledger** que não registrou.
- E o login dela não serve de prova: `last_sign_in_at` = **08/09**, *anterior* às
  duas cartas.

> **Régua nova, anotada no cartão:** não feche ficha de bounce porque `bounce_em`
> está NULL. **Ausência de bounce no ledger não é prova de entrega.** Confira o
> `last_seen_at`/`occurrences` do cartão, que é a fonte que disparou.

Sobre o tamanho disso: 1234 cartas no ledger, **12** com `bounce_em`, contra
**27** ocorrências somadas nos 20 cartões da classe. **Não afirmo que a diferença
toda (12 vs 27) é defeito** — a maior parte se explica porque o ledger só começa
em 14/09 e há bounce de 04/09 a 13/09 sem linha nenhuma pra atualizar. **1 caso
provado depois do corte, não 15.**

---

## O que gravei na fila

| cartão | ação | por quê |
|---|---|---|
| `#249` (`132f7808`) | **nota**, `investigating` mantido | medição nova (pagamento, canais, classe) + o passo que falta e de quem é |
| `#460` (`bb97e2f1`) | **nota**, `investigating` mantido | o reenvio **também** bateu; régua do `bounce_em` NULL |

Escritas por `anotar_incidente.cjs --confirmar`, **conferidas na releitura: 1
linha afetada cada**.

## Grupo (regra 7 + prioridade "pagante travado avisa NA HORA")

Uma mensagem pelo `notify-grupo.sh`: pagante de R$ 694 há 41 dias sem acesso, por
que e-mail é impossível, que a casa tem o telefone dele desde 15/08, e o pedido
concreto — **um "pode" pra chamar no WhatsApp**. Junto, a classe (10 fichas, 3
permanentes) e os 2 erros de digitação de domínio.

**Telefone e CPF não foram pro grupo** — dado pessoal não circula em canal; está
no cartão.

---

## Fila ao fim da ronda

**163 abertos** (sem mudança — nenhum fechado, e está escrito por quê).
Percepção travada: **0**.

### Pendências nomeadas (paradas, não "em andamento")

1. 🔴 **`#249` — o "pode" do WhatsApp.** Com um e-mail que funcione eu troco o
   endereço da conta e mando o acesso no mesmo dia. Sem canal, não ando.
2. 🔴 **A decisão de curso × plataforma** (28 alunos + a carta do Rafael, prazo
   que a casa deu era "amanhã" em 25/09). **Vence agora.**
3. 🔴 **`#702cc916` — 24d**, decisão de produto; destrava a cabeça da fila
   (`#52`, 37d, 22 alunos).
4. **Fila de decisão do Johnny: 18 cartões, 53 alunos, mais velho 24d.** O lote
   não foi montado nesta ronda — segue devendo.
5. **`#426`** — os 309/349 do lote de 04/09. A dívida de entrega vive lá.
6. **`patch_cfde107d`** do Vigia esperando revisão. Não foi esta ronda.
7. **141 recados `para_frank_*`**, o mais velho com 21,8d.
8. **77 cartas anteriores a 14/09** — segue sem decisão de escrituração.
9. **`emails_enviados.bounce_em` sub-registra** — 1 caso provado. Quem mexer no
   detector de bounce leva isto junto.
10. **`sgp_fracassos` com 0 linhas** — indistinguível entre "sem falhas" e "não
    grava".
