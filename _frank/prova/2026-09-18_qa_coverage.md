# Ronda diária qa_coverage — 2026-09-18 (sexta)

Medição às 15:44Z. Script: `/tmp/perf/qacov-2026-09-18.cjs` (saída em
`/tmp/perf/out-0918.txt`, 465 linhas, exit=0). Apoio: `_aluno_0918.cjs`,
`_runpodcompleted_0918.cjs`, `_elapsed_vs_len_0918.cjs`.

**Resumo:** **17/09 foi o pior dia da série inteira — 12 falhas em 76 gerações
(15,8%).** A ronda de ontem, medindo às 15:32Z, viu **0/40 e escreveu "dia
limpo"**. As 12 falhas vieram todas **depois das 16:00Z**. A lição estrutural
que a própria ronda de ontem escreveu ("a ronda enxerga ~40% do dia, e o pico é
à noite") **se cumpriu em menos de 24 horas**.

**O indicador desta rotina segue baixo** (`qa_coverage` = 1 em 17/09, 2/875 na
régua vigente). **De novo, o achado do dia está fora dele:** 9 das 12 falhas são
uma assinatura que **nunca existiu na tabela** — `RunPod COMPLETED`.

> **A prioridade não é número nenhum: é a Roseni.** Ela tem 2 gerações na vida
> inteira da conta, as duas falharam, e ela **nunca ouviu um áudio nosso**.
> Conta paga até 24/09. Não voltou há 18h.

---

## PASSO 1 — Qual régua está no ar

`gh run list --workflow=runpod-worker.yml --limit 5`: **os mesmos 5 runs de
ontem. Nenhum novo, nenhum falho, nenhum `in_progress`.**

| SHA | Fim (updatedAt) | Conclusão |
|---|---|---|
| `b2d9f47` | 2026-09-15T03:49:41Z | success |
| `7b673a7` | 2026-09-15T02:44:36Z | success |
| `2adb080` | 2026-09-08T15:22:32Z | success |

Refiz a checagem em vez de herdar a nota da véspera (lição de 15/09). `b2d9f47`
é treino de voz, não mexe em `qa_coverage`. Os arquivos que decidem:

```
git log -1 -- runpod-worker/jobs/inference.py     -> 243aa73 (04/09, no ar em 08/09)
git log -1 -- runpod-worker/jobs/tts_settings.py  -> 243aa73 (04/09, no ar em 08/09)
git log b2d9f47..origin/main -- runpod-worker/    -> VAZIO
```

**Confirmação independente no dado** (regra de 10/09): `coverage_espalhada_piso`
0 (régua anterior) → **23** (nova); `..._piso_terminal` 0 → **19**. Contadores só
aparecem depois de 08/09 15:22Z.

> **Régua no ar: `2adb080` (08/09 15:22:32Z) — DEZ dias.** Não existe correção
> escrita e não deployada. O acumulado **não** reinicia.

**Isto importa para o achado de hoje:** as falhas de 16 e 17/09 aconteceram **sem
nenhum deploy desde 15/09**, e o de 15/09 é treino de voz. O código de inferência
não mudou há dez dias. **Não é regressão de código nossa** — o que sobra é infra.
Hipótese forte, mas ainda hipótese: eu não fui ao RunPod confirmar.

---

## PASSO 2 — Medição

### Sanidade

| Checagem | Resultado |
|---|---|
| (a) presas HOJE | **0** — o zero de hoje não é "ainda não deu tempo de falhar" |
| (b) `failed` com `error_message` vazio HOJE | **0** — sem falha invisível |
| (c) status crus HOJE | `{"ready": 44}` |
| (d) `elapsed` NULL em `ready` na régua nova | 214/858 (**25%**) — faixa normal 13-29%. Sem alarme. |

### (e) Denominador que encolhe — e (e2) dias fechados

| Filtro (desde 25/08) | Hoje | 17/09 registrou | Δ |
|---|---|---|---|
| `qa_coverage` | 12 | 11 | **+1** (a de 17/09 20:18Z) |
| Falhas totais | **30** | 18 | **+12** (todas de 17/09) |

**Nenhum dia fechado encolheu** — 09/09=116, 10/09=90, 11/09=100, 12/09=72,
13/09=50, 14/09=96, 15/09=94, 16/09=78, todos com Δ=0. Primeira ronda em três
dias com a tabela (e2) inteiramente estável. O `+12` é falha **nova**, não
apagamento — verificado, não presumido.

### Janelas

Molde: corte em 08/09 15:22Z, **dez dias atrás** → terceira forma da lição de
28/08. Não existe "hoje antes do corte" nem "ontem antes do corte". Acrescentei
`16/09 inteiro` com data absoluta nos dois lados, como a ronda de ontem mandou.

| Janela | Total | Falhas | qa_cov | Taxa | ≥1000ch | 1500-2500ch |
|---|---|---|---|---|---|---|
| Contexto 25/08→05/09 (réguas misturadas) | 893 | 13 | 10 | 1,5% | 7/153 | 5/68 |
| Régua anterior `eccc3d59` (baseline limpo) | 180 | 0 | 0 | 0,0% | 0/26 | 0/14 |
| 14/09 | 96 | 0 | 0 | 0,0% | 0/23 | 0/3 |
| 15/09 | 94 | 0 | 0 | 0,0% | 0/15 | 0/0 |
| 16/09 (cluster `System error.`) | 78 | 4 | 0 | 5,1% | 4/18 | 0/3 |
| **17/09 (ONTEM, fechado) ← a que conclui** | **76** | **12** | **1** | **15,8%** | **8/18** | **8/17** |
| 18/09 até 15:44Z (hoje, PRÉVIA) | 44 | 0 | 0 | 0,0% | 0/3 | 0/2 |
| **ACUMULADO régua nova (08/09 15:22Z →)** | **875** | **17** | **2** | **1,9%** | 12/152 | 8/48 |

**17/09 contra o resto da régua nova** (excluindo 16 e 17/09): 12/76 vs 1/721,
**Fisher p = 3,0e-12**. Não é ruído.

---

## PASSO 3 — Quem falhou (vem antes de qualquer número)

### A assinatura nova: `RunPod COMPLETED`

Antes de chamar de "nova", conferi **a tabela inteira, sem recorte de data**
(lição de 12/09 — "novo" é afirmação sobre o passado, e o passado está no banco):

| Erro | Total (histórico completo) | Dias |
|---|---|---|
| `qa_coverage` | 29 | 19-27/08, 11/09, **17/09** |
| `executionTimeout` | 19 | 30/07 … 04/09 |
| **`RunPod COMPLETED`** | **9** | **só 17/09** |
| `System error.` | 4 | só 16/09 |
| `SubprocException` (torch inductor) | 1 | só 17/09 |
| `unknown` | 1 | só 17/09 |

**Zero ocorrências antes de ontem, em toda a história da tabela (desde maio).**

### Uma hipótese minha que o dado derrubou

Eu ia escrever que essas falhas eram **"rápidas demais pra ter gerado áudio"** —
elapsed 10-16s contra mediana 95s. **O dado plano não sustenta:** o p05 de um
`ready` é **13,69s** e o mínimo é 3,13s. Textos curtos terminam rápido; a frase
teria sido bonita e errada.

Refiz **pareando por tamanho de texto**, que é a única comparação que responde:

| Aluna | Texto | elapsed | p05 da faixa | mediana da faixa | veredito |
|---|---|---|---|---|---|
| Roseni | 41ch | 15,6s | 5,2s | 31,2s | dentro do normal |
| Roseni | 76ch | 11,6s | 5,2s | 31,2s | dentro do normal |
| Semear | 425ch | 16,2s | 13,9s | 82,5s | dentro do normal |
| Semear | 623ch | 11,5s | 43,5s | 105,2s | **anômalo** |
| Mariana | 1571ch ×2 | 12,7s | 111,7s | 217,9s | **anômalo** |
| Mariana | 1521ch ×4 | 10-14s | 111,7s | 217,9s | **anômalo** |

**7/10 abaixo do p05 da própria faixa.** A leitura honesta: `RunPod COMPLETED`
**não é um fenômeno de tempo** — é o job voltando **sem áudio**. O tempo só
denuncia nos textos longos, onde 12s é impossível. Nos curtos a duração é normal
e **só o erro revela**. Se eu tivesse usado o detector de tempo como critério,
teria perdido metade dos casos.

> **Terceiro modo de falha, cego para os dois lados.** A rotina só alarma com
> `elapsed > 400s` (hang). Estas 9 passam rotuladas como **"tempo normal →
> reprovação do QA"**, que é exatamente o que **não** são. O rótulo do meu
> próprio script mentiu em 9 de 12 falhas do dia.

### As alunas

**Roseni Machado Pimentel** (`roseni.pimentel@gmail.com`, acesso até **24/09**)
— **a prioridade do dia.**

```
2026-09-17T21:53:55Z | failed |  41ch | 15,6s | RunPod COMPLETED
2026-09-17T21:55:14Z | failed |  76ch | 11,6s | RunPod COMPLETED
```

**Esse é o histórico COMPLETO da conta.** Duas gerações na vida inteira, as duas
falhadas. `ready` em toda a vida da conta: **0**. Ela tentou duas vezes, nas duas
o produto não entregou nada, e **não voltou há 18h**. As duas foram estornadas —
e o estorno aqui não significa rigorosamente nada: ela não quer o crédito de
volta, ela quer o áudio, e **nunca ouviu um**. Conta paga válida por mais 6 dias.
**É o caso que merece contato humano, e é o mais perto de "aluna travada" que
esta rotina já produziu.**

**Mariana Macedo Leme** (`mariana@excellerconsultoria.com.br`, até 07/10) — 8
falhas em 17/09, **todas resolvidas**. Sequência real:

```
20:01:33 FAILED 1571ch  RunPod COMPLETED
20:01:56 FAILED 1571ch  RunPod COMPLETED
20:02:20 ready  1571ch  217,9s          <<< conseguiu
20:18:54 FAILED 1521ch  qa_coverage
20:24:53 FAILED 1521ch  RunPod COMPLETED
20:25:57 FAILED 1521ch  RunPod COMPLETED
20:26:28 ready  1521ch  223,1s          <<< conseguiu
20:32:01 FAILED 1521ch  RunPod COMPLETED
20:32:34 FAILED 1521ch  RunPod COMPLETED
20:32:59 ready  1521ch  182,6s          <<< conseguiu
```

**Desfecho: recebeu tudo.** Mas pagou **8 falhas para 3 áudios** — insistiu no
botão até sair. É a assinatura de intermitência, não de bug determinístico, e
mostra que **retry imediato funciona**. Nenhuma ação urgente; foi atrito, não
perda.

**Semear Riquezas** (`semeadorriquezas@gmail.com`, até 24/09) — 2 falhas em
17/09 (623ch, 425ch), nenhuma com o mesmo texto entregue depois. **Mas voltou
hoje** e gerou 4× com sucesso (13:49-14:26Z). Não está travada.

**Flavio Gabbriel** (`flavio@menosvintesete.com`, até 22/09) — 1 falha
(`SubprocException`, torch inductor, 1983ch). O mesmo texto saiu **ready 8
minutos depois**. Caso fechado.

**Tania** (pendência 2 de ontem, acesso vence **21/09**) — **não voltou a gerar.
Silêncio de 44h.** Ela tem o áudio dela (16/09 19:40Z), então não está sem
entrega, mas o silêncio dobrou desde ontem numa conta que vence em 3 dias. Segue
como risco de churn, e segue sendo assunto do Johnny com a aluna, não meu.

**Estornos:** conferidos por `ref_type='generation_refund'` (nunca por `kind`).
**12/12 falhas estornadas.** Nenhuma ficou sem.

---

## O que dá e o que não dá pra concluir

**Dá pra concluir:**

- **17/09 foi o pior dia da série: 15,8%**, p=3,0e-12 contra o resto da régua.
- **`RunPod COMPLETED` é assinatura inédita** — 9 casos, todos em 17/09, zero em
  toda a história anterior da tabela.
- **Não é regressão de código:** nenhum deploy desde 15/09, e o de 15/09 é treino
  de voz. O código de inferência tem dez dias.
- **`qa_coverage`, o indicador desta rotina, segue baixo:** 2/875 (0,23%) na
  régua nova. Na taxa histórica de 1,1%, o esperado em 875 seria 9,6.
- **Retry imediato resolve** (Mariana, 3/3 vezes).

**NÃO dá pra concluir:**

- **Que hoje está bem.** E este é o ponto que eu quero deixar impossível de ler
  errado. Hoje tem **0/44 às 15:44Z**. Ontem, no **mesmo horário**, tinha
  **0/40** — e então produziu 12 falhas. **As 12 vieram depois das 16:00Z: a
  ronda de ontem viu 53% do volume do dia e 0% das falhas dele.** Hoje é
  estatisticamente **indistinguível de ontem-antes-do-evento**. O zero de hoje
  não é notícia boa; é a mesma leitura que precedeu o pior dia da série.
- **A causa.** Intermitência + ausência de deploy + job voltando sem áudio
  apontam para infra do RunPod. **Hipótese.** Não abri o painel do RunPod.
- **Se 16/09 e 17/09 são o mesmo fenômeno.** Assinaturas diferentes
  (`System error.` vs `RunPod COMPLETED`), elapsed diferentes (230-400s vs
  10-16s). Dois dias seguidos de falha de infra em horário de pico é padrão
  demais para ignorar e pouco demais para afirmar que é uma coisa só.

### H-idioma (pré-registrado 12/09)

Acúmulo: **438/828**. Divergentes: **7/8**. `COM divergência 0/7` vs `SEM 7/315`,
Fisher p=1,0. **Não conclui, e não deve.**

**A premissa envelheceu e eu registro isso agora, com o teste aberto:** a taxa de
divergência observada subiu para **1,60%** (7/438), o que daria o alvo de 8
divergentes em **~501** gerações, não 828 (Δ=−327). **Ressalva obrigatória:** a
conta se apoia em n=7, que é ruído — isso **não** prova que a taxa é 1,60%, prova
só que 828 deixou de ser o número defensável. **Não vou mexer no alvo no meio do
teste**; registro a divergência para decidir na ronda que fechar.

**Contaminação, mantida de ontem e agora pior:** as 4 falhas de `System error.`
(16/09) **e as 11 novas de 17/09 que não são `qa_coverage`** caem todas no braço
"SEM divergência" e nada têm a ver com H-idioma. Ao fechar, **as 15 devem sair**.
Decidido com o resultado ainda aberto, de propósito.

### Elapsed

Sem hang novo. Máximo na régua nova segue **378,88s** — a mesma geração de
sempre. Incidente `d3d8d1b2` segue fechado; **não reabri**.

---

## Lição de hoje — a ronda de ontem acertou o diagnóstico e ainda assim o relatório errou

Ontem escrevi, com todas as letras: *"'hoje está limpo' é sempre uma afirmação
sobre a minoria do dia"*, e *"a janela que conclui sobre um dia inteiro é sempre
ONTEM, nunca HOJE"*. E mesmo assim o relatório de ontem **abriu** dizendo que o
indicador estava limpo, com a ressalva do n enterrada depois. Quatro horas
depois vinha o pior dia da série.

**O diagnóstico estava certo e a ESTRUTURA do relatório o contradizia.** Não
adianta declarar a limitação no meio do texto se o topo afirma o contrário —
quem lê o topo (e é o que o Johnny lê no Telegram) recebeu "limpo". A lição de
16/09 dizia que toda checagem tem que declarar o que não cobre; faltava a parte
difícil: **o que ela não cobre tem que estar no TOPO, não no rodapé.**

**REGRA:** o número de HOJE nunca abre o relatório nem a mensagem. Abre ONTEM
(dia fechado) e, quando houver, o aluno travado. "Hoje" entra **sempre** com o %
do dia que representa e **sempre** comparado ao mesmo horário de ontem — porque
"0/44 hoje" e "0/40 ontem antes de 12 falhas" são a mesma frase.

### Segunda lição — meu rótulo mentiu com mais confiança que meu número

O script rotulou 9 das 12 falhas como **"tempo normal → reprovação do QA"**.
Nenhuma delas era reprovação do QA: eram jobs voltando **sem áudio**. O rótulo
não é um bug de cálculo, é uma **categoria velha** — a rotina foi construída
quando só existiam dois modos (reprovação do QA e hang), e ela força todo caso
novo num dos dois. É o par exato da lição de ontem ("o veredito enfático da minha
própria ferramenta não é árbitro"), mas um nível abaixo: **ontem foi o veredito,
hoje foi a taxonomia.**

**REGRA:** quando aparecer assinatura de erro inédita, o rótulo derivado
(`tempo normal`/`hang`) **não se aplica até ser revalidado**. Categoria fechada
só é honesta enquanto o mundo não traz caso novo — e trouxe dois em dois dias.

### Terceira lição — a comparação plana quase me deu a frase errada

Eu tinha a manchete pronta ("rápido demais pra ter gerado áudio") e o dado plano
a **derrubou** (p05 de um ready = 13,7s). Só o pareamento por tamanho de texto
mostrou o que é real: 7/10 anômalas **na própria faixa**. É a lição de 29/08
(o denominador que vale é o da faixa) aplicada ao **tempo** em vez de à taxa.
**Elapsed sem o tamanho do texto ao lado não significa nada** — e eu venho
imprimindo elapsed agregado há semanas.

---

## Pendências para a próxima ronda (CRITÉRIO, nunca gatilho)

1. **`RunPod COMPLETED` voltou hoje à noite?** Dois dias seguidos de falha de
   infra no pico (16/09 19-20Z, 17/09 20-22Z) já é padrão. **Se aparecer em
   17-18/09 à noite, são três dias e aí é escalar para o RunPod, não observar
   mais.** A leitura de hoje às 15:44Z **não responde isso** — o horário do
   evento ainda não chegou.
2. **Roseni gerou com sucesso?** É a única que **nunca** ouviu um áudio. Se
   continuar sem gerar, é perda de aluna paga, não métrica. **Merece contato
   humano hoje** — e isso é decisão do Johnny.
3. **Tania voltou?** 44h de silêncio, conta vence **21/09**.
4. **Régua:** se aparecer verde novo, cheque o diff de `jobs/inference.py` e
   `jobs/tts_settings.py` antes de partir janela. Verde não é corte.
5. **H-idioma:** falta 1 divergente (7/8). Ao fechar, tirar do braço de controle
   as **15** falhas que não são `qa_coverage` (4 de 16/09 + 11 de 17/09).
   Reavaliar o alvo (828 vs ~501) **só depois** de fechar.
6. **Detector de tempo:** trocar o limiar único (`>400s`) por comparação
   **pareada com a faixa de texto** (p05 da faixa), que é o que pegou 7/10 hoje.
7. **Baselines pra amanhã:** `qa_coverage` desde 25/08 = **12**; falhas totais =
   **30**; dias fechados 09/09=116, 10/09=90, 11/09=100, 12/09=72, 13/09=50,
   14/09=96, 15/09=94, 16/09=78, **17/09=76** (primeira leitura fechada).
