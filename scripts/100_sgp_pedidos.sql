-- 100 — SGP (Sistema de Geração Pronto) dentro do FastCloner.
--
-- 29/08 (Johnny): o aluno do SGP deixa de preencher o formulário externo +
-- planilha e passa a se cadastrar em /sgp, seguir o wizard (dados → foto →
-- áudio → revisão) e acompanhar o "pedido" estilo iFood. Plano completo em
-- _Bugs/SGP/PLANO_SGP.md.
--
-- Uma linha por aluno: é o estado do pedido (o que o tracker lê e o /admin usa
-- como fila). `onboarding_runs` continua sendo o log de tentativas do robô.

alter table public.profiles
  add column if not exists whatsapp text;

comment on column public.profiles.whatsapp is
  'Telefone informado no SGP (dígitos com DDI, ex. 5511999998888). Antes só ia pro user_metadata.';

create table if not exists public.sgp_pedidos (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references public.profiles(id) on delete cascade,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),

  -- onde ele está no wizard / no processamento
  -- dados | foto | audio | revisao | enviado | processando | pronto | falhou
  status           text not null default 'dados',

  -- ciência do aluno (checkboxes marcados, com hora) — decisão 29/08
  ciencia_foto     jsonb,                 -- ["luz","fundo","enquadramento","nitida","sem_acessorios"]
  ciencia_foto_at  timestamptz,
  ciencia_audio    jsonb,                 -- ["30min","silencio","mesmo_ambiente","fala_natural"]
  ciencia_audio_at timestamptz,
  aceite_lgpd_at   timestamptz,

  -- material entregue (o que aparece no review)
  fotos            jsonb not null default '[]'::jsonb,  -- [{slot,key,status:'processando'|'aprovada'|'reprovada',tipo,motivos[]}]
  audios           jsonb not null default '[]'::jsonb,  -- [{key,nome,segundos,status,motivos[]}]

  -- processamento
  enviado_em       timestamptz,
  foto_pronta_em   timestamptz,
  voz_pronta_em    timestamptz,
  voice_id         uuid,
  erro             text
);

create index if not exists sgp_pedidos_status_idx on public.sgp_pedidos (status, criado_em);

alter table public.sgp_pedidos enable row level security;

-- O aluno lê o próprio pedido (tracker). Escrita só pelo servidor (service_role).
drop policy if exists "sgp_pedidos_select_own" on public.sgp_pedidos;
create policy "sgp_pedidos_select_own" on public.sgp_pedidos
  for select using (auth.uid() = user_id);

create or replace function public.sgp_pedidos_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists sgp_pedidos_touch on public.sgp_pedidos;
create trigger sgp_pedidos_touch before update on public.sgp_pedidos
  for each row execute function public.sgp_pedidos_touch();
