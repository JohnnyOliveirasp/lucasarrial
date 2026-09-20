# Ronda das falhas — 20/09, 00hZ

Item serial: **#15 / `d3d8d1b2`** (o mais velho com aluno: 51,4d, 18 alunos).
**NAO fechado.** Entregue o item (a) que a nota de 17/09 deixou pendente.

---

## 0. Passo fixo da ronda: reconciliar os envios

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

771 cartas lidas da pasta `Sent`, 694 ja tinham linha, 77 fora da janela do
`--corte`, **0 escrituraveis, 0 recusadas**. A contagem fecha (771 = 771).

Conferido com o instrumento independente
(`2026-09-18_enviados_x_tabela.cjs`): **veredito "0 carta depois do corte"**.
O buraco segue PASSIVO.

⚠️ As **77 cartas anteriores a 14/09 14:06:31Z** continuam sem decisao — e o
que o `--corte` exclui de proposito. Segue sendo decisao de producao
(`cobreDesde` em `contato-tentativas.ts`), nao de ronda.

## 0.1 Percepcao travada (ordem de 17/09)

`percepcao_travada.cjs`: **2 cartoes**, mais velho parado ha **1,5d**.
Nenhum dos dois e parada nova e nenhum precisa de despacho novo:

- **#450** — ja despachado e resolvido como **nao sendo** caso de percepcao
  (falso positivo do proprio varredor, anotado na ronda de 18/09).
- **#473** (Katia) — audio ja refeito e ja despachado ao `olho` numa ronda
  anterior; espera a **aluna** ouvir. Espera legitima, com data.

## 0.2 Placar da fila

82 abertos · 36 aguardando aluno · 0 presos em estado intermediario ·
1 fechado sem retorno humano (#407).

---

## 1. Erro meu, pego antes de virar relatorio

Primeira consulta de dormencia: `created_at > '2026-09-04 20:47:50Z'` →
**timeouts = 1**. Quase escrevi "a classe reincidiu".

Nao reincidiu. A ocorrencia de 04/09 esta gravada em **20:47:50.38824+00**,
maior que o literal `20:47:50.000` — o proprio marco entrou na janela que
deveria exclui-lo. Refeito com o timestamp cheio: **1.159 geracoes, ZERO
timeout**, ate 19/09 23:39Z. **Classe dormente ha 15,1 dias, nao curada.**

Fica registrado porque a familia do erro e a deste cartao (denominador errado
em 12/09, 14/09, 15/09 e 16/09). A diferenca: desta vez o vies era o
**inverso** do habitual — o achado CONTRARIAVA a tese calma e por isso era
empolgante. Empolgacao confere tao pouco quanto confirmacao.

## 2. O achado da ronda: o item (a) estava pronto ha 2 dias, parado num branch

A nota de 17/09 termina com *"(a) heartbeat levar regens acumulado. Delegado
ao coder nesta ronda com cartao no Mission Board."*

- Cartao `15c6d862`: **[completed]** desde 17/09 14:00.
- Na main: `grep regens worker_log.py` = **0**.
- Na verdade: **PR #329**, aberto **17/09 17:57Z**, 2 dias parado, sem CI
  (o repo nao roda check nesse branch) e sem review.

E a armadilha que o manual descreve com todas as letras — *"card completed no
Mission Board NAO significa em producao, so a main deploya"* — a mesma que em
19/08 deixou um fix de aluno 9h preso. Sem isso, o #15 entraria numa **7a
ronda** pedindo o item (a) com o item (a) pronto no origin.

## 3. O que eu conferi antes de mergear

Nao aceitei o relatorio do operario como prova.

- **Diff lido** (`worker_log.py` +88, `jobs/inference.py` +22): telemetria
  pura. Provedor consultado por tick, lista branca de 1 chave (`regens`),
  `try/except` em volta de tudo, `set_current_job(None)` limpa. Nenhum arquivo
  de `frontend/`, nenhuma migration, nenhuma env nova, nada no caminho de
  credito/estorno.
- **Conferi a ponta que o relatorio nao provava:** se `self.qa_stats` nao
  existisse no momento em que `run()` registra o provedor, a lambda levantaria
  `AttributeError`, `_stats_do_job` devolveria `{}` e a feature seria
  **decorativa sem quebrar nada** — o pior defeito possivel num cartao que ja
  perdeu rondas com telemetria que *parecia* ligada. Esta em
  `inference.py:84`, no `__init__`, antes do `run()`. Ok.
- **Testes rodados por mim** (venv do repo quebrado; criei `/tmp/venv-ronda`):

  | | resultado |
  |---|---|
  | `test_fase_telemetria` no branch | **27 testes OK** |
  | `test_fase_telemetria` na main (baseline) | 13 OK |
  | suite inteira do worker no branch (8 arquivos) | **8/8 OK** |

  A saida do teste mostra o payload real do heartbeat com `"regens": 12` — a
  feature faz o que promete, nao so passa no teste.

- **Mergeado:** PR #329 → main, merge **`d49837ff`** (19/09 23:45:33Z), branch
  deletado. Confirmado na `origin/main`: 7 ocorrencias de `regens` em
  `worker_log.py`.

## 4. Limite declarado: mergeado nao e, ainda, rodando

`runpod-worker/**` na main dispara o workflow **Build RunPod Worker**
(run `35476982295`, iniciado 23:45:35Z). Builds recentes levaram **24 a 47
min**. **No fechamento desta ronda o build ainda nao tinha terminado.**

Entao, dito sem enfeite: **o codigo esta na main, a imagem ainda nao esta
publicada, e nenhum job real gravou `regens` no heartbeat ate agora.**

A conferir na proxima ronda:

```sql
select id, created_at, qa->'fase_corrente'->'meta'->>'regens'
from generations
where qa->'fase_corrente'->'meta' ? 'regens'
order by created_at desc;
```

Enquanto essa consulta nao devolver linha, o item (a) esta **entregue na main
mas nao provado em job real**.

## 5. Dinheiro

**19 de 19** executionTimeout com estorno, conferido por
`ref_type='generation_refund'` (**nao** por `kind` — `kind` grava
`extra_purchase` e enganaria pro lado de pagar em dobro). `SEM_ESTORNO = 0`.
Nenhum aluno esperando nesta classe: ultima ocorrencia ha 15 dias, todos
estornados na hora.

## 6. (b) e (c): 3 cartoes parados na mesma pergunta de uma linha

`#226` (`702cc916`) e `#234` (`f8587cef`) seguem `investigating`. A pergunta
de rigor do QA foi ao grupo em **17/09 — 2 dias sem resposta**. O conserto do
proprio #15 (item c, orcamento de regen consciente do teto) e a **mesma** troca
qualidade x entrega.

Os tres **nao** estao travados por falta de medicao: ela esta feita, com preco
em tempo, desde 17/09. Estao travados numa decisao de produto. Nao decido no
lugar do Johnny.

## 7. Excecao ao serial: conferida e nao aplicavel

Antes de seguir no #15, conferi o unico gatilho que autorizaria abrir outro
cartao — dinheiro sendo cobrado errado agora. **#254** (cobranca em dobro, 15
alunos): a ronda de 17/09 ja mediu os 8 candidatos e sao **zero vitimas**
(so o Diego, deixado cobrar por decisao consciente). Excecao nao se aplica;
serial mantido.

## 8. O que NAO fiz

Nao gastei GPU, nao virei chave, nao toquei em credito, acesso, voz nem
migration. Nao escrevi pra aluno (nao ha aluno esperando nesta classe). Fora o
banco de incidentes, a unica escrita foi o merge do PR #329.
