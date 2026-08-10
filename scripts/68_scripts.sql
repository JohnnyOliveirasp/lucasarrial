-- 68: histórico do Gerador de Roteiro.
-- Sem isso o aluno fecha a aba e perde o roteiro que acabou de pagar, e a gente
-- não tem como auditar o que a LLM escreveu pra quem. Guarda a IDEIA e o TEXTO.
create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  idea text not null,
  seconds int not null,
  script text not null,
  model text,                       -- qual modelo escreveu (ROTEIRO_MODEL do dia)
  credits_charged int not null default 0,
  created_at timestamptz not null default now()
);
create index scripts_user_idx on public.scripts (user_id, created_at desc);
alter table public.scripts enable row level security;
-- Sem policies: acesso só via service role (rotas autenticadas).
