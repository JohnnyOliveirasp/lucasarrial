-- ============================================================================
-- Platform Lucas / AI Clone Verse — Schema inicial
-- 4 entidades de negocio + profiles. RLS por user_id.
-- Aplicar via Transaction Pooler (porta 6543). Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- profiles  (extende auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    email        text not null,
    display_name text,
    avatar_url   text,
    plan         text not null default 'free' check (plan in ('free','pro')),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles(email);

-- Trigger: cria row em profiles automaticamente quando usuario se cadastra
-- (funciona pra Google OAuth, email/senha, magic link — qualquer provider)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: mantem updated_at sincronizado
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- voices  (1 row por voz clonada)
-- ----------------------------------------------------------------------------
create table if not exists public.voices (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users(id) on delete cascade,
    name                text not null,
    status              text not null default 'uploading'
                        check (status in (
                          'uploading',          -- aguardando upload dos audios
                          'validating',         -- backend rodando VAD pra validar duracao
                          'rejected_too_short', -- < 20min de fala efetiva, bloqueado
                          'training',           -- RunPod treinando
                          'ready',              -- LoRA pronta no R2
                          'failed'              -- erro irrecuperavel
                        )),
    duration_seconds    int,                    -- duracao efetiva (apos VAD)
    raw_audio_paths     jsonb not null default '[]'::jsonb,  -- ["r2://voices-clone-ai-verse/<user>/<voice>/raw/audio_1.mp3", ...]
    lora_path           text,                   -- "r2://voices-clone-ai-verse/<user>/<voice>/lora.safetensors"
    runpod_job_id       text,                   -- ultimo job de treino
    error_message       text,
    trained_at          timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists voices_user_id_idx on public.voices(user_id);
create index if not exists voices_status_idx  on public.voices(status);

drop trigger if exists voices_updated_at on public.voices;
create trigger voices_updated_at
  before update on public.voices
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- training_jobs  (auditoria — mesma voice pode retreinar varias vezes)
-- ----------------------------------------------------------------------------
create table if not exists public.training_jobs (
    id              uuid primary key default gen_random_uuid(),
    voice_id        uuid not null references public.voices(id) on delete cascade,
    user_id         uuid not null references auth.users(id) on delete cascade,
    runpod_job_id   text not null,
    status          text not null default 'queued'
                    check (status in ('queued','running','completed','failed')),
    steps           int,
    final_loss      numeric,
    elapsed_seconds int,
    error_message   text,
    started_at      timestamptz,
    finished_at     timestamptz,
    created_at      timestamptz not null default now()
);

create index if not exists training_jobs_voice_id_idx on public.training_jobs(voice_id);
create index if not exists training_jobs_user_id_idx  on public.training_jobs(user_id);

-- ----------------------------------------------------------------------------
-- generations  (1 row por audio gerado)
-- ----------------------------------------------------------------------------
create table if not exists public.generations (
    id                       uuid primary key default gen_random_uuid(),
    user_id                  uuid not null references auth.users(id) on delete cascade,
    voice_id                 uuid not null references public.voices(id) on delete cascade,
    text_raw                 text not null,
    text_normalized          text,            -- saida da LLM, nullable ate normalizar
    reference_audio_path     text not null,
    reference_transcript     text not null,
    audio_path               text,            -- "r2://generations-ai-verse-clone/<user>/<gen>.wav"
    sample_rate              int,
    duration_seconds         numeric,
    elapsed_seconds          numeric,
    status                   text not null default 'pending'
                             check (status in ('pending','generating','ready','failed')),
    error_message            text,
    created_at               timestamptz not null default now()
);

create index if not exists generations_user_id_idx  on public.generations(user_id);
create index if not exists generations_voice_id_idx on public.generations(voice_id);
create index if not exists generations_created_idx  on public.generations(created_at desc);

-- ----------------------------------------------------------------------------
-- usage_monthly  (quota por usuario por mes)
-- ----------------------------------------------------------------------------
create table if not exists public.usage_monthly (
    user_id           uuid not null references auth.users(id) on delete cascade,
    period_month      date not null,           -- sempre dia 1 do mes (YYYY-MM-01)
    trainings_used    int  not null default 0,
    generations_used  int  not null default 0,
    primary key (user_id, period_month)
);

create index if not exists usage_monthly_period_idx on public.usage_monthly(period_month);

-- ============================================================================
-- Row Level Security (RLS)
-- Usuario so ve/edita as proprias rows. Backend usa service_role pra bypass.
-- ============================================================================
alter table public.profiles       enable row level security;
alter table public.voices         enable row level security;
alter table public.training_jobs  enable row level security;
alter table public.generations    enable row level security;
alter table public.usage_monthly  enable row level security;

-- profiles: usuario ve/edita o proprio
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id);

-- voices: usuario ve/cria/edita/deleta as proprias
drop policy if exists voices_self_all on public.voices;
create policy voices_self_all on public.voices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- training_jobs: read-only pro user (backend cria/atualiza via service_role)
drop policy if exists training_jobs_self_select on public.training_jobs;
create policy training_jobs_self_select on public.training_jobs
  for select using (auth.uid() = user_id);

-- generations: usuario ve/cria/deleta as proprias (update via backend)
drop policy if exists generations_self_select on public.generations;
create policy generations_self_select on public.generations
  for select using (auth.uid() = user_id);

drop policy if exists generations_self_insert on public.generations;
create policy generations_self_insert on public.generations
  for insert with check (auth.uid() = user_id);

drop policy if exists generations_self_delete on public.generations;
create policy generations_self_delete on public.generations
  for delete using (auth.uid() = user_id);

-- usage_monthly: usuario so le (backend incrementa via service_role)
drop policy if exists usage_self_select on public.usage_monthly;
create policy usage_self_select on public.usage_monthly
  for select using (auth.uid() = user_id);
