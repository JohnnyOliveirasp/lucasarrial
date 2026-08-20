# Ronda diaria - saude do QA de audio (qa_coverage)

Rodada em 2026-08-20 ~15:10Z. Card Mission Board: f345bf1e.

## PASSO 1 - qual regua esta no ar

Ultimo run VERDE de `runpod-worker.yml` que tocou `runpod-worker/`:

- sha: `aae3ba51eacd12c73b093e0a0a7ecdbd481f7a11`
- titulo: `fix(voz): parar de reprovar audio BOM - a regua passa a medir a FORMA do buraco`
- arquivos: `runpod-worker/handler.py`, `runpod-worker/test_coverage_qa.py`
- criado 2026-08-20T11:01:19Z, **TERMINOU 2026-08-20T11:41:59Z** (40min, dentro da faixa normal de 28-52min)

Nenhum run falhado nem em andamento nos ultimos 8. **A correcao mais recente ESTA no ar.**
O corte de todas as janelas abaixo e o TERMINO (11:41:59Z), nao o commit.

Obs: hoje houve 4 builds verdes (01:23, 03:19, 03:53, 11:41). Entao a janela
"hoje antes do corte" nao e uma regua unica, e uma mistura. Isolando so a regua
imediatamente anterior (03:53:48Z -> 11:41:59Z): 18 geracoes, 2 falhas - n pequeno
demais pra concluir isolado, registrado so por rastreabilidade.

## PASSO 2 - medicao

Criterios: `generations`, paginado em blocos de 1000 (177 linhas no total desde 19/08 00h UTC,
uma pagina so). Conta `johnny.oliveirasp@gmail.com` excluida (admin, nao debita credito).
Geracao `pending` em voo excluida do denominador. Status distintos no periodo: ready=168, failed=9, pending=1.

| janela | total | falhas qa_coverage | taxa |
|---|---|---|---|
| ONTEM 19/08 (dia inteiro) | 110 | 5 | **4,5%** |
| HOJE ate o build verde (00:00 -> 11:41:59Z) | 39 | 3 | **7,7%** |
| HOJE depois do build verde (11:41:59Z -> 15:10Z) | 23 | 0 | **0,0%** |

### REGRA DO DENOMINADOR - o que da e o que NAO da pra concluir

**NAO da pra concluir que melhorou.** n=23 na janela nova.
- Se a taxa verdadeira continuasse em 10%, a chance de sair zero falha em 23 geracoes
  por puro acaso e `0,9^23 ~= 9%`. Nao e desprezivel.
- Limite superior 95% pela regra de tres: `3/23 ~= 13%`. Ou seja, o dado observado
  **nao exclui** a taxa velha.
- Veredito: sinal bom, prova nenhuma. Precisa de ~2 dias limpos pra afirmar melhora.

Ritmo de hoje: 3 a 11 geracoes por hora. Nesse ritmo, um dia inteiro limpo da ~60-100
geracoes, o que ja seria conclusivo contra uma taxa de 7-10%.

### elapsed_seconds - reprovacao ou hang?

Todas as 9 falhas do periodo tiveram elapsed entre **39,9s e 226,2s**, dentro da faixa
normal (40-230s). **Nenhum hang.** Incidente d3d8d1b2 (aceite de risco do Johnny)
continua sem motivo pra reabrir.

### ACHADO QUE LIMITA A MEDICAO (nao consertar sozinho)

4 estornos de agosto (`ref_type='generation_refund'`) apontam pra `ref_id` que
**nao existe mais** na tabela `generations`:

| quando | aluno | ref_id | valor |
|---|---|---|---|
| 2026-08-19T18:15:29Z | paulogmarinho@gmail.com | 5c1adcf6-... | 1164 |
| 2026-08-19T18:19:20Z | paulogmarinho@gmail.com | f44d84cd-... | 1164 |
| 2026-08-19T18:22:43Z | paulogmarinho@gmail.com | dd794da4-... | 1159 |
| 2026-08-20T00:11:18Z | robertocesarfernandes771@gmail.com | 9f8af111-... | 1508 |

Os 3 do paulogmarinho caem exatamente dentro do cluster de falhas qa_coverage de
19/08 (18:11-19:05), e ele nao tem NENHUMA linha em `generations` no dia 19/08.
Conclusao: **linhas de geracao falhada somem da tabela**. Toda taxa medida por
`generations` e portanto um **LIMITE INFERIOR**.

Taxa corrigida somando os estornos orfaos como falhas presumidas:
- 19/08: 8/113 = **7,1%** (em vez de 4,5%)
- hoje ate o corte: 4/40 = **10,0%** (em vez de 7,7%)
- hoje depois do corte: 0 orfao, segue 0/23

Isso e exatamente o tipo de erro de regua que esta rotina existe pra pegar. Vira card
pro coder investigar por que a linha some; **nao mexi em nada.**

## PASSO 3 - quem falhou

**ALUNO TRAVADO AGORA (prioridade):**
- `dirceu.walber64@gmail.com` (DIRCEU WALBER GONCALAVES DE LIMA) - falhou 20/08 00:35
  com o texto mais longo do periodo (2000 chars), estornado 00:39. **Nao voltou desde
  entao (~14h30).** Ele nao tem o audio que pediu. Estorno nao e caso resolvido.
  Acesso vence 2026-08-24 (4 dias).

**CREDITO NAO ESTORNADO:**
- `serescastro6@gmail.com` (seres castro) - falhou 2x com o MESMO texto de 1080 chars.
  A 1a (08:39, id a40918d4) foi estornada as 08:41. A 2a (10:09, id db811e2f)
  **nao tem nenhuma transacao apontando pra ela** - o aluno perdeu 1080 creditos.
  Conseguiu o audio na 3a tentativa, 10:15. Nao esta travado, mas ta devendo credito pra ele.
  (Conferido por `ref_type='generation_refund'`, nunca por `kind` - o estorno grava
  `kind='extra_purchase'`.)

**Se resolveram sozinhos (voltaram e conseguiram):**
pestanatiago2008@gmail.com, allysoncruz.nutri@gmail.com, estudioelianeguedes@gmail.com,
nucleartstudio@gmail.com, paulogmarinho@gmail.com, robertocesarfernandes771@gmail.com.

## Nao fiz (fora do escopo da ronda)

Nao respondi aluno, nao mexi em credito, nao abri/fechei incidente, nao toquei no
endpoint do RunPod.

## Ferramentas

`/tmp/perf/qacov.cjs` (janelas), `/tmp/perf/sanidade.cjs` (status distintos + exclusao
de admin), `/tmp/perf/orfas.cjs` (estornos orfaos), `/tmp/perf/travados.cjs` (aluno voltou?).
