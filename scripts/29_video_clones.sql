-- 29: Vídeo Clone (lip-sync InfiniteTalk no RunPod serverless)
-- imagem + áudio → MP4 falando. 1 linha por geração.
-- APLICADA via MCP Supabase em 2026-07-08 (migration video_clones).
create table if not exists public.video_clones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  image_path text not null,
  audio_path text not null,
  duration_seconds numeric not null,
  num_frames integer not null,
  tier text not null check (tier in ('480p','720p')),
  credits_cost integer not null default 0,
  status text not null default 'pending' check (status in ('pending','generating','ready','failed')),
  runpod_job_id text,
  video_path text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_video_clones_user on public.video_clones (user_id, created_at desc);
create index if not exists idx_video_clones_job on public.video_clones (runpod_job_id) where runpod_job_id is not null;

alter table public.video_clones enable row level security;

create policy "video_clones_select_own" on public.video_clones
  for select using (auth.uid() = user_id);
create policy "video_clones_insert_own" on public.video_clones
  for insert with check (auth.uid() = user_id);
create policy "video_clones_delete_own" on public.video_clones
  for delete using (auth.uid() = user_id);
-- update só via service_role (worker/poll marca ready/failed)
