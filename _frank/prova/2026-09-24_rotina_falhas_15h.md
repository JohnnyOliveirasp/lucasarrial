# Ronda das falhas — 24/09 ~14h41–15h00Z (Frank, dono da fila)

**Desfecho: 1 incidente FECHADO até o fim (`#469` / `b706b32e`, vazamento de
crédito), e o conserto dele NÃO precisou ser escrito — já estava em produção
havia 6 dias, commitado 40 minutos depois do próprio cartão nascer. O achado da
ronda é por que ninguém tinha percebido: o censo que a ronda usa pra escolher
"o mais antigo" ordena pelo dia em que o CARTÃO foi escrito, não pelo dia em que
o problema começou — e esse cartão aparecia como tendo 6 dias, não 41.**

Gasto: **zero GPU, zero crédito de aluno movido, zero migration, zero DDL, zero
e-mail enviado, zero merge.** Escritas: 1 fechamento de incidente, 1 nota, 1
recado no grupo, este log.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=…14:06:31Z --confirmar` | **0** escriturável. **1199 = 1199**, nenhuma carta sumiu (1122 já com linha + 77 fora da janela). |
| `enviados_x_tabela` (irmão de leitura, independente) | **VEREDITO: 0 carta depois do corte.** Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho **0d**. Controles positivo (#310) e negativo (#518) OK, 535 varridos. |
| `pagante_trancado.cjs` | **0** pagante trancado · **0 na fronteira** (eram 23 — a virada das 12:00 passou e resolveu sozinha) · 1 sem prova (`drfabiovilhena29@`, 3º dia) |
| Censo da fila | **115** abertos (−1) · 68 com 7d+ |
| `esperando_johnny` | **17** parados em decisão · mais velho **56d** · **54 alunos** atrás da fila |
| `conserto_pronto_e_parado` | **38** mergeáveis parados · 24 há 3d+ · **19** apodrecidos (era 20) · mais velho 35d |

### 1.1 O defeito conhecido do instrumento novo se repetiu — e ele se recusou de novo

`conserto_pronto_e_parado.cjs` **abortou na 1ª execução**: 57 PRs voltaram
`UNKNOWN`. É exatamente o defeito anotado ontem (ele dispara ~58 `gh pr view` em
rajada e o GitHub responde `UNKNOWN` enquanto calcula). Ele **morreu em vez de
imprimir "0 mergeável"**, que é como foi desenhado. 2ª execução devolveu o quadro
cheio.

> **Segue sem conserto, pelo 2º dia:** falta a segunda passada nos `UNKNOWN`.
> A ferramenta só funciona porque é rodada duas vezes — por acidente, não por
> desenho. Não consertei nesta ronda (peguei o `#469`); fica anotado pela 2ª vez.

## 2. Por que este cartão

Desci a fila por idade. Os três da frente seguem **fora da minha alçada**, e a
leitura de 40 minutos atrás continua valendo (`d3d8d1b2`: o corpo do PR #404 diz
`❌ NÃO mergear — decisão do Johnny`; `37bacb68`: gargalo é a decisão (a)/(b)/(c)
do `702cc916`; `f8587cef`: esperar n crescer, medido às 02hZ de hoje).

Peguei o **`#469`** por duas razões: é o **2º mais velho da fila** por
`first_seen_at` (**41,5d**), e é **vazamento de dinheiro** — a exceção que a
regra 8 permite abrir fora da ordem. E ele estava **genuinamente sem trabalho**:
4 notas, nunca triado.

## 3. `#469` — o conserto estava pronto havia 6 dias e ninguém fechou o cartão

### 3.1 O que era

`houveDebitoDeTreino(userId, voiceId)` perguntava *"existe **alguma** linha de
débito pra esta voz?"* e nunca *"esse débito ainda está por devolver?"*.
Estornar não apaga a linha do débito, **acrescenta a linha oposta**. Então na 2ª
falha da MESMA voz a consulta achava o débito original de novo e estornava de
novo: **N falhas na mesma voz = N estornos contra 1 débito.**

Caso que abriu o cartão — voz `600173a6`, 18/09:

```
14:43:26Z  training        -10.000  ref_type=voice
14:44:28Z  extra_purchase  +10.000  ref_type=voice_train_refund
15:31:18Z  extra_purchase  +10.000  ref_type=voice_train_refund   ← 2º estorno, 1 débito
```

### 3.2 O conserto já existia — e nasceu deste cartão

Commit **`aadddad3`**, *"fix(creditos): estorno de treino decide por SALDO
PENDENTE, nao por 'existe debito'"*, de **18/09 16:37:23Z**.

O cartão nasceu às **15:57:53Z**. O conserto veio **40 minutos depois**, no mesmo
dia, escrito em resposta direta a ele — o comentário do código cita a voz
`600173a6` e o horário nominalmente. **E o cartão nunca foi fechado:** ficou
**6 dias em `investigating`** anunciando como pendente um defeito que já não
existia, e contando nas estatísticas da fila igual a um que ninguém olhou.

`houveDebitoDeTreino` foi **removida** (0 ocorrências na árvore inteira). No
lugar, `saldoPendenteDoTreino` (soma algébrica dos lançamentos do `ref_id`) +
`valorDoEstornoDeTreino` (`Math.min(devido, teto)`).

**Foi além do que o cartão pediu:** o cartão pedia um booleano corrigido;
entregaram o **valor apurado**, então estorno parcial também fecha certo.

### 3.3 Alcance MAIOR do que o próprio cartão afirmava

O cartão dizia — com honestidade — que só o caso do Heitor tinha o mecanismo
provado, e que as **3 vozes de agosto** (`ca61b94d` 14/08, `8aca0126` 15/08,
`b5ea6b9b` 17/08) tinham forma **diferente** (zero débito, 1 estorno) e **não
foram investigadas**.

Conferido no código: **a mesma correção fecha as duas formas.** Zero débito →
`saldoPendente = 0` → a guarda `if (args.saldoPendente >= 0) return 0` devolve
**0**. O buraco velho morreu junto com o novo, sem ninguém ter reivindicado isso.

### 3.4 Medição — varredura completa, não amostra

Cruzei **todo** o `credit_transactions` por `ref_id` (débito
`kind='training'`/`ref_type='voice'` × estorno `ref_type='voice_train_refund'`).

> Conferido por **`ref_type`, JAMAIS por `kind`** — o estorno grava
> `kind='extra_purchase'`. É a armadilha da ordem de 20/08 que quase pagou 13
> alunos em dobro.

Vozes com `estornado > debitado`: **4** — exatamente as mesmas 4 do cartão,
**nenhuma nova**. A mais recente é a do Heitor, **18/09 15:31:18Z**: a última
ocorrência do vazamento é **anterior** ao commit do conserto (16:37Z).
**Zero ocorrência nova em 6 dias.**

### 3.5 Prova de que está em produção (conteúdo, não promessa de PR)

- `aadddad3` é **ancestral de `origin/main`** (`merge-base --is-ancestor`: OK).
- Conferido no **conteúdo da `origin/main`** via `git cat-file`:
  `saldoPendenteDoTreino` presente, `houveDebitoDeTreino` **ausente (0)**.
- `Deploy Frontend (production)` **SUCCESS** repetido desde então.
- `HEAD == origin/main == 8e587c0f` no momento da conferência.

### 3.6 Controle de mutação — porque teste que passa só vale se pega a regressão

`saldo-pendente-do-treino.test.ts`: **5 pass / 0 fail**.

Apliquei o mutante que **reintroduz o bug** — a perna do estorno casando por
`kind === "training"` em vez de `ref_type === "voice_train_refund"` (com ele o
estorno nunca é encontrado, o saldo parece eternamente devedor e a casa paga o
mesmo débito em toda falha):

| estado | resultado |
|---|---|
| main | **5 pass / 0 fail** |
| com mutante | **4 pass / 1 FAIL** |
| restaurado | **5 pass / 0 fail**, `git diff --stat` vazio |

A guarda está **viva** e pegaria a volta do defeito.

### 3.7 O aluno

`heitorcamargo7@gmail.com` **não foi prejudicado** — ele **recebeu** 10.000 cr
indevidos, não perdeu nada. **Não há aluno esperando resposta neste cartão** e
nenhuma carta foi enviada: o único motivo pra escrever a ele seria **pedir
crédito de volta**, que não é ação autorizada.

### 3.8 O que este fechamento NÃO resolve

Os **40.000 cr** já concedidos (10.000 × 4 vozes) continuam com os alunos.
**Não recolhi.** Tirar crédito de assinante pagante é ação de dinheiro
irreversível e **não existe ordem da casa que a autorize** — as ordens cobrem
**devolver** crédito cobrado errado, nunca o contrário, e nenhum dos 4 tem culpa.

Isso é **decisão comercial**, não defeito aberto: o mecanismo que criava o
dinheiro está morto e não produz mais nada. Foi ao grupo como item de decisão.

## 4. O achado da ronda: o censo da fila mede a idade errada

A pergunta que sobrou foi *por que um cartão de 41 dias com vazamento de dinheiro
ficou 6 dias sem ninguém pegar*, quando a regra da ronda é literalmente "pegue o
mais antigo".

**Porque o censo não o mostrava.** `2026-09-19_idade_dos_abertos.cjs` seleciona e
ordena por **`created_at`** — ele nem chega a ler `first_seen_at`:

```
.select("id, status, title, occurrences, created_at, last_seen_at")
.order("created_at", { ascending: true })
```

Os dois campos respondem perguntas **diferentes**: `created_at` é *há quanto
tempo a casa SABE*, `first_seen_at` é *há quanto tempo ACONTECE*. O `#469`
aparecia no censo como **6 dias** (posição funda na lista) quando o defeito
tinha **41,5**. A ronda lê o topo dessa lista. Ele nunca chegou lá.

**Medido, pra não exagerar o tamanho:** dos **115** abertos, só **3** têm
defasagem > 2 dias. Não é epidemia — é uma minoria que cai justamente no ponto
cego do critério de escolha:

| cartão | idade real | idade no censo | alunos |
|---|---|---|---|
| **`#494` / `719c9af6`** | **23,6d** | 4,2d | **9** |
| `#537` / `cfa488b5` | 17,8d | 0,7d | 2 |
| `#538` / `c015a57c` | 10,7d | 0,7d | 1 |

> **NÃO consertei o instrumento, de propósito.** Qual campo é o certo não é
> detalhe técnico: ordenar por `first_seen_at` promove cartão cujo evento é
> antigo mas cuja descoberta é nova, e isso muda a fila de prioridade da casa
> inteira. Trocar isso em silêncio numa ronda é decidir prioridade sem mandato.
> Fica **medido e escrito**; quem decidir, decide com os 3 nomes na mão.

**Consequência prática pra próxima ronda:** o **`#494`** (9 alunos, 23,6d reais)
é o mais velho **de fato** entre os que não estão travados em decisão. É ele, e
não a cabeça aparente da lista.

## 5. O que precisa do Johnny

Sem novidade estrutural além do item 4 da ronda anterior. Repetindo o lote (a
doutrina de 17/09 manda juntar, não re-escalar um por ronda):

1. **WhatsApp/telefone** para os pagantes do `#249` (R$ 8.250,27) — o mesmo aval
   destrava o `94d3015d` (Sunesa, R$597).
2. **Crédito do Gemini** (`olho`, `pesquisa`, `social`).
3. Decisão (c) do `#234` (`TTS_TAIL_QA_INTERNO_MODO=reprovando`).
4. **Quem mergeia conserto pronto** (38 parados, 19 podres). É o **3º dia
   seguido** em que o gargalo da ronda é entrega, não investigação.
5. `#426`: as 3 perguntas comerciais de 14hZ seguem abertas.
6. 🆕 **Os 40.000 cr do `#469`** — recolher dos 4 alunos ou perdoar. Não fiz nada
   e não farei sem ordem.

## 6. Fim de ronda

- Log commitado na **main** (regra 25-B).
- Conferência: **`HEAD == origin/main`** depois do `fetch`, e o commit da ronda
  conferido por `merge-base --is-ancestor`.
- Escrita conferida **na releitura independente** (não no `RETURNING`): `#469` →
  `fixed`, `resolved_by=frank`, `resolved_commit=aadddad3`, `resolution_note`
  **4.497 chars**, notas 4 → **5**.
- Recado no **grupo** via `notify-grupo.sh` (regra de canal de 31/08): 1 fato
  consumado, o fechamento do `#469`. Nada no privado do Johnny.
