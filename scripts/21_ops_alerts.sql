-- ============================================================================
-- 21_ops_alerts.sql
-- Throttle de alertas operacionais (ex.: "Kie sem créditos"). Evita floodar o
-- suporte com 1 e-mail por cena. `claim_alert(key, cooldown)` faz um
-- check-and-set ATÔMICO: devolve true só quando pode enviar (fora do cooldown).
-- Aplicar via Transaction Pooler (porta 6543). Idempotente.
-- ============================================================================

create table if not exists public.ops_alerts (
  key          text primary key,
  last_sent_at timestamptz not null default now()
);

-- Sem RLS: só o service_role (server) escreve/lê via RPC.
alter table public.ops_alerts enable row level security;

create or replace function public.claim_alert(p_key text, p_cooldown_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_ok  boolean;
begin
  insert into public.ops_alerts (key, last_sent_at)
  values (p_key, v_now)
  on conflict (key) do update
    set last_sent_at = v_now
    where public.ops_alerts.last_sent_at < v_now - make_interval(secs => p_cooldown_seconds)
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;
