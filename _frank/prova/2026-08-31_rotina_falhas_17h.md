# Ronda das falhas — 31/08/2026, 16h40–17h20 UTC (Frank)

Método serial (regra 8, ordem de 21/08). Ordem de 29/08 respeitada: **nada da
planilha foi lido, escrito, classificado ou reprocessado**; nenhum incidente de
causa-planilha foi aberto, reaberto ou comentado; **#180 e #184 não foram
reabertos**. Canal: tudo no **grupo** (`notify-grupo.sh`), conforme a ordem de
31/08.

## Placar

- Fila no início: **11 investigating + 4 aguardando_aluno** (era 10 na ronda das
  16h; o #173 voltou pelo caminho `entregarAoTime`, por desenho, não é zumbi).
- Fila no fim: **11 investigating + 4 aguardando_aluno**. Não abri nem fechei
  incidente.
- Fechados como `fixed`: **0**.
- Alunos respondidos: **1** (Johnathan, #173).
- Fix escrito, **provado** e enviado: **1** (PR #138). **Em produção: 0.**
- Incidentes cuja **premissa** mudou por medição desta ronda: **4**
  (#173, #205, #208, #192).

---

## O achado: o nosso verificador de pagamento diz "NUNCA PAGOU" para quem pagou

Peguei o **#173** pelo serial (mais antigo acionável com aluno esperando). Era
para ser um caso de atendimento. Virou o defeito mais caro que eu já medi aqui,
e ele estava **dentro da nossa própria régua**.

### Como cheguei

O #173 tinha, das rondas anteriores, um veredito forte e bem escrito:

> *"NUNCA PAGOU, conferido em 3 fontes independentes"* — `aluno.cjs` (sem
> acesso, 0 créditos, 0 compras), `pagou_de_verdade.cjs` (Hotmart viva) e
> `payment_events` (por e-mail e por payload).

O aluno, no uid 390 de hoje, respondia à nossa pergunta com uma frase só:
*"Comprei o acesso pelo johnathan.ppires@gmail.com"*. Duas coisas
inconciliáveis, e a nossa era a que tinha três fontes. Fui ler **o código da
régua** antes de aceitar que o aluno estava enganado.

`pagou_de_verdade.cjs:45` pergunta à Hotmart **um endpoint só**:
`/subscriptions?subscriber_email=`.

**Compra avulsa não é assinatura.** `UNIQUE_PAYMENT` e `MULTIPLE_PAYMENTS` não
aparecem em `/subscriptions` — nunca apareceram. A régua não estava medindo
errado: ela não estava **fazendo a pergunta**.

### As três fontes não eram independentes

Esse é o ponto que fez o erro sobreviver a várias rondas e a dois agentes. As
três olham superfícies diferentes do **mesmo** buraco:

| fonte | o que ela olha | por que dá zero aqui |
|---|---|---|
| `aluno.cjs` | a **nossa** conta | a compra avulsa não vira linha nossa |
| `pagou_de_verdade.cjs` | `/subscriptions` | avulsa não é assinatura |
| `payment_events` | webhook `PURCHASE_APPROVED` | não chega para essas vendas |

Três zeros que **concordam** parecem confirmação. Eram a mesma cegueira contada
três vezes. Foi isso, e não falta de cuidado, que fez o veredito parecer sólido.

### O que a pergunta certa devolve

`/sales/history?buyer_email=`, mesmo token, mesma conta Hotmart, mesma regra de
pagamento (`value > 0` **E** `APPROVED`/`COMPLETE`):

| aluno | a nossa régua | a Hotmart |
|---|---|---|
| `johnathan.ppires@gmail.com` (#173) | NUNCA PAGOU | **R$ 2.391,00** — 3 compras |
| `comercial@roteironamao.com` (#205/#208) | NUNCA PAGOU | **R$ 185,61** — 2 compras |
| `70rrosusa@gmail.com` (#192) | NUNCA PAGOU | **R$ 684,92** — 3 compras |
| `luanmarcal.com@gmail.com` | PAGOU (R$ 17) | **+ R$ 115,90** que não víamos |

Johnathan: 27/08, PIX, todas `APPROVED` — R$ 297 (`HP2705120177`), R$ 597
(`HP3595813880`), R$ 1.497 (`HP0272337557`).

**Ele estava certo e nós estávamos errados.** E nós pedimos a ele, **duas
vezes** (30/08 e 31/08), que provasse uma compra que estava lá o tempo todo.

### É a segunda vez que o mesmo formato de falha nos pega

O `README/ordens` já carrega a `profiles.ja_pagou` **suspensa** por ler "nunca
pagou" para 1.515 de 1.515 perfis. Este é o mesmo formato — **zero vindo de uma
pergunta errada sendo lido como resposta** — com um agravante: o `ja_pagou`
está marcado como proibido, e o `pagou_de_verdade.cjs` está marcado, no mesmo
arquivo, como **"a fonte de verdade"**. O instrumento em que mais confiamos era
o que estava cego.

---

## O que eu fiz

### 1. Escrevi ao aluno (regra 8, e-mail individual)

Enviado 16h5xZ, bcc `suporte@`, **prova lida antes** (cópia para a nossa caixa,
uid 386, texto conferido íntegro na volta). Conteúdo: ele estava certo; as três
transações listadas com valor e número do pedido; **por que** não víamos (a
régua só olhava assinatura); desculpa explícita por tê-lo feito justificar o que
já tinha feito certo; **não precisa mandar mais nada**.

**O que eu deliberadamente NÃO coloquei: data para a voz dele.** Promessa sem
dono foi o pecado original deste caso — em 29/08 dissemos "nós mesmos rodamos" e
ninguém rodou. Repetir isso agora, ainda que com boa notícia junto, seria trocar
uma mentira por outra. Escrevi que o pagamento está resolvido e que a liberação
depende de uma pessoa, sem inventar prazo.

### 2. Consertei o instrumento — PR #138, commit `d4d04c5`

Branch `feat/pagou-enxerga-compra-avulsa`.

1. Terceira fonte, `/sales/history` — onde a compra avulsa mora.
2. `HTTP != 200` ou corpo não-JSON viram **erro**, nunca zero silencioso. Zero
   vindo de falha não pode virar "não pagou": **é a raiz exata deste bug.**
3. **O veredito deixou de ser um bit.** "Pagou a assinatura do FastCloner" e
   "comprou um curso avulso" decidem coisas diferentes e agora saem separados,
   com um aviso explícito quando é só avulso. Colapsar os dois num sim/não foi o
   que produziu o engano — o defeito não era só a fonte faltando, era a pergunta
   ter uma resposta binária que ela não comporta.
4. `NUNCA PAGOU` só é impresso com as **três** fontes vazias.
5. Avulsa só quando a Hotmart diz `is_subscription === false`; `undefined` não
   vira avulsa por omissão.

**Provado nas duas pontas, com chamada real à API:** os três alunos passam a ler
`PAGOU` com transação, valor e produto; e um e-mail inexistente **continua**
lendo `NUNCA PAGOU (nenhuma das 3 fontes)`. A segunda ponta é a que importa: um
instrumento que sempre "acha" trocaria um defeito por outro e o teste diria que
passou. Marcelo (assinatura + avulsa) serve de terceiro controle — a parte de
assinatura bate exatamente com o que a versão antiga imprimia, então o fix
**soma**, não reescreve.

### 3. Anotei os quatro incidentes afetados

`#173` (954ca6c9), `#205` (a7c0311b), `#208` (ee0fe55d), `#192` (ae0061d5) —
cada um com a medição, a transação e o limite do que ela decide.

---

## O que isso muda na Cristina (#205/#208) — e é o item mais urgente da fila

A decisão pendente do Johnny está formulada assim: *"dar ou não 100.000 créditos
de **cortesia** a uma aluna em período de teste, que **acha** que pagou"*.

**Ela pagou R$ 185,61**, duas compras aprovadas em 27/08.

Isso **não** decide o caso, e eu não decidi nada: continua sendo decisão
comercial se a compra avulsa do curso dá direito a crédito dentro do FastCloner.
Não liberei crédito, não dei acesso, não escrevi a ela.

O que muda é **o enunciado**:

> não é *"dar 100k de graça a quem não pagou"*
> é *"definir o que o cliente que pagou R$ 185,61 tem direito dentro do
> FastCloner"*

São decisões diferentes, e a segunda é a verdadeira. A frase dela no uid 385
(*"o entendimento que eu tinha, a partir do curso que comprei, era de que,
enviando o material, eu teria acesso ao resultado"*) deixa de ser mal-entendido
de quem não pagou e vira pergunta legítima de cliente pagante.

O Vigia tinha visto o padrão ("dois alunos no mesmo dia com a mesma leitura") e
concluído que era comunicação. Com a medição de hoje, a leitura muda: os dois
**pagaram**, e talvez o que eles entenderam do que compraram esteja mais perto
do certo do que o que a nossa base sabia sobre eles.

---

## Limites do que eu medi — o que eu NÃO posso afirmar

Honestidade sobre o tamanho do buraco, porque a tentação aqui é grande:

1. **Não medi a base inteira.** Conferi **7** e-mails, todos da fila de hoje.
   Que **6 de 7** tivessem compra avulsa invisível é forte, mas é amostra de
   conveniência, não censo. **Quantas das 1.515 contas estão nessa situação eu
   não sei**, e não vou estimar por regra de três.
2. **Não sei se alguém teve crédito NEGADO por causa disso.** É a pergunta que
   importa e ela exige varrer decisões passadas, não só contas. Não deu tempo
   nesta ronda e eu não vou afirmar dano que não medi.
3. **Não decidi nada de comercial.** Compra do curso ≠ assinatura do FastCloner.
   O que uma dá direito na outra é do Johnny; eu entrego a medição.

---

## Por que não peguei os outros

- **#99 Luciano** — vence hoje na virada; decisão dos R$ 97 é do Johnny.
- **#200, #201, #203, #209** — travados em merge (#132, #133, #134, #136).
- **#207 Márcio** — bola com o aluno desde 15h25Z de ontem.
- **#210** — meu, mas o passo seguinte é o merge do #137.
- **#196, #197, #202, #206** — `aguardando_aluno`, nenhum com 7d+ de silêncio.
- **`luanmarcal.com@gmail.com`** — segue **não tocado de propósito** (perímetro
  da ordem de 29/08). O único fato novo que registro é o de dinheiro: ele também
  tem R$ 115,90 de compra avulsa que a régua não via. Não abri incidente, não
  reprocessei, não classifiquei.

## Fim de ronda

`git fetch origin` + `git log --oneline origin/main..HEAD` conferido, e
`git status --short` também (a lição do log órfão da ronda das 15h). Código em
`feat/pagou-enxerga-compra-avulsa` (PR #138); nada de fix preso em branch sem PR.
Este log vai direto na `main` — e desta vez o `git status` é conferido **depois**
do commit, não antes.

## Precisa de gente (nesta ordem)

1. **#205/#208 Cristina — a decisão mudou de pergunta.** Ela pagou. Se a
   resposta não vier, a ronda da manhã escreve a ela pelo compromisso já
   datado — e vai escrever dizendo que ela pagou.
2. **#173 Johnathan — R$ 2.391 e nenhum executor.** O pagamento parou de ser
   dúvida. Falta decidir o acesso e **quem roda a voz dele à mão**. Ele já foi
   avisado da verdade, sem prazo inventado.
3. **PR #138** — enquanto não subir, a próxima ronda mede com o instrumento
   cego e pode negar crédito a aluno pagante. É o único PR da fila que protege
   dinheiro de cliente.
4. **A pergunta que ficou aberta:** quantas das 1.515 contas leem "nunca pagou"
   sendo pagantes, e alguma delas já teve crédito negado por isso? Merece uma
   ronda inteira. Não estimei.
5. **#99 Luciano** (vence hoje), **#135** (decisão binária), **#192** (alguém
   ouvir o timbre), **os 21 PRs abertos**.
