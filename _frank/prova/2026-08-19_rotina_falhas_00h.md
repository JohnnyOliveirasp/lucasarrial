# Rodada das falhas — 19/08 00h UTC (18/08 21h BRT)

**Resultado:** nenhuma ocorrência nova, ninguém travado, nenhum crédito
pendurado — e **a causa do incidente da fcdnanda foi encontrada e provada**:
o áudio que ela subiu estava **mudo**. Fila caiu de 2 para 1.

## Estado da fila

| Incidente | Antes | Agora | Movimento |
|---|---|---|---|
| `d3d8d1b2` Geração de áudio: tempo estourado | investigating (13x) | investigating (13x) | 3h15 limpas, nota nova |
| `2663506d` Rajada Vídeo Clone (fcdnanda) | investigating (2x) | **ignored** | causa provada e fechada |

`varredura_travados`: **0 itens presos**. Contadores relidos no fim da rodada
(a rodada das 22:20 errou por ler antes de uma ocorrência entrar no ingest).

## O achado: 44 segundos de silêncio digital

Os 3 jobs falhados (20:16, 20:17, 20:19) usaram o **mesmo** arquivo
`45641b83-…-44410c2bf6b2.mp3`. Baixei do R2 e medi:

```
Peak level dB: -inf
silencedetect: silence_start 0 | silence_end 43.92 | duration 43.92
2.105.761 das 2.108.160 amostras no noise floor
```

MP3 **válido** (128 kbps, mono, 48 kHz), decodifica limpo — não é corrupção.
É um arquivo de 44 segundos sem som. O worker InfiniteTalk morre sem erro
estruturado nesse caso e devolve o genérico `Job processing failed`.

### As quatro hipóteses que morreram no teste

1. **Não era a imagem.** O job que **deu certo** às 20:36 usou exatamente a
   **mesma** imagem (`images/6e0db1c2-…/result.png`) dos três que falharam.
   Mesma imagem + áudio diferente = sucesso. Experimento natural, feito por
   ela mesma.
2. **Não era capacidade/GPU.** No minuto exato das falhas o endpoint entregava
   normal: `diretoria@grupoperes.com.br` ficou `ready` às **20:17:29**, um
   segundo depois da falha das 20:17:26; `alcinalivre` às 20:19:31.
3. **Não era `num_frames`/duração.** A faixa 1050–1075 frames parecia culpada
   (36,8% de falha) mas é **100% contaminada** por leilapatricia em 06/08
   (`db17c668`, 11 falhas de uma pessoa só). Na base inteira, >1000 frames
   falha 4,2% contra base de 3,8%, e o maior sucesso registrado tem **2.275
   frames**. Derrubada com a distribuição completa, não com amostra.
4. **Não era MP3 corrompido** — a causa fechada do `db17c668`, que eu havia
   **herdado como hipótese**. O arquivo dela passa por `-err_detect explode`
   sem um único erro. A hipótese mais atraente era a errada.

### O escopo real, medido antes de exagerar

Baixei e medi o pico de áudio das **54 falhas** de `video_clone` dos últimos
45 dias. **Só estas 3 estão mudas.** As outras 51 têm áudio de verdade (a mais
baixa em −17,2 dB). Isso explica **este** incidente e mais nada: não é
epidemia e não reabre o `db17c668`.

⚠️ **Meu primeiro script de perícia mentiu.** Ele imprimiu `ERRO_DECODE` nas 54
falhas — inclusive no arquivo que eu **sabia** que decodificava. Era bug meu
(`execFileSync` lendo stderr só no catch), não dado. Consertei e remedi. Se eu
tivesse acreditado na primeira saída, teria concluído "todos os áudios estão
quebrados" e ido consertar o worker errado.

## A aluna está inteira

Conferido no banco, não deduzido: os 3 débitos de 4.620 cr foram **estornados
integralmente** (20:17, 20:18, 20:19); ela refez com outro áudio e entregou
**2 vídeos** (20:36 e 20:49) mais uma imagem. Nunca escreveu para o suporte —
o incidente foi aberto pela burst-rule, não por reclamação dela.

**Não mandei e-mail**, de propósito: para ela o problema acabou 3h antes,
sozinha. Escrever agora seria avisar de um problema que ela já resolveu.

## A lacuna de produto (card `4c82f566`, com o `coder`)

O Vídeo Clone **aceita áudio mudo**, cobra 4.620 cr, manda pra GPU e devolve
erro genérico — ela tentou 3× às cegas. O treino de voz já barra essa classe
desde `f9f882a`/`ingest.ts`; o Vídeo Clone não.

**Limiar validado antes de propor:** barrar com pico < **−60 dBFS**. Em 60
sucessos medidos, o pico mais baixo foi **−19,09 dB** e nenhum ficou abaixo de
−60 dB. São 40 dB de folga. E a instrução no card é explícita: **falso
positivo é pior que o bug** — na dúvida ou se a medição falhar, deixa passar.

## `d3d8d1b2` — sem novidade, e continua não provado

- 3h15 limpas, contador ainda em 13.
- dralizbeth inteira: falha 20:46 (−456), estorno +456 às 21:17, refez 21:24
  `ready` em 27,04s, emendou 2 vídeos (21:29, 21:40).
- O fix `1c09508` está no ar mas **`failed` com `elapsed_seconds` = 0 em toda a
  base**. Nenhuma falha ocorreu após o deploy (22:12 UTC), então a
  instrumentação nunca escreveu. **Armada ≠ provada.** Só a próxima prova.

## ⚠️ Achado lateral que precisa do Johnny: `ja_pagou` está `false` para todos

A migration 79 criou a coluna, mas o **backfill (passo 2) nunca rodou**:

```
perfis: 1.242 · ja_pagou=true: 0 · null: 0 · false: 1.242
com acesso ativo agora: 546   →  todos os 546 marcados como "nunca pagou"
```

Hoje é **inofensivo**: nenhum código do app lê `ja_pagou` (grep só acha meus
scripts de investigação e os da análise de churn). A trava ainda não subiu.

**O risco é o dia em que subir.** Uma trava que leia esse campo hoje trataria
**100% dos pagantes** como quem nunca pagou — a repetição exata do 18/08 (14
clientes zerados, 1.356.554 cr, inclusive o Lucas), só que maior.

Agrava: o default é `false`, não `null`. `false` afirma "não pagou";
`null` diria "não conferido". A regra 9-A manda **nunca debitar o
desconhecido** — com default `false` o desconhecido se disfarça de negativo.

Nada executado sobre isso. Backfill mexe em determinação de dinheiro e precisa
do aval — está como binária no relatório.

## Nada gasto, nada irreversível

Nenhum crédito mexido, nenhuma GPU disparada, nenhuma migration aplicada,
nenhum e-mail em massa. As únicas escritas foram as duas notas de incidente.
Perícia toda em `_Bugs/` (`pericia_audios.cjs`, `pericia_sucessos.cjs`,
`rodada_00h*.cjs`).
