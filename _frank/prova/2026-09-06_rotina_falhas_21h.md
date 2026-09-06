# Ronda das falhas — 06/09, ~21hZ (18h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** incidente e ele me levou a um segundo da mesma classe.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: ordem de 31/08 — o aviso saiu no **GRUPO**,
nada foi pro privado.

---

## 0. A ronda em uma linha

**Dois alunos que pagaram R$ 1.427,60 juntos nunca entraram na plataforma uma
única vez — um há 22 dias, outro há 30 — e os dois estavam parados porque o
chamado dizia que a bola estava com eles. Não estava: eles nunca receberam
nada. O e-mail está morto para os dois, e o canal que funciona existe, está
conectado e alcança os dois.**

---

## 1. Qual incidente eu peguei, e por quê

Fila no início: **23 abertos**, 13 `aguardando_aluno`, 4 presos.

Pela regra 8 (o mais antigo **com aluno afetado**), os quatro mais antigos
saem: **#15, #222, #226, #234** estão presos em **decisão**, não em
investigação, e todos os quatro já tinham nota de hoje. **#237** segue
bloqueado em **identificação**. **#246** e **#254** foram levados até o fim nas
rondas das 19hZ e 20hZ.

Sobrou o **#249**, parado há **2 dias** — a nota mais velha da fila sem dono.

## 2. O que o card não dizia: ele é PAGANTE

A nota de 04/09 tratou o caso como *"conta do lote SGP, nasce sem acesso e sem
crédito, está correta assim"*. Isso é verdade sobre a conta e **esconde o que
importa**. Medido na Hotmart **viva** (`pagou_de_verdade.cjs`, valor > 0 **E**
COMPLETE/APPROVED):

| aluno | pago | quando | há quanto |
|---|---|---|---|
| Glauber (`#249`) | **R$ 694,00** (397 SGP + 297 Fábrica) | 15/08 | **22 dias** |
| Anderson (`#250`) | **R$ 733,60** (420,96 SGP + 312,64 Fábrica) | 06-07/08 | **30 dias** |

`profiles.last_seen_at = NULL` nos dois: **nenhum dos dois entrou uma vez
sequer.** As contas só nasceram em 04/09 — 20 e 28 dias depois do pagamento — e
o único e-mail de acesso bateu em bounce nos dois casos.

Pela ordem de prioridade isso é **aluno pagante travado**, que vem antes da
limpeza da fila. O card não dizia, então cinco rondas passaram por ele sem
tratá-lo como urgente.

## 3. Refuto a frase que parou o #249 por 2 dias

A nota de 04/09 encerra assim: *"AÇÃO PRO TIME DE SUPORTE (não é minha — eu não
tenho WhatsApp)"*. **Medi, e é falso.** No servidor, read-only:

- sessão WAHA `default` = **WORKING** (conectada)
- `reachoutTimelock` = **LIVRE** (a tranca da Meta pra contato frio não está ativa)
- `check-exists` do telefone do Glauber = **existe**; do Anderson = **existe**

A casa tem `wahaSendText` em `lib/agent/waha.ts`, o canal está de pé, e o
**nosso próprio e-mail de onboarding manda o aluno falar com o suporte no
WhatsApp (41) 99148-1573** — o canal é oficial e anunciado por nós.

> **A lição:** *"eu não tenho o canal X"* é uma afirmação sobre **capacidade**, e
> capacidade se **mede** antes de virar motivo pra passar a bola. Passar pro time
> humano sem medir transformou um caso de 5 minutos em 2 dias de silêncio com
> aluno pagante do outro lado — e ninguém pegou, porque anotar no card não faz
> ninguém agir.

## 4. Refuto também "caixa cheia se resolve sozinha" — testando, não supondo

A mesma nota de 04/09 classificou o Anderson como *"esse tende a resolver
sozinho e vale retentar depois"*. **Retentei hoje. Não resolveu.**

| tentativa | quando | desfecho |
|---|---|---|
| 1ª (uid 995) | 04/09 17:16Z | bounce, caixa cheia |
| 2ª (uid 1095) | 05/09 22:03Z | bounce **5 s** depois |
| **3ª (uid 1176) — minha, hoje** | 06/09 20:48Z | **bounce 20:48:42** |

Três dias corridos, três recusas, mesma causa. Mandei a terceira **justamente
pra não decidir por suposição** — e o sistema registrou o bounce sozinho
(`occurrences` 1 → 3). Enquanto a caixa estiver cheia ele não recebe **nada**
nosso: acesso, etapa, suporte.

## 5. O balde errado — o defeito de classificação que vale pros dois

O **#250** aparecia na varredura sob **"AGUARDANDO ALUNO: a bola está com ele"**.
A bola **nunca** esteve com ele: ele não recebeu uma única mensagem nossa.

Chamar de "aguardando aluno" quem nunca foi alcançado é o mesmo defeito de
fundo do #249 — **o sistema marca como respondido quem só foi ENVIADO**, e o
250 do SMTP só significa "aceitei pra fila". O aluno vira silêncio invisível, e
ninguém dá segunda tentativa em quem o quadro diz que está devendo resposta.
Passei os dois pra `investigating`, que é o que eles são de fato.

## 6. Armadilha nova, medida, pra ninguém repetir

O telefone do aluno **não está** em `sales/history` — está em `sales/users`. E lá:

> **`users[0]` é o PRODUCER, `users[1]` é o BUYER.** O `users[0]` devolveu
> `19991069105` **idêntico para os dois alunos**: é o número da **casa**
> (Starter Digital). Pegar "o primeiro telefone" mandaria a mensagem do aluno
> **pro nosso próprio número**. Filtre por `role == 'BUYER'`, nunca por índice.

Confirmado por papel, não por posição: Glauber `38999198156` (bate com o da
nota de 04/09, agora conferido na fonte viva), Anderson `11973974029` (**novo** —
ninguém tinha esse dado).

## 7. Cumpri uma promessa velha que ninguém tinha cumprido

A nota de 04/09 terminava com *"vou revarrer"* os bounces do lote de 349 contas.
**Nunca foi feito.** Revarri hoje (`--desde 4-Sep-2026`): continuam **2 alunos**,
nenhuma vítima nova apareceu, e a taxa de ~0,6% se manteve. O medo de que o
número subisse com bounce atrasado **não se confirmou** — e agora isso está
medido, não pendurado.

## 8. O que eu fiz

- **Escrevi pro Anderson** (3ª tentativa, uid 1176, cópia **CONFIRMADA** em
  Enviados). Não pedi permissão: regra 8 me autoriza e-mail individual sobre
  caso que estou tratando. Bounce confirmado 14 s depois.
- **Medi o pagamento dos dois** na Hotmart viva, não na exportação.
- **Achei e conferi os dois telefones** por papel na fonte viva.
- **Provei o canal** (sessão, tranca, existência dos dois números).
- **Revarri os bounces** do lote.
- **Corrigi a classificação** dos dois cards e anotei os dois com o que o banco
  confirmou depois de gravar (`#249` 2 → 3 notas, `#250` 5 → 6, 1 linha afetada
  cada, conferido na releitura).
- **Levei ao GRUPO** como pagante travado, com o pedido de decisão.

## 9. O que eu NÃO fiz

**Não mandei WhatsApp pros alunos.** Minha regra 8 pré-autoriza **e-mail**
individual, não WhatsApp — e pro Glauber não existe e-mail que funcione, então
no caso dele eu **não tenho canal autorizado**. Parei e levei a decisão ao
Johnny em vez de me autorizar sozinho. O texto dos dois está pronto pra
disparar.

Não cancelei, não estornei, não mexi em crédito, acesso ou plano, não apliquei
migration, não gastei GPU, não mergeei PR, não fechei nem reabri incidente, não
toquei em nada da planilha. Hotmart lida por **GET puro**; caixa por `EXAMINE` +
`BODY.PEEK`.

**Nenhum dos dois cards fecha, e eu não finjo que fecha.** O que mudou é que
agora sabemos **por quê**, **há quanto tempo**, **quanto cada um pagou** e
**qual é o único caminho que resta**.

## 10. Precisa de DECISÃO do Johnny

1. **Novo, e é o desta ronda:** posso mandar WhatsApp pro Glauber
   (`5538999198156`) e pro Anderson (`5511973974029`)? É o único canal vivo
   pros dois. Se a resposta for "o time humano faz", precisa de **alguém com
   nome** — 2 dias provaram que anotar no card não basta.
2. Seguem de antes: **#226** destrava o #234; **migration 82** destrava o #15;
   **#222** reenquadrar ou fechar; **PR #196** (18 vozes paradas) e **PR #176**
   esperando revisão. Relógios: **Diego 08/09 12hZ**, **Marcelo 11/09**.

## 11. A lição que fica

**Um chamado pode estar parado por uma frase errada sobre nós mesmos, não sobre
o problema.** O #249 não estava bloqueado por falta de informação nem por
decisão difícil: estava bloqueado por *"eu não tenho WhatsApp"* — uma afirmação
de capacidade que ninguém conferiu e que custou 2 dias de silêncio a um aluno
que tinha pago R$ 694 e nunca conseguiu entrar. **Antes de passar a bola por não
ter um recurso, gaste 30 segundos verificando se você realmente não tem.**

A segunda: **"tende a resolver sozinho" é uma previsão, e previsão não fecha
caso.** Custava uma tentativa descobrir que a caixa do Anderson estava cheia
havia três dias. Enquanto ninguém testou, ele ficou no balde de quem "está
devendo resposta" — devendo resposta a um e-mail que nunca chegou nele.
