# Rodada das falhas — 18/08 23h UTC (20h BRT)

**Resultado:** nenhuma ocorrência nova, ninguém travado, fila estável em 2
incidentes `investigating`. **Achei um erro na minha própria entrega da rodada
anterior** e corrigi o registro antes que alguém agisse em cima dele.

## Estado da fila

| Incidente | Status | Occ | Última | Movimento nesta rodada |
|---|---|---|---|---|
| `d3d8d1b2` Geração de áudio: tempo estourado | investigating | 13 | 18/08 20:46 | 2h15 limpas |
| `2663506d` Rajada Vídeo Clone (fcdnanda) | investigating | 2 | 18/08 20:19 | 3h05 limpas |

`varredura_travados`: **0 itens presos**. Contadores reconferidos no fim da
rodada (a rodada anterior foi corrigida por uma ocorrência que entrou no ingest
*depois* da leitura — desta vez reli antes de fechar).

## Alunos: os três estão inteiros

Conferido no banco, não deduzido:

- **dralizbeth** — falha 20:46 (−456), estorno **+456** às 21:17, refez 21:24
  `ready` em 27,04s; seguiu com vídeo clone `ready` às 21:29, 21:40 e 22:23.
- **namaiimoveis** — falha 18:05 (−1620), estorno **+1620** às 18:43, refez
  18:42 `ready` em 23,34s; vídeo clone `ready` 18:47 e 20:01.
- **fcdnanda** — 3 falhas 20:16–20:19, os 3 débitos de −4620 estornados
  integralmente; depois **2 vídeos entregues** (20:36 e 20:49).

Ninguém escreveu, ninguém ficou sem entrega, nenhum crédito pendurado.
Nenhum e-mail enviado — mesmo critério das rodadas anteriores.

## O fix 1c09508 está no ar — conferido no servidor, não suposto

Playbook P ("pronto" ≠ "no ar"), aplicado:

- `.next/BUILD_ID` de **18/08 22:11:46 UTC**
- `elapsed_seconds` presente nos **dois** bundles compilados
  (`webhooks/runpod/route.js` = 2, `generations/[id]/route.js` = 1)
- `pm2 aiverse` no ar desde **22:12:39** — 53s após o build, logo o processo
  em execução **é** esse build

**Armada ≠ provada:** nenhuma falha ocorreu após o deploy, então ela nunca
escreveu um valor (`failed` com `elapsed_seconds` preenchido = **0** em toda a
base). Só a próxima ocorrência prova.

## O erro que eu cometi na rodada das 22:20 — dois relógios diferentes

Eu escrevi que bastaria comparar o `elapsed_seconds` da falha com a
distribuição de sucesso (p99 136,8s, pior 459,7s) para separar **HANG** de
**COLD START**. Está **errado**, e produziria veredito falso.

| Caminho | Fonte | O que mede |
|---|---|---|
| Sucesso | `out.elapsed_s` (`lib/generations/finalize.ts:62`) | relógio **interno do worker** |
| Falha (1c09508) | `executionTime` do RunPod | relógio **da plataforma** |

No `handler.py`, `t0 = time.monotonic()` está na **linha 1012**, depois de
`_free_cuda()`, `_ensure_model_downloaded()` e `VoxCPM.from_pretrained(...)`.
Ou seja: a distribuição histórica mede **só o loop de inferência**, com modelo
já baixado e já carregado na VRAM — **exclui o cold start inteiro**. O
`executionTime` da plataforma **inclui**.

O viés aponta exatamente para o lado que dá falso "HANG": cold start é
justamente a parte que o relógio do worker nunca contou. E cold start era a
**única hipótese que a rodada anterior não conseguiu matar**.

### O que isso invalida (para ninguém agir em cima)

Eu ia propor **cortar o teto** (hoje `max(30min, 15min + chunks×2min)`) usando
"pior sucesso real = 7,7min". **Não proponho mais.** 7,7min é o pior tempo de
*inferência*, não de *job*. Cortar o teto com esse número mataria job legítimo
em worker frio. Derrubei minha própria proposta antes de mandá-la.

## Segundo achado: a coluna tem buraco de ~22%, todo dia

2.890 gerações `ready` em 45 dias, **2.266 com `elapsed_seconds` (78,4%)**.
Conferi se o buraco era temporal (coluna nova) e **não é**: fica em 20–25% em
**todos** os 45 dias. Logo é caminho de código, não data — jobs cujo output do
worker não trouxe `elapsed_s`. A distribuição descreve 78% dos sucessos, com os
22% ausentes selecionados por mecanismo ainda não identificado, que **não posso
assumir neutro em velocidade**.

Consulta **paginada** (o Supabase corta em 1.000; `limit` ingênuo mente sobre a
cauda) e `error` checado em toda query — o script quebrou 3× em coluna
inexistente (`generations.updated_at`, `profiles.credits`,
`credit_transactions.type`) e **falhou alto** em vez de imprimir zero.

## O que a instrumentação ainda entrega

Valor **extremo** continua conclusivo: falha perto do teto inteiro (~30min) é
hang com certeza — nenhum cold start plausível leva 30 minutos. O que se perde
é a discriminação **fina** (falha entre ~8 e ~15min fica ambígua). Continua
valendo o relógio do estorno (playbook R), que deu **31min19s** no caso das
20:46 e aponta hang.

## Vídeo Clone: duas famílias de falha, não uma

1.417 jobs em 45 dias, **54 falhas (3,8%)** espalhadas por **22 alunos**.
fcdnanda é 3 de 54 — a burst-rule abriu no nome dela por concentração, não por
anomalia dela.

- **Família A — determinista por entrada:** fcdnanda usou o **mesmo** áudio nas
  3 tentativas (`9a-9cc9-44410c2bf6b2.mp3`); bruno.moura repetiu `93-bd5a` 2× e
  `c8-916b` 2×; sdelmassa72 repetiu `5f-9bda` 2×.
- **Família B — não é por entrada:** leilapatricia (incidente `db17c668`, 11
  falhas em 06/08) usou **onze áudios diferentes**, nenhum repetido.

**Correção:** o executor ligou os dois incidentes pela `sample_error` genérica
("Job processing failed") e eu deixei a ligação de pé na rodada das 18h. O dado
de entrada diz que são coisas diferentes, e juntá-las atrasa as duas.

**A taxa caiu:** apenas **2 eventos em 10 dias** (11/08 andremillioni, 18/08
fcdnanda). O grosso das 54 está em 09/07, 23/07, 03/08 e 06/08. É cauda
residual, não incidente em curso.

## Binárias para o Johnny

1. **Migration** para gravar o `executionTime` da plataforma **no sucesso**
   (coluna nova — não dá para reaproveitar `elapsed_seconds`, que já carrega o
   relógio do worker em 2.266 linhas e alimenta o "gerado em Xs" da UI).
   Sem isso, a comparação da próxima falha fica enviesada.
2. **Reprodução por conta da casa** do caso fcdnanda (áudio + imagem, 480p-v3),
   sem cobrar, puxando o log do RunPod dentro dos 30min. Gasta GPU.

Nada executado sem aval. Nenhum e-mail em massa, nenhum crédito mexido,
nenhuma migration aplicada.
