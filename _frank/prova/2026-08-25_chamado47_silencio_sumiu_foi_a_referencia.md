# Chamado 47 (Katia) — o silêncio que sumiu entre 21/08 e 25/08 foi a REFERÊNCIA trocada, não a montagem

Incidente 47 / ce6e157d · voz c127b74e · medido em 25/08 · script: `frontend/_Bugs/chamado_47_katia/medir_referencias.cjs`

## O fato a explicar

Mesmo texto (99 palavras), mesma voz, mesmo `tts_silence_ms=466`, articulação idêntica (3,20 pal/s):

| geração | quando | dur | pausas | silêncio total |
|---|---|---|---|---|
| 47dc0f6e | 21/08 20:27Z | 36,98s | 15 | 6,09s |
| 80856425 | 25/08 17:53Z (0 regen) | 34,32s | 9 | 3,43s |
| 1e19b952 | 25/08 18:55Z (1 regen) | 34,15s | 7 | 2,96s |

Tempo FALANDO idêntico → a queda de ~2,7s é silêncio que sumiu, não fala mais rápida.

## Causa medida: o ref/auto.wav foi TROCADO 71 segundos antes do primeiro áudio novo

R2 (bucket vozes, `.../c127b74e.../ref/`):

- `auto.bak-2026-08-25-pfk3.wav` — backup criado **25/08 17:52:01Z** (a referência que gerou o 47dc0f6e)
- `auto.wav` — substituído **25/08 17:52:01Z**, 71s antes do 80856425 (**17:53:12Z**)
- Quem trocou: `fabricar_referencia.cjs` (é ele que cria o `.bak-<data>-<rand>` e regrava `reference_transcript`), rodado dentro do próprio chamado 47 — o nome da geração 80856425 diz "referência corrigida (25/08)".
- Prova no banco: `reference_transcript` do 47dc0f6e ("e isso acontece com todas as pessoas…") ≠ dos dois de 25/08 ("me portar como alguém que cria conteúdos…"). Mesmo path, trecho DIFERENTE da gravação.

## A/B das duas referências (mesmo silencedetect -35dB/0,15s do medir.cjs + word timestamps whisper-1)

| referência | dur | pausas (silencedetect) | silêncio total | palavras | wps | pausas ≥300ms entre palavras |
|---|---|---|---|---|---|---|
| até 25/08 17:52 (gerou o 21/08) | 28,85s | 14 | 6,38s | 55 | 1,91 | 10 (6,50s) |
| desde 25/08 17:52 (gerou os de 25/08) | 27,40s | 11 | 4,94s | 69 | **2,74** | **5 (2,72s)** |

A referência nova fala **43% mais rápido** e tem **menos da metade da pausa** (2,72s vs 6,50s). O VoxCPM clona o pacing da referência: a saída espelhou (silêncio 6,09→3,43s, pausas 15→9). A "correção" da referência escolheu um trecho onde a Katia fala rápido e quase sem pausa — exatamente o contrário do que a queixa dela ("frases muito próximas, áudio corrido") precisava.

## Suspeitos exonerados (janela de código 080dd74..30e76c2, refator incluído)

- **trim de chunk**: `audio_ops.trim_silence` é byte a byte igual ao `_trim_silence` do handler antigo; mesmos defaults (`TTS_CHUNK_TRIM=1`, threshold 0.005, pad 20ms, pad maior só no 1º chunk).
- **silêncio entre chunks / crossfade**: mesma condição (`silence>0 e crossfade==0 e idx<último`), mesmas chaves de payload (`chunk_silence_ms`/`chunk_crossfade_ms`) antes e depois do refator.
- **ref_tail_silence_ms**: já existia no handler antigo com o mesmo default (600) — e ele ADICIONA silêncio, não tira.
- **laço de QA/regen**: o 80856425 teve **0 regens** e ainda assim perdeu o silêncio — o QA não explica.
- Não há geração da voz entre 22 e 24/08 (código novo + ref velha), então o isolamento perfeito código-vs-referência por dado de produção não existe; mas a troca da ref explica direção, magnitude e o timing de 71s.

## Achado colateral real (não disparou nestes áudios)

`jobs/inference.py:_resgatar_por_subdivisao` concatena os pedaços resgatados **sem** o silêncio de 466ms entre eles (`np.concatenate(pedacos)`) — cada resgate come as pausas de fronteira de frase daquele chunk. Não firou aqui (`coverage_rescue` ausente no qa_stats dos três), mas é progressivo: todo chunk resgatado sai mais "corrido" que o resto.

## Consequências

1. **NÃO reenviar os áudios de 25/08 pra Katia** — têm metade do silêncio do que ela já rejeitou por "corrido".
2. O caminho pro chamado 47 não é trocar referência de novo: a queixa é ONDE falta pausa (fronteira de frase DENTRO do chunk de 160 chars não recebe silêncio nenhum). O experimento certo é chunk menor POR JOB — destravado neste PR (`chunk_max_chars` no payload, default 160 intacto; mais chunks = mais GPU, decisão do Johnny).
3. Se a referência for refeita, o critério de escolha do trecho precisa considerar densidade de pausa — hoje o `fabricar_referencia.cjs` não olha isso.
