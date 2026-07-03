-- ============================================================================
-- 20_video_scene_videos.sql
-- Fase 4 do wizard de vídeo: geração do CLIPE de vídeo por cena (image-to-video
-- via Kie). O usuário escolhe 1 dos 3 tiers (Bronze/Grok, Prata/Kling,
-- Gold/Seedance); o tier fica no projeto (video_projects.video_tier, já existe).
-- Cada cena ganha seu clipe de 5s a partir da imagem já gerada (first frame).
-- O prompt de MOVIMENTO é gerado por Claude Sonnet (visão) olhando a imagem.
-- Aplicar via Transaction Pooler (porta 6543). Idempotente.
-- ============================================================================

alter table public.video_scenes
  add column if not exists video_path         text,
  add column if not exists video_status       text,   -- null=não gerado; pending|generating|ready|failed
  add column if not exists video_kie_task_id  text,
  add column if not exists video_prompt_pt    text,    -- prompt de movimento (pt-BR, mostrado/editável)
  add column if not exists video_prompt_en    text,    -- versão enviada ao modelo
  add column if not exists video_tier         text,    -- bronze|prata|gold (tier que gerou o clipe)
  add column if not exists video_credits_cost integer not null default 0,
  add column if not exists video_error        text;

create index if not exists idx_video_scenes_video_task
  on public.video_scenes (video_kie_task_id);
