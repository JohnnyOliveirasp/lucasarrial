-- ============================================================================
-- 16_video_projects.sql
-- Wizard de geração de vídeo (Menu Vídeos → "Video History Board").
-- Um projeto de vídeo é o "guarda-chuva" do pipeline de 5 estágios:
--   Áudio (TTS existente) -> Cenas -> Imagens -> Vídeos -> Vídeo final.
-- Esta migration cria SÓ a tabela-pai `video_projects` (Fase 1). As tabelas
-- filhas `video_scenes` (Fase 2) e `render_jobs` (Fase 5) entram nas próprias
-- fases — migrations incrementais, igual o resto do projeto.
-- Mesma filosofia das `generations`/`image_generations`: status assíncrono,
-- arquivos no R2, RLS por user_id (backend escreve via service_role).
-- Aplicar via Transaction Pooler (porta 6543). Idempotente.
-- ============================================================================
create table if not exists public.video_projects (
    id                       uuid primary key default gen_random_uuid(),
    user_id                  uuid not null references auth.users(id) on delete cascade,
    name                     text,            -- renomeável; null = fallback (data) na UI
    status                   text not null default 'draft',  -- draft|scenes|images|videos|rendering|done|failed
    source_generation_id     uuid references public.generations(id) on delete set null,  -- áudio escolhido
    audio_path               text,            -- snapshot do R2 key do áudio (bucket generations)
    audio_duration_seconds   numeric,         -- duração do áudio escolhido (<= 90s)
    script_text              text,            -- snapshot do roteiro (text_raw da geração)
    aspect_ratio             text not null default '9:16',
    scene_count              integer,         -- nº de cenas (preenchido na Fase 2)
    video_tier               text,            -- bronze|prata|gold (preenchido na Fase 4)
    final_video_path         text,            -- vídeo final no R2 (preenchido na Fase 5)
    error_message            text,
    created_at               timestamptz not null default now()
);

create index if not exists idx_video_projects_user
    on public.video_projects (user_id, created_at desc);

-- RLS: usuário só vê/cria/deleta os próprios; update via backend (service_role).
alter table public.video_projects enable row level security;

drop policy if exists video_projects_self_select on public.video_projects;
create policy video_projects_self_select on public.video_projects
  for select using (auth.uid() = user_id);

drop policy if exists video_projects_self_insert on public.video_projects;
create policy video_projects_self_insert on public.video_projects
  for insert with check (auth.uid() = user_id);

drop policy if exists video_projects_self_delete on public.video_projects;
create policy video_projects_self_delete on public.video_projects
  for delete using (auth.uid() = user_id);
