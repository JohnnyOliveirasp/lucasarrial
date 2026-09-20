# Ronda das falhas — 20/09, ~19h40–20h20Z (Frank)

Item serial: **#254 / `f1ada07e`** (cobrança em dobro). O #371, item das quatro
rondas anteriores, está travado em **decisão** (o rótulo do `8cd37f59`), não em
apuração — a própria nota das 18h30 nomeou isso. Regra 8: travou, diga em que
passo e siga. Segui.

Esta ronda **refuta uma afirmação escrita na `resolution_note` do #254** e
entrega um aluno que estava sem contato nenhum havia 16 dias sem que ninguém
notasse.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — **nada no privado do Johnny**; o post
do grupo está no §6.

## Placar

- Fila: **92 abertos** no início e no fim da ronda (igual às 18h30).
- Fechados `fixed`: **0** — honesto. O dinheiro cobrado a mais segue na conta
  do aluno, não na nossa (§5).
- Fix em produção: **0**. Não mergeei nada (§4).
- **Alunos respondidos: 1** — Leandro, nos dois endereços (§2).
- Crédito devolvido: **0** — nada a devolver por minha alçada.
- Passo fixo dos envios: **878 lidas, 0 carta fora da tabela** depois do corte.
- `pagante_trancado`: **0 trancados, 0 na fronteira**, 1 sem prova.
- Percepção travada: **2 cards**, mais velho parado 2,3d — os dois tratados (§4).
- Cartões: **1 novo** no Mission Board (`fc8ab4bf`).

---

## 0. Passos fixos

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): **878**
cartas lidas de `Sent`, **801** já tinham linha, **77** fora da janela,
**0 escrituráveis, 0 recusadas**. A contagem fecha (878 = 878). Idêntico às
18h30 — nenhuma carta nova no intervalo.

O instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue **passivo**.

`pagante_trancado.cjs`: **0 pagante trancado, 0 na fronteira**, 1 sem prova
(`drfabiovilhena29@`, sem subscriber code no payload).

---

## 1. O #254 afirmava uma coisa falsa sobre si mesmo

A `resolution_note`, escrita hoje às 02hZ, diz: **"TODOS já foram avisados por
escrito."** Fui conferir em vez de herdar.

Dos **15** endereços em `affected_emails`, **4** têm carta registrada:

| endereço | última carta | n |
|---|---|---|
| `contatoecocannabis@` | 16/09 | 2 |
| `nassaramesquita@` | 17/09 | 1 |
| `gutoassuncao16@` | 20/09 | 1 |
| `jkakoalves@` | 20/09 | 2 |

**Os outros 11 têm zero.**

E o ledger local **não é a fraqueza do argumento aqui**, que é justamente a
objeção óbvia (o README documenta que ele tem buraco). O passo fixo reconcilia
contra a pasta **remota** `Sent` e o veredito de hoje é "0 carta depois do corte
de 14/09 14:06:31Z". Logo, para carta posterior a 14/09, **ausência de linha é
ausência de carta**. Antes do corte eu não afirmo nada.

Cruzado com `ja_falaram.cjs` (que lê as marcações de `/admin/falhas`, a caixa
que eu não leio): `leandro@`, `contato@aeroclubejf` e `herysilva.27` = **sem
registro**. ⚠️ Declaro o limite que a própria ferramenta imprime: *"sem registro"
não é prova de silêncio*. Por isso **não escrevi ao aluno que ele ficou sem
resposta** — escrevi sobre o caso dele.

---

## 2. Leandro: medido vivo, e nunca tinha sido contatado

Duas assinaturas **ACTIVE**, mesmo produto (7851642, Plano Founder), duas contas
nossas — ensaio *read-only* do `cancelar_assinatura.cjs`:

```
J9HMYL9P  contato@aeroclubejf.com.br   ACTIVE  renova 28/09 12:00Z
4XVSU9U7  leandro@aeroclubejf.com.br   ACTIVE  renova 30/09 12:00Z
```

Hotmart viva: R$97 COMPLETE **28/08** (contato@) + R$97 COMPLETE **05/09**
(leandro@). **R$194 por mês por um serviço só.**

**Registro a diferença em vez de assimilar ao resto do cartão:** não é fatura em
duplicata no mesmo dia, como Jackson e Carlos. São ciclos deslocados ~8 dias.
Muda a leitura do defeito.

**O método que resolveu 4 dos 5 casos deste cartão não funciona aqui.** "Decide
por uso" pressupõe uma conta vazia. As duas têm trabalho dele dentro:

| conta | gastos | créditos | vozes | gerações |
|---|---|---|---|---|
| `contato@` | 29 | 66.830 | 3 | 10 |
| `leandro@` | 9 | 22.820 | 1 | 5 |

Uso **não desempata**. É o mesmo caso da lucila blanco, que a descrição marcou
como "NÃO DECIDIDO DE PROPÓSITO". Não escolhi por ele, não cancelei nada.

**Escrito nesta ronda**, nos dois endereços, cópias **confirmadas** na pasta de
enviados: **uid 3047** e **uid 3048**, chave `leandro-254-dobro-28set`, as duas
em `emails_enviados`. A carta dá as datas, diz que a falha de não detectar é
nossa, mostra o uso das duas contas, pede **uma linha** dele, diz que **sem a
frase escrita eu não cancelo nada** (9-C), oferece o caminho da Hotmart, e sobre
reembolso diz a verdade: em análise, **sem valor e sem data prometidos**.

Avisei também que as avulsas dele (SGP R$597 e Fábrica R$297, ambas de 28/07)
**não são assinatura e não são afetadas** — sem isso a carta assusta.

---

## 3. Herineth: a acusação do cartão não se sustenta pelo critério dele mesmo

A `resolution_note` lista **"Herineth US$44"** entre os cobrados em dobro.
Medido hoje na Hotmart viva: `herysilva.27@gmail.com` tem **`assinaturas: 1`**.
Uma, não duas. As duas cobranças de US$22 (18/08 e 30/08) são **rec#2 e rec#3**
— ciclos **consecutivos da mesma assinatura**.

O título do cartão é *"5 alunos com DUAS assinaturas ao mesmo tempo"*. **Ela não
satisfaz esse critério.** Pode haver outro defeito (12 dias entre rec#2 e rec#3
é curto pra plano mensal), mas é **outra classe** e exige o código que cobra
aberto, não o ledger — ordem de 27/08 §1, os 3 chamados falsos de dinheiro.

**Não escrevi pra ela.** Dizer "você foi cobrada em dobro" sem prova é o erro que
aquela ordem existe pra impedir. Fica anotado como **pergunta**, não como fato.

---

## 4. Percepção (ordem de 17/09) e o PR de 23 dias

`percepcao_travada.cjs`: **2 cards**, mais velho parado **2,3d**.

- **#450** — nota anterior já registrou que é **falso positivo** do instrumento
  (casou por prefixo). Sem ação.
- **#500 (Ellen)** — marcado `[não ouço]`. **Declarei o bloqueio real em vez de
  despachar**, e digo por quê: a frase que casou o detector é *"a pergunta dela
  (gravar 1h em vez de 20min ajuda?) eu não respondo: não ouço áudio"*. Mandar o
  áudio pro `olho` **não responde isso**. Ouvir um take diz como aquele take
  soou; a pergunta é sobre a **relação duração→prosódia**, que só se responde
  medindo o corpo de vozes. Despachar devolveria parecer inútil e daria ao cartão
  **aparência de atendido**. Não é percepção travada: é **medição inexistente**.

**O que atrasa de verdade, e não estava bloqueado:** o conserto da entonação já
está **escrito e parado**. Conferido por mim na fonte viva:

```
PR #92  fix/ritmo-da-referencia-porta-73a60bb
state=OPEN  isDraft=TRUE  updatedAt=2026-08-28T21:48:55Z  mergeable=UNKNOWN
```

**23 dias em rascunho**, com **duas alunas** esperando (#500 e #348, mesma aluna,
10 dias). Mesma família do "fix preso em branch 9h" de 19/08 e do item (a) do #15
parado 2 dias num PR — agora em escala de **semanas**.

**Não mergeei**, e isso é decisão, não omissão: PR de 23 dias sobre uma main que
andou muito não se mergeia no fim de ronda. A casa tem **5 branches STALE** no
origin exatamente com esse risco (`feat/onedrive-401`,
`feat/fix-image-upload-retry`, `fix/trava-foto-nova-8379549c` e as 2 da cura de
referência) — todos derrubariam conserto que **está em produção**. Abri o card
**`fc8ab4bf`** pro `coder`: medir o diff, se ainda aplica sobre a main de hoje,
suíte no branch × baseline na main, e se há teste cobrindo. **Ele não mergeia;
eu revejo (14-B).**

---

## 5. O que trava, com quem, e com que data

1. **O "pode" do Johnny pro reembolso em dinheiro** — pedido no grupo em 04/09,
   reforçado como urgente hoje 02h30Z. **16 dias.** Não é alçada minha (9-B/9-C).
   Atinge Carlos, Jackson, Leandro e Nassara.
   **Não repus no grupo nesta ronda**: já foi hoje, marcado urgente, e a regra 7
   proíbe repetir progresso parcial. Repetir de 18 em 18h mata o canal que o
   Lucas também lê.
2. **A frase escrita do titular (9-C)** — Carlos pedida 20/09 01h47Z, Leandro
   pedida nesta ronda. **As duas com data anotada.** Esperar resposta de aluno
   não é estar travado (regra 8).

**Relógios reconferidos vivos:** Carlos `UMJP7PDY` + `MY5O3KWB` as duas ACTIVE
cobrando **22/09 12:00Z** (1,7 dia); Leandro **28/09** e **30/09**.

**Não escrevi pro Carlos.** A carta de hoje 01h47Z já deu a data e pediu a linha,
nos dois endereços, sem bounce. Cobrar de novo 18h depois é pressão, não serviço.

---

## 6. Jackson: resolvido hoje, mas gravado no cartão errado

A perna dele foi medida e respondida às **16h26Z** (carta uid 3025, sem bounce),
e **toda a apuração ficou no #499** — a duplicata que o Vigia abriu às 15:25Z.
**Do #254, dono da classe e com `jkakoalves@` em `affected_emails` desde 04/09,
não se enxergava nada disso.**

É exatamente o defeito que fez o #254 existir: a descrição dele diz que foi
separado do #222 porque *"quem trabalhava o #222 pela lista de e-mails NÃO
ENXERGAVA o único item com data"*. **Aconteceu de novo, em 16 dias, no mesmo
cartão.**

Reconferi sem herdar do #499, na Hotmart viva:

```
jkakoalves@ (ativa X74ADBMN):     rec#2 97 COMPLETE 26/08 · rec#3 97 APPROVED 19/09
jkakorio@  (cancelada 6VHWPHB9):  rec#2 97 COMPLETE 26/08 · NADA depois
```

**Controle natural, e é o que torna isso conclusivo:** as duas nasceram em 19/08
e as duas cobraram em 26/08. Em 19/09 **a ativa cobrou e a cancelada não**. O
cancelamento de 04/09 segurou, e a cobrança de 19/09 é mensalidade legítima — os
100.000 cr dela entraram em 19/09 13:52Z.

O que continua devendo a ele é **só o dinheiro**: os R$97 a mais de 26/08 foram
compensados em **crédito** (+100.000, `courtesy_grant`), nunca em dinheiro.
**Ele está certo quando diz "não devolveram".**

O **#499 estava com `resolution_note` NULA** apesar de toda a apuração — o mesmo
defeito que escondeu 16 dias de trabalho no #254. Preenchi, apontando pro #254
como dono do dinheiro.

**Post no grupo: houve.** Uma linha, fato consumado (carta pro Leandro + a
afirmação falsa que eu derrubei). Sem log de terminal, sem progresso parcial.

---

## 7. O que eu não fiz

Não cancelei assinatura, não estornei, não toquei em crédito, acesso, voz,
migration nem GPU. Não mergeei PR. Não marquei `fixed` — regra 14 inteira.
Nada da planilha (ordem de 29/08).
