# Rotina das falhas — 16/09 20h

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Item serial:** **#290** (`446c3ae4`), 9,9d — cabeça real da fila.
**Não fechei.** Fila: **85 abertos** (era 82 às 21h de ontem; +3 novos).
Entregue: **PR #316** (perna irmã) + **card #434** + 2 notas no #290 + escalada
no grupo com data e valor. 0 patch do Vigia. 102 recados `tell_frank` (não
tocados).

---

## 0. Como escolhi o item

Os 13 cartões acima dele foram conferidos e todos têm o próximo passo fora das
minhas mãos ou foram encostados nas rondas de hoje (`#241` 18:54Z, `#249`
16:51Z, `#254` 17:44Z, `#270` 13:22Z, `#288` 16:54Z, `#299` 12:55Z, `#305`
18:02Z). Restaram dois de 9,9d: **#290** (8 alunos) e **#291** (1 aluno).
Empate em idade → **mais gente sofrendo** → #290.

Ironia registrada: peguei o #290 por ser *"o mais velho cujo próximo passo não
está com o Johnny"* e terminei a ronda provando que **está**.

---

## 1. Corrigi um erro da minha própria nota de 13/09 — e ele invertia a urgência

A nota de 13/09 diz *"rmf174 **perde o acesso** em 19/09, rutifortuna8 e
flaviamalavazi em 20/09"*. **Errado.** Contradizia a minha nota de 08/09, que
estava certa, e eu não tinha percebido.

Medido hoje nos 8: `status=active`, `subscription.status=ACTIVE` e
`access_until` **exatamente igual** a `date_next_charge` em **8 de 8**. Para
assinatura ACTIVE essa data é **próxima cobrança**, não vencimento.

**Prova empírica, não interpretação:** max e cris tinham a mesma data (13/09) e
em 13/09 14:20Z os dois foram **cobrados R$ 97 e renovados até 13/10** (credito
100.000 → 200.000). A leitura "renova" venceu a leitura "vence" no teste de
realidade.

## 2. O relógio que existe de verdade (e é argumento de DINHEIRO)

Não é "corra antes que expire". É: **nos próximos 4 dias, 3 pessoas pagam o
segundo mês de uma plataforma que a nossa própria carta disse que elas não
têm, sem ter entrado uma única vez.**

| cobrança | quando | logou? |
|---|---|---|
| 19/09 | 3 dias | nunca |
| 20/09 | 4 dias | nunca |
| 20/09 | 4 dias | nunca |

R$ 97 × 3 = **R$ 291 em 4 dias**. Somado aos R$ 194 já pagos em 13/09 → **R$ 485**
de gente que nunca abriu o produto.

Justo com o fato, como em 13/09: **a cobrança é legítima** (order bump C1/C2,
assinaram de verdade). Não pedi estorno e não chamei de cobrança indevida. O que
é nosso é o **silêncio em volta dela**.

## 3. Estado dos 8, medido hoje: nada melhorou em 9,9 dias

**7 de 8 nunca logaram** (`auth.users.last_sign_in_at` NULL; só max, 04/09
16:48Z — o mesmo número de 07/09 e de 13/09). 8 de 8 com `plan=pro`, acesso
vivo, **zero voz, zero pedido no SGP**. **1.000.000 de créditos parados.**

Instrumento (vale pra quem reusar): medir por `auth.users`.
`profiles.last_seen_at` **subnotifica** login e devolve "8 de 8", que é falso.

---

## 4. O ALARME QUE EU LEVANTEI E REFUTEI EU MESMO — a parte mais importante da ronda

Medi os 19 envios de boas-vindas do SGP posteriores ao fix cujo comprador tem
assinatura ativa hoje, comparei com `entitlements.created_at`, e deu **19 de 19
com a entitlement nascendo DEPOIS do e-mail** (1,1h a 144h). Conclusão óbvia e
pronta pra escalar: *"o texto falso continua saindo, 19 vítimas novas, o fix não
funciona."*

**Fui conferir a causalidade antes de gritar, e ela é o inverso.** Comparando com
`purchase.approved_date` + `price.value`: nos 19, a assinatura foi contratada
**depois** do e-mail (valor `0` em 16 = início de trial). Essas pessoas compraram
SGP, receberam a mensagem dizendo que a plataforma é à parte — o que **para elas
era verdade** — e **então** assinaram. A entitlement vem depois do e-mail porque
é **consequência** dele.

**Zero vítima nova. Alarme refutado por mim mesmo, na mesma ronda.**

Conferi também o caminho gêmeo: 23 envios, 7 com assinatura ativa hoje, e nos 7
o pagamento entrou de **14min a 27h depois**, valor 0. O caso de hoje
(e-mail 18:11Z, assinatura 18:18Z) é isso: **7 minutos**.

> **A lição, que é a mesma da minha nota de 07/09:** "achei o texto errado numa
> caixa" é o começo de um falso alarme caro. O que separou os dois aqui foi
> comparar com `approved_date` e olhar `price.value` — e **não** com
> `created_at` da entitlement. **`created_at` de entitlement não serve pra datar
> o que o aluno sabia.**

## 5. A condição (b) de fechamento, como está escrita, é inalcançável

A nota de 07/09 põe como condição pra fechar *"uma comprovação em produção do
ramo corretivo, que só vem quando um assinante pagante comprar o SGP"* — e eu
vinha repetindo isso como se fosse questão de esperar.

Medido hoje com a população **inteira** (não por amostra de caixa): em **9,6
dias** desde o fix, dos 19 compradores de SGP com assinatura ativa, **nenhum já
era pagante no momento do envio**. O ramo corretivo não rodou nem uma vez — e
não por azar: o comprador com bump no mesmo checkout **não reapareceu em 9,6
dias**.

A condição mantém o cartão aberto **para sempre** por um evento fora da nossa
mão. Recomendei na nota trocar (b) por *"lógica validada contra as 8 linhas reais
de produção"* (feito em 07/09: TRUE em 8/8). Deixei como **recomendação, não como
decisão** — critério de fechamento deste cartão eu decido na próxima ronda, não
no meio de uma nota.

## 6. Achado estrutural → PR #316 + card #434

O fix do #290 protegeu `montarBoasVindas`. **O caminho irmão ficou aberto:**
`onboarding/pronto.ts:181` decide a carta final por `hasActiveAccess`, que lê o
**cache do profile** — preenchido só pela reconciliação. Quem compra SGP +
assinatura no mesmo checkout termina o onboarding **antes** disso, cai no
`avisoOkMasAssine` e recebe *"falta só o acesso — **Assine aqui**"* com **link de
checkout**. A mentira do #290 outra vez, agora como **chamada de venda**.

É o padrão `#137`: classe fechada no recorte estreito que segue disparando.

**Consertado:** PR **#316**, commit `7135f29`. A decisão passa a perguntar também
pelo e-mail da compra (`entitlements`), pela **mesma régua do gate**. Aditivo, com
curto-circuito (só consulta quando o profile já disse "sem acesso"), erro →
`false` = comportamento de hoje. **Não usa `profiles.ja_pagou`** (SUSPENSA:
`false` em 1.515 de 1.515) — usar faria o conserto nascer morto. A consulta gêmea
do #290 foi deixada **intacta de propósito**: já está no ar.

Verificado: `tsc` limpo, `eslint` limpo, `node --test` **89/89**.
Limite honesto: a consulta nova não tem teste próprio (depende do admin do
Supabase); a **regra** que ela aplica tem, em `acesso-regra.test.ts`.
Limite herdado (não novo): casa por `buyer_email` — classe do `#222`.

---

## 7. O que trava o #290, em uma linha

O e-mail de reparação dos 8 está **escrito e conferido desde 07/09**. Não sai
porque é **lote**, e lote precisa do **"pode" do Johnny** (regra 8) — o único
e-mail que eu não mando sozinho. Pedido desde **04/09: 12 dias**.

Repostei no grupo com a data e o valor, e ofereci **fatiar**: liberar só os 3
cobrados nesta semana, se ele preferir.

**Passo em que emperrou: aguardando 1 palavra.** Tudo o que é meu neste cartão
está feito.

## 8. O que eu NÃO fiz

- Não fechei o #290 (não podia: a perna que falta não é minha).
- **Não mandei o lote sem aval.** Não escrevi pra nenhum aluno nesta ronda.
- Não estornei, não cancelei assinatura, não mexi em crédito, acesso, plano,
  entitlement, migration nem GPU.
- Não mergeei o #316 (PR precisa de review; branch não deploya).
- Não apaguei nenhum dos 102 recados — segue valendo o item 5 da ronda das 21h:
  precisam de ferramenta com `--confirmar`, não de edição na mão.
- Não toquei em nada da planilha (ordem de 29/08).

## 9. Lição

**O número mais impressionante é o que mais merece desconfiança.** Eu tinha
"19 de 19 vítimas novas" na mão — coerente com o cartão, dramático, e pronto
pra virar escalada. Era falso, e o que o derrubou foi uma coluna: `approved_date`
em vez de `created_at`. Duas consultas separam "o fix não funciona, 19 pessoas
lesadas" de "o funil funcionando como devia".

E o corolário, que é o defeito real desta fila: **o #290 não está parado por
falta de trabalho.** Tem 12 notas, 2 PRs, medição honesta e o e-mail pronto há
9 dias. Está parado por **uma palavra** — e enquanto ela não vem, R$ 485 já
saíram do bolso de gente que nunca abriu o produto. Quando o gargalo é decisão
e não execução, **medir melhor não destrava**; só insistir no canal certo, com
data e valor na mão.
