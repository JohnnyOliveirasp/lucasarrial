-- ============================================================================
-- Adiciona runpod_job_id em generations (Slice 5).
-- Permite o webhook do RunPod casar a row certa quando inferência termina.
-- ============================================================================

alter table public.generations
  add column if not exists runpod_job_id text;

create index if not exists generations_runpod_job_idx
  on public.generations(runpod_job_id);
