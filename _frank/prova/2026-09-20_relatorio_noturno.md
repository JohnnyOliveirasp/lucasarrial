# 20/09 — Relatório noturno

**Postado no grupo** (`notify-grupo.sh`), conforme a ordem de 31/08. Consolidado
do dia inteiro numa mensagem só; as rondas de hora em hora já postaram os fatos
consumados (regra 7) e não se repetem aqui.

Fechado às **21/09 ~01:15Z** (o dia 20/09 teve ronda até 01hZ do 21).

---

## 1. O que eu resolvi

### 1-A. Sete cartões fechados, o maior deles com dinheiro na mão

Conferido por `resolved_at` no banco, não por lembrança:

| cartão | o que era | quando |
|---|---|---|
| **#485** | clipe de cena falhava e a casa **não devolvia nada** — 43 cenas, 7 alunos, desde 31/07 | 02:08Z |
| **#270** | 15 alunos ressarcidos | 10:57Z |
| **#496** | a ferramenta de anotar gravava **no cartão de outra pessoa** e dizia que deu certo | 12:27Z |
| **#343** | Welrisson (atendimento humano), fechado por conferência | 12:45Z |
| **#358** | rajada do Vídeo Estúdio (b-roll) — conserto de **14/09** que ninguém voltou pra fechar; aluno avisado | 13:44Z |
| **#367** | a cura da referência por palavra tinha **3 saídas silenciosas** | 14:51Z |
| **#502** | áudio entregue mais curto do que o texto | 23:25Z |

O **#485** é o que mais importou: o conserto (`dc3a6be3`) está no ar, **59.400
créditos voltaram para 6 alunos** e os 6 foram avisados. Sobraram **62.040 cr de
2 alunos**, acima do teto de 20.000/caso da regra 9-B — escalados e rastreados no
cartão **#488**, pra o dinheiro não sumir junto com o cartão fechado. É a
pergunta 1 da seção 2.

### 1-B. O PR que estava havia 24 dias em rascunho entrou em produção

O **PR #92** (velocidade da referência de voz — caso Ellen) estava em draft desde
27/08 e tinha virado **CONFLITANTE**: 1.023 commits de distância do merge-base.
Não era conflito de texto, era redesenho concorrente. Foi refeito como união com
o `cut_mode` da main e entrou como **PR #379 / `561f6867`**, 21:45Z.

Correção de rumo que saiu junto: **são duas Ellens**. O conserto que subiu é de
**velocidade**; a queixa que continua esperando é de **entonação** (pergunta que
não sobe o tom). Uma coisa não fecha a outra, e os dois cartões (#500 e #348)
ficaram com a nota dizendo isso.

### 1-C. Dois números herdados que estavam errados, derrubados

1. **Fila de percepção: 18 → 2 → 0 real.** O SQL que a ordem de 17/09 manda rodar
   conta qualquer nota que *mencione* ver/ouvir/assistir. O instrumento da casa
   (`percepcao_travada.cjs`, com controle positivo) conta quem **só para** por
   isso: **2** — e os dois já estão resolvidos (#450 é falso positivo pela própria
   frase que o refuta; #234 já tem laudo). Eu ia publicar 18 pela quinta ronda
   seguida. A ordem de 17/09 precisa de uma correção de texto apontando pro
   instrumento, não pro regex.
2. **#254 dizia sobre si mesmo que "TODOS já foram avisados por escrito".** Dos 15
   endereços, **4** tinham carta. Os outros **11 tinham zero**. Corrigido no
   registro; Leandro e Carlos escritos. E a Herineth, que a ronda das 20h tinha
   **tirado** da lista de reembolso, voltou: ela tem **duas** assinaturas, não uma
   — a ronda anterior mediu com o instrumento errado.

### 1-D. Alunos

**42 cartas para 40 alunos** saíram das rondas hoje (`origem = ronda-manual`).
Casa inteira: 120 cartas / 67 pessoas, 1 quicou.

---

## 2. O que precisa de você

Cinco, todas de uma linha. Ordenadas por dinheiro parado e idade.

1. **Posso falar por WhatsApp com os 10 pagantes sem acesso?** (R$ 8.250,27; o
   mais antigo espera há **44 dias**; telefone existe para 11 das 12 fichas; canal
   WAHA medido funcionando em 06/09) — **sim / não**
2. **Sai o reembolso em dinheiro do Carlos, Jackson, Leandro e Nassara?**
   (cobrança em dobro; pedido em **04/09**, parado há 16 dias) — **sim / não**
3. **Devolvo os 62.040 cr aos 2 alunos do #485?** (acima do teto de 20.000/caso;
   cartão #488, aberto hoje 02h) — **sim / não**
4. **Autorizo GPU pra retreinar as 11 vozes do #501?** (a régua de 20 min contou o
   mesmo arquivo várias vezes — raul: 7m30 contados como 33m36) — **sim / não**
5. **A compra avulsa do SGP dá direito a quê dentro do FastCloner?** — essa não é
   sim/não, é comercial, e é o que trava os **309 do #426 (~R$ 66 mil)**.

---

## 3. O que subiu pra produção

Oito PRs mergeados hoje:

| PR | commit | o que corrige |
|---|---|---|
| #363 | `6007594b` | lucro do caixa (período e acumulado) já sai com a retirada descontada |
| #365 | `9a8ca328` | lista de estornos conhece `video_clip_refund_backfill` (4ª reincidência) |
| #364 | `08cb2433` | o centro do gráfico deixa de se chamar "Lucro (caixa)" |
| #370 | `58d9013b` | SGP: entrar na conta do aluno sem senha (link por `token_hash`) |
| #373 | `e5c5b2e1` | #371: gate de rosto determinístico (temperature 0) — 20 alunos eram barrados por sorteio |
| #376 | `0ea25ab4` | estorno: `image_refund_gate371` entra na lista (5ª reincidência) |
| #378 | `fed87f4a` | SGP: régua dos 20 min soma fala **distinta** (#501) |
| #379 | `561f6867` | voz: a referência respeita o **ritmo** da pessoa (o PR #92 de 24 dias) |

**No ar, provado — BUILD_ID no servidor, não Action verde:**

- `BUILD_ID` = **`rdGkQn0uzHZkJNn3MAZDu`**, compilado **20/09 21:46:54Z** — depois
  do último merge do dia (#379, 21:45:03Z), logo cobre os oito.
- Conferido por dentro, não só pela data: o símbolo que o #379 introduz
  (`reference_rate_wps`) está no **compilado** do servidor
  (`.next/server/chunks/2492.js`) e na fonte (`finalize-training.ts`, mtime
  21:45:13Z).
- Perna de GPU do #379: `deploy-runpod` **22:26:14Z**, workers reciclados (RunPod
  0→7, VOX B 0→4), sem `::warning::`.
- **Nada de código ficou esperando deploy**: os 8 commits posteriores ao build são
  todos prova/registro em `_frank/`, nenhum toca `frontend/` ou `runpod-worker/`.

Os PRs **#359** e **#360** também aparecem com data de hoje (mergeados 01:08Z e
01:10Z), mas já foram reportados no relatório de 19/09 — não conto duas vezes.

---

## 4. Estado geral

| | hoje (20/09) | ontem (19/09) |
|---|---|---|
| itens presos na varredura | **0** | 0 |
| incidentes abertos | **93** | 83 |
| …com 7 dias ou mais | **39** | 39 |
| …mais velho / mediana | **52d** / 5d | — |
| aguardando aluno (bola com ele) | 36 | 36 |
| fechados no dia | **7** | 19 |
| pagante trancado (prova na Hotmart) | **0** (1 sem prova) | 0 (1 sem prova) |
| pagante sem acesso pela classe do #426 | **10 · R$ 8.250,27** | 9 · R$ 7.400,82 |
| crédito devolvido no dia | **85.325 cr** (85% do teto de 100.000) | 11.525 cr |
| recados `tell_frank` na caixa | **129** | 117 |
| patch do Vigia esperando | 1 | 1 |
| GPU (3 endpoints) | fila **0** nos três · `unhealthy` **0** · `throttled` 1–3 | fila 0 · throttled 1–2 |
| lista de estorno | em dia: 16 devolução + 13 não-devolução, 3.509 linhas, **nada por classificar** | em dia |

Composição das devoluções de hoje, pra ninguém ter que confiar no total:
`video_clip_refund_backfill` 59.400 (6) · `image_refund` 25.000 (21) ·
`image_refund_gate371` 525 (1) · `generation_refund` 400 (1).

### Os quatro números que pioraram, ditos com todas as letras

1. **Abertos: 83 → 93.** Dez a mais em um dia, com só 7 fechados. A fila cresceu.
2. **Pagante sem acesso: 9 → 10, R$ 7.400,82 → R$ 8.250,27.** A classe não está
   estável, está crescendo: a Aline **pagou hoje e a carta já quicou**.
3. **Recados `tell_frank`: 117 → 129.** A caixa dos agentes só acumula.
4. **85% do teto diário de devolução** consumido num dia só.

### Um fechado que não conta como fechado

**#407** (Luciano, cancelamento) fechou em cima do próprio disparo e ninguém
voltou: o aluno escreveu de novo, o cartão re-fechou sozinho, e não houve retorno
humano. Última mensagem dele há **133h**. Trato como aluno esperando.

---

## 5. Técnico que alguém precisa conferir (fica aqui, não na mensagem)

1. **Nenhum workflow de CI roda `pytest`.** O `runpod-worker.yml` só builda
   Docker. Os **315 testes** da main não barram nada automaticamente — só rodam
   quando alguém lembra. É a mesma família do "fix preso em branch por 9h" e do PR
   de 24 dias: trabalho feito que não chega em produção porque nada o empurra. Não
   abri cartão (é infra de CI, não conserto de ronda) — fica nomeado.
   Detalhe em `_frank/prova/2026-09-20_rotina_falhas_21h.md` §6.
2. **77 cartas anteriores a 14/09 14:06:31Z** seguem sem decisão na reconciliação
   de envios (é o que o `--corte` exclui). Exige mexer no `cobreDesde` na mão:
   decisão de produção, não de ronda.
   Detalhe em `_frank/prova/2026-09-21_rotina_falhas_01h.md` §1.
3. **iCloud e Outlook seguem sem medição** na sonda de bounce — o iCloud recusou o
   IP residencial desta máquina (Spamhaus PBL), que **não** é o IP do SMTP de
   produção. Não se conclui nada sobre o caminho de produção a partir daí.
   Detalhe em `_frank/prova/2026-09-20_rotina_falhas_23h45.md` §3.3.

---

## 6. O que eu errei hoje, ao montar este relatório

Rodei a varredura diária a partir do worktree em
`feat/resumo-diario-grupo-suporte`, que está parado. Ela acusou **três `ref_type`
de estorno "desconhecidos"** (`edicao_broll_refund`, `image_refund_gate371`,
`video_clip_refund_backfill`) — alarme de dinheiro, do tipo que entra no relatório
como problema. **Era falso**: os três já estão cadastrados na `origin/main`; quem
não os conhecia era a minha cópia velha. Refeito em worktree limpa sobre
`origin/main`, o veredito é *"lista em dia, nada por classificar"*.

É exatamente a lição escrita ontem — *"branch parado mente com sintaxe perfeita"*
— me pegando de novo, 24h depois. O que impediu o erro de virar mensagem não foi
lembrar da lição: foi **reconferir o alarme contra a main antes de escrever**.
