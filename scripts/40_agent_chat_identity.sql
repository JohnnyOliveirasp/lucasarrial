-- 40: F4 do agente — identidade do contato: telefone real (LID→PN via WAHA)
-- e vínculo com o perfil do aluno (match por checkout_phone da Hotmart).
-- Aplicada via MCP em 2026-07-12 (projeto yizerthyrgrajivlotcw).
alter table public.agent_chats
  add column if not exists wa_phone text,
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;
create index if not exists agent_chats_profile_id_idx on public.agent_chats (profile_id);
