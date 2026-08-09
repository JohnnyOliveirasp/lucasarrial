-- 66_winback.sql — Resgate da Fast (win-back por WhatsApp, ordem Johnny 09/08)
--
-- A Carol (número +1 352 717-9543, persona da Fast no WhatsApp) ABRE conversa
-- com quem cancelou: escuta o motivo, mostra o que a plataforma já corrigiu e
-- pra onde ela vai, e pode devolver créditos até um teto pra trazer de volta.
--
-- Duas tabelas: a FILA (quem contatar, em que pé está, o que se descobriu) e
-- o PAINEL DE CONTROLE (interruptor + degrau do aquecimento + freio).

create table if not exists public.winback_targets (
  id uuid primary key default gen_random_uuid(),
  -- Identidade (o e-mail do cancelamento é a chave — 1 abordagem por pessoa)
  email text not null,
  phone_digits text,                 -- só dígitos com país (ex.: 5511997847719)
  profile_id uuid references public.profiles(id) on delete set null,
  canceled_at timestamptz,
  -- 'nunca_ativou' (assinou e não usou) · 'usou_e_saiu' · 'sem_conta'
  segment text not null default 'usou_e_saiu',
  -- O que a pesquisa de cancelamento do app capturou (quase sempre pobre:
  -- 50% marca "Outro motivo" e não escreve nada — daí a conversa existir)
  survey_reason text,
  survey_detail text,
  -- pending → sent → replied → (recovered | lost | optout) · blocked | skipped
  status text not null default 'pending',
  chat_id uuid references public.agent_chats(id) on delete set null,
  wa_jid text,
  sent_at timestamptz,
  delivered_at timestamptz,          -- ack do WhatsApp; nulo por muito tempo = bloqueio
  replied_at timestamptz,
  -- O motivo REAL, dito na conversa (é isto que o Johnny quer saber)
  outcome text,
  outcome_detail text,
  credits_granted integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists winback_targets_email_key on public.winback_targets (lower(email));
create index if not exists winback_targets_status_idx on public.winback_targets (status);
create index if not exists winback_targets_chat_idx on public.winback_targets (chat_id);

-- Painel de controle (linha única). enabled=false de propósito: NADA sai
-- enquanto o Johnny não ligar.
create table if not exists public.winback_settings (
  id smallint primary key default 1,
  enabled boolean not null default false,
  day_index smallint not null default 0,      -- degrau do aquecimento (0 = dia 1)
  last_send_date date,                        -- data BRT do último envio
  sent_today smallint not null default 0,
  next_send_at timestamptz,                   -- intervalo aleatório entre contatos
  paused_until timestamptz,                   -- freio automático
  credits_cap integer not null default 50000, -- teto que a Carol dá sozinha
  last_note text,
  updated_at timestamptz not null default now(),
  constraint winback_settings_single check (id = 1)
);

insert into public.winback_settings (id) values (1) on conflict (id) do nothing;

-- Só o service role toca nisso (o app acessa via getAdmin()).
alter table public.winback_targets enable row level security;
alter table public.winback_settings enable row level security;
