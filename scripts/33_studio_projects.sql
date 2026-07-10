-- 33: Vídeo Estúdio F0 (áudio impecável) — 1 projeto por vídeo do Estúdio.
-- Fluxo F0: aluno grava/sobe áudio → worker (audio_edit no RunPod) remove
-- tentativas repetidas + encolhe pausas → áudio limpo + words + relatório.
-- Fases futuras (F1+) acrescentam colunas de cenas/render neste mesmo projeto.
-- APLICADA via MCP Supabase em 2026-07-09 (migration studio_projects).
create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  status text not null default 'processing'
    check (status in ('processing','audio_ready','failed')),
  raw_audio_path text not null,
  clean_audio_path text,
  duration_raw_seconds numeric,
  duration_clean_seconds numeric,
  kept_takes integer,
  removed_takes integer,
  transcript_words jsonb,
  edit_report text,
  runpod_job_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_studio_projects_user on public.studio_projects (user_id, created_at desc);
create index if not exists idx_studio_projects_job on public.studio_projects (runpod_job_id) where runpod_job_id is not null;

alter table public.studio_projects enable row level security;

create policy "studio_projects_select_own" on public.studio_projects
  for select using (auth.uid() = user_id);
create policy "studio_projects_insert_own" on public.studio_projects
  for insert with check (auth.uid() = user_id);
create policy "studio_projects_delete_own" on public.studio_projects
  for delete using (auth.uid() = user_id);
-- update só via service_role (poll/webhook marca audio_ready/failed)
