# Rotina das Falhas — ronda das 23h40 (2026-08-20, 23:40–00:00 UTC)

Dono da fila: Frank (regra 14-A). Ordens lidas: `_frank/ordens/README.md` (índice)
+ `2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐ vigente) +
`2026-08-20_fluxo_quem_olha_o_que.md` + `2026-08-20_correcoes_da_ronda.md`.

**Resumo em uma linha:** fechei **zero** incidentes — de novo, e de novo está
certo, porque os 4 que restam estão todos parados no "pode" do Johnny. O que
esta ronda entrega de verdade é **matar o item 3 da ordem vigente** (re-medir as
entregas com a régua corrigida): fiz a medição, custo zero, e o resultado
**refuta a premissa da ordem** — o "23 de 40" não era inflado.

---

## 1. Fila — paginada, com o `error` cru impresso

```
ERRO_COUNT: null
count exact = 69 | acumulado = 69   (paginado; a consulta corta em 1000)
TALLY POR STATUS = {"fixed":50,"ignored":15,"investigating":4}  soma = 69 ✅
```

**Quatro em `investigating`, zero em `open`. Os mesmos quatro da ronda das 23h** —
nada novo entrou em 35 min.

| # | incidente | idade | quem espera | desfecho desta ronda |
|---|---|---|---|---|
| 1 | `5c3f1f8b` | 253h | **3 alunos pagantes** | conferido que não se resolveu; travado no "pode" (e-mail + GPU) |
| 2 | `ce6e157d` | 35,5h | **aluna** (Katia) | sem novidade; área do Claude, não toquei |
| 3 | `100e7ace` | 3,1h | técnico | causa já refutada às 22h; o que sobra é a cauda do áudio, do Claude |
| 4 | `c3893803` | 0,9h | **16 pagantes** | 4ª medição + **Johnny cobrado de novo** (relógio em 12,3h) |

- **Zumbi (fechado que voltou a disparar): 0.** Conferi os 23 fechados com
  `last_seen_at` nas últimas 48h — nenhum com `last_seen` posterior ao próprio
  `resolved_at`.
- **Fechados sem `resolved_at` (cegos pro detector): 0.** Continua fechado pelos
  dois lados desde o `261b295b`.

## 2. Pergunta 1 da rotina — "já resolveu sozinho?" — em todos: **não**

Medido no banco antes de qualquer teoria:

| aluno | voz | estado | saldo parado |
|---|---|---|---|
| marcelopersonalthe32 | `f6f82819` | **failed** desde 10/08 · zero gerações | 198.950 |
| csitya100 | `8aca0126` | **failed** desde 15/08 · zero gerações | 200.655 |
| ivanildezuca | `4c2c4abc` + `4b4567fe` | **failed** desde 08/08 · zero gerações | 200.000 |
| katiasalvador32 | `c127b74e` | **ready**, pacing 220/0 aplicado 20/08 20:15 | 78.665 |

**Katia: última geração é de 19/08 21:07 — segue sem nenhuma geração pós-piloto.**
Quarta ronda seguida em que dizer que o piloto de pacing "funcionou" ou "não
adiantou" seria chute. O veredito custa 1 geração = GPU = decisão do Johnny.

## 3. Produção — sã

- `generations` 24h: **137 · 133 ready · 4 failed · 0 presa.** As 4 falhas são
  todas `qa_coverage` (o portão **protegendo**) e **todas anteriores ao deploy da
  régua nova** — a mais recente às 10:09Z, o deploy terminou 11:41:58Z.
- `training_jobs` 24h: **28 de 28 completed, zero failed.**
- **`d3d8d1b2` (timeout, risco aceito) NÃO voltou.** As 2 ocorrências de
  `executionTimeout` em 72h são ambas de **18/08** (50,9h e 53,6h). A ordem manda
  reabrir *se voltar* — não voltou, **não reabri**.

### Sinal novo, e o que ele ainda não prova

`qa_coverage.cjs --corte auto` (o corte veio do GitHub: `deploy-runpod` do
`aae3ba5` terminou 11:41:58Z, não a hora do push):

```
ANTES da régua nova   | 270 gerações |  9 falhas | 7 qa_coverage | 3,3%
DEPOIS da régua nova  |  94 gerações |  0 falhas | 0 qa_coverage | 0,0%
```

Às 15:10Z isso era n=23 e o veredito registrado foi "sinal bom, prova nenhuma".
Agora é **n=94, zero falhas**, e o veredito muda de grau, com a conta na mesa:

- contra a taxa pré-corte do próprio dia (7,7%): `0,923^94 ≈ 0,05%` — **exclui**.
- contra a taxa agregada de 3 dias (3,3%): `0,967^94 ≈ 4,3%` — no limite, **não
  exclui com folga**.
- limite superior 95% pela regra de três: `3/94 ≈ 3,2%`.

**Veredito honesto: a taxa alta está excluída, a taxa baixa ainda não.** Mais um
dia limpo fecha. Não escrevi "o fix pegou" porque o número ainda não autoriza.

## 4. 🔴 `c3893803` — os 16 pagantes, e o relógio

**Quarta medição independente** (ensaio do backfill, 23:42Z, 813 entitlements +
1334 profiles paginados): **os mesmos 16, lista idêntica** às três anteriores.
Zero colateral. **Nada foi gravado.**

**O relógio é o ponto:** `dr.bruno` vence **21/08 12:00 UTC — 12,3h** a partir
desta ronda. Passou disso o backfill não restaura mais nada para ele (a data
copiada já estaria no passado) e ele perde **em silêncio** dias que pagou. Os
outros 15 vencem entre 60h e 564h.

**Cobrei o Johnny de novo às 23:47Z** (Telegram, `message_id` 186), com o relógio
explícito e o comando pronto. A 1ª cobrança foi 22:50Z e **segue sem resposta** —
a última fala dele no grupo é de 14:45Z. Cobro de novo por volta das 10:00Z se
continuar mudo, porque **decisão pendente aqui não tem cobrador** e é exatamente
assim que ela dorme (está registrado na ordem do fluxo como buraco conhecido).

**Não apliquei, e o motivo não mudou:** mexe em acesso de 16 clientes, e isso é do
Johnny (`2026-08-20_fluxo_quem_olha_o_que.md`), com o precedente das 47 em
`2026-08-20_correcoes_da_ronda.md` item 1.

## 5. ✅ Item 3 da ordem vigente — RE-MEDIDO, e a premissa da ordem está ERRADA

A ordem manda: *"Re-medir as entregas com a régua CORRIGIDA (expandindo dígitos):
o '23 de 40' era inflado"* — e diz que com a régua certa deu **50%**.

**Medi. Não muda nada. Continua 23 de 40 = 58%.**

Custo **zero**: não precisei transcrever nada de novo. As 40 transcrições de 19/08
já estavam salvas em `_Bugs/2026-08-19_substituicao_audio/transcripts.json`, e o
`2_comparar.py` **não copia o normalizador à mão** — extrai por AST direto de
`git show origin/main:runpod-worker/handler.py`, ou seja, pega a régua **viva**, já
com a expansão de dígito do `d9a14c0`.

**Prova de que a régua usada é mesmo a corrigida:**

```
_qa_norm_words("sao 08:55 da manha") -> [sao, oito, cinquenta, e, cinco, da, manha]
_qa_norm_words("tenho 23 anos")      -> [tenho, vinte, e, tres, anos]
```

**Prova de que a correção não PODE mexer nesta amostra:**

```
das 40 gerações da amostra, as que contêm DÍGITO no texto = ZERO
```

Logo a expansão de dígito é **matematicamente incapaz** de mudar este resultado — e
de fato a saída de hoje bate com o `relatorio.txt` de 19/08 18:27. Os 5
normalizadores carregaram (o script faz `sys.exit` se faltar algum), então não é
falha silenciosa de extração.

Resultado com a régua viva: **LIMPAS 17 | CONTAMINADAS GRAVE 23 (58%) | 13 alunos
de 18**. As trocas são de **palavra**, não de número: `rayssa→ressa`,
`kess→tchess`, `"em ouvi los"→"emubilo"`, `"muscul chirt"→"musco shear"` — várias
são nome próprio e estrangeirismo, **candidatas a transcrição embolada do Whisper**,
não necessariamente defeito do TTS. Essa parte da ordem (que boa parte é Whisper)
se sustenta; o número não.

**O "50%" não reproduz e eu não achei a fonte dele.** Registrei no `fb8d29b7` sem
reabrir. Quem escreveu a ordem deve conferir — pode ter sido conflação com a taxa
de `qa_coverage`, que é outra medição.

**O que esta amostra NÃO responde:** as 40 são entregas de **19/08**, anteriores ao
portão de intrusão (`6af76ae`, 20/08). Medir se o portão novo baixou a taxa exige
transcrever entregas **novas** = custo de API = precisa do "pode". Não fiz.

## 6. Erros meus nesta ronda, e o que os pegou

1. **Inventei nomes de coluna e ganhei um zero mentiroso.** Consultei
   `profiles.credits`, `generations.error` e `training_jobs.error` — nenhuma
   existe. A saída foi *"generations 24h: 0"*, que eu quase reportei como
   "produção parada". O `error` cru (`42703: column does not exist`) pegou.
   As colunas certas são `credits_subscription`+`credits_extra` e `error_message`.
   **Quarta ronda seguida em que imprimir o erro antes de acreditar no zero salva
   o relatório.**
2. **Inventei o UUID do `c3893803`** ao montar o script de anotação (chutei o
   sufixo a partir do prefixo curto). O **ensaio** respondeu `NAO EXISTE` em vez de
   gravar. Sem ensaio, o `update` por id inexistente teria afetado **0 linhas em
   silêncio** e eu escreveria no relatório que anotei o incidente. É exatamente a
   armadilha que a ordem manda não repetir — e ela só não me pegou porque o script
   confere `.select()` e relê depois.

Os dois writes desta ronda: **1 linha afetada cada, relidos do banco, status
inalterado** (nada foi reaberto nem fechado por acidente).

## 7. O que NÃO fiz

- **Não marquei nada como `fixed`** — nada foi resolvido de ponta a ponta.
- **Não rodei o backfill** (só o ensaio). Não mexi em acesso de ninguém.
- Não gastei GPU, não retreinei, não regerei áudio, não toquei em crédito.
- Não escrevi para aluno nenhum (sem o "pode").
- Não rodei migration, não mergeei branch, não apaguei branch.
- Não li a caixa do `suporte@` para triagem — a fila de incidents é a fonte.
- Não reabri `d3d8d1b2` (não voltou) nem toquei em `ce6e157d`/`100e7ace` (Claude).
- Não transcrevi entregas novas (custo sem aval).

## 8. Precisa de decisão do Johnny

Igual à ronda das 23h, porque **nada saiu da lista**. Ordenado por relógio:

1. 🔴 **Os 16** (`c3893803`) — `node _frank/ferramentas/backfill_acesso_pago.cjs --confirmar`.
   Um comando, reversível, não concede nada novo. **`dr.bruno` vence em 12,3h.**
2. **marcelopersonalthe32** e **csitya100** — retreino por conta da casa (falha
   nossa nos dois). **Gasta GPU.**
3. **ivanildezuca** — só e-mail explicando o gate dos 10 min. **Custo zero.**
   (Nunca contatada, há 12 dias. Cláudio, há 5.)
4. **Katia** — 1 geração para dar veredito ao piloto de pacing. **Gasta GPU.**
   Quarta ronda sem veredito.
5. **Estrutural** — voz `failed` não volta pra fila; o aluno lê "tente treinar
   novamente" e o produto não deixa.

## 9. Ferramentas desta ronda

Em `_Bugs/ronda2340/` (fora do git, uso único): `fila.cjs` (fila paginada + zumbis
+ `resolved_at` nulo), `schema.cjs` (o que pegou os nomes de coluna errados),
`estado.cjs` (pergunta 1 + produção + timeout), `acharid.cjs` (o UUID de verdade),
`anota.cjs` (ensaio → `--confirmar` → releitura independente).

Reusei, sem alterar: `_frank/ferramentas/backfill_acesso_pago.cjs` (ensaio),
`_frank/ferramentas/qa_coverage.cjs --corte auto`,
`_Bugs/2026-08-19_substituicao_audio/2_comparar.py`.
