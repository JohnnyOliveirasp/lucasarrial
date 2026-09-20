# Ronda das falhas — 20/09, ~12h40–13h45Z (Frank)

Item serial: **#343 / `ec35016e`** (Welrisson, `welrisson@gmail.com`) — o cartão
aberto com a **nota mais velha da fila inteira**, 8,7 dias sem ninguém encostar.
**Levado até o fim pela regra 8** e fechado como `fixed` — mas fechado por
**conferência**, não por conserto, e o log diz isso na cara (§3).

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — tudo foi pro **grupo**
(`notify-grupo.sh`), duas mensagens. Nada no privado do Johnny.

## Placar

- Fila: **91 → 90 abertos** · 36 em `aguardando_aluno`.
- Fechados `fixed`: **1** (#343), com nota e `resolution_note` de 678 chars.
- Alunos respondidos: **0** — e isso é deliberado, não omissão (§4).
- Crédito devolvido: **0**. Conferido no extrato que **não havia nada a
  devolver** (§2, item 5) — não é "não olhei", é "olhei e estava zerado".
- Passo fixo dos envios: **0 cartas fora da tabela** depois do corte.
- Percepção travada: **2** pelo instrumento (mais velho parado há 2,0d) ·
  **16** pela consulta crua da ordem de 17/09 (mais velho **18,7d**).
- Achado novo medido: **22 dos 90** cartões abertos param em decisão do Johnny
  (§5).

---

## 0. Passos fixos, antes de qualquer coisa

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): **839**
cartas lidas da pasta `Sent`, 762 já tinham linha, 77 fora da janela do corte,
**0 escrituráveis, 0 recusadas**. A contagem fecha (839 = 839).

O instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue **passivo**.

(Ronda das 13h: 823 lidas / 746 com linha. **+16 cartas, todas já com linha.**)

As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão, como o README manda.

**Percepção travada**, os dois números, sem escolher o menor: instrumento **2**
(mais velho parado há 2,0d); SQL cru da ordem de 17/09 **16** (mais velho
**18,7d**, #226). Os dois cartões do instrumento foram lidos: o #450 está
marcado como *não* sendo caso de percepção e o #473 espera a **aluna** ouvir o
áudio refeito. Nenhum dos dois é despacho pendente meu.

---

## 1. Por que este cartão — e por que **não** por idade bruta

Conferi os mais velhos **um por um, lendo a última nota de cada**, sem herdar o
veredito da ronda das 13h. Seguem travados em decisão que não é minha:

| cartão | idade | por que não move |
|---|---|---|
| #15 `d3d8d1b2` | 52,0d | risco aceito pelo Johnny |
| #226 `702cc916` | 18,7d | produto |
| #234 `f8587cef` | 17,8d | aval de GPU |
| #249 / #250 | 15,8d | o "pode" pra telefone/WhatsApp |
| #263 `5c68eb33` | 15,0d | definição dos R$ 97 |
| #290 `446c3ae4` | 13,6d | o "pode" pro lote dos 8, há 16 dias |

**Uma hipótese minha que morreu na medição, e fica registrada porque custou
turnos.** A nota de 16/09 do #290 dizia que o PR #316 **não estava em
produção** ("branch não deploya"). Isso casa exatamente com a armadilha que o
manual manda caçar no fim de ronda — fix de aluno preso em branch, os 9h de
19/08. Fui atrás achando que tinha encontrado um. **Não tinha:** `gh pr view
316` diz `MERGED`, e o #434 (`2614845d`) já está `fixed` desde 17/09, fechado
por uma ronda posterior. A nota do #290 é que estava **velha**. Conferi em vez
de acreditar, e o resultado foi "não há nada aqui" — que é resposta legítima.

**O critério que usei no lugar da idade bruta** é o que a ronda de 14/09 provou
melhor: o cartão aberto com a **última anotação mais antiga**. O #343 tinha
nota parada em **11/09 18:52Z — 8,7 dias**. Idade bruta esconde esse cartão
(ele é de 10/09, meio da fila); "há quanto tempo ninguém olha" o traz pro topo
na hora.

---

## 2. O que o cartão era, e as 7 conferências

Welrisson pediu atendente humano no chat do app (2ª ocorrência). A nota do
Executor ligava o mesmo e-mail a outras três pernas: **#326** (SGP travado na
tela 1), **#330** (compra do SGP paga sem entrega) e **#341** (saldo negativo
de **-10.525** debitado pelo onboarding do SGP).

Em 11/09 o suporte@ deu baixa de "aluno já respondido" (WhatsApp), com o aviso
**correto** de que *"responder o aluno e consertar o defeito são duas coisas
diferentes"*. Por isso ninguém fechou — e, por isso também, **ninguém voltou**.
Ficou 8,7 dias no limbo entre "respondido" e "resolvido".

Conferi no banco, ponto a ponto:

1. **Acesso** — `plan='pro'`, `access_source='hotmart'`, `access_until` **11/10
   12:00Z**.
2. **Saldo** — 173.175 assinatura + 11.340 extra = **184.515**. Não negativo.
3. **O -10.525 foi devolvido de verdade** — linha explícita em
   `credit_transactions`, `ref_type='perdao_negativo_onboarding'`, **+10.525**
   em **11/09 17:30:30Z**, `balance_after` 100.000. **Conferido por `ref_type`,
   não por `kind`** — a armadilha medida da casa. Os dois débitos que criaram o
   negativo estão lá datados (-525 avatar, -10.000 treino, ambos 09/09 22:57Z).
   Não foi **mascarado** pela recarga: a recarga de 100.000 é **outra linha**,
   com outro `ref_type`, no mesmo minuto. Essa distinção era o ponto todo.
4. **O SGP foi entregue** — `sgp_pedidos a38ed55e`, status **`pronto`**, 4 fotos
   `aprovada`, 1 áudio `aprovado` (1.865s), `voz_pronta_em` 09/09 23:03:40Z.
   As pernas #326 e #330 não descrevem mais o estado dele.
5. **Vídeo Clone** — 3 jobs, **todos `ready`**, com `video_path`, `error_message`
   vazio. As 2 falhas de 14/09 foram cobradas **e estornadas no mesmo dia**
   (`ref_type='video_clone_refund'`, -5.670/+5.670 duas vezes). **Líquido zero.**
6. **Voltou a produzir** — áudio e imagem 11/09, vídeos 14 e 15/09, `last_seen`
   **17/09 17:50Z**.
7. **Resposta humana** — dada pelo suporte@ em 11/09 por WhatsApp.

---

## 3. Por que `fixed`, e o que eu **não** estou afirmando

O pedido do cartão era *"um humano precisa falar com o aluno e resolver acesso +
saldo"*. As duas coisas aconteceram, e as três pernas materiais estão resolvidas
em produção **hoje**, conferidas acima.

**Eu não consertei nada aqui.** A casa já tinha consertado antes de mim. O que
esta ronda fez foi **conferir e tirar do limbo** um cartão que seguia aberto
só porque ninguém voltou. Isso está escrito na nota do cartão com essas
palavras, pra ninguém ler este `fixed` como trabalho técnico que não houve.

Regra 14 respeitada no sentido que importa: **não carimbei `fixed` em cima de
coisa não resolvida** — carimbei em cima de coisa resolvida que eu **verifiquei
linha a linha**, e disse quem resolveu.

**O defeito de causa não fecha aqui** e está dito na nota: **#341 /
`b633b18c`** (onboarding do SGP debita a carteira do comprador, 16 alunos)
segue aberto. O "perdão" que salvou o Welrisson é **remendo no momento da
assinatura**, não conserto: **quem não assinar depois continua com o negativo.**

---

## 4. Por que não escrevi pro aluno

Ele **já foi respondido** (11/09, WhatsApp) e está produzindo desde então
(último acesso 17/09). Carta nova aqui seria ruído — avisar alguém de que o
problema dele acabou 9 dias depois de ele já ter voltado a usar o produto não
serve ao aluno, serve ao placar. **Não conto "aluno respondido" nesta ronda.**

---

## 5. O achado da ronda: a fila não está parada por falta de trabalho

Medido hoje: **22 dos 90 cartões abertos** têm a **última nota** terminando em
espera por uma decisão do Johnny. O mais velho espera **52 dias**.

Ressalva honesta sobre o instrumento: os 22 vêm de **casamento por texto** na
última nota (`'pode' do Johnny`, `decisao COMERCIAL`, `falta UNICAMENTE`,
`levo ao grupo`…), então o número pode ter **folga pra menos** — regex acha
citação, não só bloqueio. **Os 8 do topo eu li um por um e confirmo.** Reporto
assim em vez de arredondar pra baixo.

Dois deles são **pagante parado sem nada**, e por isso foram pro grupo agora e
não no relatório da noite (a regra de prioridade manda avisar na hora):

- **#249 Glauber** — pagou **R$ 694** em 15/08 (2 compras COMPLETE), **36 dias**
  sem receber nada. E-mail **morto em definitivo**; o único canal é telefone, que
  a Hotmart guarda desde 15/08.
- **#250 Anderson** — **R$ 733,60**, **44 dias**, mesma classe.

Os dois dependem de **uma** palavra: o "pode" pra ligar. Levei ao grupo
pedindo só isso, separado das decisões de dinheiro (#263, #290), pra não
afogar o pedido barato no pedido caro.

---

## 6. Frota

Não deleguei nesta ronda: o trabalho foi leitura de banco e decisão de fila, que
é o que **não** se delega (é o meu pedaço). Os workers de assinatura Claude
continuam sem auth (`Not logged in`), como as rondas das 03h, 11h e 13h
registraram — então **esta ronda também não teve revisão do `gerente`**. Fica
dito: a conferência das 7 pontas do §2 foi minha, sem segunda opinião. Não
precisei do `olho` porque não houve artefato pra ver nesta ronda.

---

## 7. O que eu NÃO fiz

Não mexi em crédito, acesso, assinatura, plano, tier, preço nem entitlement.
Não **tirei** crédito de ninguém (9-A). Não gastei GPU. Não apliquei migration.
Não subi código — **esta ronda não tem PR, e não inventei um pra parecer
produtiva**. Não escrevi pra aluno (§4). Não prometi estorno a ninguém. Não
toquei nos cartões travados em decisão alheia, além de **ler** a última nota de
cada pra conferir que seguem travados. Não li e-mail não lido. Não consertei o
`percepcao_travada.cjs` — o ponto cego do `aguardando_aluno` registrado nas
rondas das 11h e 13h **continua de pé**, e eu não o ataquei hoje. **Nada da
planilha** (ordem de 29/08).

---

## 8. Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` conferido **vazio**
depois do commit deste log. `git branch` conferido: nenhum branch de feature
criado nesta ronda e nenhum fix preso — a única suspeita de fix em branch
(PR #316) foi investigada no §1 e **já estava mergeada**.

Esta ronda escreveu: **1 cartão fechado** com 7 conferências no banco, **1
hipótese própria derrubada por medição** (o PR #316), **1 medição nova** que
explica a fila travada (22 de 90), **2 mensagens no grupo** e este log.
