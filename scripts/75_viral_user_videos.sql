-- 75: a curadoria vira PESSOAL (desenho fechado com o Johnny em 14/08).
--
-- Até aqui `selecionado` e `descartado` eram colunas da LINHA do vídeo, ou
-- seja: globais. Funcionava porque a tela é admin-only — mas no dia que
-- abrir pros 400, o descarte de um sumiria da tela de todos e a lista de
-- download de um apareceria pro outro.
--
-- Regra combinada:
--   • o CATÁLOGO (viral_videos) é comum — toda busca alimenta o acervo de todos
--   • a CURADORIA (esta tabela) é de cada um — descartar some só da MINHA tela
--   • o ARQUIVO só nasce quando a pessoa vai PRODUZIR (reservar ≠ baixar)
create table if not exists public.viral_user_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  viral_id uuid not null references public.viral_videos(id) on delete cascade,

  -- "vou usar este" → entra em Meus Virais. NÃO baixa nada: só metadado.
  reservado boolean not null default false,
  reservado_em timestamptz,

  -- Descarte pessoal: some da minha grade, continua na dos outros.
  descartado boolean not null default false,
  descartado_em timestamptz,

  -- Virou Video React de verdade. É o que alimenta o selo "N usando".
  usado boolean not null default false,
  usado_em timestamptz,

  -- O mp4 só desce quando a pessoa produz (a URL do TikTok expira em horas,
  -- então o worker resolve o link na hora — nunca o video_url da busca).
  download_status text not null default 'nao_baixado',
  r2_key text,
  download_erro text,
  -- Régua do TTL: arquivo sem uso há 60 dias sai do R2 (o metadado FICA).
  arquivo_tocado_em timestamptz,

  criado_em timestamptz not null default now(),

  -- Uma linha por pessoa por vídeo.
  unique (user_id, viral_id)
);

-- Grade de "Meus Virais" e peneira do descarte pessoal.
create index if not exists viral_user_videos_meus_idx
  on public.viral_user_videos (user_id, reservado, reservado_em desc)
  where reservado = true;
create index if not exists viral_user_videos_descarte_idx
  on public.viral_user_videos (user_id, viral_id)
  where descartado = true;
-- Faxina do R2 (arquivo velho sem uso).
create index if not exists viral_user_videos_arquivo_idx
  on public.viral_user_videos (download_status, arquivo_tocado_em)
  where r2_key is not null;

alter table public.viral_user_videos enable row level security;
-- Sem policies: acesso só via service role, igual ao resto do app.

-- Quem garimpou (pagou a busca) leva 7 dias de vantagem antes do vídeo cair
-- no acervo comum. Sem isso o aluno paga a busca e vê o vizinho usando de
-- graça no mesmo dia — "paguei, é meu" é reação legítima.
alter table public.viral_videos
  add column if not exists garimpado_por uuid references public.profiles(id) on delete set null,
  add column if not exists exclusivo_ate timestamptz;

create index if not exists viral_videos_exclusividade_idx
  on public.viral_videos (exclusivo_ate)
  where exclusivo_ate is not null;

-- Selo "N pessoas usando" sem varrer a tabela na tela.
create or replace function public.virais_uso(ids uuid[])
returns table (viral_id uuid, usando bigint)
language sql
stable
set search_path = public
as $$
  select viral_id, count(*)::bigint
  from public.viral_user_videos
  where viral_id = any(ids) and (reservado or usado)
  group by viral_id;
$$;

-- BACKFILL: o que o Johnny já marcou vira reserva dele. `selecionado_por` é
-- a única pista de dono que existe hoje; o descarte global (migração 73)
-- continua valendo pra todo mundo — não dá pra saber quem descartou, e
-- inventar dono seria pior do que manter o que está.
insert into public.viral_user_videos (user_id, viral_id, reservado, reservado_em)
select v.selecionado_por, v.id, true, coalesce(v.selecionado_em, now())
from public.viral_videos v
where v.selecionado = true and v.selecionado_por is not null
on conflict (user_id, viral_id) do nothing;
