-- 61: publicador social próprio ("nosso Blotato") — Instagram primeiro,
-- desenhado multi-plataforma. Tokens ficam CRIPTOGRAFADOS (AES-256-GCM no app).

-- Contas sociais conectadas pelo aluno (1 linha por conta/plataforma).
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'instagram',   -- instagram | tiktok | youtube...
  account_ref text not null,                    -- id do usuário NA plataforma
  username text,
  auth_kind text not null default 'instagram_login',
  access_token_encrypted text not null,
  token_expires_at timestamptz,                 -- long-lived IG ~60d; cron renova
  status text not null default 'active',        -- active | expired | revoked
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, account_ref)
);
alter table public.social_accounts enable row level security;
-- Sem policies: acesso SÓ via service role (token nunca chega ao client).

-- Fila/histórico de publicações (imediatas e agendadas; sweeper avança).
create table public.publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform text not null default 'instagram',
  media_type text not null default 'reel',      -- reel | image | story
  media_url text not null,
  caption text,
  scheduled_at timestamptz,                     -- null = publicar já
  status text not null default 'ready',         -- ready | processing | published | failed
  container_id text,                            -- id do container Meta em voo
  platform_post_id text,
  attempts int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index publications_sweep_idx on public.publications (status, scheduled_at);
create index publications_user_idx on public.publications (user_id, created_at desc);
alter table public.publications enable row level security;
