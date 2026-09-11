# Ronda das falhas — 11/09/2026, 01hZ (22h BRT)

Dono da fila (14-A). Peguei **um** incidente e levei até onde ele ia: **`#254`**
(`f1ada07e`), perna **aeroclubejf**. Escrevi pro aluno (2 e-mails, cópia
confirmada), anotei 2 cartões, **não fechei nenhum**, não mexi em crédito, não
cancelei e não estornei.

Repo em `main`, `pull --ff-only` (já em dia). `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Ordem de **29/08** respeitada: nada da
planilha. Ordem de canal de **31/08**: o aviso desta ronda foi **no grupo**.

---

## O achado: a urgência das 00h estava apoiada num fato falso

O relatório do Vigia das 00:17Z escalou o `#254` como a última janela de
garantia e escreveu, com todas as letras:

> *"Ninguém deste par pediu nada. (…) Foi a **casa** que detectou a dobra, há 6
> dias, neste cartão, **e não avisou ninguém. O aluno não sabe.**"*

**O aluno sabe há 4 dias.** Conferido nos Enviados (`ler_caixa --enviados
--para`, os dois endereços):

| uid | quando | pra quem |
|---|---|---|
| **1173** | 06/09 19:47Z | `leandro@aeroclubejf.com.br` |
| **1174** | 06/09 19:47Z | `contato@aeroclubejf.com.br` |

Mesmo assunto nos dois: *"Leandro, você tem duas assinaturas do FastCloner
ativas (R$ 194/mês) — as duas são de propósito?"*. O e-mail nomeia os dois
códigos (`J9HMYL9P`, `4XVSU9U7`), os dois titulares, as duas datas de próxima
cobrança, o que tem em cada conta, e pede a frase escrita de autorização. É um
e-mail bom. **Ele não respondeu** — `INBOX` com `FROM` nos dois endereços volta
vazia, 101h depois.

**O que isso derruba:** não havia decisão do Johnny represada nesta perna. O
card já define a alçada (*"cancelar/estornar exigem o 'pode' do Johnny"*) e o
próprio e-mail de 06/09 promete ao titular que a casa **não cancela sem pedido
dele**. Sem a frase escrita não há o que decidir. O título do card já dizia o
certo desde 04/09: **"Carlos e Leandro: bola com o aluno"**.

Registro isto do mesmo jeito que o Vigia registrou o erro dele às 00h: a
objeção de instrumento cego desta vez foi dele, e o instrumento cego era não
ter aberto a pasta de Enviados antes de afirmar silêncio da casa.

---

## O que eu medi sozinho (não herdado de nota)

`payment_events`, 16 linhas dos dois e-mails.

**As duas assinaturas nasceram trial de R$ 0.**

| conta | trx | valor | quando | garantia |
|---|---|---|---|---|
| `contato@` | `HP3432700678` | **0** | APPROVED 28/07 10:20Z → COMPLETED 05/08 | 04/08 |
| `leandro@` | `HP0805519173` | **0** | APPROVED 30/07 12:18Z → COMPLETED 07/08 | 06/08 |

**Cobrado de verdade até hoje: um R$ 97 em cada, e só.**

| conta | trx | quando | garantia |
|---|---|---|---|
| `contato@` | `HP3355066694` | APPROVED 28/08 14:37Z → COMPLETED 05/09 09:30Z | 04/09 (**vencida**) |
| `leandro@` | `HP0976568130` | APPROVED 05/09 19:46Z | **12/09 00:00Z** |

Todo o resto é `PURCHASE_DELAYED` — cobrança que **não passou**: 8 linhas, trx
diferentes (`contato@` 04/08, 13/08, 18/08; `leandro@` 06/08, 13/08, 18/08,
28/08, 30/08).

**Correção de número, pra não inflar:** arrecadado desta organização até agora
= **R$ 194 no total** (R$ 97 + R$ 97), não R$ 194/mês já cobrados. O
"R$ 194/mês" é o **run-rate futuro** e nesse sentido está certo (renova 28/09 e
30/09). Quem ler a nota das 00h como *"a casa recebe R$ 194/mês desta
organização"* está somando errado.

### Identidade: o que prova e o que NÃO prova

Nome **"Leandro Lopardi"** nos dois payloads e nos dois `profiles`. Mas o **CPF
não cruza**: `contato@` traz `document 03808036664` e CEP `36033-560`;
`leandro@` traz `document ""` e CEP `""`.

Ou seja: **não tenho aqui o campo independente que o método deste card exige** —
foi assim que o Solon se provou, pelo telefone. Fica no nome + domínio
corporativo, que é mais fraco, e eu não vou promover isso a prova. Pior: pelo
que o e-mail de 06/09 afirma (**não reconferido por mim nesta ronda**), os
titulares na Hotmart são **diferentes** — `contato@` = *Acjf Escola de Aviação
Civil Ltda* (PJ), `leandro@` = *Leandro Lopardi* (PF).

**A hipótese "dois assentos de propósito" segue viva.** É exatamente por isso
que a casa não pode cancelar sozinha.

### O uso não desempata, e as duas estão dormentes há 41 dias

O método do card manda decidir pelo **uso**. Medido hoje (`aluno.cjs` nos dois):

| conta | vozes | último gasto |
|---|---|---|
| `contato@` (conta 28/07) | 3 ready: *Leandro*, *Leandro 2*, *Leandro 3* | **29/07 13:12** |
| `leandro@` (conta 29/07, compra 30/07) | 1 ready: *Leandro* | **31/07 08:37** |

Nenhum gasto em nenhuma das duas **desde 31/07**. 200.000 créditos intactos em
cada, já com as recargas de ciclo. O uso existe dos dois lados e parou dos dois
lados — **não desempata**, o que confirma que perguntar era mesmo o caminho.

Informação nova pra quem for decidir: o aluno está pagando duas assinaturas de
um produto que **parou de usar há 41 dias**. Não muda a alçada; muda o tom.

---

## O que eu fiz (a única coisa que era minha)

E-mail de acompanhamento aos **dois** endereços — **uid 1698** (`leandro@`) e
**uid 1699** (`contato@`), cópia **CONFIRMADA** na pasta de Enviados nas duas.

Motivo: o e-mail de 06/09 dizia *"me diga o quanto antes, porque prazo de
contestação é curto"* mas **não dava a data**. O aluno não tinha como saber que
o relógio fecha em 12/09 00:00Z. O meu dá a data **no fuso dele** (amanhã,
sexta 11/09, ~21h BRT), repete as três saídas — deixar as duas / cancelar uma
com a frase escrita / pedir os R$ 97 de 05/09 de volta — e **não promete
estorno nenhum**.

Não cancelei, não estornei, não mexi em crédito, não abri a Hotmart viva.

**Desfecho esperado, dito com todas as letras:** se ele não responder até 12/09
00:00Z, a garantia da cobrança de 05/09 fecha e o dinheiro passa a depender de
análise de vendedor. Isso é um desfecho **aceitável e registrado** — o aluno foi
avisado duas vezes, a segunda com a data na mão, e a casa não cancela assinatura
de titular PJ sem pedido escrito. O inaceitável era o caso do Victor: ninguém
avisar e o prazo decidir sozinho. **Aqui não é esse caso.**

---

## Calibração do `#350`: a prova de conceito rendeu 1 em 4

A nota das 00h rodou a varredura D-1 e devolveu 4 alunos com garantia "viva",
tratando a lista como fila de dinheiro sem dono. Conferi os 4 nos Enviados:

| aluno | cartão | o que a casa já mandou | é pedido de dinheiro? |
|---|---|---|---|
| `leandro@aeroclubejf` | `#254` | uids 1173/1174 (a dobra) + 1698/1699 hoje | **sim** — e já tinha dono |
| `rodrigo.limas.1978@` | `#305`, `#306` | uids 582, 1322 — onboarding SGP, "falta criar sua conta" | não |
| `pcezardireito@` | `#270` | uids 1080, 1101 — apagão do Vídeo Clone e a volta | não (quer **reativar**) |
| `ak@aknetzwork.com` | `#312` | uid 1023 — onboarding SGP | não (o próprio Vigia já marcou) |

**3 dos 4 não são pedido de dinheiro nenhum** — são ruído do filtro por
**palavra no título**, limite que a própria nota declarou. Taxa útil: **1 em 4**,
e o útil já estava tratado. Nesta amostra a casa tinha escrito para **todos os
4**.

Isso **não mata o card** — o alarme D-1 continua barato e o caso do Victor
(`#309`) prova que a classe machuca. Mas derruba o enquadramento de *"fila de
dinheiro que ninguém está olhando"*.

**O que muda no desenho, pra quem implementar:** o gatilho não pode ser palavra
no título. Tem que ser (a) pedido de reembolso/cancelamento identificado no
**corpo** do chamado, cruzado com (b) `product.warranty_date > now()`, e (c)
**descontar quem já foi respondido** — senão o alarme toca em cima de caso já
tratado e vira ruído, que é como detector morre.

---

## O que anotei

| onde | o quê | notas |
|---|---|---|
| `f1ada07e` (`#254`) | a retratação da premissa, os 16 `payment_events`, a correção do R$ 194, o limite da identidade (CPF não cruza), os 41 dias dormentes e os dois e-mails que mandei | 24 → **25** |
| `3a9a4854` (`#350`) | a calibração 1-em-4 da prova de conceito e os 3 critérios que o gatilho precisa ter | 2 → **3** |

Os dois `UPDATE` conferidos na releitura, **1 linha afetada** cada.

## Números da ronda

- **71 incidentes** em `open`/`investigating` (0 em `open`). Mesmo número das
  00h. **Não fechei nenhum** — este caso não fecha enquanto a bola está com o
  aluno, e forçar `fixed` aqui seria a regra 14 pelo avesso.
- **2 e-mails enviados** (uids 1698, 1699), cópia confirmada nos dois na
  primeira tentativa. Nenhuma linha nova em `enviados_local.jsonl`.
- Caixa lida só com `EXAMINE` + `BODY.PEEK`, busca `SEEN`. **Não toquei em
  não-lido.**
- Custo: leitura + 2 SMTP. Nenhuma GPU, nenhum crédito, nenhuma chamada paga de
  visão.
- 🧹 Higiene, **estável**: seguem **8 arquivos** modificados não commitados em
  `frontend/**/sgp*` e `frontend/messages/*`, mais os não rastreados em
  `_frank/rascunhos/`. **Oitava ronda seguida.** Não são meus, **não toquei**;
  commitei só este log.

## O que continua parado, sem novidade desde as 00h

| | idade |
|---|---|
| `#309` Victor — prazo **venceu**, decisão de vendedor na Hotmart | 54h |
| `#312` `c726c5ae` — varredor cego pro SGP, 19 compradores sem conta | 52,4h |
| `#313` `2d0509b4` — 15 vitalícios de graça | 51,8h (17ª ronda pedindo) |
| `#331` `3528dd59` — Mastroianni, reposição de crédito | 24h |
| `#341` `b633b18c` — 147.350 (14 pessoas) | 11,8h |
| PR **#92** em DRAFT | 14 dias |
