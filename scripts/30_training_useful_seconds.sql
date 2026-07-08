-- 30: telemetria anti-churn do treino de voz
-- Áudio ÚTIL (pós Demucs+VAD) medido pelo worker; NULL em treinos antigos.
-- APLICADA via MCP Supabase em 2026-07-09 (migration training_useful_seconds).
alter table public.training_jobs
  add column if not exists useful_seconds numeric;
