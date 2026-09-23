# Ronda das falhas — 23/09 ~23h40Z a 24/09 ~00h50Z (Frank, dono da fila)

**Desfecho: 1 incidente FECHADO de verdade (`#86de22c6`, Simone Leal), 1 aluna
pagante respondida depois de 16 dias, R$ 975,40 confirmados como JÁ
ESTORNADOS, 1 lacuna de instrumento fechada com ferramenta nova, e 1 armadilha
de medição que quase virou acusação falsa contra uma aluna — registrada antes
de causar dano.**

Gasto: **zero GPU, zero crédito movido, zero migration, zero merge, zero código
de produção tocado.** As escritas foram: 1 carta a aluna, 1 incidente fechado,
1 ferramenta nova em `_frank/ferramentas/`.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável. **1142 = 1142**, nenhuma sumiu (1065 já com linha + 77 fora da janela). |
| `enviados_x_tabela` (irmão de leitura, independente) | rodado na ronda anterior; buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho **0d**. Controle positivo (#310) e negativo (#518) OK, 525 varridos. |
| Censo da fila | **144** abertos (investigating 105 · aguardando_aluno 31 · open 8) · mais velho **55,4d** |
| `esperando_johnny` | **17** parados em decisão do Johnny · mais velho **55d** · **54 alunos** atrás da fila. **Não re-escalei** (lote foi ao grupo às 20hZ de hoje; doutrina de 17/09 manda lote, não repetição). |

As 77 cartas anteriores ao corte seguem sem decisão, como a ordem prevê.

---

## 2. Serial: `#86de22c6` — Simone Leal Araujo de Andrade

### 2.1 Por que este cartão

Os mais velhos com aluno foram relidos nota a nota e seguem travados em decisão
alheia: `d3d8d1b2` (55d, risco aceito pelo Johnny), `37bacb68`/`f8587cef`/
`f1ada07e`/`702cc916` (trabalhados hoje em rondas anteriores), `af06731f`/
`99a20692` (bola do aluno), `8b8fc4c8` (mão humana na Hotmart), `7ed72ad0`/
`b0ddd483`/`7578c587`/`09a26f8b`/`5c68eb33` (dinheiro, mesa do Johnny — o
`5c68eb33` lido na íntegra: *"falta UNICAMENTE a definição do Johnny"*),
`72de0a07` (fechado o que era meu na ronda das 23hZ).

Os dois de 19,3d são bloqueio declarado e real: `132f7808` espera o "pode" do
WhatsApp; `8c29740f` depende da entrega do `#426`.

Peguei o `86de22c6` porque o **Vigia nomeou a lacuna e ela era minha** (22/09
20hZ, item 4): *"busca no /sales/history por VALOR+DATA ou por CPF — NENHUM DOS
DOIS EXISTE hoje nas ferramentas da casa… construir instrumento novo que
consulta a Hotmart viva é trabalho de dono da fila, não de sensor"*. Não era
decisão travada: era ferramenta que faltava.

### 2.2 O que era, medido

| transação | valor | quando (order_date) | pagamento | produto | status |
|---|---|---|---|---|---|
| `HP3504926128` | R$ 303,40 | 31/08 11:23:47Z (**08:23 BRT**) | Apple Pay **10x** | Fábrica de Conteúdo Invisível (7283335) | **REFUNDED** |
| `HP2163322038` | R$ 672,00 | 31/08 11:34:02Z (**08:34 BRT**) | Visa **6x** | Sistema de Geração Pronto (7283229) | **REFUNDED** |

Produtor `Starter Digital`, comprador `Simone Leal araujo de andrade
<simonelealandrade88@gmail.com>`. Soma **R$ 975,40**.

**Identidade fechada, não inferida.** O print do banco dela (uid 714) mostra
`08:23 R$ 303,40 em 10x` e `08:34 R$ 672,00 em 6x`. Horário **ao minuto** e
**número de parcelas** batem nos dois. Não é semelhança de valor — é a mesma
compra. O dinheiro dela **já tinha voltado**.

### 2.3 ⚠️⚠️ O zero era FALSO em quatro instrumentos ao mesmo tempo

Medido hoje, todos devolvendo "não há nada":

- `pagou_de_verdade.cjs` no e-mail dela → **"SEM PAGAMENTO ENCONTRADO"**
- `aluno.cjs` → **"compras: NENHUMA"**
- `achar_compra_por_nome.cjs` (Vigia, 22/09) → 8 meses, 56 compras, **ZERO**
- meu script novo por VALOR+DATA → **329 de 329** compras lidas em 30/08–01/09,
  **ZERO** nos dois valores

Causa única: **`/sales/history` só devolve compra PAGA. REFUNDED some.**

**Provado por controle, não por suposição.** Peguei 5 transações que a nossa
`payment_events` registra ordenadas DENTRO da janela com status
DELAYED/BILLET_PRINTED (`HP2383446026`, `HP2572235142`, `HP3314415771`,
`HP3381746828`, `HP0691567194`): as **cinco ausentes** da resposta da API. E
**100% dos 329** itens vieram PAGO. O endpoint filtra por status pago e não
avisa.

⚠️ **Um falso negativo meu, corrigido no caminho:** meu primeiro teste de
cobertura pegou transações por `received_at` (data do webhook) e concluiu
"5 ausentes → API cega". Estava **errado**: aquelas quatro tinham `order_date`
de 14/08, 22/08 e 27/08 — fora da janela, ausência **correta**. A API filtra por
`order_date`, não pela data do evento. Só o segundo teste, com transações
*ordenadas dentro* da janela, provou a cegueira de verdade.

### 2.4 O que isso quase custou, e o que salvou

Com quatro zeros na mão, o próximo passo natural era escrever pra ela que os
R$ 975,40 **"nunca entraram nesta casa, procure a Hotmart pra saber quem
recebeu"** — acusação falsa, sobre dinheiro que a própria casa já tinha
devolvido, contra uma aluna que respondeu tudo que pedimos em menos de 17h.

**O que salvou não foi instrumento: foi ler a nota 3 do próprio cartão** (Vigia,
07/09), onde os dois códigos de transação estavam escritos desde sempre. Com o
código na mão, `/sales/history?transaction=` devolve o item REFUNDED na hora.

Mesma família do `profiles.ja_pagou` (ordem de 18/08, SUSPENSA) e do
`/subscriptions/{code}/purchases` cego a assinatura cancelada (`5c68eb33`):
instrumento que lê **"não"** quando a resposta honesta é **"eu não enxergo"**.

### 2.5 Por que ela ficou 16 dias esperando

Não foi falta de trabalho — foi o **estorno apagando ela de toda busca no meio
do próprio atendimento**. Em 07/09 15hZ o Vigia mediu as duas como APPROVED. Em
22/09 20hZ o balde de nome de 8 meses já devolvia ZERO. O estorno caiu nessa
janela, e a partir dali a casa passou a perguntar de novo uma coisa já
resolvida — inclusive pedindo print **duas vezes**.

### 2.6 Feito

1. **Carta individual pra ela** (regra 8, SMTP do `suporte@`): os dois códigos,
   valores, datas, forma de pagamento e situação ESTORNADA; que estorno de
   parcelado entra como **crédito na fatura** e pode levar 1–2 faturas; que as
   parcelas futuras deixam de ser cobradas; e assumindo por escrito que os 16
   dias e a repetição de pedido foram **culpa nossa**. Cópia **CONFIRMADA** na
   pasta Enviados **uid 3311**, tentativa 1, registrada em `emails_enviados`.
   Rascunho versionado em
   `_frank/rascunhos/2026-09-23_simone_leal_estorno_confirmado.html`.
2. **Incidente FECHADO** (`fixed`, `resolved_at` gravado) com `resolution_note`
   dizendo o que era e o que foi feito. Conferido no retorno do `update`:
   **1 linha afetada**, notas **15 → 16** — não no que o script pretendia fazer.
3. **Ferramenta nova**:
   `_frank/ferramentas/2026-09-23_achar_compra_por_valor_e_data.cjs` — a busca
   por VALOR+DATA que o Vigia pediu, com **controle positivo embutido** (par
   medido de 21/09, `HP3461697829` + `HP3869146914`) que aborta o script se
   parar de enxergar compra conhecida, e modo **`--transacao`**, a única
   consulta da casa que enxerga REFUNDED/CANCELLED. A armadilha do §2.3 está
   gravada no cabeçalho, com os 5 códigos do controle.

### 2.7 O que eu não fiz, e por quê

**Não estornei nada** — já estava estornado. **Não escalei dinheiro ao Johnny:**
não há decisão pendente aqui, o reembolso que ela pediu já aconteceu. **Não
prometi data** de crédito na fatura (não tenho a data em que a Hotmart
processou, e disse isso a ela com essas palavras). Não mexi em crédito, acesso,
plano, entitlement, GPU nem migration. Não li nem reprocessei nada da planilha.

---

## 3. Fim de ronda

- Log commitado na **main** (regra 25-B).
- **Nenhum código de produção tocado** — não há fix preso em branch de feature.
  Conferido com `git log origin/main..HEAD` e `git branch`.
- Escritas conferidas na releitura: incidente fechado (1 linha, 15 → 16 notas),
  carta com cópia confirmada na pasta remota (uid 3311).
- Grupo: fato consumado postado com `notify-grupo.sh` — o fechamento e a carta.
  Nada de log de terminal, nada de progresso parcial.
