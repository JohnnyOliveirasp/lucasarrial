-- 60: vídeos Avatar IV gerados via conta HeyGen do aluno (BYOK).
-- Custo cai na conta HeyGen DELE; aqui só orquestramos e guardamos o resultado.
create table public.heygen_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  heygen_video_id text,
  image_source text not null, -- platform_image | upload | heygen_look
  audio_generation_id uuid,
  title text,
  status text not null default 'processing', -- processing | ready | failed
  video_path text,
  duration_seconds numeric,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index heygen_videos_user_idx on public.heygen_videos (user_id, created_at desc);
alter table public.heygen_videos enable row level security;
-- Sem policies: acesso só via service role (rotas autenticadas).
