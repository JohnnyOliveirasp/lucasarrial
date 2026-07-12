-- 38: Agente de suporte WhatsApp (F0) — conversas e mensagens espelhadas
-- do número do suporte (via Evolution API). Acesso só via service role
-- (RLS ligada sem policies — padrão das tabelas de admin).
-- Aplicada via MCP em 2026-07-12 (projeto yizerthyrgrajivlotcw).
create table public.agent_chats (
  id uuid primary key default gen_random_uuid(),
  wa_jid text not null unique,                -- 55...@s.whatsapp.net | ...@g.us
  kind text not null check (kind in ('private','group')),
  name text,                                  -- pushName do contato / assunto do grupo
  mode text not null default 'auto' check (mode in ('auto','human')),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.agent_chats(id) on delete cascade,
  wa_message_id text,
  sender_jid text,                            -- autor (no grupo = participante)
  sender_name text,
  from_me boolean not null default false,
  role text not null default 'user' check (role in ('user','agent','human')),
  kind text not null default 'text' check (kind in ('text','audio','image','video','document','sticker','other')),
  content text,
  created_at timestamptz not null default now()
);

create index agent_messages_chat_created_idx on public.agent_messages (chat_id, created_at desc);
-- Dedupe de retries do webhook: mesma mensagem não entra 2x.
create unique index agent_messages_chat_wamid_uq on public.agent_messages (chat_id, wa_message_id) where wa_message_id is not null;
create index agent_chats_last_message_idx on public.agent_chats (last_message_at desc);

alter table public.agent_chats enable row level security;
alter table public.agent_messages enable row level security;
