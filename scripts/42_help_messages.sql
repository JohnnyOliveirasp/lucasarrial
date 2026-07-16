-- 42: Mary no app — chat de ajuda dentro da plataforma (balão de suporte).
-- Uma linha por mensagem (aluno ou Mary), por usuário logado. Canal WhatsApp
-- continua nas tabelas agent_* — aqui é o canal WEB (identidade = login,
-- sem malabarismo de telefone). RLS ligada SEM policy: só service_role
-- (a API /api/v1/help usa getAdmin e valida o dono).

create table if not exists help_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  from_me boolean not null default false, -- true = Mary
  content text not null,
  pathname text,                          -- página do app onde o aluno estava
  has_image boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists help_messages_user_created
  on help_messages (user_id, created_at desc);

alter table help_messages enable row level security;
