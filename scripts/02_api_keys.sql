-- ============================================================================
-- Platform Lucas / AI Clone Verse — Tabela api_keys
-- Permite chamadas externas autenticadas via header X-API-Key.
-- ============================================================================

create table if not exists public.api_keys (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    name          text not null,
    key_prefix    text not null,            -- primeiros 8 chars (visível na UI)
    key_hash      text not null unique,     -- sha256 do key completo
    last_used_at  timestamptz,
    revoked_at    timestamptz,
    created_at    timestamptz not null default now()
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);
create index if not exists api_keys_hash_idx    on public.api_keys(key_hash);

alter table public.api_keys enable row level security;

drop policy if exists api_keys_self_select on public.api_keys;
create policy api_keys_self_select on public.api_keys
  for select using (auth.uid() = user_id);

drop policy if exists api_keys_self_insert on public.api_keys;
create policy api_keys_self_insert on public.api_keys
  for insert with check (auth.uid() = user_id);

drop policy if exists api_keys_self_update on public.api_keys;
create policy api_keys_self_update on public.api_keys
  for update using (auth.uid() = user_id);

drop policy if exists api_keys_self_delete on public.api_keys;
create policy api_keys_self_delete on public.api_keys
  for delete using (auth.uid() = user_id);
