-- ============================================================================
-- 07: transcrição da referência automática
-- A referência passa a ser AUTO-extraída no treino (2 min de 1 dos áudios do
-- usuário). Como cortamos a ref no treino e o worker já roda Whisper ali,
-- transcrevemos a ref UMA vez e guardamos aqui — assim a geração não precisa
-- re-transcrever a referência a cada vez (mais rápido, menos um ponto de falha).
-- Idempotente.
-- ============================================================================
alter table public.voices add column if not exists reference_transcript text;
