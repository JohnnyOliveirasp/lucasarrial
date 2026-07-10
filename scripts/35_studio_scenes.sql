-- 35: Vídeo Estúdio F3 — banco PESSOAL de cenas (b-roll gerado do roteiro).
-- Cada cena gerada fica na biblioteca do aluno (paga 1x, reusa grátis).
-- Fluxo: LLM planeja (frase→conceito/prompt/dialeto, reusando o banco) →
-- still (gpt-image-2 t2i) → anima (grok 5s) → MP4 permanente no R2
-- {user}/studio-bank/{scene_id}.mp4. studio_projects.scene_plan guarda o
-- mapa frase→cena do projeto.
-- APLICADA via MCP Supabase em 2026-07-10 (migration studio_scenes).
create table if not exists public.studio_scenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept text not null,
  prompt_en text not null,
  dialect text not null default 'realista' check (dialect in ('realista','craft')),
  status text not null default 'planning'
    check (status in ('planning','generating_still','animating','ready','failed')),
  kie_task_id text,
  image_path text,
  video_path text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_studio_scenes_user on public.studio_scenes (user_id, created_at desc);
create index if not exists idx_studio_scenes_kie on public.studio_scenes (kie_task_id) where kie_task_id is not null;

alter table public.studio_scenes enable row level security;
create policy "studio_scenes_select_own" on public.studio_scenes
  for select using (auth.uid() = user_id);
-- insert/update só via service_role (planejador/sync do servidor)

alter table public.studio_projects
  add column if not exists scenes_status text not null default 'idle'
    check (scenes_status in ('idle','generating','ready','failed')),
  add column if not exists scene_plan jsonb;
