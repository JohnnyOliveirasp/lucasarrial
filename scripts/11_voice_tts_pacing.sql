-- ============================================================================
-- 11 — pacing de TTS por voz (pausa entre frases)
-- Permite ajustar a pausa entre frases por voz, sem afetar as demais.
-- NULL = usa o default global do worker (env TTS_CHUNK_*). Idempotente.
--   tts_silence_ms   : ms de silêncio inserido entre frases (ex: 220)
--   tts_crossfade_ms : ms de crossfade entre frases (0 = desliga a fusão)
-- ============================================================================

alter table public.voices
  add column if not exists tts_silence_ms   int,
  add column if not exists tts_crossfade_ms int;

comment on column public.voices.tts_silence_ms is
  'Pausa (ms) entre frases na geração. NULL = default do worker.';
comment on column public.voices.tts_crossfade_ms is
  'Crossfade (ms) entre frases. 0 desliga a fusão. NULL = default do worker.';
