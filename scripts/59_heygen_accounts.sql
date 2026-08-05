-- 59: contas HeyGen conectadas por aluno (BYOK — "HeyGen dentro do FastCloner").
-- A key fica CRIPTOGRAFADA (AES-256-GCM no app; nunca em texto puro).
create table public.heygen_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  api_key_encrypted text not null,
  label text,
  status text not null default 'active', -- active | invalid | revoked
  remaining_credits numeric,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);
alter table public.heygen_accounts enable row level security;
-- Sem policies: acesso SÓ via service role (a key nunca chega ao client).
