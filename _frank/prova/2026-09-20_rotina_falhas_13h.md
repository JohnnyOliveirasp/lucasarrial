# Ronda das falhas — 20/09, ~11h30–13hZ (Frank)

Item serial: **#245 / `52b22304`** (Igor Ramalho, insatisfeito com o realismo do
Vídeo Clone, **16,6 dias** esperando). **Levado até o fim pela regra 8**: vídeo
assistido de verdade, causa medida, aluno respondido por e-mail hoje, cartão
anotado. Saiu do meu colo — a bola agora é dele.

O saldo honesto: **a fila não andou** (90 → 90). Não fechei nada como `fixed`
porque **nada foi consertado** — o que este cartão tinha pra entregar era uma
medição e uma resposta que o aluno esperava há 16 dias, e as duas saíram. O que
esta ronda produziu de mais durável não é fila menor: é o **par de controle** que
faltava no #494, e que impedia a classe inteira de ser levada a sério.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — tudo foi pro **grupo**
(`notify-grupo.sh`). Nada no privado do Johnny.

## Placar

- Fila: **90 → 90 abertos** · 38 com 7d+ · 36 em `aguardando_aluno`.
- Fechados `fixed`: **0** — e isso está explicado no §5, não escondido.
- Alunos respondidos: **1** (Igor, uid 2993, conferido na tabela).
- Crédito devolvido: **0**. Nenhuma falha técnica no caso (§4).
- Vídeos assistidos nesta ronda: **1** (o par de controle).
- Percepção travada: **2** pelo instrumento (mais velho parado há 2,0d) ·
  **16** pela consulta crua da ordem de 17/09 (mais velho **18,7d**). A
  divergência é real e está no §6.
- Passo fixo dos envios: **0 cartas fora da tabela** depois do corte.

---

## 0. Passos fixos, antes de qualquer coisa

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): **823**
cartas lidas da pasta `Sent`, 746 já tinham linha, 77 fora da janela do corte,
**0 escrituráveis, 0 recusadas**. A contagem fecha (823 = 823).

O instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue **passivo**.

(Ronda das 11h: 801 lidas / 746 com linha. +22 cartas, todas já com linha — as
14 do #270 entre elas.)

As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão, como o README manda.

---

## 1. Por que este cartão

Os seis mais velhos da fila com aluno afetado continuam parados em decisão que
não é minha — **conferi de novo, não herdei o veredito da ronda das 11h**:

| cartão | idade | por que não move |
|---|---|---|
| #15 `d3d8d1b2` | 51,9d | decisão de produto, no grupo desde 17/09 |
| #226 `702cc916` | 18,7d | mesma decisão do #15 |
| #234 `f8587cef` | 17,8d | mesma decisão do #15 |
| #249 / #250 | 15,8d | propostas aguardando o "pode" |
| #254 `f1ada07e` | 15,7d | carta saiu 20/09 01h, saiu do meu colo |
| #263 `5c68eb33` | 14,9d | falta a definição do Johnny sobre os R$ 97 |

O **#245 é mais velho que quatro deles** (16,6d) e **não aparece na lista de
abertos** — está em `aguardando_aluno` desde 03/09. Esse rótulo diz "a bola está
com o aluno". **Não estava.** O aluno tinha feito a parte dele em 09/09 e
ninguém olhou. É exatamente o ponto cego que a ronda das 11h descreveu e não
consertou; nesta ronda eu não consertei o instrumento, mas **fui buscar o
cartão à mão** em vez de esperar o instrumento melhorar.

---

## 2. O que estava errado na resposta de 03/09 — e não era mentira, era alvo

Em 03/09 o Igor escreveu pelo chat do app: os vídeos não ficam realistas, e
**ele já tinha seguido as orientações de enquadramento**. A casa respondeu no
mesmo dia (uid 501) com **mais orientação de enquadramento**: foto real, peito
pra cima, rosto ocupando ~1/3 da altura, luz suave.

A nota daquele dia foi honesta sobre o próprio limite, e isso precisa ser dito:

> *"LIMITE DA MINHA ANALISE, dito na cara: eu NAO assisti aos videos de saida.
> Julguei a ENTRADA. (…) Se ele responder que refez com foto certa e continuou
> ruim, ai vira defeito nosso e precisa de olho humano."*

**A condição se cumpriu e ninguém percebeu.** Ele não "respondeu" — ele
**fez**. Em **09/09 17:19Z** gerou o clone `68c06864` a partir de
`uploads/2cb80a20`. Eu abri a foto: **real, 4:3, sentado, peito pra cima,
frontal, luz uniforme, fundo limpo.** É o pedido, ao pé da letra. Pagou
**2.940 cr**. O resultado ficou 11 dias sem ninguém assistir.

A nota de 03/09 tinha o gatilho certo escrito. **O que faltou foi alguém voltar
pra puxá-lo** — e esse alguém era a ronda.

---

## 3. A medição, e por que ela vale mais que as três da ronda das 11h

Despachei o vídeo de 09/09 pro `olho` (ordem de 17/09: percepção é despacho,
não parada), **cego**: sem citar o #494, sem citar a hipótese, sem citar os três
pareceres anteriores. Veredito, item a item:

| | vídeo 09/09 `68c06864` (27,9s, **foto real correta**) | vídeo 12/09 `f3133d80` (15,8s, avatar gerado) |
|---|---|---|
| lip-sync | acompanha, **sem atraso** | acompanha o ritmo |
| **braços/mãos** | **nenhum movimento em 27s** | **nenhum movimento** |
| piscada | **normal**, a cada ~2–4s | rara, olhar fixo |
| boca | nítida | borrada na fala rápida |
| **nota** | **7,5/10** | **5,0/10** |

Palavras do parecer sobre o de 7,5: *"o avatar mantém o corpo e os braços
completamente parados, denunciando que se trata de uma foto estática
animada"*.

**Por que este é o par de controle.** Os três pareceres da ronda das 11h foram
todos em vídeos feitos a partir de **avatar gerado na plataforma** ou de foto
que ninguém conferiu. Contra aqueles três, a casa sempre pôde responder *"o
aluno não seguiu a orientação"* — e responderia, porque é o que ela vinha
respondendo. **Este é o único caso da classe em que dá pra provar que o aluno
obedeceu**, porque eu abri a foto de entrada e olhei antes de olhar a saída.

---

## 4. As duas correções que a medição impõe — uma pra cada lado

**(a) A dica de foto NÃO é inútil, e o #494 estava injusto com ela.** Mesmo
aluno, mesma conta, mesmo motor, três dias de diferença: avatar gerado dá
**5,0**, foto real correta dá **7,5**. A **piscada volta**. A boca fica nítida.
Enquadramento melhora o rosto, e isso agora é medido, não opinião. A ronda das
11h escreveu que *"foto melhor não cria gesto"* — verdade — mas o tom deixava
entender que a orientação era inútil. **Não é**, e eu não vou deixar essa meia
verdade virar a nova resposta padrão da casa.

**(b) A dica continua sem alcançar a queixa, e agora com controle.** Braços
parados nos **dois**: no de 5,0 e no de 7,5. Não existe foto que crie gesto. A
frase certa pra casa parar de dizer não é "foto melhor não ajuda" (falso), é:

> **Foto melhor não responde quem reclama de corpo parado.**

Responder gesticulação com enquadramento é trocar de assunto — **e o aluno paga
a troca.**

**Placar da classe depois desta ronda:** 4 vídeos, 4 alunos. **4 de 4 absolvem
a boca. 4 de 4 acusam o corpo.** A única nota acima de 5 é justamente a da foto
correta, e mesmo ela é descrita como "foto estática animada".

---

## 5. Crédito: o que eu não fiz, e por quê

**Não estornei nada e não prometi estorno.** Pela 9-B não há falha técnica: as
**7** gerações do Igor estão todas `ready`, `error_message` vazio. Foi entregue
o que foi pedido. Insatisfação de **qualidade** é decisão do Johnny — mesma
linha da ronda das 11h com os ~10.000 cr do Paulo.

Fica **registrado no cartão e no grupo**, pro Johnny decidir, sem nenhuma
promessa feita ao aluno:

- **2.940 cr** (09/09) gastos **seguindo orientação nossa** que não alcançava a
  causa.
- **2.960 cr** (12/09) gastos gerando **o mesmo vídeo duas vezes**: 1.680 no
  Padrão 2.0 às 00:35 e 1.280 no Turbo às 01:26. **Mesma foto** (`57b5436a`) e
  **mesmo áudio** (`1754f8e6`), conferidos no banco, 51 minutos de intervalo. É
  literalmente o padrão que a nota de 03/09 mandava **nunca recomendar** —
  *"NUNCA MANDE ELE TROCAR DE MODO PRA MELHORAR REALISMO"* — e ele chegou nele
  sozinho, pela segunda vez, porque nada na tela o impede nem o avisa.

Na carta eu disse isso a ele com os números, pra ele parar de queimar crédito
nessa comparação. **Preferi avisar a deixar ele descobrir pagando.**

**Estado da conta, conferido hoje:** ativo (`hotmart`), `access_until`
**22/09 12:00Z — dois dias**, 151.076 cr de assinatura, `last_seen`
**20/09 04:02Z**. Ele continua usando o produto hoje. Foi por isso que a carta
saiu nesta ronda e não na próxima. **Não mencionei renovação na carta**: não se
vende pra quem está reclamando e ainda não foi respondido.

---

## 6. Percepção travada: dois números, e a divergência dita em vez de escolhida

- **Instrumento** (`percepcao_travada.cjs`): **2** cartões, mais velho parado há
  **2,0d**. Controle positivo OK (#310 reencontrado), 480 incidentes varridos.
- **Consulta crua da ordem de 17/09** (o SQL escrito na própria ordem):
  **16** cartões, mais velho **18,7d** (#226).

Os dois estão certos, e medem coisas diferentes: o instrumento pergunta *"a
ÚLTIMA nota está parada esperando alguém ver?"*; o SQL da ordem pergunta *"a
nota menciona ver/ouvir/assistir em algum lugar?"*. **Reporto os dois e não
escolho o menor**, porque a ordem de 17/09 diz com todas as letras que silêncio
nessa classe não pode parecer saúde — e 2 parece saúde ao lado de 16.

O ponto cego estrutural segue **exatamente como a ronda das 11h registrou** e eu
**não o consertei**: o instrumento só olha `open`/`investigating`, e **6 dos 9**
cartões da classe do realismo estão em `aguardando_aluno`. O **#245 desta ronda
nunca apareceu em nenhum dos dois números** — nem nos 4 de 11h, nem nos 2 de
agora. Eu o achei à mão, lendo a fila. Dívida registrada no #494, com a causa
localizada.

---

## 7. O que ficou gravado, e a prova de que gravou

- **Carta**: `enviar_email.cjs`, chave `realismo-clone-245-igor`, bcc
  suporte@. Cópia **confirmada** na pasta de enviados, **uid 2993**. Linha em
  `emails_enviados` conferida por consulta depois de gravar: `enviado_em`
  **2026-09-20 11:45:17Z**, origem `ronda-manual`.
- **#245**: nota anexada e `status` mantido em `aguardando_aluno` — **agora
  verdadeiro**, porque a bola passou a ser dele de fato. Escrita conferida na
  releitura: **1 linha afetada, `agent_notes` 3 → 4**.
- **#494**: nota do par de controle anexada. **1 linha afetada, `agent_notes`
  0 → 1.** (O cartão tinha sido aberto às 10h55Z com descrição de 5.684 chars e
  `agent_notes` **vazio** — anotei isso ao encontrar.)

Nenhum `fixed` foi carimbado. **Regra 14: nada aqui foi resolvido.**

---

## 8. Frota

O `olho` (OpenRouter) respondeu em **46s** e produziu o parecer do §3. Os
workers de assinatura Claude continuam sem auth (`Not logged in`), como as
rondas das 03h e 11h registraram — então **esta ronda também não teve revisão do
`gerente` nem teste de `qa`**. A segunda opinião que existe aqui é o pedido
**cego** ao `olho` e a conferência das entradas no banco antes de aceitar a
saída. Menos do que o normal. Fica dito.

---

## 9. O que eu NÃO fiz

Não estornei nem prometi estorno (§5). Não assisti aos 7 vídeos restantes da
classe — dívida escrita no #494 **com a receita**, não como "precisa olhar". Não
consertei o `percepcao_travada.cjs` (§6). Não toquei em tier, preço, motor de
vídeo, acesso, entitlement, assinatura ou plano de ninguém. Não **tirei** crédito
de ninguém (9-A). Não gastei GPU. Não apliquei migration. Não subi código —
**esta ronda não tem PR, e não inventei um pra parecer produtiva**. Não toquei
nos cartões travados em decisão alheia. Não li e-mail não lido. **Nada da
planilha** (ordem 29/08). Não mencionei renovação pro aluno cujo acesso vence em
2 dias.

---

## 10. Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` conferido **vazio**
depois do commit deste log. Nenhum branch de feature foi criado nesta ronda, e
`git branch` conferido pra garantir que não ficou fix preso — não havia fix.

Esta ronda escreveu: **1 carta** a um aluno que esperava 16,6 dias, **2 cartões
anotados** (0 fechados), **1 vídeo assistido** que vira o par de controle da
classe do realismo, e este log.
