-- ============================================================================
-- 10 — user_consents (aceite de Termos / Privacidade / Politica de Uso)
-- Audit trail versionado: quando o texto legal mudar, sobe CONSENT_VERSION no
-- codigo e o popup reaparece (a query nao acha aceite na versao nova).
-- Guarda IP + user-agent p/ prova de consentimento. Idempotente.
-- ============================================================================

create table if not exists public.user_consents (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    consent_type    text not null,        -- 'all' (aceite unico cobrindo os 3 docs)
    consent_version text not null,        -- ex '2026-06-rascunho'
    accepted_at     timestamptz not null default now(),
    ip_address      text,
    user_agent      text,
    revoked_at      timestamptz,
    unique (user_id, consent_type, consent_version)
);

create index if not exists user_consents_user_idx on public.user_consents(user_id);

-- RLS: usuario so ve/insere o proprio aceite. Backend usa service_role (bypass).
alter table public.user_consents enable row level security;

drop policy if exists user_consents_self_select on public.user_consents;
create policy user_consents_self_select on public.user_consents
  for select using (auth.uid() = user_id);

drop policy if exists user_consents_self_insert on public.user_consents;
create policy user_consents_self_insert on public.user_consents
  for insert with check (auth.uid() = user_id);
