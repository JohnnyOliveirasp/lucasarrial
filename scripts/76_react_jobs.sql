-- 76: fila do Video React.
--
-- A montagem não cabe numa requisição: o clone de vídeo roda no RunPod e leva
-- minutos. Igual ao resto do app, a rota cria o job e a tela pergunta o
-- estado — quando o clone fica pronto, a montagem (ffmpeg) acontece e o mp4
-- final vai pro R2.
create table if not exists public.react_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  viral_id uuid not null references public.viral_videos(id) on delete cascade,

  -- O que a pessoa montou no wizard.
  layout text not null,
  roteiro text not null,
  cta text,
  foto_url text,
  audio_url text,
  segundos numeric not null default 0,

  -- Peças do caminho: cada uma pode demorar e falhar sozinha.
  viral_r2_key text,
  clone_job_id text,
  clone_r2_key text,

  -- fila → baixando → clonando → montando → pronto | erro
  status text not null default 'fila',
  erro text,
  r2_key text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists react_jobs_meus_idx
  on public.react_jobs (user_id, criado_em desc);
-- O sweep procura o que está em voo.
create index if not exists react_jobs_abertos_idx
  on public.react_jobs (status)
  where status not in ('pronto', 'erro');

alter table public.react_jobs enable row level security;
-- Sem policies: acesso só via service role, igual ao resto do app.
