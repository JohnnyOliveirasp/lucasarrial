-- 69: chat de ajuste do Gerador de Roteiro (Fase 5).
-- O histórico vive AQUI, não no navegador: o aluno paga por mensagem, então
-- perder a conversa num F5 seria perder crédito. É também o que o servidor lê
-- pra montar o contexto — o client nunca manda o histórico (não daria pra
-- confiar em quem paga por mensagem).
create table public.script_messages (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  /** Versão do roteiro que ESTA resposta produziu (null = não mexeu no texto). */
  script_after text,
  credits_charged int not null default 0,
  created_at timestamptz not null default now()
);
create index script_messages_script_idx on public.script_messages (script_id, created_at);
alter table public.script_messages enable row level security;
-- Sem policies: acesso só via service role (rotas autenticadas).
