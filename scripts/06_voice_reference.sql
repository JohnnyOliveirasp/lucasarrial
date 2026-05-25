-- ============================================================================
-- 06: áudio de referência PERSISTENTE por voz
-- A referência deixa de ser por-geração e passa a ser uma propriedade da voz:
-- o usuário sobe uma vez, fica salva e é reusada em toda geração até ele
-- trocar/apagar. A transcrição continua sendo feita pelo worker a cada
-- geração (Caminho A — sem mexer no Docker), por isso só guardamos o caminho.
-- Idempotente.
-- ============================================================================
alter table public.voices add column if not exists reference_audio_path text;
