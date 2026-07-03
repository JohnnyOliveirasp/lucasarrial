-- ============================================================================
-- 22_render_jobs.sql
-- Fase 5 do wizard de vídeo: fila de MONTAGEM do vídeo final. O Next.js só
-- ENFILEIRA (status pending); um WORKER separado (CPU, ffmpeg) consome a fila,
-- concatena os clipes na ordem das cenas + muxa o áudio + corta no tamanho do
-- áudio, sobe o mp4 pro R2 e marca o projeto como done. Roda local agora e no
-- Hetzner (pm2) depois — MESMO código. Aplicar via Pooler (6543). Idempotente.
-- ============================================================================

create table if not exists public.render_jobs (
  id               uuid primary key default gen_random_uuid(),
  video_project_id uuid not null references public.video_projects(id) on delete cascade,
  user_id          uuid not null,
  status           text not null default 'pending',  -- pending|processing|done|failed
  attempts         integer not null default 0,
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_render_jobs_status on public.render_jobs (status, created_at);
create index if not exists idx_render_jobs_project on public.render_jobs (video_project_id);

alter table public.render_jobs enable row level security;

-- Usuário enxerga os próprios jobs (o worker usa service_role e ignora RLS).
drop policy if exists render_jobs_select_own on public.render_jobs;
create policy render_jobs_select_own on public.render_jobs
  for select using (auth.uid() = user_id);

-- Claim atômico do próximo job pendente (evita 2 workers pegando o mesmo).
create or replace function public.claim_render_job()
returns public.render_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.render_jobs;
begin
  select * into v_job
  from public.render_jobs
  where status = 'pending'
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.render_jobs
    set status = 'processing', attempts = attempts + 1, updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;
