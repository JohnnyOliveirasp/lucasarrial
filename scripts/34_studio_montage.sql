-- 34: Vídeo Estúdio F1 (motor de montagem) — projeto ganha o estágio de vídeo.
-- audio_ready → montage_status processing → ready (video_path) | failed.
-- Cenas da F1 = banco de TESTE fixo (R2 voices/studio-test-scenes/scene1..6).
-- APLICADA via MCP Supabase em 2026-07-10 (migration studio_montage).
alter table public.studio_projects
  add column if not exists montage_status text not null default 'idle'
    check (montage_status in ('idle','processing','ready','failed')),
  add column if not exists montage_job_id text,
  add column if not exists video_path text,
  add column if not exists montage_error text,
  add column if not exists montage_report text;

create index if not exists idx_studio_projects_montage_job
  on public.studio_projects (montage_job_id) where montage_job_id is not null;
