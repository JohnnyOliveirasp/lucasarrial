-- ============================================================================
-- 19_video_images.sql
-- Fase 3 do wizard de vídeo: geração de imagem por cena (image-to-image via Kie).
-- A referência (1 a 6 fotos DA PESSOA) fica no projeto e é usada em TODAS as
-- cenas; cada cena ganha a sua imagem gerada. Espelha image_generations.
-- Aplicar via Transaction Pooler (porta 6543). Idempotente.
-- ============================================================================

-- Referência padrão do projeto + aceite de ciência (foto será usada em tudo).
alter table public.video_projects
  add column if not exists reference_image_paths text[],
  add column if not exists image_consent_at timestamptz;

-- Campos da imagem gerada de cada cena.
alter table public.video_scenes
  add column if not exists image_path         text,
  add column if not exists image_status       text,   -- null=não gerada; pending|generating|ready|failed
  add column if not exists image_kie_task_id  text,
  add column if not exists resolution         text not null default '1K',  -- 1K|2K|4K
  add column if not exists image_credits_cost integer not null default 0,
  add column if not exists image_error        text;

create index if not exists idx_video_scenes_image_task
  on public.video_scenes (image_kie_task_id);
