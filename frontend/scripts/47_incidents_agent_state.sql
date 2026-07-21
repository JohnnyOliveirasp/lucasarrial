-- 47: aba Falhas (incidentes agrupados) + memória do agente de monitoramento.
-- Ocorrências cruas (admin_failures) viram INCIDENTES dedupados por assinatura,
-- com status de correção. agent_state = memória persistente da rotina (Fable).
-- Aplicada via MCP em 2026-07-21 (espelho).

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  kind text not null,                      -- training | generation | voice | reported | ...
  cause text not null default 'unknown',   -- user_dataset | infra_gpu | infra_storage | capacity | bug | reported | unknown
  status text not null default 'open',     -- open | investigating | fixing | fixed | ignored
  signature text not null,
  title text not null,
  occurrences integer not null default 1,
  affected_emails text[] not null default '{}',
  sample_error text,
  attachment_path text,                    -- R2 (reporte manual com anexo)
  reported_by text,                        -- e-mail do admin que reportou
  description text,
  resolution_note text,
  resolved_commit text,
  resolved_by text,                        -- 'agent' | e-mail
  resolved_at timestamptz,
  agent_notes jsonb not null default '[]'::jsonb
);
create index if not exists incidents_signature_idx on public.incidents (signature);
create index if not exists incidents_status_idx on public.incidents (status, last_seen_at desc);

-- Liga cada falha crua (kind + id da linha original) ao incidente — idempotência
-- do sync (uma falha nunca conta duas vezes).
create table if not exists public.incident_occurrences (
  kind text not null,
  ref_id uuid not null,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  at timestamptz not null,
  email text,
  error text,
  primary key (kind, ref_id)
);

-- Memória chave-valor do agente de monitoramento (última execução, contexto,
-- aprendizados). Lida/escrita via /api/v1/agent/* com token dedicado.
create table if not exists public.agent_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Service-role only (sem policies, RLS ligado) — padrão das tabelas de admin.
alter table public.incidents enable row level security;
alter table public.incident_occurrences enable row level security;
alter table public.agent_state enable row level security;
