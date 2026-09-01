# Cancelamentos de 25/08 — apuração

Rodado em 26/08 pela rotina diária de cancelamentos.
Ferramenta: `_frank/ferramentas/cancelamentos_ontem.cjs` (somente leitura).

```
node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-08-25
```

Janela: `2026-08-25T00:00:00Z` → `2026-08-26T00:00:00Z`.
10 eventos `SUBSCRIPTION_CANCELLATION` → **10 pessoas** (nenhum e-mail repetido).

Classificação feita contra a **Hotmart viva**, por **pessoa** (e-mail), lendo
TODAS as assinaturas de cada uma. Critério de "pagou": `price.value > 0` **E**
`status ∈ {COMPLETE, APPROVED}` — `OVERDUE` não é pagamento (armadilha 1).

**Armadilha 2 conferida:** nenhuma das 10 tem outra assinatura viva
(`ACTIVE`/`STARTED`/`DELAYED`). `danilo.oliveira1910` tinha duas assinaturas
(`M0TGKKE5` e `AR4S83XK`) — ambas `INACTIVE`/`CANCELLED_BY_CUSTOMER`. Nenhuma
salva ninguém.

**Nada foi alterado. Nenhum saldo tocado, nenhuma função religada.**

Scripts de conferência (a pasta `_Bugs/` é gitignorada — o código está colado
no fim deste arquivo para poder ser auditado sem re-executar):
`_Bugs/2026-08-26_confere_cancelamentos_25.cjs`,
`_Bugs/2026-08-26_backlog_trial.cjs`,
`_Bugs/2026-08-26_confere_backlog_hotmart.cjs`,
`_Bugs/2026-08-26_allowlist_vs_backlog.cjs`,
`_Bugs/2026-08-26_pagantes_sem_marcador.cjs`,
`_Bugs/2026-08-26_causa_do_zeramento.cjs`.

---

## 1. FORA DA REGRA — a varredura está desligada há 8 dias, e hoje eu medi o buraco inteiro

**Causa única, já conhecida:** `expire_trial_credits` está **DESATIVADA desde
18/08**. Corpo vivo lido agora (`pg_get_functiondef`, não é suposição):

```
DESATIVADA POR FRANK EM 18/08 18:5x: a primeira rodada real zerou 14 pessoas
que PAGARAM (conferido na Hotmart, 6 de 6 na amostra).
```

**Oitavo dia consecutivo.** Ela foi desligada por um motivo certo; ninguém
religou, e o outro lado da regra parou junto.

### O que muda hoje: o número que os relatórios anteriores davam estava certo mas era pequeno demais

Os relatórios de 20/08 a 25/08 sempre mediram o vazamento **da coorte do dia**
(ontem: 6 pessoas / 438.950 cr). Isso é a conta certa para a pergunta "quem
cancelou ontem", mas responde errado a pergunta que importa: **quanto já está
parado no total?** Hoje eu contei o acumulado de todas as coortes:

| | pessoas | créditos |
|---|---|---|
| **Já passou do dia 10 e o crédito continua lá** | **20** | **1.648.085** |
| Ainda no prazo, mas não existe máquina pra cumprir o prazo | 33 | 2.422.200 |
| **TOTAL parado pela varredura desligada** | **53** | **4.070.285** |

Isso é **9× o número que vínhamos reportando**, e não é porque piorou de
ontem pra hoje — é porque a conta certa nunca tinha sido feita.

**Os 20 do primeiro bloco foram conferidos um a um na Hotmart viva, não no
nosso banco.** 20 de 20 confirmados como trial que nunca pagou. Zero
desmentidos, zero erros de consulta:

```
=== CONFIRMADOS trial-que-nunca-pagou (20) ===
   deboramaria02@gmail.com            rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   franciscofragoso48@gmail.com       rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   contatoelvysmax@gmail.com          rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE ×4
   nilma.advogada@gmail.com           rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   ricardoborgesfigueiredo81@gmail.com rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   plutotv2026@gmail.com              rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   guipaueli@gmail.com                rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   adrianomedeiros.dev@gmail.com      rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   simonedalmasosp@gmail.com          rec#1 R$0 CANCELLED ×7 | rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   millidiu@gmail.com                 rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   newquality2018@gmail.com           rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   juliana.caran@hotmail.com          rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   makaniws@gmail.com                 rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   paulovasconste@gmail.com           rec#1 R$0 CANCELLED ×5 | rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   aprendacomliz@gmail.com            rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE ×2
   warleysantosfranca@gmail.com       rec#1 R$0 COMPLETE | rec#2 R$97 OVERDUE
   viniciusbergamo.epm@gmail.com      rec#1 R$0 COMPLETE
   personaltrainer.nelsonlopes@gmail.com rec#1 R$0 APPROVED
   laisdamatapenteado@gmail.com       rec#1 R$0 COMPLETE
   karinnarihanna@gmail.com           rec#1 R$0 COMPLETE

=== DESMENTIDOS pela Hotmart — NAO SAO CALOTEIROS (0) ===
=== ERROS de consulta — nao concluir nada sobre estes (0) ===
```

Detalhe dos 20 (dia 10 já vencido):

| dia 10 | crédito | pessoa | adesão | cancelou |
|---|---|---|---|---|
| 31/07 | 100.000 | deboramaria02@gmail.com | 21/07 | 05/08 |
| 01/08 | 100.000 | franciscofragoso48@gmail.com | 22/07 | 11/08 |
| 01/08 | 100.000 | contatoelvysmax@gmail.com | 22/07 | 21/08 |
| 01/08 | 100.000 | nilma.advogada@gmail.com | 22/07 | 29/07 |
| 07/08 | 100.000 | ricardoborgesfigueiredo81@gmail.com | 28/07 | 17/08 |
| 07/08 | 100.000 | plutotv2026@gmail.com | 28/07 | 06/08 |
| 08/08 | 100.000 | guipaueli@gmail.com | 29/07 | 13/08 |
| 08/08 | 99.600 | adrianomedeiros.dev@gmail.com | 29/07 | 05/08 |
| 11/08 | 26.480 | simonedalmasosp@gmail.com | 01/08 | 12/08 |
| 12/08 | 100.000 | millidiu@gmail.com | 02/08 | 10/08 |
| 14/08 | 22.633 | newquality2018@gmail.com | 04/08 | 13/08 |
| 14/08 | 100.000 | juliana.caran@hotmail.com | 04/08 | 24/08 |
| 18/08 | 66.537 | makaniws@gmail.com | 08/08 | 15/08 |
| 18/08 | 98.425 | paulovasconste@gmail.com | 08/08 | 24/08 |
| 19/08 | 80.456 | aprendacomliz@gmail.com | 09/08 | 18/08 |
| 19/08 | 60.030 | warleysantosfranca@gmail.com | 09/08 | 16/08 |
| 24/08 | 81.421 | viniciusbergamo.epm@gmail.com | 14/08 | 21/08 |
| 25/08 | 75.340 | personaltrainer.nelsonlopes@gmail.com | 15/08 | 21/08 |
| 25/08 | 48.618 | laisdamatapenteado@gmail.com | 15/08 | 22/08 |
| 26/08 | 88.545 | karinnarihanna@gmail.com | 16/08 | 18/08 |

⚠️ **A allowlist da equipe foi conferida à parte e nenhum dos 53 é da casa**
(`_Bugs/2026-08-26_allowlist_vs_backlog.cjs`): 3 e-mails na allowlist real
(admin + cortesia), 0 batendo com o backlog, com controle positivo e negativo
na mesma execução.

---

## 2. FORA DA REGRA — 130 pagantes ficariam expostos no dia em que a varredura religar

Este é o item que eu não esperava encontrar, e ele é maior que o item 1.

O relatório de 20/08 registrou que os assinantes estavam a salvo porque tinham
o marcador `paid` em `trial_credit_expirations` — *"estão fora da varredura pra
sempre"*. Isso está **correto**, e agora está provado no código, não suposto.
`scripts/80_trial_credit_expiry.sql:95`:

```sql
where t.trial_start <= now() - make_interval(days => p_grace_days)
  and not exists (select 1 from public.trial_credit_expirations e where e.email = t.email)
```

Quem tem linha na tabela — qualquer `outcome` — nunca mais é avaliado. O
marcador é imunidade permanente.

**O problema é que a tabela parou de crescer no dia em que a função foi
desligada.** As 328 linhas são todas de **2026-08-18**, sem exceção:

```
marcadores: 328 linhas | datas distintas: ["2026-08-18"]
por outcome: {"paid":231,"zeroed":97}
pagantes de verdade (filtro FORTE, historico): 376
```

Ou seja: **todo mundo que virou pagante depois de 18/08 está sem imunidade.**
Quando a função religar, essas pessoas serão julgadas pela detecção interna de
"pagou" — que é exatamente a que falhou e zerou 14 pagantes.

| | pessoas | créditos |
|---|---|---|
| Pagantes sem marcador `paid` | 133 | — |
| destes, com `credits_subscription` > 0 | **130** | **20.120.767** |
| destes, começaram a pagar depois de 18/08 18:45 | 79 | — |

**20,1 milhões de créditos de gente que pagou**, contra os 1.356.554 do
incidente de 18/08. É **15× o prejuízo daquele dia**, e dois dos expostos
cancelaram ontem: `christinatheodoro19` (145.960 cr) e `marcelo@cmmcontabilidade`
(164.549 cr) — ambos pagaram `rec#2 R$97 APPROVED` e ambos estão sem marcador.

⚠️ Isto **não** é um pedido pra marcar ninguém como `paid`. Escrever 130 linhas
nessa tabela é mexer na máquina que decide saldo, e a regra 9-A é clara:
detector propõe, não executa. É um aviso de **pré-condição**: religar a
`expire_trial_credits` sem antes resolver os 130 desprotegidos transforma um
vazamento de 4 milhões num prejuízo potencial de 20 milhões.

### A causa do zeramento de 18/08 eu NÃO achei — e testei uma hipótese que deu errado

Vale registrar o negativo pra ninguém repetir o caminho. Lendo
`scripts/80_trial_credit_expiry.sql:70-90`, a CTE `ap` tira o e-mail de um lugar
só, com um `coalesce` que vira string vazia em vez de nulo:

```sql
lower(coalesce(payload->'data'->'buyer'->>'email','')) as email
```

Hipótese: evento de pagamento sem `data.buyer.email` sumiria da CTE `paid`, a
pessoa cairia como `has_paid = false` e seria zerada mesmo tendo pago.
**Refutada.** Dos 1.353 eventos `PURCHASE_APPROVED`/hotmart, **1.353 têm
`data.buyer.email`** — nenhum sem:

```
PURCHASE_APPROVED/hotmart (o universo da funcao): 1353
eventos SEM data.buyer.email .................: 0
PAGAMENTOS invisiveis pra CTE 'paid' .........: 0
controle positivo: eventos COM data.buyer.email = 1353
```

Então **a causa continua desconhecida** e o conserto continua sendo card pro
`coder`. Não vou dizer que achei o que não achei.

⚠️ Achado colateral do mesmo caminho: `trial_credit_expirations` tem 97 linhas
`zeroed`, e **nenhuma com `debited > 0`**. Bate com o relatório de 20/08
(`sum(debited) = 0`) e é coerente com a reversão de 94s — mas quer dizer que a
tabela **não guarda quanto foi tirado de cada um**. Se um zeramento indevido
acontecer de novo, o rastro pra desfazer não está aí; está em
`credit_transactions`.

---

## 3. FORA DA REGRA (menor) — cancelou na Hotmart e não existe conta aqui

| pessoa | adesão | cancelou | ficou |
|---|---|---|---|
| valeskacanci@gmail.com | 11/08 | 25/08 | 14 d |

Nenhum crédito em jogo (sem perfil, sem saldo). Fica registrado porque é o
mesmo sinal de **onboarding que não completou** visto em 24/08
(`danisostisso93`, `math.sg97`): a pessoa comprou na Hotmart e nunca chegou a
existir na plataforma. **Terceiro caso em dois dias** — vale ver se é o padrão
do playbook I.

**Zero conferido, não presumido** (armadilha 3). Busca exata e por semelhança
voltaram vazio, com controle positivo na mesma consulta:

```json
{
  "total_perfis": 1555,
  "busca_exata_valeska": 0,
  "busca_parcial_valeska": 0,
  "controle_positivo_marcusnogue": 1,
  "controle_email": "marcusnogue@gmail.com"
}
```

`controle_positivo` = `marcusnogue@gmail.com`, que existe e retornou 1. A
consulta funciona; o vazio é real.

---

## 4. Os 6 assinantes — regra 9 cumprida, saldo e acesso

Nenhum teve crédito mexido por rotina. Conferido no **extrato negativo cru**,
não só no filtro de zeramento: todos os débitos das 6 contas são consumo do
produto (vídeo, imagem, treino de voz), zero lançamentos de
`trial_expirado`/`estorno`/`subscription_expired`/`refund`/`chargeback`.

| pessoa | ficou | crédito | extra | acesso até | débitos | zeramentos |
|---|---|---|---|---|---|---|
| christinatheodoro19@gmail.com | 9 d | 145.960 | 0 | 16/09 | 29 (consumo) | **0** |
| edsonvanderbc@gmail.com | 31 d | 200.000 | 0 | 25/09 | 13 (consumo) | **0** |
| marcelo@cmmcontabilidade.com.br | 12 d | 164.549 | 0 | 13/09 | 15 (consumo) | **0** |
| catarinacouras@gmail.com | 20 d | 146.165 | 680 | 05/09 | 11 (consumo) | **0** |
| glaubebatista@gmail.com | 31 d | 100.000 | 0 | 25/09 | 10 (consumo) | **0** |
| marcusnogue@gmail.com | 22 d | 64.518 | 3.150 | 03/09 | 48 (consumo) | **0** |

Os seis pagaram de verdade:

```
christinatheodoro19  rec#1 R$0 COMPLETE 16/08 | rec#2 R$97 APPROVED 23/08
edsonvanderbc        rec#1 R$0 COMPLETE 25/07 | rec#2 R$97 COMPLETE 01/08 | rec#3 R$97 APPROVED 25/08
marcelo@cmm          rec#1 R$0 COMPLETE 13/08 | rec#2 R$97 APPROVED 20/08
catarinacouras       rec#1 R$0 COMPLETE 05/08 | rec#2 R$97 COMPLETE 13/08
glaubebatista        rec#1 R$0 COMPLETE 25/07 | rec#2 R$97 COMPLETE 01/08 | rec#3 R$97 OVERDUE + WAITING_PAYMENT
marcusnogue          rec#1 R$0 COMPLETE 03/08 | rec#2 R$97 COMPLETE 10/08
```

Todos são o caso "trial que virou pagante": `rec#1` zerado é o teste, a venda é
o `rec#2`. Classificar por `rec#1` faria os seis virarem trial e perderem
821.192 créditos que são deles.

`glaubebatista` tem `rec#3` em `OVERDUE` + `WAITING_PAYMENT` — cobrança emitida
e não paga. **Não muda nada**: ele pagou `rec#2`, a regra 9 manda manter, e o
acesso até 25/09 é o período que o webhook gravou. Registrado só pra ninguém
ler o `OVERDUE` depois e achar que é caloteiro.

`credits_extra` (680 + 3.150) não entra em conta nenhuma — a regra nunca toca
nesse saldo, e está correto que não tenha tocado.

---

## 5. Os 4 trials

| pessoa | ficou | crédito | dia 10 | o que acontece |
|---|---|---|---|---|
| valeskacanci@gmail.com | 14 d | — (sem conta) | — | nada em jogo, item 3 |
| douglasoliveiraandrade@yahoo.com.br | 6 d | 76.320 | 29/08 | **não vai expirar**, item 1 |
| danilo.oliveira1910@gmail.com | 0 d | 79.550 | 04/09 | **não vai expirar**, item 1 |
| grazielleaparecida3108@gmail.com | 0 d | 99.600 | 04/09 | **não vai expirar**, item 1 |

`danilo.oliveira1910` e `grazielleaparecida3108` assinaram e cancelaram no
mesmo dia (25/08). "Ficou" = da adesão na Hotmart (`accession_date`) até o
`cancellation_date` do evento.

---

## Nota técnica: por que a data de adesão não sai do nosso banco

A primeira versão do script de backlog devolveu **"0 pessoas, 0 cr"** — e teria
virado "não há nada vazando" se eu não tivesse mandado imprimir os
não-classificados (63 pessoas apareceram lá). O motivo, conferido no payload
cru: o evento `SUBSCRIPTION_CANCELLATION` **não tem `accession_date`**, nem em
`data.subscription`, nem na raiz. Ele tem só isto:

```json
"subscription": { "id": 45665593, "plan": { "id": 1325347, "name": "Plano Founder" } },
"date_next_charge": 1788264000000,
"cancellation_date": 1787682127915
```

A ferramenta oficial acerta porque busca a adesão na **API da Hotmart**. Quem
precisar da data a partir do nosso banco tem que derivar do evento de compra
com `recurrence_number = 1` e `price.value = 0`. Fica registrado como a terceira
vez que um zero desta rotina era defeito de consulta, não ausência de dado.

---

## O que não foi feito, de propósito

- Nenhum saldo alterado, nenhuma função religada, nenhum marcador escrito
  (regra 9-A: detector propõe, não executa).
- Não marquei os 130 pagantes como `paid`. Seriam 130 escritas na tabela que
  governa saldo, feitas por um relatório somente-leitura. É decisão do Johnny.
- Não religuei a `expire_trial_credits`. Enquanto ela estiver desligada o custo
  é vazamento (4,07 milhões), não prejuízo pro aluno. Nessa ordem continua sendo
  o lado certo pra errar — mas agora com dois números na mesa: **4,07 milhões
  parados hoje** contra **20,1 milhões expostos** se religar sem preparar antes.

---

## Apêndice — o código das conferências

A pasta `_Bugs/` é gitignorada (`.gitignore:87`), então o código que produziu
cada número deste relatório está colado aqui para poder ser auditado sem
re-executar nada. O script de backlog **não** está no apêndice: ele virou
ferramenta permanente em `_frank/ferramentas/backlog_trial.cjs`, porque a
conta acumulada precisa entrar na rotina diária, não morrer neste laudo.

### `_Bugs/2026-08-26_confere_cancelamentos_25.cjs`

```js
/**
 * Conferências do relatório de cancelamentos de 25/08 que o
 * `cancelamentos_ontem.cjs` NÃO faz sozinho. SOMENTE LEITURA.
 *
 * 1. CONTROLE POSITIVO do "não existe conta" (armadilha 3): valeskacanci
 *    voltou vazio no profiles. Vazio só vira prova se a MESMA consulta
 *    acertar alguém que existe.
 * 2. EXTRATO NEGATIVO CRU dos 6 assinantes: o relatório diz "ninguém zerou
 *    o crédito deles". Isso é um zero. Imprime TODOS os lançamentos
 *    negativos (não só os que casam com o regex de zeramento) pra mostrar
 *    que a consulta responde e que o que tem lá é consumo, não rotina.
 * 3. BACKLOG REAL da varredura desligada: quem já passou do dia 10 e ainda
 *    tem credits_subscription. O relatório do dia só olha quem cancelou
 *    ontem; a conta que cresce é esta.
 */
const { supa } = require("../_frank/ferramentas/_comum.cjs");

const ASSINANTES = [
  "christinatheodoro19@gmail.com",
  "edsonvanderbc@gmail.com",
  "marcelo@cmmcontabilidade.com.br",
  "catarinacouras@gmail.com",
  "glaubebatista@gmail.com",
  "marcusnogue@gmail.com",
];
const TRIAIS_ONTEM = [
  "valeskacanci@gmail.com",
  "douglasoliveiraandrade@yahoo.com.br",
  "danilo.oliveira1910@gmail.com",
  "grazielleaparecida3108@gmail.com",
];

(async () => {
  const db = supa();

  // ---------- 1. controle positivo do vazio ----------
  const { count: totalPerfis } = await db.from("profiles")
    .select("id", { count: "exact", head: true });
  const alvo = "valeskacanci@gmail.com";
  const { data: exato } = await db.from("profiles").select("id,email").ilike("email", alvo);
  const { data: parcial } = await db.from("profiles").select("id,email").ilike("email", "%valeska%");
  const { data: controle } = await db.from("profiles").select("id,email")
    .ilike("email", "marcusnogue@gmail.com");   // sabidamente existe

  console.log("=== 1. 'SEM CONTA' e vazio de verdade? ===");
  console.log(JSON.stringify({
    total_perfis: totalPerfis,
    busca_exata_valeska: exato?.length ?? null,
    busca_parcial_valeska: parcial?.length ?? null,
    controle_positivo_marcusnogue: controle?.length ?? null,
    controle_email: controle?.[0]?.email ?? null,
  }, null, 2));

  // ---------- 2. extrato negativo cru dos assinantes ----------
  console.log("\n=== 2. TODOS os lancamentos NEGATIVOS dos 6 assinantes (cru) ===");
  for (const email of ASSINANTES) {
    const { data: p } = await db.from("profiles")
      .select("id,email,credits_subscription,credits_extra,access_until")
      .ilike("email", email).maybeSingle();
    if (!p) { console.log(`${email}: SEM PERFIL (!!)`); continue; }
    const { data: tx, error } = await db.from("credit_transactions")
      .select("amount,kind,ref_type,note,created_at")
      .eq("user_id", p.id).lt("amount", 0)
      .order("created_at", { ascending: false });
    if (error) { console.log(`${email}: ERRO ${error.message}`); continue; }
    const rotina = (tx || []).filter((t) =>
      /trial_expirad|estorno|subscription_expired|refund|chargeback/i.test(`${t.ref_type ?? ""} ${t.kind ?? ""}`));
    const tipos = {};
    for (const t of tx || []) {
      const k = `${t.kind ?? "-"}/${t.ref_type ?? "-"}`;
      tipos[k] = (tipos[k] ?? 0) + 1;
    }
    console.log(`${email}`);
    console.log(`   saldo: ${p.credits_subscription} sub | ${p.credits_extra} extra | acesso ${p.access_until?.slice(0, 10) ?? "-"}`);
    console.log(`   debitos negativos: ${tx?.length ?? 0}  -> ${JSON.stringify(tipos)}`);
    console.log(`   destes, ZERAMENTO POR ROTINA: ${rotina.length}${rotina.length ? " !! " + JSON.stringify(rotina) : ""}`);
  }

  // ---------- 3. backlog da varredura desligada ----------
  console.log("\n=== 3. BACKLOG: trial que JA passou do dia 10 e ainda tem credito ===");
  const { data: marcas, error: eM } = await db.from("trial_credit_expirations")
    .select("email,outcome,trial_start,debited,resolved_at");
  if (eM) { console.log(`ERRO trial_credit_expirations: ${eM.message}`); }
  const marcaDe = new Map((marcas || []).map((m) => [String(m.email).toLowerCase(), m]));
  console.log(`marcadores lidos: ${marcas?.length ?? 0} (controle: a consulta respondeu)`);

  // quem cancelou nos ultimos 30 dias, pelo nosso proprio banco
  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: evs, error: eE } = await db.from("payment_events")
    .select("received_at,payload")
    .eq("event_type", "SUBSCRIPTION_CANCELLATION")
    .gte("received_at", desde);
  if (eE) { console.log(`ERRO payment_events: ${eE.message}`); return; }
  console.log(`cancelamentos nos ultimos 30 dias: ${evs.length} (controle: a consulta respondeu)`);

  const porEmail = new Map();
  for (const e of evs) {
    const d = e.payload?.data ?? {};
    const email = String(d.subscriber?.email ?? "").toLowerCase().trim();
    if (!email) continue;
    const ade = d.subscription?.accession_date ?? d.accession_date ?? null;
    const ant = porEmail.get(email);
    if (!ant || (ade && ade < ant.adesao)) porEmail.set(email, { email, adesao: ade, quando: e.received_at });
    else porEmail.set(email, ant);
  }

  const linhas = [];
  for (const { email, adesao, quando } of porEmail.values()) {
    const { data: p } = await db.from("profiles")
      .select("id,credits_subscription").ilike("email", email).maybeSingle();
    if (!p || !(p.credits_subscription > 0)) continue;
    const m = marcaDe.get(email);
    if (m?.outcome === "paid") continue;              // assinante: regra 9 manda MANTER
    const ini = adesao ? Number(adesao) : (m?.trial_start ? Date.parse(m.trial_start) : null);
    if (!ini) { linhas.push({ email, adesao: null, dia10: null, cr: p.credits_subscription, nota: "sem data de adesao no evento" }); continue; }
    const dia10 = new Date(ini + 10 * 86400000);
    linhas.push({
      email,
      adesao: new Date(ini).toISOString().slice(0, 10),
      dia10: dia10.toISOString().slice(0, 10),
      venceu: dia10.getTime() < Date.now(),
      cr: p.credits_subscription,
      marca: m?.outcome ?? "nenhum",
      cancelou: quando.slice(0, 10),
    });
  }
  const venceu = linhas.filter((l) => l.venceu);
  const aVencer = linhas.filter((l) => l.venceu === false);
  const soma = (a) => a.reduce((s, l) => s + l.cr, 0);
  console.log(`\n-- JA VENCEU (deveria estar zerado, nao esta): ${venceu.length} pessoas, ${soma(venceu)} cr`);
  for (const l of venceu.sort((a, b) => a.dia10.localeCompare(b.dia10))) console.log(`   ${l.dia10}  ${String(l.cr).padStart(7)} cr  ${l.email}  (adesao ${l.adesao}, cancelou ${l.cancelou}, marca ${l.marca})`);
  console.log(`\n-- AINDA NO PRAZO (mas a varredura esta parada): ${aVencer.length} pessoas, ${soma(aVencer)} cr`);
  for (const l of aVencer.sort((a, b) => a.dia10.localeCompare(b.dia10))) console.log(`   ${l.dia10}  ${String(l.cr).padStart(7)} cr  ${l.email}  (adesao ${l.adesao}, cancelou ${l.cancelou}, marca ${l.marca})`);
  const semData = linhas.filter((l) => l.dia10 === null);
  if (semData.length) { console.log(`\n-- SEM DATA DE ADESAO (nao classificado): ${semData.length}`); for (const l of semData) console.log(`   ${l.email} ${l.cr} cr`); }

  console.log("\n-- os 4 de ontem, um a um:");
  for (const e of TRIAIS_ONTEM) {
    const l = linhas.find((x) => x.email === e);
    console.log(`   ${e}: ${l ? JSON.stringify(l) : "sem credits_subscription > 0 ou sem perfil"}`);
  }
})();
```

### `_Bugs/2026-08-26_confere_backlog_hotmart.cjs`

```js
/**
 * Confere na HOTMART VIVA os 20 que o backlog acusou como "trial que passou do
 * dia 10 e ainda tem crédito". SOMENTE LEITURA.
 *
 * Por quê: o backlog classifica "nunca pagou" olhando o NOSSO `payment_events`.
 * O relatório de 20/08 já avisou que pagamento que existe na Hotmart e não
 * chegou no nosso banco faz um pagante virar caloteiro — foi assim que 14
 * pessoas foram zeradas em 18/08. Nenhum nome entra na conta de vazamento sem
 * confirmação positiva na fonte.
 *
 * Também confere a allowlist: `bypasses_billing` voltou 0 e zero precisa de
 * prova (a coluna pode simplesmente não existir com esse nome).
 */
const { supa } = require("../_frank/ferramentas/_comum.cjs");

const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";
const PAGO = new Set(["COMPLETE", "APPROVED"]);
const VIVA = new Set(["ACTIVE", "STARTED", "DELAYED"]);

const ALVOS = [
  "deboramaria02@gmail.com", "franciscofragoso48@gmail.com", "contatoelvysmax@gmail.com",
  "nilma.advogada@gmail.com", "ricardoborgesfigueiredo81@gmail.com", "plutotv2026@gmail.com",
  "guipaueli@gmail.com", "adrianomedeiros.dev@gmail.com", "simonedalmasosp@gmail.com",
  "millidiu@gmail.com", "newquality2018@gmail.com", "juliana.caran@hotmail.com",
  "makaniws@gmail.com", "paulovasconste@gmail.com", "aprendacomliz@gmail.com",
  "warleysantosfranca@gmail.com", "viniciusbergamo.epm@gmail.com",
  "personaltrainer.nelsonlopes@gmail.com", "laisdamatapenteado@gmail.com",
  "karinnarihanna@gmail.com",
];

async function token() {
  const u = `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}`
    + `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, { method: "POST", headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` } });
  const raw = await r.text();
  const t = JSON.parse(raw).access_token;
  if (!t) throw new Error(`Hotmart sem access_token (HTTP ${r.status}): ${raw.slice(0, 200)}`);
  return t;
}
async function get(url, H) {
  const r = await fetch(url, { headers: H });
  const raw = await r.text();
  try { return { json: JSON.parse(raw), raw, status: r.status }; }
  catch { return { json: null, raw, status: r.status }; }
}

(async () => {
  const db = supa();

  // ---- a allowlist existe mesmo? ----
  const { data: eq, error: eEq } = await db.from("profiles").select("email").eq("bypasses_billing", true);
  console.log(`=== allowlist bypasses_billing: ${eEq ? `ERRO -> ${eEq.message}` : `${eq.length} pessoa(s)`} ===`);
  if (!eEq) {
    const { count: tot } = await db.from("profiles").select("id", { count: "exact", head: true })
      .not("bypasses_billing", "is", null);
    console.log(`   controle: ${tot} perfis com a coluna preenchida (se 0, a coluna nao alimenta ninguem)`);
  }

  const H = { Authorization: `Bearer ${await token()}` };
  const confirmados = [], desmentidos = [], erros = [];

  for (const email of ALVOS) {
    const s = await get(`${BASE}/subscriptions?subscriber_email=${encodeURIComponent(email)}`, H);
    if (!s.json) { erros.push({ email, erro: `subscriptions HTTP ${s.status}: ${s.raw.slice(0, 160)}` }); continue; }
    const assinaturas = s.json.items || (Array.isArray(s.json) ? s.json : []);
    if (!assinaturas.length) { erros.push({ email, erro: `0 assinaturas — corpo cru: ${s.raw.slice(0, 200)}` }); continue; }

    const cobrancas = [];
    let falhou = null;
    for (const a of assinaturas) {
      const code = a.subscriber_code || a.subscriber?.code || a.code;
      if (!code) continue;
      const p = await get(`${BASE}/subscriptions/${code}/purchases`, H);
      if (!p.json) { falhou = `purchases ${code} HTTP ${p.status}: ${p.raw.slice(0, 160)}`; break; }
      const lista = Array.isArray(p.json) ? p.json : (p.json.items || []);
      for (const c of lista) cobrancas.push({ valor: c.price?.value ?? 0, status: c.status, rec: c.recurrency_number ?? c.recurrence_number ?? null });
    }
    if (falhou) { erros.push({ email, erro: falhou }); continue; }

    const pagas = cobrancas.filter((c) => c.valor > 0 && PAGO.has(c.status));
    const vivas = assinaturas.filter((a) => VIVA.has(a.status));
    const resumo = cobrancas.map((c) => `rec#${c.rec} R$${c.valor} ${c.status}`).join(" | ");

    if (pagas.length || vivas.length) {
      desmentidos.push({ email, pagas: pagas.length, vivas: vivas.map((a) => `${a.subscriber_code || a.code}/${a.status}`), resumo });
    } else {
      confirmados.push({ email, resumo });
    }
  }

  console.log(`\n=== CONFIRMADOS trial-que-nunca-pagou (${confirmados.length}) ===`);
  for (const c of confirmados) console.log(`   ${c.email}\n      ${c.resumo || "(nenhuma cobranca)"}`);

  console.log(`\n=== DESMENTIDOS pela Hotmart — NAO SAO CALOTEIROS (${desmentidos.length}) ===`);
  for (const d of desmentidos) console.log(`   ${d.email}  pagas=${d.pagas} vivas=[${d.vivas.join(",")}]\n      ${d.resumo}`);

  console.log(`\n=== ERROS de consulta — nao concluir nada sobre estes (${erros.length}) ===`);
  for (const e of erros) console.log(`   ${e.email}: ${e.erro}`);
})();
```

### `_Bugs/2026-08-26_allowlist_vs_backlog.cjs`

```js
/**
 * A allowlist da equipe cobre alguém do backlog? SOMENTE LEITURA.
 *
 * Por quê: o `2026-08-26_backlog_trial.cjs` tentou filtrar a equipe por
 * `profiles.bypasses_billing` — e essa COLUNA NÃO EXISTE (a consulta deu erro
 * e o filtro virou no-op silencioso). A allowlist real vive no CÓDIGO
 * (`frontend/src/lib/credits/access.ts`), que é exatamente a regra 9-A: "a
 * allowlist da equipe tem que estar dentro do SQL; `bypassesBilling` vive no
 * código do app e função no banco não passa por lá — foi assim que o sócio foi
 * zerado em 18/08".
 *
 * Imprime só CONTAGEM e os e-mails do backlog que baterem. Nunca o conteúdo
 * da allowlist (regra 18).
 */
const path = require("node:path");
const RAIZ = path.resolve(__dirname, "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv"))
  .config({ path: path.join(RAIZ, "frontend", ".env.local") });

const PADRAO_CORTESIA = "johnny.oliveirasp@gmail.com,lucas.m.arrial@gmail.com,eduardo@lucasarrial.com";
const lista = (v) => String(v ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

const admins = lista(process.env.ADMIN_EMAILS);
const cortesia = lista(process.env.COMP_ACCESS_EMAILS ?? PADRAO_CORTESIA);
const equipe = new Set([...admins, ...cortesia]);

const BACKLOG = [
  // 20 que já passaram do dia 10
  "deboramaria02@gmail.com", "franciscofragoso48@gmail.com", "contatoelvysmax@gmail.com",
  "nilma.advogada@gmail.com", "ricardoborgesfigueiredo81@gmail.com", "plutotv2026@gmail.com",
  "guipaueli@gmail.com", "adrianomedeiros.dev@gmail.com", "simonedalmasosp@gmail.com",
  "millidiu@gmail.com", "newquality2018@gmail.com", "juliana.caran@hotmail.com",
  "makaniws@gmail.com", "paulovasconste@gmail.com", "aprendacomliz@gmail.com",
  "warleysantosfranca@gmail.com", "viniciusbergamo.epm@gmail.com",
  "personaltrainer.nelsonlopes@gmail.com", "laisdamatapenteado@gmail.com",
  "karinnarihanna@gmail.com",
  // 4 trials que cancelaram em 25/08
  "valeskacanci@gmail.com", "douglasoliveiraandrade@yahoo.com.br",
  "danilo.oliveira1910@gmail.com", "grazielleaparecida3108@gmail.com",
];

console.log(`admins configurados .....: ${admins.length}`);
console.log(`cortesia configurados ...: ${cortesia.length}`);
console.log(`allowlist total .........: ${equipe.size}`);

// controle positivo: a comparação funciona mesmo?
const amostra = [...equipe][0];
console.log(`controle positivo (allowlist reconhece o proprio 1o e-mail): ${equipe.has(amostra)}`);
console.log(`controle negativo (e-mail inventado nao bate): ${equipe.has("nao-existe-999@exemplo.com")}`);

const bate = BACKLOG.filter((e) => equipe.has(e));
console.log(`\nnomes do backlog (${BACKLOG.length}) que sao da equipe: ${bate.length}`);
if (bate.length) console.log(bate.join(", "));
else console.log("nenhum — a conta de vazamento nao tem gente da casa dentro");
```

### `_Bugs/2026-08-26_pagantes_sem_marcador.cjs`

```js
/**
 * Quem PAGOU e está SEM o marcador `paid` em trial_credit_expirations?
 * SOMENTE LEITURA. Nada aqui escreve, propõe ou executa (regra 9-A).
 *
 * Por quê: em 20/08 o relatório registrou que os assinantes estavam seguros
 * porque tinham marcador `paid` — "estão fora da varredura pra sempre, então
 * nem se a função religar eles correm risco". O marcador é a proteção.
 *
 * Mas a tabela tem 328 linhas e TODAS são de 2026-08-18 18:45:05 — o dia em que
 * a `expire_trial_credits` foi desligada. Ninguém marcou nada desde então.
 * Logo: todo mundo que virou pagante DEPOIS de 18/08 está sem proteção. No
 * dia em que a função religar, essas pessoas são exatamente o perfil das 14
 * que foram zeradas (1.356.554 cr, revertido em 94s).
 *
 * Este script só MEDE o tamanho do grupo. Quem decide é o Johnny.
 */
const { supa } = require("../_frank/ferramentas/_comum.cjs");

const TIPO_PAGO = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
const STATUS_PAGO = new Set(["APPROVED", "COMPLETE", "COMPLETED"]);
const PRODUTO = "7851642";

(async () => {
  const db = supa();

  const { data: marcas, error: eM } = await db.from("trial_credit_expirations")
    .select("email,outcome,resolved_at");
  if (eM) throw new Error(`trial_credit_expirations: ${eM.message}`);
  const datas = [...new Set((marcas || []).map((m) => String(m.resolved_at).slice(0, 10)))].sort();
  console.log(`marcadores: ${marcas.length} linhas | datas distintas: ${JSON.stringify(datas)}`);
  const porOutcome = {};
  for (const m of marcas) porOutcome[m.outcome] = (porOutcome[m.outcome] ?? 0) + 1;
  console.log(`por outcome: ${JSON.stringify(porOutcome)}`);
  const temPaid = new Set(marcas.filter((m) => m.outcome === "paid").map((m) => String(m.email).toLowerCase()));

  const evs = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("payment_events")
      .select("event_type,received_at,payload").range(de, de + 999);
    if (error) throw new Error(`payment_events: ${error.message}`);
    evs.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`eventos lidos: ${evs.length} (controle: a consulta respondeu)`);

  // primeira cobranca REAL paga de cada pessoa (filtro FORTE)
  const pagantes = new Map();
  for (const e of evs) {
    const d = e.payload?.data ?? {};
    const pid = String(d.product?.id ?? "");
    if (pid && pid !== PRODUTO) continue;
    if (!TIPO_PAGO.has(e.event_type)) continue;
    const pu = d.purchase; if (!pu) continue;
    if (!((pu.price?.value ?? 0) > 0)) continue;
    if (!STATUS_PAGO.has(pu.status)) continue;
    const email = String(d.subscriber?.email ?? d.buyer?.email ?? "").toLowerCase().trim();
    if (!email) continue;
    const q = pu.approved_date ?? pu.order_date ?? Date.parse(e.received_at);
    if (!pagantes.has(email) || q < pagantes.get(email)) pagantes.set(email, q);
  }
  console.log(`pagantes de verdade (filtro FORTE, historico): ${pagantes.size}`);

  const CORTE = Date.parse("2026-08-18T18:45:05Z");
  const semMarca = [];
  for (const [email, quando] of pagantes) {
    if (temPaid.has(email)) continue;
    const { data: p } = await db.from("profiles")
      .select("credits_subscription,credits_extra").ilike("email", email).maybeSingle();
    if (!p) continue;
    semMarca.push({
      email, pagou: new Date(quando).toISOString().slice(0, 10),
      depoisDoCorte: quando > CORTE,
      cr: p.credits_subscription ?? 0, extra: p.credits_extra ?? 0,
    });
  }
  const soma = (a) => a.reduce((s, l) => s + l.cr, 0);
  const comCredito = semMarca.filter((l) => l.cr > 0);
  console.log(`\n=== PAGANTES SEM MARCADOR 'paid' (desprotegidos se a varredura religar) ===`);
  console.log(`total: ${semMarca.length} | com credito de mensatualidade > 0: ${comCredito.length} | soma: ${soma(comCredito)} cr`);
  console.log(`destes, comecaram a pagar DEPOIS de 18/08 18:45: ${comCredito.filter((l) => l.depoisDoCorte).length}`);
  for (const l of comCredito.sort((a, b) => a.pagou.localeCompare(b.pagou)))
    console.log(`   pagou ${l.pagou}  ${String(l.cr).padStart(7)} cr  ${l.email}${l.depoisDoCorte ? "" : "   <-- pagou ANTES do corte e mesmo assim ficou sem marca"}`);
})();
```

### `_Bugs/2026-08-26_causa_do_zeramento.cjs`

```js
/**
 * Por que a `expire_trial_credits` zerou 14 PAGANTES em 18/08? SOMENTE LEITURA.
 *
 * Hipótese vinda da leitura de `scripts/80_trial_credit_expiry.sql:70-90`: a CTE
 * `ap` tira o e-mail de UM lugar só —
 *
 *     lower(coalesce(payload->'data'->'buyer'->>'email',''))
 *
 * — e as CTEs `trials` e `paid` saem as duas dali. Se um evento de PAGAMENTO
 * não tiver `data.buyer.email` (e a pessoa aparecer só como
 * `data.subscriber.email`), o pagamento dela some da CTE `paid`, ela cai como
 * `has_paid = false`, e a função zera o saldo de alguém que pagou.
 *
 * Note que o `coalesce(...,'')` faz o e-mail virar STRING VAZIA, não NULL:
 * o `left join paid p on p.email = t.email` casa vazio-com-vazio em vez de não
 * casar, então o defeito nem aparece como linha órfã.
 *
 * Este script mede quantos eventos de pagamento estão nessa situação. Não
 * propõe correção nem toca em nada.
 */
const { supa } = require("../_frank/ferramentas/_comum.cjs");

const STATUS_PAGO = new Set(["APPROVED", "COMPLETE", "COMPLETED"]);

(async () => {
  const db = supa();
  const evs = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("payment_events")
      .select("event_type,provider,received_at,payload").range(de, de + 999);
    if (error) throw new Error(`payment_events: ${error.message}`);
    evs.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`eventos lidos: ${evs.length} (controle: a consulta respondeu)`);

  // A funcao olha SO event_type='PURCHASE_APPROVED' e provider='hotmart'
  const ap = evs.filter((e) => e.provider === "hotmart" && e.event_type === "PURCHASE_APPROVED");
  console.log(`PURCHASE_APPROVED/hotmart (o universo da funcao): ${ap.length}`);

  let semBuyer = 0, semBuyerComSub = 0, pagamentoPerdido = 0;
  const vitimas = new Map();
  for (const e of ap) {
    const d = e.payload?.data ?? {};
    const buyer = String(d.buyer?.email ?? "").toLowerCase().trim();
    const sub = String(d.subscriber?.email ?? "").toLowerCase().trim();
    const pu = d.purchase ?? {};
    const valor = pu.price?.value ?? 0;
    const rec = pu.recurrence_number ?? pu.recurrency_number ?? null;
    if (!buyer) {
      semBuyer++;
      if (sub) semBuyerComSub++;
      // pagamento de verdade que a CTE `paid` NAO vai enxergar
      if (valor > 0 && rec !== null && STATUS_PAGO.has(pu.status)) {
        pagamentoPerdido++;
        if (sub) vitimas.set(sub, (vitimas.get(sub) ?? 0) + 1);
      }
    }
  }

  console.log(`\n=== o e-mail que a funcao usa (data.buyer.email) ===`);
  console.log(`eventos SEM data.buyer.email .................: ${semBuyer}`);
  console.log(`   destes, COM data.subscriber.email .........: ${semBuyerComSub}`);
  console.log(`PAGAMENTOS (valor>0, rec presente, status pago)`);
  console.log(`   invisiveis pra CTE 'paid' .................: ${pagamentoPerdido}`);
  console.log(`   pessoas distintas afetadas ................: ${vitimas.size}`);
  if (vitimas.size) {
    console.log(`\n   quem pagou e a funcao nao veria como pagante:`);
    for (const [email, n] of [...vitimas].sort((a, b) => b[1] - a[1])) console.log(`      ${email}  (${n} pagamento(s))`);
  }

  // controle: a chave existe mesmo em ALGUM evento? (senao o zero acima e trivial)
  const comBuyer = ap.filter((e) => (e.payload?.data?.buyer?.email ?? "") !== "").length;
  console.log(`\ncontrole positivo: eventos COM data.buyer.email = ${comBuyer}`);
  console.log(`(se este numero for 0, a hipotese muda: o campo simplesmente nunca existiu)`);

  // as 14 zeradas em 18/08 — quem foram, e elas tinham buyer.email?
  const { data: zeradas } = await db.from("trial_credit_expirations")
    .select("email,outcome,debited").eq("outcome", "zeroed").gt("debited", 0);
  console.log(`\n=== as zeradas de 18/08 com debito > 0: ${zeradas?.length ?? 0} ===`);
  for (const z of zeradas || []) {
    const meus = ap.filter((e) => String(e.payload?.data?.subscriber?.email ?? "").toLowerCase() === String(z.email).toLowerCase()
      || String(e.payload?.data?.buyer?.email ?? "").toLowerCase() === String(z.email).toLowerCase());
    const pagos = meus.filter((e) => {
      const pu = e.payload?.data?.purchase ?? {};
      return (pu.price?.value ?? 0) > 0 && STATUS_PAGO.has(pu.status);
    });
    const comB = pagos.filter((e) => (e.payload?.data?.buyer?.email ?? "") !== "").length;
    console.log(`   ${z.email}  debitado ${z.debited} cr | pagamentos no banco: ${pagos.length} | destes com buyer.email: ${comB}`);
  }
})();
```

