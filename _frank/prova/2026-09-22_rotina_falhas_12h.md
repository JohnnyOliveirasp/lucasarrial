# RONDA DAS FALHAS — 22/09/2026, ~11h40–12h05Z

Dono da fila (regra 14-A). Método serial da ordem de 21/08 (regra 8). Canal:
ordem de 31/08 — FastCloner **só no grupo**. Ordem de 29/08 respeitada: **nada
da planilha** foi lido, escrito, classificado ou reprocessado.

**Cartões fechados: 0.** **Alunos escritos: 0.** **Fix em produção: 0.**
**Pedido de decisão ao grupo: 1 (consolidado).** **Notas corretivas: 3.**

Digo na primeira linha o que esta ronda foi: uma ronda de **medição e
correção de premissa**, não de entrega. Nenhum cartão podia fechar sem mentir.
O que ela produziu foi descobrir que **uma das duas escaladas na mesa do
Johnny não precisava existir** e que **a outra estava subdimensionada em
2,5×**.

---

## 0. Passos fixos — os três limpos

| passo | resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar` | 1007 lidas · 930 já tinham linha · 77 fora da janela · **0 escrituráveis** · contagem fecha 1007=1007 |
| `enviados_x_tabela.cjs` (irmão de leitura, independente) | **0 carta depois do corte** ✔ |
| `percepcao_travada.cjs` (ordem de 17/09) | controle positivo OK (#310) · 507 varridos · **0 travado em percepção** |

As 77 anteriores a 14/09 14:06:31Z seguem **sem decisão**. Não mexi:
`cobreDesde` é decisão de produção, não de ronda.

---

## 1. Serial: peguei o mais velho (#214, 21d) e ele me levou ao #446

Peguei `#214` (zicasantos37, 21 dias) por ser o mais velho com aluno nomeado.
A nota de ontem o tratava como **decisão inédita** do Johnny: *"estorno depois
de pagar não está escrito em lugar nenhum"*.

### Essa frase é falsa, e fui eu quem escreveu

Fui conferir antes de repetir a escalada. A regra **existe**:

- decisão do Johnny **18/08**, implementada no commit `07767682`
  ("Estorno/chargeback/protesto zera o crédito de mensalidade")
- teste: `estorno-zera-credito.test.ts` → *"PURCHASE_REFUNDED → ZERA (dinheiro
  voltou)"*
- DDL: `scripts/111_estorno_zera_credito.sql`, cabeçalho ainda **"NÃO APLICADA"**

**Não falta regra. Falta a migration rodar.** Isso colapsa `#214` e `#446` na
mesma pendência e **tira uma escalada duplicada da mesa do Johnny**.

É exatamente a armadilha que o manual de ronda já nomeia: *"DDL commitado não é
DDL aplicado"*. O commit diz, com todas as letras, "mig 82 (**NÃO aplicada** —
regra 21)". O **chamador subiu assim mesmo**.

### Conferido no catálogo, não no log

`information_schema.routines` com `proname ilike '%zero%'/'%refund%'/'%estorno%'`
→ **0 linhas** (22/09 11h50Z). O commit `07767682` **é** ancestral de
`origin/main`. Ou seja: o código que chama está no ar, a função não existe.

### A contestação que nunca tinha sido registrada no #214

`payment_events` da tx `HP2306675202`, na ordem: `PURCHASE_APPROVED` 26/08 →
**`PURCHASE_PROTEST` 01/09 23:28Z (DISPUTE)** → `PURCHASE_REFUNDED` 07/09.
As notas anteriores falavam só em "REFUNDED". O `PROTEST` importa: é o dia
seguinte ao relato dela no chat, e também conta como dinheiro devolvido.
O extrato dela (`credit_transactions`) tem **11 lançamentos e nenhum de
estorno** — o REFUNDED de 07/09 passou **sem deixar rastro**, porque a função
nunca existiu.

---

## 2. O #446 estava contando só o barulho: a classe é 2,5× maior

O `#446` media **4 pessoas / 589.102 cr** — que é só quem quebrou **depois** de
15/09 03:03Z e por isso deixou erro em `payment_events.error`. Antes disso a
mesma regra falhava **em silêncio**.

Varri pelo **estado**, não pelo erro
(`entitlements.status in ('refunded','chargeback') AND saldo > 0`):

| conta | status | evento | `credits_subscription` | gasto pós-evento |
|---|---|---|---|---|
| marlon@bianchitour.com | refunded | 29/08 | 200.000 | 0 |
| draortizestefani@gmail.com | refunded | 10/09 | 187.189 | 0 |
| adrianomalafaia.webcert@gmail.com | refunded | 11/09 | 178.935 | 0 |
| paula@handelhomes.com | refunded | 16/09 | 171.029 | 0 |
| core@frentestudio.com.br | chargeback | 17/09 | 169.067 | 0 |
| mkt.drrigatti@gmail.com | chargeback | 21/09 | 149.006 | **38.511** |
| alexsander20196@gmail.com | refunded | 19/08 | 130.619 | 0 |
| vazilg@gmail.com | refunded | 18/09 | 100.000 | 0 |
| zicasantos08@hotmail.com (**#214**) | refunded | 07/09 | 93.305 | 0 |
| miguelmoedas.propriedades@gmail.com | chargeback | 11/09 | 77.185 | 0 |
| contatoabreu25@gmail.com | refunded | 03/08 | **0** | — |

**11 contas · 1.452.872 cr · `credits_subscription` 1.456.335.**

### Não inflei a classe — e conferi de propósito

As 11 têm **uma única** entitlement cada, todas do produto `7851642`, todas em
status de dinheiro devolvido, **nenhuma com compra viva em paralelo**.

E deixei **de fora de propósito** as **301 contas `canceled` (31,1M cr)**: pela
REGRA FINAL DE CRÉDITO de 20/08 quem parou de pagar usa o que tem até acabar —
aquilo **não é defeito**. Somar os 31,1M faria o número parar de significar
alguma coisa, que é o erro que a ronda de ontem já teve de corrigir na Bárbara.

### Duas armadilhas de aplicação, medidas antes de alguém aplicar

1. **`contatoabreu25`**: `credits_subscription` = 0, só 8.112 em `credits_extra`
   — que a regra **nunca** toca. Aplicar nele **não zera nada**. São **10**
   contas afetáveis, não 11.
2. **`zicasantos08` (#214)**: `credits_extra` = **−11.575**. Zerar a assinatura
   (93.305) deixa a conta em **−11.575**, não em 0. "Zerar" não produz zero.

### Não piorou desde ontem

Nenhum evento novo preso. O único consumo pós-estorno segue sendo os 38.511 cr
do `mkt.drrigatti`, que **parou 21/09 17:54Z**.

### Escalação: uma só, consolidada

`ask_humans` ao grupo (`ok:true`), com as duas decisões separadas de propósito:
**(A)** aplicar a `scripts/111` — recomendei SIM, é a parte de baixo risco e
para a sangria nova sem tocar em saldo de ninguém; **(B)** zerar os 1.456.335 cr
das 10 contas — recomendei SIM, mas é retirada de saldo de aluno e pela **9-A**
é dele. Disse que dá pra fazer só (A) agora.

**NÃO apliquei DDL, NÃO zerei crédito de ninguém, NÃO reprocessei evento.**
Era o "vale repetir UMA vez em 22/09" que a nota de ontem previa — repetido
**uma** vez, consolidado, não duplicado.

---

## 3. #245 (Igor): o veredito do `olho` existia e não estava no cartão

O varredor de percepção deu **0** e eu desconfiei, porque vi um recado do Vigia
pedindo olho humano. **O varredor estava certo e eu errado** — o recado era o
original de 03/09, e o cartão já tinha sido despachado em 20/09.

Mas ao conferir achei outra coisa: o card `9d41ee9a` (@`olho`) está
**[completed] desde 20/09 22:04Z com laudo completo**, e a última nota do
incidente só registrava o **despacho**, nunca o **retorno**. A ordem de 17/09
manda o veredito voltar **escrito na nota do card**. Não voltou. **Arquivei o
laudo inteiro no #245 nesta ronda.**

Veredito do `olho`: 7 gerações + 7 fotos-fonte, 14 arquivos abriram. Vídeo ruim
(boca emborrachada, dentes borrados, efeito máscara); fotos **parcialmente**
no padrão (3 fora, 4 totalmente dentro); **o aluno tem razão** — mesmo nas
gerações em que seguiu tudo, o defeito permaneceu. É limite do motor de
lip-sync.

### Registrei a divergência em vez de escolher a versão conveniente

A carta de 20/09 11:45Z (uid 2993) dizia ao aluno que a boca "acompanha o áudio"
e "ficou nítida", centrando a queixa no **corpo parado**. O laudo das 22:04Z do
**mesmo dia** é mais duro com a boca. As duas **concordam no que decide o caso**
(ele tem razão, é limite do produto) e **divergem no detalhe**. Quem reabrir
precisa saber que há duas leituras do mesmo material.

### Corrijo um erro meu, no meio desta ronda

Tratei o #245 como *"aluno esperando há 19 dias em silêncio"* e comecei a agir
com essa urgência. **Estava errado**: ele foi respondido em 20/09 11:45Z, com
carta que assumiu a falha de diagnóstico da casa, recusou prometer data e pediu
desculpa pela demora. Eu tinha visto o despacho e **não tinha conferido
`emails_enviados` antes de concluir**. Anoto porque quase repeti no diagnóstico
o erro que a casa já pagou caro: afirmar desfecho sem ir à fonte.

**Não escrevi de novo pra ele**: não há fato novo do lado dele, e reabrir só pra
dizer "na verdade a boca também está ruim", sem remédio na mão, piora a
experiência. Se cabe devolver crédito das gerações que o nosso próprio laudo
chama de fracas, é dinheiro — logo é do Johnny (9-A). Não decidi, não estornei,
não prometi.

Conta conferida hoje 11h48Z: plan pro, 151.076 cr, entitlement `5b8530d3`
**ativa**, `access_until` 22/09 12:00Z — **fronteira normal de renovação** de
assinatura viva, não vencimento de acesso. (Também aqui eu quase inventei
urgência; medi antes de alarmar.)

---

## 4. Achado de processo, pra não virar classe

**Despacho de percepção que volta e não é arquivado fica invisível duas vezes.**
O `percepcao_travada.cjs` deixa de acusar o cartão (a última nota não pede mais
olho), e o veredito fica só no Mission Board, onde a ronda seguinte não olha.
Foi o que aconteceu no #245 por 2 dias. O caso é `n=1` e **não apertei nada** —
registro pra que, se aparecer um segundo, vire regra: **despacho só se encerra
quando o veredito está na nota do incidente.**

---

## 5. Por que NÃO postei ronda no grupo

REGRA 7 (21/08) manda postar quando: fechou incidente, subiu fix pra produção,
ou escreveu pra aluno. **Nenhum dos três aconteceu.** A ordem é explícita que
ronda vazia e progresso parcial **não** vão pro grupo — o Lucas está lá e ruído
mata o canal. O que foi ao grupo nesta ronda é o **pedido de decisão do #446**,
que é regra 9-D e é urgente.

---

## 6. Placar honesto

- **Fechados: 0.** Nenhum podia virar `fixed` sem violar a regra 14.
- **Uma escalada duplicada eliminada** (#214 é #446; a premissa era minha e
  estava errada).
- **Uma escalada corrigida pra cima**: 589.102 → 1.456.335 cr, 4 → 10 contas,
  com as duas armadilhas de aplicação medidas antes.
- **Um veredito resgatado** do Mission Board pro cartão (#245).
- **Dois erros meus registrados**: a premissa do #214 (ontem) e a urgência
  inventada no #245 (hoje, no meio da ronda).
- **Uma decisão esperando o Johnny**, com número na mão e separada em (A)
  barata e (B) cara.
