# O débito fire-and-forget do onboarding — medido em 14/09/2026

Card: "INVESTIGAR E CORRIGIR — 16 pessoas com voz `ready` desde 01/09 e nenhum
lançamento em `credit_transactions`".

**Veredito: a hipótese principal do card é FALSA.** O débito não falhou calado.
Ele nunca foi chamado, porque não devia ser — é a decisão autorizada de 09/09
funcionando. O defeito de fire-and-forget existe no código, mas explica **zero**
das 16 pessoas e hoje está **inalcançável em produção**.

Nada foi alterado no banco. Nenhum saldo tocado, nenhuma cobrança retroativa.

---

## 1. Reprodução do achado

`node _frank/rascunhos/uso_sem_debito_0914.cjs` (somente leitura) devolve o
mesmo número do card:

```
vozes ready desde 2026-09-01: 261  |  donos distintos: 211
VOZ PRONTA E NENHUM DEBITO NO RAZAO: 16 pessoa(s)
```

As 16 conferem uma a uma com a lista do card.

## 2. O que a hipótese do card previa — e por que não é isso

A hipótese: `treino.ts:154-163` chama `debitCreditsOnboarding` e descarta o
retorno; a função devolve `{ok:false}` calado em `no_profile`; logo, treino
entregue e 10.000 nunca cobrados.

Para isso ser verdade, as 16 teriam que ter passado por um caminho onde
`billed === true`. **Nenhuma passou.** As 16 vieram do SGP:

```sql
select a.email, v.id as voice_id, sp.sessao is not null as veio_do_sgp, sp.origem
from (/* as 16 */) a
join voices v on v.user_id = a.id and v.status='ready' and v.created_at >= '2026-09-01'
left join sgp_pedidos sp on sp.voice_id = v.id;
```

→ **16 de 16 com `veio_do_sgp = true`**, `sgp_status = 'pronto'`,
`sgp_origem = 'portal'`. Zero exceções.

No SGP, `processar.ts:243` chama `dispararTreinoOnboarding(..., "sgp")`, e
`deveCobrarOnboarding({origem:"sgp"})` devolve `false`
(`lib/credits/onboarding-cobranca.ts:55`). Com `billed === false`,
`debitCreditsOnboarding` **não é invocada**. Não há retorno para descartar.

## 3. O corte pela data do deploy fecha sem sobra

O fix que parou a cobrança do SGP é o commit `0b870d9` (09/09 20:26 -0400),
mergeado na main pelo **PR #228 em 10/09 08:46:41 -0400 = 10/09 12:46Z**.
Usando o merge (e não o commit) como fronteira, as 61 vozes `ready` do SGP
desde 01/09 se separam sem resto:

| janela | vozes SGP `ready` | debitadas | allowlist |
|---|---|---|---|
| ANTES do deploy (< 10/09 12:46Z) | 27 | 26 | 1 |
| DEPOIS do deploy | 34 | **0** | 0 |

A única voz pré-deploy sem débito é de `lucas.m.arrial@gmail.com`, que está em
`ALLOWLIST_PADRAO` (`access-window.ts:75-76`) — equipe não paga, por desenho de
08/06. **Nenhum caso inexplicado, nas duas direções.**

> ⚠️ Usar o *commit* (10/09 00:26Z) em vez do *merge* produz 3 falsos
> positivos (`rearielo@hotmail.com`, `drbrunoa@gmail.com`, `edust@live.com`,
> todos entre 00:51Z e 02:56Z de 10/09). Eles rodaram no build antigo, que
> ainda cobrava — corretamente. Commit não é deploy.

## 4. "15 com 0 crédito e SEM ACESSO" não é sintoma

É o estado esperado de um comprador de SGP que não assinou: comprar o SGP não
concede crédito (regra comercial) e o acesso ao `/app` vem da assinatura.
Antes do fix esse mesmo comprador ficava a **-10.525**; depois, fica em 0. Os
dois estados bloqueiam o `/app`, mas só o primeiro era dívida. O fix removeu a
dívida, não o bloqueio — e o bloqueio é a regra, não o defeito.

## 5. O defeito que existe de verdade (e o tamanho real dele)

O fire-and-forget é real no código:

- `treino.ts` fazia `await debitCreditsOnboarding({...})` sem atribuir;
- `avatares.ts:170` fazia o mesmo;
- pior, `service.ts` descartava o `error.message` da RPC inteiro
  (`if (error) return {ok:false, reason:"error"}`), então nem o motivo sobrava.

Material entregue antes do débito + retorno descartado + erro sem detalhe =
dívida que não aparece no razão nem no log.

**Mas o único caminho que chega a debitar é o da PLANILHA**
(`origem:"planilha"` → `billed:true`), e ele está parado:

```sql
select max(criado_em), count(*) from onboarding_runs;
-- 2026-08-29 23:02:44Z | 140
```

Última linha em **29/08**. O conserto é **preventivo**, não sangramento em
curso. Dizer o contrário inflaria o achado.

## 6. Item 3 do card (corrida de `no_profile`): não foi medido nenhum caso

O card pedia para tratar a ordem de criação do profile se a causa fosse
`no_profile` por corrida. **Não há caso para tratar** — nenhuma das 16 passou
pelo débito, e não há ocorrência medida de `no_profile` em produção. Construir
retry para uma corrida não observada seria adivinhação. Fica registrado como
não-feito, com o motivo.

## 7. Item 4 do card: a lista e o valor, sem cobrar ninguém

Se o Johnny quisesse cobrar retroativamente as 16 — **e a medição diz que não
há o que cobrar**, porque a casa decidiu em 09/09 não cobrar o comprador de
SGP — o valor nominal seria 16 × 10.000 = **160.000 cr**. Cobrar seria
*reverter* a decisão de 09/09 por engano, não corrigir um erro.

Nenhuma ação de saldo foi tomada. Quem decide é o Johnny.

## 8. Reprodução

```bash
node _frank/rascunhos/uso_sem_debito_0914.cjs                 # as 16
node _frank/ferramentas/sql.cjs "<consulta da seção 2>"        # rota das 16
node _frank/ferramentas/sql.cjs "<consulta da seção 3>"        # corte pelo deploy
node _frank/ferramentas/sql.cjs "select max(criado_em), count(*) from onboarding_runs"
git log --format='%h %ci %s' --diff-filter=A -- frontend/src/lib/credits/onboarding-cobranca.ts
git rev-list --ancestry-path 0b870d9..main --merges | tail -1   # o merge = o deploy
```

## 9. Verificação do patch

```bash
cd frontend
node --test src/lib/credits/debito-onboarding-falho.test.ts    # 10/10
npx tsc --noEmit    # 1 erro, idêntico ao da main (resgate-audio.test.ts / vitest)
npx eslint src/lib/credits/debito-onboarding-falho.ts src/lib/credits/service.ts \
           src/lib/onboarding/treino.ts src/lib/onboarding/avatares.ts   # exit 0
```

Mutação reproduzida (o teste tem que CAIR quando o defeito volta):

| mutação | efeito |
|---|---|
| descarta o `detalhe` da RPC (= código pré-fix) | 1 falha |
| marca greppável vazia | 1 falha |
| some o `ref` do aviso | 2 falhas |
| os dois motivos viram a mesma string | 1 falha |
| some o valor da dívida | 1 falha |

> A mutação da marca **passava** na primeira versão do teste:
> `includes(MARCA)` com marca vazia é `includes("")`, sempre verdadeiro. O
> teste foi reescrito para travar o literal. Fica registrado porque é o tipo
> de teste que dá sensação de cobertura sem cobrir nada.
