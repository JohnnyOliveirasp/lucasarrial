# Ronda das falhas — 04/09/2026, ~13:49Z (10:49 BRT)

Serial: peguei o **`3ca22d47`** (#222 / "5 alunos presos fora da própria conta"),
o **mais antigo dos abertos** (01/09 15:54). **Não fechei** — segue travado numa
decisão de dinheiro que não é minha. Mas o que travava a decisão do Johnny era
uma ambiguidade, e essa ambiguidade **acabou**.

Canal: um aviso foi pro **grupo** (`notify-grupo.sh`), ordem de 31/08. Ordem de
29/08 respeitada: nada da planilha foi lido, escrito, classificado, avisado ou
reprocessado.

---

## 1. O que estava travado

A ronda das 01hZ mediu 5 alunos pagando em dobro e parou com esta ressalva:

> *"quanto estornar por pessoa depende de qual das duas assinaturas é a legítima,
> e no Carlos e na lucila as duas nasceram no MESMO dia — não dá pra decidir isso
> por script, e eu não decidi."*

Honesto, e foi a decisão certa naquele momento. Mas o pedido foi pro grupo como
um bloco só ("cancelar + estornar as 5"), e ficou **13h sem resposta** com a
data do 06/09 correndo. Pedido grande e ambíguo é pedido que não se responde.

## 2. A ambiguidade era decidível — só não pelo campo que estavam olhando

O script olhava **quem pagou o quê**. As duas assinaturas são pagas, então
empatam sempre. O que desempata é **uso**:

| aluno | conta com uso | conta duplicada | veredito |
|---|---|---|---|
| **SOLON ANDRADE** | `lscontabilidade813@` — 1 voz READY ("Solon - SGP"), 2 gerações, 88.025 de 100k créditos gastos | `solonandrade03@` — **0 vozes, 0 gerações, 200k intocados** | decidido |
| Jackson N. Alves | `jkakoalves@` — 2 vozes ready, 7 gerações, 17 gastos | `jkakorio@` — **órfã, nem perfil tem** | decidido |
| Carlos A. F. Moreira | `gutoassuncao16@` — 5 gastos | `caplastica@` — **órfã, sem perfil** | decidido |
| Nassara B. M. O. | `nassaramesquita@` — 36 gastos | `ZKJBP56C` — **venceu 30/08, não renova** | sem ação urgente |
| **lucila blanco** | — | — | **NÃO decidi** |

**A lucila eu não decidi e digo o porquê:** `blancolucila539@` e
`contatoecocannabis@` estão **ambas zeradas** (0 voz, 0 geração, 0 gasto). Uso
não desempata. Escolher qual conta dela morre no chute seria exatamente o tipo
de decisão silenciosa que o README proíbe. Essa tem que ser **perguntada a ela**
— e não é urgente: as cobranças dela caem em 23/09 e 30/09.

4 de 5 decididos por evidência. 1 isolado com o motivo escrito.

## 3. Identidade provada por campo independente, não por nome

A armadilha registrada em 03/09 — *"cruzamento por nome é pista, não prova"* —
vale aqui: as duas contas do Solon se chamam "SOLON ANDRADE", o que não prova
nada sozinho.

Telefone `11947432100` aparece em **exatamente 2 dos 1088** entitlements da
tabela inteira: os dois dele. **Controle rodado junto**, porque número sem
controle não vale: **978 telefones distintos** em 1088 linhas, 69 em branco. O
campo discrimina — então o "2" significa alguma coisa.

## 4. O dinheiro, reconferido na fonte (e uma suspeita minha que caiu)

Não herdei o número da ronda anterior. Cheguei a **suspeitar que o "R$97 cada"
fosse uma cobrança só, contada duas vezes** pelo instrumento (o
`pagou_de_verdade` cruza por documento e podia estar atribuindo a venda de uma
conta à outra). Fui conferir antes de repetir. Nos **nossos** `payment_events`:

| transação | conta | valor | quando |
|---|---|---|---|
| `HP1154197434` | solonandrade03 | **0 BRL** | 06/08 (o trial) |
| `HP3690808585` | solonandrade03 | **97 BRL** | APPROVED 13/08 **14:44** |
| `HP3797964181` | lscontabilidade | **97 BRL** | APPROVED 13/08 **22:13** |

Códigos **diferentes**, 7h30 de intervalo. A suspeita caiu: a cobrança dupla é
**real**, R$194. O número da ronda anterior estava certo.

## 5. A data, confirmada por instrumento externo

A ronda anterior tirou o "06/09" do **nosso** `access_until` — campo nosso,
que já mentiu antes. Fui na Hotmart (`/subscriptions`, leitura, não cancela
nada): `date_next_charge` do `POTX6UYJ` = **2026-09-06T12:00Z**. Bate. O
`IJA1SHDQ` é 13/09. O prazo está certo, agora medido por fora.

### Divergência que eu não vou esconder

A Hotmart descreve o `POTX6UYJ` como **`trial: true`, valor 0 BRL, sem
`last_recurrency`** — mas o nosso `payment_events` mostra essa **mesma**
assinatura cobrando R$97 em 13/08 (e o `updated_at` do entitlement, 21/08
09:58:49, casa no segundo com o `PURCHASE_COMPLETE` dela).

**De fora eu não consigo afirmar se em 06/09 sai R$97 ou R$0.** Não vou
inventar. O que dá pra afirmar, e basta pra decidir: **em 06/09 essa assinatura
cobra numa conta com uso zero.**

## 6. O pedido foi refeito — quebrado em dois

Em vez de repetir o bloco que não foi respondido:

1. **URGENTE, até 06/09** — cancelar a `solonandrade03`. Só isso já impede a
   cobrança nova, e ele **não perde nada que usa**.
2. **Sem prazo** — o estorno dos R$97 já cobrados.

Um "sim" pequeno e datado, e um que pode esperar. Postado no grupo nesta ronda.

## 7. O que eu NÃO fiz

Não cancelei assinatura, não estornei, não mexi em crédito, não escrevi pra
aluno, não gastei GPU, não apliquei migration, não mergeei PR, não fechei nem
reabri incidente, e não toquei em nada da planilha.

**Por que não escrevi pra lucila**, já que e-mail individual é alçada minha:
a pergunta útil pra ela ("qual conta você quer manter?") vem colada a uma
promessa de dinheiro que eu não posso fazer antes do item 2 acima. Prazo dela é
23/09 — há folga. Escrever agora seria criar expectativa sem ter o que entregar.

## 8. Registro

Nota gravada no `3ca22d47` (`agent_notes` 23 → **24**, 1 linha afetada,
conferida na releitura). Status mantido em `investigating` — não fechei, porque
não está resolvido.

## 9. Pendências que continuam com o Johnny

1. **Cancelar a duplicada do Solon** — prazo **06/09**, dois dias.
2. **Estorno das duplicadas** (Solon, Jackson, Carlos) — sem prazo.
3. **`#234`:** virar o `TTS_TAIL_QA_INTERNO_MODO` (+16–19% de regen). Trava o
   `#47` junto.
4. **`#246`/Jesus Peres:** compra avulsa do curso dá acesso ao FastCloner?
5. **Migration 102** (`102_incidents_resolved_guard.sql`) segue não aplicada.
6. Os **3 branches com conserto fora da main** (fix dos chamados #243/#244, com
   aluno esperando) seguem atrás da main e precisam de rebase.
