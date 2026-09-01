# Ronda das falhas — 31/08/2026, 17h20–18h20 UTC (Frank)

Método serial (regra 8, ordem de 21/08). Ordem de 29/08 respeitada: **nada da
planilha foi lido, escrito, classificado ou reprocessado**; nenhum incidente de
causa-planilha foi aberto, reaberto ou comentado. Canal: tudo no **grupo**
(`notify-grupo.sh`), conforme a ordem de 31/08.

## Placar

- Fila no início: **11 investigating + 4 aguardando_aluno**.
- Fila no fim: **13 investigating + 2 aguardando_aluno**. Não abri nem fechei
  incidente — **dois voltaram de `aguardando_aluno` para `investigating`**
  porque a bola nunca foi do aluno.
- Fechados como `fixed`: **0**.
- Alunos respondidos: **2** (#202 Vinícius, #196 Liliane) — os dois por
  **retratação**.
- Fix subido: **0**. (O #138 da ronda anterior segue OPEN.)
- Incidentes cuja premissa mudou por medição desta ronda: **5**
  (#202, #196, #173, #205, #207).

---

## O caso serial: nós dissemos a um cliente de R$ 2.697,60 que a compra dele não existia

Peguei o **#202** porque a varredura o mostrava em `aguardando_aluno` — a
etiqueta que significa "a bola é dele". Fui conferir o que exatamente tínhamos
pedido a ele, e o que encontrei foi um e-mail **meu**, de hoje de manhã.

### O que eu afirmei às 10h46Z (uid 364), palavra por palavra

> *"na conta do e-mail vlorandi@gmail.com não existe nenhuma compra
> registrada"*

E pedi a ele código de transação, e-mail alternativo ou CPF — para **provar**.

### O que a Hotmart responde, no mesmo e-mail

| data | valor | status | transação | produto |
|---|---|---|---|---|
| 29/08 | R$ 297,00 | APPROVED | HP3517088140 | Fábrica de Conteúdo Invisível |
| 29/08 | R$ 597,00 | APPROVED | HP2540995505 | Sistema de Geração Pronto |
| 30/08 | R$ 1.803,60 | APPROVED | HP0167002846 | Comunidade Presença Lucrativa |

**R$ 2.697,60, três compras aprovadas, no próprio e-mail dele.** Ele escreveu
em 30/08 23:47Z dizendo que tinha pagado *"ontem, no cartão"*. 29/08 é
exatamente ontem. **Ele estava certo em cada palavra.**

### O agravante que é só meu

Três agentes erraram o mesmo alvo (Vigia 00h, Executor 00h25, eu 10h46), todos
pelo `pagou_de_verdade.cjs` cego — isso é a causa herdada do #173, medida ontem
às 17h. Mas o meu caso tem um detalhe pior: eu **fiz tudo certo de método**.
Paginei 1.695 profiles, paginei 4.965 payment_events, imprimi o `error` cru,
escapei de um zero falso do 42703 — e ainda assim concluí *"não existe pagamento
nosso que deixou de virar crédito"*.

A varredura estava correta e a conclusão errada, porque a pergunta certa não
estava em nenhuma das duas tabelas: estava num endpoint que eu não consultei.
**Rigor de método não salva de instrumento cego.** É a lição desta ronda.

### A segunda vítima da mesma cegueira: #196

Mesma história, 8 dias antes. O chamado se chama *"aluna **diz** que pagou"*, e
a nota do Vigia grifou que *"isso é o que ELA disse, não o que o dado diz"*.

O dado dizia: **R$ 694,00**, duas compras COMPLETE em 22/08
(HP2507595159 · HP3369432695), no próprio e-mail dela. Pedimos comprovante a
quem já tinha pagado.

---

## A pergunta que a ronda das 17h deixou aberta, agora com número

A ronda anterior escreveu: *"quantas das contas leem 'nunca pagou' sendo
pagantes? Não estimei."* Estimar por regra de três estava fora de questão, então
**virei a pergunta**: em vez de varrer 1.712 contas contra a Hotmart uma a uma,
varri as **vendas** da conta Hotmart inteira e cruzei com a nossa base.

10.601 vendas em 22 páginas (paginado), 9.653 pagas pela régua que vale.
Cruzamento com `profiles` também paginado — o PostgREST corta em 1000 em
silêncio.

### O catálogo, que não estava escrito em lugar nenhum

| vendas | total | pessoas | produto | tipo |
|---|---|---|---|---|
| 6.753 | R$ 5.698.879,50 | 6.727 | Fábrica de Conteúdo Invisível | AVULSA |
| 1.922 | R$ 3.312.712,42 | 1.903 | Sistema de Geração Pronto | AVULSA |
| 557 | R$ 354.091,97 | 432 | **FastCloner** | **assinatura** |
| 215 | R$ 20.218,44 | 215 | Gerador de Ganchos Inteligente | AVULSA |
| 190 | R$ 309.605,51 | 189 | Comunidade Presença Lucrativa | AVULSA |
| 16 | R$ 65.440,73 | 16 | Programa AI Content | AVULSA |

**O FastCloner é 1 dos 6 produtos e o único que é assinatura.** A régua olhava
só para ele. Não era "um endpoint faltando": era a pergunta cobrindo **um sexto
do negócio** e sendo chamada, no `README/ordens`, de *"a fonte de verdade"*.

### O tamanho

- **6.518** pessoas pagaram somente avulso → todas liam `NUNCA PAGOU`
- **528** dessas têm conta no FastCloner
- **370** têm conta **e** estão sem acesso vivo
- **301** dessas com saldo **zero**

### O que esses números NÃO dizem — e isso importa mais que eles

1. **370 não é "370 alunos tiveram crédito negado".** Crédito só foi negado a
   quem chegou a ser avaliado. Não afirmo dano que não medi.
2. **370 não é uma dívida.** Compra de curso não é assinatura do FastCloner. O
   que uma dá direito na outra é decisão comercial. Eu entrego a medição.
3. O que 370 **é**: a população exposta — gente que pagou a casa, tem conta
   aqui, está sem acesso, e que a nossa base descreveria como "nunca pagou".

### O dano que eu consigo provar, caso a caso: quatro

| # | aluno | pagou | o que nós dissemos |
|---|---|---|---|
| #173 | Johnathan | R$ 2.391,00 | pedimos prova **duas** vezes (30 e 31/08) |
| #202 | Vinícius | R$ 2.697,60 | *"não existe nenhuma compra registrada"* |
| #196 | Liliane | R$ 694,00 | pedimos comprovante; chamado = *"diz que pagou"* |
| #205/#208 | Cristina | R$ 185,61 | decisão enunciada como *"cortesia a quem não pagou"* |

**R$ 5.968,21** de gente a quem a nossa base disse "você nunca pagou".

**A assimetria que explica a invisibilidade:** só descobre quem reclama. Dos
370, quatro reclamaram alto o bastante para virar chamado. Os outros 366 nunca
souberam que existia uma decisão sobre eles — e nós também não.

---

## Não são quatro mal-entendidos. É um funil.

Johnathan, Vinícius, Liliane e Cristina compraram **os mesmos dois produtos**
(Fábrica de Conteúdo Invisível + Sistema de Geração Pronto) e desembocaram no
FastCloner esperando acesso. O Luciano (#99) comprou os mesmos dois em 18/08 e
**depois** assinou o FastCloner — é o caminho que a régua enxergava.

Isso muda o enunciado da decisão pendente: não é sobre uma aluna, é uma
**política**. Respondida uma vez, fecha **#173, #196, #202, #205, #208 e #209**
e define o que dizer aos outros 366.

---

## O que eu fiz

1. **Escrevi ao Vinícius (#202)** — 17:47Z, Enviados uid 388, bcc `suporte@`,
   cópia conferida na volta, nenhum bounce (o do #201 voltou em ~2s, então
   ausência é sinal). Retratação explícita, as 3 transações listadas, **por que**
   não víamos, "você não precisa mandar nada", desculpa por ter pedido prova.
2. **Escrevi à Liliane (#196)** — 17:49Z, mesma disciplina, cópia conferida.
   Retratação + o material dela (3 imagens, voz de 40min) reconfirmado.
3. **Nos dois: nada de crédito, acesso, GPU ou prazo inventado.** Registrei em
   ambos o compromisso **com dono** de escrever de volta quando houver definição
   — e de escrever mesmo se demorar. Está nas notas para a próxima ronda herdar.
4. **Anotei 5 incidentes** (#202, #196, #173, #205, #207) com a medição e o
   limite do que ela decide.
5. **`aguardando_aluno` → `investigating` em #202 e #196.** A etiqueta estava
   mentindo: dizia que a bola era do aluno, quando fomos nós que a colocamos lá
   em cima de uma leitura errada.

## O furo da ronda anterior que eu registro em vez de esconder

**#207 Márcio respondeu às 14:54Z** (uid 387/388) e a ronda das 17h escreveu
*"bola com o aluno desde ontem"*. A resposta já estava na caixa.

E a resposta dele **decide o conserto**: *"a fala não parece natural... **a voz
está exatamente como é a minha**"*. Ou seja, das 5 opções que oferecemos ele
escolheu "soa robótico/lendo" e **excluiu** "não parece minha voz". Isso
confirma a nota do Vigia das 16h e tem consequência de dinheiro: **retreinar a
voz dele não conserta**, porque retreino ataca timbre — a parte que ele diz
estar certa. Prometemos retreino grátis; cumprir como está seria gastar GPU da
casa para entregar o mesmo defeito. **Não disparei retreino, não abri card.**
Deixei o próximo passo escrito com dono (baixar o anexo, medir pelo
`medir_pausas_da_entrega.cjs`, só então responder).

## Por que não peguei os outros

- **#99 Luciano** — decisão dos R$ 97 é do Johnny; prazo fecha na virada. Medi
  um fato novo com a régua corrigida: ele também comprou R$ 894 do curso em
  18/08, então é cliente de **R$ 991**, não de R$ 97.
- **#200, #201, #203, #209, #210** — travados em merge (#132, #133, #134, #136,
  #137).
- **#192** — precisa de ouvido humano; #135 é decisão binária.
- **#197, #206** — `aguardando_aluno` legítimo, nenhum com 7d+ de silêncio.
- **`luanmarcal.com@gmail.com`** — segue não tocado (perímetro da ordem de
  29/08).

## Limites — o que eu NÃO posso afirmar

1. Não sei quantos dos 370 tiveram crédito **negado**. Sei de 4.
2. Não decidi nada comercial. Compra de curso ≠ assinatura do FastCloner.
3. O censo cobre vendas desde **01/05/2026**. Compra anterior a isso não entrou.
4. Não conferi o material que o Márcio mandou (uid 388, 18,4MB) — afirmo só o
   que ele escreveu, não o que o arquivo mostra.

## Fim de ronda

`git fetch origin` + `git log --oneline origin/main..HEAD` vazio, e
`git status --short` conferido **depois** do commit (lição do log órfão das
15h). O censo ficou em `_Bugs/` (fora do git), como manda o README das
ferramentas. Nenhum código novo nesta ronda — nada preso em branch.

## Precisa de gente (nesta ordem)

1. **UMA decisão, não quatro: o que a compra do curso dá direito dentro do
   FastCloner.** Fecha 6 incidentes e define o que dizer a 366 pessoas.
2. **PR #138** — enquanto não subir, a próxima ronda mede com o instrumento
   cego e pode negar crédito a cliente pagante de novo.
3. **#99 Luciano** — vence na virada, e agora é cliente de R$ 991.
4. **#207 Márcio** — pagante, bola nossa, e o conserto certo não é retreino.
5. **#192** (ouvido humano), **#135** (decisão binária), **os 21 PRs abertos**.
