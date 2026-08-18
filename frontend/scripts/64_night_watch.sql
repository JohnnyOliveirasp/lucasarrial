-- 64: vigia noturno — espinha (ordem de 18/08, Onda 1).
-- ⚠️ REGRA 21: NÃO aplicar sem aval do Johnny. Este arquivo é a proposta.
--
-- Duas tabelas:
--  * night_watch_runs — histórico de cada rodada. Existe porque "rodada muda"
--    foi o bug: 43 vozes ficaram paradas semanas sem ninguém saber. Registro
--    de rodada + relatório obrigatório = silêncio nunca mais vira "saúde".
--    Também é o mutex persistente (status 'running' barra rodada dupla).
--  * night_watch_seen — memória de "já olhei". Item que a varredura não
--    resolve NÃO pode voltar em toda rodada comendo o teto (armadilha de
--    18/08: o insolúvel escondia o resolvível). Contador + última vez.

create table public.night_watch_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',  -- running | done | failed
  dry_run boolean not null default true,
  -- por detector: { name, table, checked, found, truncated, alreadySeen, fixed, error, anomaly }
  -- "checked" existe pra distinguir "0 presos" de "0 olhados" (anti-cegueira).
  detectors jsonb not null default '[]'::jsonb,
  found_total int not null default 0,
  fixed_total int not null default 0,
  errors_total int not null default 0,
  report text,                             -- o relatório humano que saiu
  error text
);
create index night_watch_runs_started_idx on public.night_watch_runs (started_at desc);
create index night_watch_runs_status_idx on public.night_watch_runs (status);

create table public.night_watch_seen (
  item_key text primary key,               -- "<tabela>:<id>"
  detector text not null,                  -- quem achou
  kind text not null,                      -- classe do problema (ex.: fila_parada)
  user_id uuid,                            -- aluno afetado, quando houver
  summary text,                            -- último resumo humano
  times_seen int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index night_watch_seen_last_idx on public.night_watch_seen (last_seen_at);

-- Sem policies de propósito: acesso SÓ via service role (mesmo padrão do
-- social_accounts da mig 61) — nada disso chega ao client.
alter table public.night_watch_runs enable row level security;
alter table public.night_watch_seen enable row level security;
