# Ronda das falhas — 23/09, ~19hZ (Frank, dono da fila)

Serial da vez: **#437 `acac6983` (Mariana)** — **fechado**. Não é o mais antigo
da fila, e a §2 diz por quê — com a diferença de que desta vez eu **medi** a
fila de cima em vez de herdar a conclusão da ronda anterior.

Nada gasto: sem GPU, sem crédito movido, sem migration, sem merge, sem código de
produção tocado, sem e-mail em massa. As escritas foram **1 carta individual**
(regra 8 de 21/08), **1 fechamento de incidente** e **45 recados mortos
apagados** (com dump).

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável. 1109 lidas = 1032 já com linha + 77 fora da janela. **1109 = 1109**, nenhuma sumiu. |
| `enviados_x_tabela` (irmão de leitura, independente) | **0** carta depois do corte fora da tabela. Buraco **passivo**. |
| `percepcao_travada.cjs` | **0** travados. Controle positivo (#310) e negativo (#518) OK, 517 varridos. |
| `idade_incidentes` | **141** abertos (open 6 · investigating 100 · aguardando_aluno 35) · 30d+: 4 · 15-30d: 28 · 7-15d: 54 |
| `esperando_johnny` | **17** parados no Johnny · mais velho **55d** · **54** alunos atrás da fila · +8 não triados |

As 77 cartas anteriores ao corte seguem sem decisão, como a ordem prevê.

---

## 2. Por que o serial não é o mais antigo (medido, não herdado)

A fila de cima continua travada em decisão de terceiros — confirmei que
`c726c5ae` (106d), `d3d8d1b2` (55d), `b706b32e` (40,7d) e `37bacb68` (35d)
seguem no Johnny, e `af06731f`/`99a20692` seguem legitimamente no aluno.

Em vez de repetir a descida manual da ronda anterior, montei o recorte que acha
**silêncio de verdade**: cartão aberto, com aluno nomeado, **nascido depois de
14/09** (quando `emails_enviados` passa a existir) e **sem nenhuma carta desde
que o cartão nasceu**. Deu 25.

⚠️ **E o recorte tem falso positivo, medido antes de eu usar o número.** O
`2f786411` (Leiliane, 7,0d) aparecia como silêncio e **não era**: a baixa de
16/09 diz *"respondido via email e reenviado o acesso"*, assinada por
`suporte@lucasarrial.com` — carta do time humano, que **não passa pelo nosso
SMTP e por isso nunca tem linha em `emails_enviados`**. Descontando quem tem
nota `tipo='aluno_respondido'`, sobram 23. Registro o defeito do instrumento
para ninguém reportar "23 alunos no silêncio" sem esse desconto: a maioria dos
23 restantes são cartões de **classe** (`frank:`, `fail-burst:`, `generation:`,
`vigia:`), onde o e-mail é **amostra**, não alguém esperando resposta.

Filtrando para quem de fato escreveu pra casa (`help:atend:`), sobrou um nome
repetido **4 vezes**: a Mariana.

---

## 3. Serial: `acac6983` (#437, Mariana) — **fechado**, e o defeito era o silêncio

**O diagnóstico já estava certo e completo desde 16/09 22:24Z**, escrito pelo
EXECUTOR, com o plano correto: responder por e-mail com o contorno operacional.
**A carta nunca saiu.** Foram **7,0 dias**.

### O que esses 7 dias custaram a ela, em número

Ela não ficou parada esperando: o ledger mostra uso **ativo até hoje 23/09
18:16Z**, com saldo caindo de **96.376 → 60.885** créditos. Ou seja, ela passou
a semana inteira pagando caro exatamente no problema que tinha perguntado como
evitar. Silêncio aqui não foi só falta de educação, foi crédito dela queimado.

### Conferido no FONTE antes de escrever (não repeti a nota de ontem)

- `lib/credits/config.ts:13` — `GENERATION_MIN_CREDITS = 400` ✔
- `lib/credits/config.ts:24-25` — `generationCreditCost() = max(400, text.length)` ✔
- `generationCreditCost` tem **um único chamador** em todo o frontend
  (`app/api/v1/voices/[id]/generate/route.ts:174`) → **não existe** caminho de
  preview/teste barato.

Por isso a carta diz a ela que esse botão **não existe**, em vez de inventar um.

### A carta (uid **3279** confirmado na pasta Enviados)

`msgid <frank-1790189507073-ixlw3fchxga@fastcloner.com>`, linha **conferida em
`emails_enviados` depois de gravar** (1 linha, 18:51:49Z, origem `ronda-manual`,
bounce nulo).

Diz: (a) os 7 dias de silêncio foram falha nossa, assumida por escrito; (b) modo
de teste barato não existe; (c) o contorno que funciona hoje — como o custo é
`max(400, nº de caracteres)`, juntar **todas** as siglas num único texto de até
400 caracteres derruba o teste de `N×400` para `1×400` (10 siglas: 4.000 → 400
créditos); (d) a dica que dispensa o teste — escrever a sigla foneticamente
(`cê-ênê-pê-jota` em vez de `CNPJ`); (e) o estorno das falhas dela.

**Estorno conferido pelo campo certo** (armadilha da ordem de 20/08): por
`ref_type='generation_refund'`, **nunca** por `kind` — **14 estornos, +14.288
cr**. Declaro o limite da medição: medi o **total**, não casei 1:1
falha→estorno, e a carta diz exatamente isso, sem afirmar completude que eu não
medi.

### O que **não** fechou junto

Mexer no **piso de 400 / preço do teste** é decisão comercial do Johnny. Fechei
o **atendimento** (ela está respondida e tem contorno que funciona hoje),
seguindo a doutrina do próprio cartão: *responder o aluno e consertar o defeito
são duas coisas diferentes*. O item do piso foi ao grupo. Se ela responder, o
cartão reabre sozinho.

---

## 4. 45 recados mortos apagados — o imposto que cada ronda vinha pagando

**Sintoma que eu senti na pele nesta ronda:** conferi 4 recados da fila
(Walsicleia, Valdemir `cd74e57f`, Hellen, Dan `a6e21646`) e os **quatro já
estavam tratados** — carta enviada, cartão parado no aluno, trabalho feito. Meia
ronda gasta remedindo trabalho pronto.

Medido: **153 recados**, dos quais **45 apontavam para incidente já
`fixed`/`ignored`** — 29% de puro ruído, mandando a ronda seguinte refazer o que
já estava fechado.

O `03_ROTINA.md` §1 já manda apagar com `DELETE` quando tratado (e avisa que
`update ... set value = null` volta `23502` e **deixa a chave no lugar**), e há
precedente de 17/09 (`2026-09-17_recados_mortos_apagados.json`). Segui os dois:

- **Dump antes de apagar** → `_frank/prova/2026-09-23_recados_mortos_apagados.json`
  (72 KB, 45 recados com texto integral — reversível a partir daí).
- `DELETE ... RETURNING key` → 45 chaves devolvidas.
- **Conferido depois**: `153 → 108`, e a quebra por status não tem mais
  **nenhum** `fixed`/`ignored` (sobram investigating 63 · aguardando_aluno 29 ·
  open 2).

Critério conservador de propósito: só apaguei recado cujo **incidente está
fechado**. Recado de cartão aberto não foi tocado.

---

## 5. Investigado e **descartado** — saldo negativo NÃO é bug

Achei 13 contas com saldo **negativo**, 12 delas no valor idêntico de
**−10.525** (soma −137.875). Valor repetido igual costuma ser causa sistêmica, e
quase virou incidente.

**Não é defeito.** Fui ao `credit_transactions` antes de abrir cartão e a nota do
próprio débito diz, literalmente: `[onboarding: pode ficar negativo]`. O
onboarding debita −525 (avatar) e −10.000 (treino da voz) contra saldo zero, por
design. O 13º caso (−11.575) é um `PURCHASE_REFUNDED` de 22/09 com
`credits_extra` preservado, também deliberado. As 13 são `plan=free`, **sem
acesso e sem pagante** — ninguém está sendo cobrado.

Registro aqui para a próxima ronda não "descobrir" isso de novo e abrir cartão
em cima de comportamento intencional.

---

## 6. Também conferido e sem ação

- **`cd74e57f` (Valdemir)**: o `percepcao_travada` devolveu 0 e está **certo** —
  a última nota é o *"EU OLHEI, NÃO SUPUS"* do Frank em 22/09, com a percepção
  já feita e a aluna respondida. O que estava velho era o **recado**, não o
  cartão. (Recado apagado na limpeza da §4.)
- **Walsicleia (`f8a71e43`)** e **Hellen (`2609241a`)**: ambas já escritas
  (22/09 23:27Z e 23/09 01:26Z), paradas legitimamente na resposta delas, com
  data anotada. Pela regra 8 saíram do meu colo — não são travamento.
- **Dan (`a6e21646`)**: respondido 21/09 (uid 3091).

---

## 7. Fim de ronda

- Log e dump commitados na **main** (regra 25-B).
- **Nenhum código de produção foi tocado** nesta ronda, logo não há fix preso em
  branch de feature.
- Escritas: carta à Mariana (uid 3279, linha conferida em `emails_enviados`);
  fechamento do `acac6983` (1 linha afetada, conferida na releitura); 45 recados
  apagados (dump commitado).
- Grupo: postado (fechamento do #437 + a carta, o item de preço para o Johnny, a
  limpeza dos 45, e os passos fixos sem novidade).
