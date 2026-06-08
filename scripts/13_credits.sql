-- ============================================================================
-- 13 — sistema de créditos (assinatura recorrente + pacotes avulsos)
-- Dois baldes: credits_subscription (zera/recarrega no ciclo) e credits_extra
-- (comprado avulso, NÃO expira). Débito consome a assinatura PRIMEIRO.
-- Funções fazem débito/crédito de forma ATÔMICA (row lock) p/ evitar corrida.
-- Idempotente.
-- ============================================================================

-- saldo materializado no profile (cache rápido p/ gate e UI)
alter table public.profiles
  add column if not exists credits_subscription int not null default 0,
  add column if not exists credits_extra        int not null default 0;

comment on column public.profiles.credits_subscription is
  'Créditos do plano recorrente. Zera e recarrega a cada ciclo (não acumula).';
comment on column public.profiles.credits_extra is
  'Créditos comprados avulsos (pacotes). Não expiram. Gastos após os da assinatura.';

-- livro-razão: auditoria de cada movimento de crédito
create table if not exists public.credit_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null,    -- subscription_grant | extra_purchase | generation | training | adjustment
  amount        int  not null,    -- + crédito, - débito
  balance_after int  not null,    -- saldo TOTAL (sub+extra) após o movimento
  ref_type      text,             -- generation | voice | payment_event | ...
  ref_id        text,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists credit_tx_user_idx on public.credit_transactions (user_id, created_at desc);

comment on table public.credit_transactions is
  'Histórico de todo crédito/débito. amount + = crédito, - = débito. balance_after = saldo total após.';

-- feedback de cancelamento (regra: cancela sem travar, mas pergunta o motivo)
create table if not exists public.subscription_cancellations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  reason     text,
  detail     text,
  created_at timestamptz not null default now()
);

comment on table public.subscription_cancellations is
  'Motivo informado pelo usuário ao cancelar a assinatura (não bloqueia o cancelamento).';

-- ── função: DÉBITO atômico (assinatura primeiro, depois avulso) ──────────────
create or replace function public.debit_credits(
  p_user_id  uuid,
  p_amount   int,
  p_kind     text,
  p_ref_type text default null,
  p_ref_id   text default null,
  p_note     text default null
) returns jsonb
language plpgsql
as $$
declare
  v_sub int; v_extra int; v_total int;
  v_from_sub int; v_from_extra int; v_balance int;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive (got %)', p_amount;
  end if;

  select credits_subscription, credits_extra into v_sub, v_extra
    from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  v_total := coalesce(v_sub,0) + coalesce(v_extra,0);
  if v_total < p_amount then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', v_total);
  end if;

  v_from_sub   := least(coalesce(v_sub,0), p_amount);
  v_from_extra := p_amount - v_from_sub;
  v_balance    := v_total - p_amount;

  update public.profiles
     set credits_subscription = credits_subscription - v_from_sub,
         credits_extra        = credits_extra - v_from_extra,
         updated_at = now()
   where id = p_user_id;

  insert into public.credit_transactions(user_id, kind, amount, balance_after, ref_type, ref_id, note)
    values (p_user_id, p_kind, -p_amount, v_balance, p_ref_type, p_ref_id, p_note);

  return jsonb_build_object('ok', true, 'balance', v_balance,
    'from_subscription', v_from_sub, 'from_extra', v_from_extra);
end;
$$;

-- ── função: RECARGA da assinatura (reset, não acumula) ───────────────────────
create or replace function public.grant_subscription_credits(
  p_user_id uuid, p_amount int, p_ref_type text default null, p_ref_id text default null
) returns jsonb
language plpgsql
as $$
declare v_balance int;
begin
  update public.profiles
     set credits_subscription = p_amount, updated_at = now()
   where id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;

  select credits_subscription + credits_extra into v_balance from public.profiles where id = p_user_id;
  insert into public.credit_transactions(user_id, kind, amount, balance_after, ref_type, ref_id, note)
    values (p_user_id, 'subscription_grant', p_amount, v_balance, p_ref_type, p_ref_id, 'recarga do ciclo');
  return jsonb_build_object('ok', true, 'balance', v_balance);
end;
$$;

-- ── função: CRÉDITO avulso (pacote comprado, acumula) ────────────────────────
create or replace function public.add_extra_credits(
  p_user_id uuid, p_amount int, p_ref_type text default null, p_ref_id text default null
) returns jsonb
language plpgsql
as $$
declare v_balance int;
begin
  update public.profiles
     set credits_extra = credits_extra + p_amount, updated_at = now()
   where id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;

  select credits_subscription + credits_extra into v_balance from public.profiles where id = p_user_id;
  insert into public.credit_transactions(user_id, kind, amount, balance_after, ref_type, ref_id, note)
    values (p_user_id, 'extra_purchase', p_amount, v_balance, p_ref_type, p_ref_id, 'pacote avulso');
  return jsonb_build_object('ok', true, 'balance', v_balance);
end;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.credit_transactions        enable row level security;
alter table public.subscription_cancellations enable row level security;

drop policy if exists "credit_tx_select_own" on public.credit_transactions;
create policy "credit_tx_select_own" on public.credit_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "cancel_select_own" on public.subscription_cancellations;
create policy "cancel_select_own" on public.subscription_cancellations
  for select using (auth.uid() = user_id);

drop policy if exists "cancel_insert_own" on public.subscription_cancellations;
create policy "cancel_insert_own" on public.subscription_cancellations
  for insert with check (auth.uid() = user_id);
