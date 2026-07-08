-- 28: animar imagem do Gerador de Imagem (image-to-video via Kie)
-- Espelha as colunas video_* de video_scenes (migration 20).
-- APLICADA via MCP Supabase em 2026-07-08 (migration image_generations_video).
alter table public.image_generations
  add column if not exists video_status text
    check (video_status in ('pending','generating','ready','failed')),
  add column if not exists video_path text,
  add column if not exists video_kie_task_id text,
  add column if not exists video_prompt_pt text,
  add column if not exists video_prompt_en text,
  add column if not exists video_tier text,
  add column if not exists video_credits_cost integer,
  add column if not exists video_error text;

-- Webhook do Kie casa pelo task id do vídeo.
create index if not exists idx_image_generations_video_kie_task
  on public.image_generations (video_kie_task_id)
  where video_kie_task_id is not null;
