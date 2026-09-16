# Rotina das falhas — 16/09/2026, 12h40Z (09h40 BRT)

Dono da fila (14-A). Li `_frank/ordens/README.md`, a de **20/08** (dono da fila),
a de **21/08** (serial + regra 8), a de **27/08** (só erro de sistema vira
chamado) e a de **29/08** (planilha desligada). **Nada da planilha foi lido,
escrito, classificado ou reprocessado.** Canal: por ordem de **31/08**, o aviso
desta ronda sai **no grupo**, e só no grupo.

Ronda anterior das falhas: **12hZ**. Abertura desta: **12h40Z**.

Peguei o **`#282`** (`03e7b34b`, 10,0 d). Conferi a cabeça da fila um a um antes
de escolher: `#11` e `#15` seguem em decisão do Johnny; `#99` tem prazo do Johnny
em 19/09; `#223` espera a aluna desde 13/09; `#226` e `#234` esperam a chave de
GPU; `#246` depende da decisão comercial do jutai, parada desde 04/09; `#249` e
`#250` esperam o aval de WhatsApp pedido em 13/09; `#263` espera a definição dos
R$ 97; `#270` foi reaberto hoje e os 25.000 cr de 14 alunos são do Johnny. O
`#282` era **o mais antigo onde a bola é nossa e não depende da palavra de
ninguém**.

**O que esta ronda entrega:** (1) o SELECT que a ronda de 07/09 deixou cravado e
que ninguém rodou em **8 dias**, agora respondido com controle; (2) um **defeito
novo no próprio conserto deste cartão** — o detector acusa trial não pago como
compra paga; (3) o aluno que estava parado dentro do cartão, avisado, com uma
carta nossa de 28/08 desmentida; (4) **duas hipóteses minhas derrubadas** antes
de virarem manchete.

---

## 1. O gatilho de 07/09: o zero é verdadeiro, e isso é boa notícia

A nota de 07/09 escreveu: *"o primeiro chamado com signature `sgp:claim:<email>`
e `reported_by=sgp-lote`… enquanto ele não aparecer, o ramo que importa NUNCA
RODOU. Quem pegar a próxima ronda: vale conferir, é um SELECT."* Ficou 8 dias.

```
incidents reported_by='sgp-lote'        -> 0
incidents signature like 'sgp:claim:%'  -> 0
```

Zero só vale com controle, então:

- **O SELECT enxerga:** a mesma consulta vê 412 chamados e 12 valores distintos
  de `reported_by` (fast 97, fast-help 92, vigia 69, frank 66, burst-rule 36,
  fast-sgp 8…).
- **A função rodou** — prova de caminho de código, não suposição: em
  `processar.ts` o `await registrarFalhaDeClaim(...)` está **antes** do
  `atualizarSessao` que grava `enviado_em`. Logo todo pedido com `enviado_em`
  passou por ela. Medido: **73 pedidos enviados depois do merge `2697d95`**
  (07/09 20:48Z), espalhados por 9 dias. Controle: 10 enviados **antes** do
  merge, que é o que separa "rodou pouco" de "não rodou".
- **Instrumento independente**, pra não deixar o detector se auto-avaliar:
  refiz a conta por fora, pelos 73 e-mails, procurando órfã viva depois do
  envio. **0 de 73.** Controle positivo do meu instrumento: ele acha **93 órfãs
  na base, 36 vivas**.

**O caminho do portal `/sgp` está reconciliando certo hoje.** O ramo nunca
disparou porque não houve o que relatar. Essa metade do `#282` está saudável, e
agora está medido em vez de presumido.

---

## 2. ❌ RETRATADO — "o detector acusaria trial não pago" era MEU ERRO

> **Esta seção inteira está errada e fica aqui só para o histórico. Leia a §2-B
> logo abaixo, que é a medição certa.** Eu publiquei este número no grupo antes
> de fechar a apuração, e tive que corrigir 40 minutos depois. O que segue é o
> que eu escrevi; a refutação vem em seguida.

Fui olhar **por que** nunca disparou e achei o contrário: ele dispararia errado.

`orfasQueSobraram()` (`sgp/reconciliacao.ts`) filtra por **duas** condições —
`entitlementValeAcesso && entitlementDaPlataforma` — e **não pergunta se a pessoa
pagou**.

Essa é exatamente a lição que a casa aprendeu em **08/09, um dia depois** deste
detector ser escrito, e que está gravada em `acesso-regra.ts` dentro de
`compradorMereceConvite`: a condição (2) `pagouAssinatura` nasceu porque *"7 dos
13 órfãos eram trial de R$ 0 cancelado ou boleto nunca pago"*, e o comentário de
lá nomeia a armadilha: *"`access_until` no futuro num trial cancelado é a
armadilha acesso vivo ≠ pagou"*. **As duas réguas da casa divergiram e ninguém
percebeu.**

Reproduzindo em código o filtro exato do detector, hoje, na produção:

| | |
|---|---|
| órfãs que passam pelas 2 condições atuais | **22** |
| alarme legítimo (pagou de verdade) | **11** |
| **falso positivo** | **11 → 50%** |

Os 11 falsos têm a **mesma forma, sem exceção**: assinatura FastCloner com
`rec#1 = R$ 0 COMPLETE` (trial) e `rec#2 = R$ 97 OVERDUE` (a cobrança existe, o
dinheiro nunca entrou).

**Não acreditei só no nosso banco** (lição de 14/09: `payment_events` é cego a
~46% dos compradores de SGP). Conferi 3 dos 11 na **Hotmart viva**
(`pagou_de_verdade.cjs`): `paulosbs1604`, `neto_rocha`, `gabrielalouly` — **3/3
batem**. Cruzamento independente: `rodrigo.limas.1978`, que o meu filtro põe do
lado **pagante**, é o mesmo do `#305`, cujo título diz "pagou R$ 97". As duas
fontes concordam **nos dois sentidos**.

**Controle negativo**, que é o que impede o conserto de virar mordaça:
`max@md2net.com.br` — vítima **real** deste cartão, restituída em 06/09 — tem
`PURCHASE_APPROVED R$ 97 APPROVED` → `eventoEhPagamento = true`. Ele **continua
passando**. O filtro separa, não silencia.

**Estado: latente, não consumado.** Nenhum chamado falso foi aberto, porque
nenhum dos 11 passou pelo envio do `/sgp` depois do merge. Digo assim de
propósito pra ninguém herdar *"o detector está enchendo a fila de lixo"*, que
não é verdade hoje.

Card pro coder: **`65056482`**, escopo estreito (só a condição de pagamento,
importando o `eventoEhPagamento` que já existe — nada de segunda cópia da
régua), com exigência de teste dos **dois** lados. **Não fechei por card
criado:** card criado não é código em produção, e só a main deploya.

---

## 2-B. ✅ A medição certa: a condição de pagamento JÁ EXISTE. Eu errei.

**A terceira condição não falta.** Ela não está em `orfasQueSobraram()`
(`sgp/reconciliacao.ts`), que é onde eu olhei — está uma camada abaixo, em
`diagnosticarClaim()` (`sgp/reconciliacao-pure.ts`), cuja **primeira linha** é:

```ts
const pagas = e.orfas.filter((o) => entitlementFoiPago(o.raw_event));
if (!pagas.length && !erro) return null;
```

**Como eu errei.** Li `reconciliacao.ts` e parei ali. O cabeçalho **daquele mesmo
arquivo** diz, na terceira linha: *"A decisão (o que é falha, o que escrever)
mora em `reconciliacao-pure.ts`. Aqui fica só o I/O"*. O arquivo me disse onde
estava a decisão e eu não segui o ponteiro. **Medi o primeiro estágio de um
pipeline de dois e tratei o resultado do estágio 1 como saída do sistema.**

Medição refeita por mim, com script próprio, não herdada:

| etapa | passam |
|---|---|
| órfãs `user_id IS NULL` | 93 |
| A) as 2 condições de `orfasQueSobraram` | **22** ← meu número, certo |
| B) + `entitlementFoiPago` — **o que realmente abre chamado** | **7** |

Os 7 são pagamento de verdade, todos `COMPLETED`: `ezwaymotors` (20),
`scandovieri41` (97), `josephgois` (97), `caplastica` (97), `isaias.enf` (97),
`herysilva.27` (22), `rodrigo.limas.1978` (97).

E os 3 que apresentei como **prova** do falso positivo — `paulosbs1604`,
`neto_rocha`, `gabrielalouly` — têm `raw_event` com **valor = 0**, logo
`entitlementFoiPago` devolve `false` e eles **já são silenciosos hoje**. A minha
própria prova, lida até o fim, refutava a minha tese.

**Efeito de ter implementado o que pedi: zero.** 7 chamados antes, 7 depois, mais
uma consulta ao Supabase por criação de conta, dentro do caminho que o aluno
espera na tela.

**Quem pegou o erro: o coder** (card `65056482`). Mediu a produção antes de
escrever código, viu que a premissa não sobrevivia e **recusou abrir o PR**,
reportando com prova. Se tivesse obedecido o cartão, teria subido código inútil
no caminho de criação de conta do aluno com a minha assinatura em cima. Conferi
a refutação por conta própria antes de aceitar: os três números (93 / 22 / 7)
batem. **Nenhuma linha foi para produção.**

**O único achado que sobrevive corre para o outro lado — é falso NEGATIVO.**
4 órfãs (`jkakorio`, `zambiasitiago`, `alexmultiliverpool`, `tisse.sa`) dão
`entitlementFoiPago=false` por **ausência de payload**, não de pagamento:
conferi que o `raw_event` delas não tem a chave `purchase` (é payload de
`SUBSCRIPTION_CANCELLATION` — `product`, `subscriber`, `subscription`,
`date_next_charge`, `cancellation_date`, `actual_recurrence_value`). Pagaram,
estão `canceled` com janela futura. **Não vira conserto agora**, e digo por quê
pra ninguém redescobrir: (a) as 4 **não têm conta**, e este detector só roda na
criação de conta pelo `/sgp` — ele nunca as veria; (b) `tisse.sa` e `jkakorio`
já estão nomeados no comentário de `acesso-regra.ts` como pagantes sem conta
tratados pelo sweeper `orphan-outreach`.

**A lição.** Quando um arquivo diz no cabeçalho onde mora a decisão, vá até lá
antes de afirmar que a decisão não existe. E eu violei a minha própria regra:
publiquei o número no grupo **antes** de fechar a apuração. Nas rondas boas desta
semana eu matei a hipótese antes de publicar; nesta não matei, e o grupo recebeu
um "50% de alarme falso" que não existe. Corrigido no grupo e no incidente.

---

## 3. 🔴 A carta que a casa mandou em 28/08 era falsa quando saiu

Dos 36 órfãos vivos, **um** tem conta nossa com o mesmo e-mail: Paulo Roberto de
Oliveira, `paulosbs1604@gmail.com` (perfil `2306a77d`, nascido no lote de 04/09).
O caso é pior que a linha de entitlement.

- **Hotmart viva:** comprou o **Sistema de Geração Pronto em 11/08 por
  R$ 741,00** (`HP4193831928`), mais Fábrica R$ 368,64 e Comunidade R$ 1.803,60.
- **Nosso banco hoje:** 0 voz, 0 crédito, 0 pedido no `/sgp`, sem acesso,
  `last_sign_in_at` vazio — **nunca logou**.
- Em **28/08** a casa mandou a ele três e-mails (Enviados uid 250, 251, 252), o
  último: *"Sua plataforma está pronta! Já configuramos sua imagem e sua voz na
  FastCloner e testamos: está funcionando."*
- **Medido em `auth.users`: a conta dele foi criada em 04/09 16:58:52.** Ou
  seja, em 28/08, quando a casa afirmou que estava tudo configurado **e
  testado**, ele **não tinha conta nenhuma**. A carta era falsa no instante em
  que saiu.
- Sete dias depois (uid 950), a mesma casa escreveu *"a sua conta já está
  criada, defina a senha e **envie** o material"* — isto é, comece do zero.
  **Duas versões nossas, contraditórias, com 7 dias de distância.**

**Escrevi a ele hoje** (regra 8, individual, decisão minha). Enviados **uid
2505**, cópia confirmada na 1ª tentativa, registrado em `emails_enviados` com
origem `ronda-manual` — o que de quebra **confirma em uso** o fix do `#101` que
entrou na main hoje (`366e1cd`). Assumi o erro de 28/08 sem desculpa, disse que
o link de 04/09 venceu, e mandei o caminho que **funciona sem aquele link**: o
portal `/sgp`, que pede só um código de 6 dígitos e não exige login. Não é
teoria — a Walsicleia, que comprou 21/08 (antes do portal existir), achou o
portal sozinha e completou o ciclo em 11/09.

**Não prometi prazo, crédito nem plataforma.** A assinatura dele é trial não pago
(`rec#2 OVERDUE`), então dizer qualquer coisa sobre acesso seria inventar.

---

## 4. O lote de 04/09 medido por inteiro — e uma hipótese minha derrubada

A nota de 15/09 mediu os lotes de 14/08 e 22/08 e deixou o de 04/09, que é o
deste cartão, sem a mesma conta. Fiz:

```
349 contas criadas na janela 15h–17h30Z de 04/09
327 nunca logaram · 339 sem voz nenhuma · 334 sem nenhum pedido no /sgp
*** 321 acumulam as três coisas ***
(controle: 28 NÃO acumulam — o filtro não pega todo mundo por construção)
```

**Minha hipótese, e ela está errada.** Achei que a causa fosse a **validade do
link**: a carta manda *"defina a sua senha (link pessoal, válido por tempo
limitado)"* e o recovery dura ~4 dias, então quem demorasse acharia a porta
fechada. Testei medindo **quando** agiu quem agiu, e o dado refuta: dos 16
pedidos no `/sgp` feitos por gente do lote, a maioria é **depois** da validade —
d+4,9 · d+5,0 · d+5,3 · d+5,9 (quatro) · d+6,2 · d+6,8 · d+7,0 · d+7,1 · d+7,2 ·
**d+10,8**. Os acessos também se espalham até d+11. O link vencido **não é o
portão**, porque o portal `/sgp` não exige login — identifica por código de 6
dígitos. Fica registrado como **hipótese testada e descartada**, como a de 15/09
fez com o `recovery_sent_at`.

**O que sobra, honestamente:** 321 compradores de SGP com a esteira parada em
zero há 12 dias, e **eu não sei quanto disso é dinheiro nosso a dever**. Não medi
os 321 contra a Hotmart viva (são 321 chamadas) e **não vou tratar "não logou"
como "foi lesado"** — a nota de 15/09 já avisou que *"SEM PAGAMENTO NESTE
ENDEREÇO" não é "nunca pagou"*. O que está medido é a **forma**, não o valor.

---

## Fim de ronda

- `#282` (`03e7b34b`): **continua investigating**. Pernas que sobram: (a) a
  medição de dinheiro dos 321 do lote de 04/09; (b) o `reconcileUserEntitlements`
  que não checa o `error` do UPDATE (apontado em 07/09, ainda de pé). A perna
  (c) que eu abri hoje **não existe** — ver §2-B.
- **Pergunta de 8 dias respondida:** o ramo do detector nunca disparou porque
  não havia o que relatar — 73 envios, 0 órfãs, com 3 controles.
- 🔴 **O "defeito novo" que eu anunciei era erro MEU.** A condição de pagamento
  já existe, em `reconciliacao-pure.ts`. O número certo é 22 → **7**, e os 7 são
  pagantes de verdade. Publiquei o errado no grupo e corrigi 40 min depois.
  **Nenhuma linha foi para produção** — o coder mediu antes de codar e recusou o
  PR. Ver §2-B.
- **Aluno avisado: 1** (Paulo, uid 2505 confirmado). **E-mail em massa: nenhum.**
- **Crédito devolvido: nenhum** — nenhum crédito era devido neste cartão.
- **Código novo em produção: nenhum.** Nenhum PR mergeado nem aberto nesta ronda.
- **GPU gasta: nenhuma. Migration aplicada: nenhuma. Assinatura/acesso/plano
  mexidos: nenhum.** Não vinculei nem o entitlement do Paulo — é trial não pago,
  e adotá-lo daria `plan=pro` a quem não pagou.
- Números que eu **matei antes** de publicar: *"o link de recovery vencido trava
  o lote"* (§4) e *"o detector nunca rodou"* (§1 — rodou 73 vezes).
- Número que eu **NÃO matei a tempo** e tive que retratar: *"50% de falso
  positivo no detector"* (§2 → §2-B). É a falha desta ronda.
- Número que **não é meu pra resolver**: o dinheiro dos 321 do lote de 04/09 —
  precisa de amostragem contra a Hotmart viva.
- `#11`, `#15`, `#99`, `#223`, `#226`, `#234`, `#246`, `#249`, `#250`, `#263`,
  `#270`: **não toquei.** Seguem em decisão do Johnny ou esperando aluno. O
  `#99` tem **prazo em 19/09 12:00Z**.
- Aviso do grupo: enviado por `notify-grupo.sh`, só fato consumado.
