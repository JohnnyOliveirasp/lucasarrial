# Ronda das falhas — 06/09, 12hZ (09h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** incidente e levei até onde ele vai sem o Johnny.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: relatório no **grupo** (ordem de 31/08).

---

## 0. A ronda em uma linha

**As duas assinaturas do Diego não são da mesma pessoa — CPF diferente e
titular Hotmart com outro nome. Isso derruba a premissa das 4 rondas
anteriores: o que destrava o caso é a frase escrita dele, não o aval do
Johnny, e cancelar a órfã no escuro passou a ser risco de cancelar assinatura
de terceiro.**

---

## 1. Por que peguei este card, e o que descartei

Fila: **31 não-fechados** (18 `investigating`, 13 `aguardando_aluno`), contados
por `status NOT IN ('fixed','ignored')`. Eram 32 às 10hZ; a ronda das 11hZ
fechou o #261.

Peguei o **f1ada07e** pela **exceção explícita da regra 8** ("dinheiro sendo
cobrado errado agora"): relógio em 08/09 12:00Z, ~48h quando abri.

**O mais antigo da fila é o `d3d8d1b2` (30/07) e eu NÃO o peguei.** Não é
descuido: ele está travado no **passo da migration 82**, que segue não
aplicada e depende de aval do Johnny. A ronda das 00:48Z já mediu e fechou as
hipóteses vivas (régua descartada por 2 caminhos, tamanho de texto descartado,
classe B inexistente). Sem a migration não há dado novo a produzir, e a nota
pede que a próxima ronda não gaste o turno redescobrindo. **Passo que falta:
aplicar a migration 82.** Também não toquei no **#222** (parado em decisão de
produto) pelo mesmo motivo.

---

## 2. O que eu medi, na fonte

Relógio **reconferido, não herdado**: `entitlements` MYEXXEMA e 4UKYMN4L as
duas `active`, as duas `access_until 2026-09-08 12:00:00Z`; Hotmart viva
(leitura pura por `subscriber_code`) com `date_next_charge` = **2026-09-08
12:00:00Z exato** nas duas.

### 2.1 Achado que muda a recomendação: não é a mesma pessoa

Conferi o `buyer` de cada `raw_event` lado a lado, o que nenhuma ronda anterior
tinha feito:

| code | nome no buyer | e-mail | CPF | telefone |
|---|---|---|---|---|
| `4UKYMN4L` | Diego Send Zap | admin@ag12x.com.br | **35579447191** | 64999526870 |
| `MYEXXEMA` | Send Zap | sendzapoficial@gmail.com | **00295425105** | 64999526870 |

**Mesmo telefone, CPF diferente.** E na Hotmart viva o titular do `4UKYMN4L`
**não se chama Diego**: `subscriber.name = "Roseli Maria de Santana"`.

Os dois e-mails de 04/09 (uids 1037/1038) e as notas de 04 e 05/09 tratam o
caso como "o Diego tem duas assinaturas, cancela a órfã". Com CPF diferente e
titular com outro nome, cancelar a `4UKYMN4L` sem pedido escrito deixa de ser
burocracia da 9-C e vira **risco de cancelar assinatura de outra pessoa** — o
desastre que o cabeçalho do `cancelar_assinatura.cjs` descreve. Não é falta de
autorização: é falta de **identidade provada**.

### 2.2 O dobro é risco real, mas não é certeza

Coorte equivalente (mesma oferta `ewxrfw9j`, criadas 01–06/08, trial vencido,
n=123): **57 viraram recorrência paga de R$97 (46%)**, 64 nunca cobraram
(33 `active` + 31 `canceled`). O Diego tem ~46% de chance do débito duplo, não
100%.

Preço conferido, não herdado: na `ewxrfw9j` a recorrência 1 é valor 0 (611
casos) e a 2 é R$97 (218 de 236 em BRL). O R$194 dos e-mails está certo.

**Dinheiro cobrado até agora: zero.** As duas seguem em `recurrence_number=1`,
`price value=0`. Nada a estornar nesta perna.

**Erro meu, registrado:** a primeira consulta deu "0 de 118" convertidos e
estava **errada** — a recorrência nova **atualiza a mesma linha** por
`external_id`, não cria linha nova. Quase reportei "ninguém nunca é cobrado".

### 2.3 Pergunta aberta que eu não fecho

Hotmart diz **`DELAYED`** nas duas; o nosso banco diz `active`. Medido contra a
população para não virar alarme: `DELAYED` **não** é rótulo universal de trial
— no grupo que vence hoje há `DELAYED` (1K7OBBQI, EB3Y8BBS) e `ACTIVE`
(N3C3SILX) lado a lado. **Não sei o que `DELAYED` implica e não afirmo que é
falha de cobrança.** Fica como pergunta, não como causa.

### 2.4 Armadilha operacional fechada antes da hora H

A nota de 01:00Z mandou não descobrir na hora. Rodei o `cancelar_assinatura.cjs`
em **ensaio** nos dois codes: o `--orfa` existe e funciona, resolveu a órfã,
casou entitlement e assinatura pelo mesmo code e imprimiu
`ENSAIO: cancelaria o code 4UKYMN4L`. **Nada foi cancelado.** Chegando a frase,
o comando roda direto.

---

## 3. O que eu fiz com o aluno

Conferi antes que ele **não** respondeu em nenhuma das duas caixas. Mandei
**um** lembrete nos dois endereços — Sent **uid 1127** e **uid 1128**, cópias
confirmadas. Curto, com o prazo, dizendo que **nenhuma cobrança duplicada saiu
ainda**, explicando o CPF diferente e pedindo a frase por escrito.

**Por que hoje e não em 07/09** (regra dos ~3 dias): 3 dias cheios caem em
07/09 21:49Z, e a ronda seguinte a isso é a de ~11hZ de 08/09, **uma hora antes
da cobrança**. O prazo vence a regra do lembrete. Registro a justificativa para
não virar precedente de pressionar aluno sem motivo.

---

## 4. Precisa de DECISÃO do Johnny

1. 🔴 **Diego — e a minha recomendação MUDOU.** Não autorizar cancelamento
   unilateral da `4UKYMN4L`. Com CPF e titular diferentes, se ele não responder
   até 08/09 o certo é **deixar cobrar e tratar como reembolso**, não cancelar
   no escuro. Cancelar errado não tem desfazer; cobrança errada tem.
2. 🔴 **Migration 82** — é o único passo que destrava o `d3d8d1b2` (37+ dias).
3. 🔴 **21 PRs abertos e zero commit na main.** #186, #176 e #90 fecham chamado
   aberto agora.
4. **#222** — vínculo por confirmação, decisão de produto. Sexta ronda parada.

---

## 5. O que eu NÃO fiz

Não cancelei, não estornei, não mexi em crédito, não apliquei migration, não
gastei GPU, não mergeei PR, não reabri incidente e não toquei em nada da
planilha. Leitura da Hotmart foi `GET` puro. Caixa lida com `EXAMINE` +
`BODY.PEEK`.

Gravação conferida na releitura: `agent_notes` 10 → 11, 1 linha afetada; título
corrigido com `returning` (1 linha).
