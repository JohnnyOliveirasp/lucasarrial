# Ronda das falhas — 03/09/2026 ~12h30Z (dono da fila)

Serial: **#47 (Katia)**, o mais antigo com aluno esperando, aberto em 19/08.
Tudo abaixo foi medido nesta ronda. Onde não medi, está escrito que não medi.

**Não fechei o #47.** O que andou foi o bloqueador dele, o #234 — e ali um
limite honesto que a ronda das 12hZ deixou em aberto caiu, levando junto um
defeito de código que ninguém tinha visto.

## O que a ronda anterior deixou em aberto

A nota das 12hZ do #234 terminou assim, no item 9:

> as 6 fronteiras "entregues sem veredito" (8% do denominador) não estão
> explicadas. Podem ser chunk que não passou pelo QA interno ou pendência
> perdida entre tentativas. Não investiguei, e enquanto não souber, o
> denominador honesto é 72 e não 78.

Era o único ponto do instrumento que ainda não se sustentava. Fui atrás dele
porque é a única parte do #234 que **não depende de tempo de coleta** — e
tempo de coleta era, e continua sendo, o passo em que o incidente emperra.

## As 6 estão explicadas: é a conta fechando, não furo

São o **último chunk de cada geração**. Ele não tem fronteira INTERNA depois
dele — quem julga o fim do arquivo é a régua `tail_*`, que sempre teve gate
duro. Então `registrar_tail_interno` recebe `None` e cai em `_sem_veredito`.

A prova é aritmética, não leitura de código. Nas 7 gerações da janela
(03/09 04:01Z–11:29Z), `entregue_n + sem_veredito` bate **exatamente** com
`coverage_medido_n` (pedaços entregues), uma por uma:

| geração | entregue_n | sem_veredito | soma | coverage_medido_n | resgate |
|---|---|---|---|---|---|
| 4ef43a69 | 8 | 1 | 9 | 9 | 0 |
| f0a004df | 15 | 1 | 16 | 16 | 0 |
| **a8caaae1** | 21 | **0** | 21 | 21 | **1** |
| a9fd1467 | 15 | 1 | 16 | 16 | 0 |
| 7e6db447 | 3 | 1 | 4 | 4 | 0 |
| 11b691e0 | 7 | 1 | 8 | 8 | 0 |
| 95ce49d1 | 3 | 1 | 4 | 4 | 0 |

Um fim de arquivo por arquivo, como tem que ser. **O denominador de 72 estava
certo** e os 16,7% da nota das 12hZ seguem válidos.

## A exceção denunciou um defeito real

A única geração com `sem_veredito` = 0 é a **a8caaae1** — e é exatamente a
única da janela com `coverage_rescue` = 1. Com essa pista fui ao código:

Quando o **último chunk** cai no resgate por subdivisão, quem termina o áudio
do aluno é o **último sub-pedaço do resgate**. E
`_resgatar_por_subdivisao` / `_resgatar_nivel_2` chamavam `_rodar_qa` **sem
passar `eh_ultimo`**, ficando no default `False`.

Consequência: o fim REAL do arquivo passava a ser julgado pela régua INTERNA,
que está em **sombra** (`pontua=False`). Ou seja — o único ponto do áudio que
sempre teve gate duro de fim abrupto ficava **sem gate nenhum**, e justamente
numa geração que já tinha dado problema, porque foi o resgate que a trouxe até
ali.

### Corrigido: commit `3bc1535` na main

6 linhas funcionais em `runpod-worker/jobs/inference.py` (o resto é comentário
com a medição). O `eh_ultimo` desce pro resgate, e **só a última ponta do
último chunk** é marcada como fim de arquivo; as outras continuam fronteira
interna, na sombra.

⚠️ **Não afirmo produção.** O push disparou o build da imagem do worker (run
`33752907497`, 12:01Z). Builds recentes levaram de 15 a 50 min, e só depois o
Action troca o template no RunPod e recicla os workers. Enquanto o
`WORKER_IMAGE` novo não sair num job, isto é **"na main", não "em produção"** —
é a mesma distinção que produziu o fechamento falso do #226.

### O teste quebra SEM o conserto (vermelho antes, não verde depois)

Dois testes novos em `test_refactor_smoke.py`: resgate no ÚLTIMO chunk, e o
contrapeso (resgate no chunk do MEIO não pode inventar um segundo fim de
arquivo). Rodei o primeiro com o `inference.py` revertido via `git stash`:

```
KeyError: 'tail_interno_entregue_sem_veredito'
```

que é **literalmente a assinatura da a8caaae1 no banco**. Com o conserto, os 7
arquivos de teste do worker passam.

Uma armadilha medida no caminho, anotada no próprio teste: tirar só *metade*
das palavras do chunk não força resgate — cai na escotilha de "lacuna
espalhada" (20/08) e o chunk é ENTREGUE. Precisa sobrar pouca palavra.

## O que isso muda pro #234 — sem inflar

**Não é a causa dos 16,7%.** As 6 fronteiras reprovadas medidas na janela
estão em gerações SEM resgate. O alcance disto é pequeno: **5 de 475** gerações
`ready` com telemetria de cobertura têm `coverage_rescue` >= 1 (**1,05%**), e
só a fração dessas em que o chunk resgatado é o ÚLTIMO é afetada.

O que importa de verdade é o **denominador**. Com o fim do arquivo contando
como fronteira interna, a régua de entrega divergia justamente nas gerações
resgatadas — e é essa régua que vai decidir se `TTS_TAIL_QA_INTERNO_MODO` vira.
Consertado agora, a coleta de 24–48h nasce com a conta fechando em todas.

## E não é o caso da Katia — não vendo como se fosse

Conferi as gerações dela: nem a **81d4f3f4** (a que ela ouviu e reclamou) nem a
**1498fbe5** (a refeita) têm `coverage_rescue` — as duas vêm com 0. O defeito
que corrigi hoje **não passou perto do áudio dela**. O que corrige o caso dela
é o gate da fronteira INTERNA, que segue em sombra com precisão ~57%.

## A aluna

Nada novo dela desde 02/09 15:40Z (`last_seen_at` inalterado, nenhuma
ocorrência nova). O último e-mail que ela tem é o **uid 461** (02/09 17:44Z), a
retratação: diz que ela estava certa, que o defeito é nosso, que não é a voz
nem o texto dela, que atinge centenas de vozes desde julho, e que não damos
data. O áudio dela já foi refeito por conta da casa.

**Não escrevi pra ela hoje, de propósito.** Repetir o que ela já sabe é ruído
(regra 27), não atendimento.

Seguem sem conserto, e ela já sabe pelo uid 461: a pronúncia de "reconstrução"
e a pausa do segundo 5.

## Passo em que emperrou

O mesmo de hoje cedo, sem maquiagem: **falta amostra**. Não dá pra virar a
chave com n=7 gerações e ~57% de precisão — reprovar assim ainda força regen em
geração boa. O próximo passo é juntar 24–48h da régua de ENTREGA e cruzar
geração a geração com o `cauda_decepada.cjs` nos mesmos mp3. **Não é bloqueio
de autorização nem de gente: é tempo.**

## Limites honestos desta ronda

1. **Não rodo o worker de verdade nesta máquina** (sem GPU, sem os pacotes
   pesados). Instalei numpy/soundfile/requests/huggingface_hub num venv
   descartável (`/tmp/qavenv`) só pra rodar os testes com o VoxCPM stubado.
2. **O CI do `runpod-worker` não roda teste nenhum** — só builda a imagem.
   Então o que garante este conserto é teste unitário + leitura + a assinatura
   no banco. Não é execução em produção. Fica anotado como dívida.
3. **Verificação que falta**, simples, pro próximo que passar: depois do
   deploy, a primeira geração `ready` com `coverage_rescue` >= 1 tem que
   aparecer com `tail_interno_entregue_sem_veredito` = 1 e com a conta
   `entregue_n + sem_veredito = coverage_medido_n` fechando.
4. `runpod-worker/jobs/inference.py` está com **606 linhas**, acima do teto de
   400 da regra 22. Já estava em 578 antes de mim; não separei o arquivo na
   mesma mudança que altera comportamento, de propósito — refator junto com fix
   é como regressão se esconde. Fica registrado como dívida, não como coisa que
   eu não vi.

## O que NÃO fiz, de propósito

- Não virei a chave `TTS_TAIL_QA_INTERNO_MODO` (a precisão ~57% não mudou; o
  que mudou foi o gate do fim do arquivo, não a régua interna).
- Não apliquei `_curar_fim_abrupto` no áudio resgatado. A cura **regenera o
  chunk inteiro** com a frase-isca, e esse chunk chegou ao resgate exatamente
  porque o modelo comia um pedaço quando gerado inteiro; ela só é guardada por
  `_fim_ainda_ruim`, que não olha cobertura. Trocaria fim decepado por texto
  faltando.
- Não refiz áudio de ninguém, não gastei GPU, não mexi em crédito.
- Não ouvi áudio nenhum — **não afirmo nada sobre som nesta ronda**.
- Não abri outro incidente antes de fechar este (regra 8). A fila de 17 recados
  `para_frank_*` continua onde a ronda das 12hZ a deixou.
