-- ============================================================================
-- 17_video_scenes.sql
-- Cenas de um projeto de vídeo (Fase 2 do wizard). A LLM divide o roteiro em N
-- cenas (N = duração ÷ 5s), em ordem. Cada cena é um prompt visual em pt-BR
-- (editável pelo usuário); o prompt_en é preenchido na Fase 3 (tradução na hora
-- de gerar a imagem). Imagem/vídeo de cada cena entram em migrations das fases
-- seguintes (add column).
-- RLS por user_id (denormalizado p/ política simples; backend escreve via
-- service_role). Aplicar via Transaction Pooler (porta 6543). Idempotente.
-- ============================================================================
create table if not exists public.video_scenes (
    id                  uuid primary key default gen_random_uuid(),
    video_project_id    uuid not null references public.video_projects(id) on delete cascade,
    user_id             uuid not null references auth.users(id) on delete cascade,
    idx                 integer not null,          -- ordem (1..N), casa com o áudio
    prompt_pt           text not null,             -- prompt visual em pt-BR (editável)
    prompt_en           text,                      -- tradução p/ o modelo (Fase 3)
    script_excerpt      text,                      -- trecho do roteiro que a cena cobre
    created_at          timestamptz not null default now()
);

create index if not exists idx_video_scenes_project
    on public.video_scenes (video_project_id, idx);

-- RLS: usuário só vê/cria/deleta as próprias; update via backend (service_role).
alter table public.video_scenes enable row level security;

drop policy if exists video_scenes_self_select on public.video_scenes;
create policy video_scenes_self_select on public.video_scenes
  for select using (auth.uid() = user_id);

drop policy if exists video_scenes_self_insert on public.video_scenes;
create policy video_scenes_self_insert on public.video_scenes
  for insert with check (auth.uid() = user_id);

drop policy if exists video_scenes_self_delete on public.video_scenes;
create policy video_scenes_self_delete on public.video_scenes
  for delete using (auth.uid() = user_id);
