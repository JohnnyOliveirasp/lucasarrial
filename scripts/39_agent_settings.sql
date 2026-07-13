-- 39: Agente Mary F2 — interruptor GERAL (admins podem desligar a IA por
-- completo e atender na mão). Linha única; service role only.
-- Aplicada via MCP em 2026-07-13 (projeto yizerthyrgrajivlotcw).
create table public.agent_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.agent_settings (id, enabled) values (1, true);
alter table public.agent_settings enable row level security;
