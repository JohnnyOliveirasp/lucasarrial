-- ============================================================================
-- 53 — Cortesias (mentoria sem Hotmart). Spec aprovada Johnny 25/07.
-- Campanha: nome + lista de e-mails + créditos POR PESSOA + janela início/fim.
-- Início: credita cada e-mail no saldo EXTRA via add_extra_credits
--   (ref_type 'courtesy_grant'); e-mail sem conta é resgatado no login.
-- Fim: sweeper expira o RESTANTE da concessão via expire_courtesy_credits —
--   debita SÓ credits_extra (nunca o saldo da assinatura), limitado ao valor
--   dado. Acesso funciona porque crédito é o ÚNICO gate.
-- (Espelho da migration MCP 20260726* courtesy_campaigns.)
-- ============================================================================

create table if not exists public.courtesy_campaigns (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  credits_per_person int  not null check (credits_per_person > 0),
  starts_at          timestamptz not null default now(),
  ends_at            timestamptz not null,
  active             boolean not null default true,
  created_by         text,
  created_at         timestamptz not null default now()
);
comment on table public.courtesy_campaigns is
  'Campanhas de cortesia (acesso sem Hotmart): créditos por pessoa numa janela; o restante expira no fim.';

create table if not exists public.courtesy_grants (
  campaign_id       uuid not null references public.courtesy_campaigns(id) on delete cascade,
  email             text not null,
  user_id           uuid references auth.users(id) on delete set null,
  amount            int  not null,
  granted_at        timestamptz,      -- null = ainda não creditado (sem conta/agendada)
  expired_at        timestamptz,      -- null = ainda não expirado
  remaining_expired int,              -- quanto foi abatido na expiração
  primary key (campaign_id, email)
);
create index if not exists courtesy_grants_email_idx on public.courtesy_grants (email);
comment on table public.courtesy_grants is
  'Uma linha por e-mail da campanha. granted_at marca o crédito (idempotente); expired_at fecha a concessão.';

-- service-only (padrão admin): RLS ligada sem policies
alter table public.courtesy_campaigns enable row level security;
alter table public.courtesy_grants    enable row level security;

-- ── função: EXPIRAR cortesia — debita SÓ o saldo extra, atômico e limitado ───
-- Não usa debit_credits (que consome assinatura primeiro): aqui NUNCA se toca
-- credits_subscription. Abate min(extra atual, valor da cortesia).
create or replace function public.expire_courtesy_credits(
  p_user_id    uuid,
  p_max_amount int,
  p_ref_id     text default null
) returns jsonb
language plpgsql
as $$
declare
  v_extra int; v_debit int; v_balance int;
begin
  if p_max_amount <= 0 then
    return jsonb_build_object('ok', true, 'debited', 0);
  end if;

  select credits_extra into v_extra
    from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  v_debit := least(greatest(coalesce(v_extra, 0), 0), p_max_amount);
  if v_debit > 0 then
    update public.profiles
       set credits_extra = credits_extra - v_debit, updated_at = now()
     where id = p_user_id;
    select credits_subscription + credits_extra into v_balance
      from public.profiles where id = p_user_id;
    insert into public.credit_transactions(user_id, kind, amount, balance_after, ref_type, ref_id, note)
      values (p_user_id, 'adjustment', -v_debit, v_balance, 'courtesy_expire', p_ref_id, 'cortesia expirada (fim da campanha)');
  end if;

  return jsonb_build_object('ok', true, 'debited', v_debit);
end;
$$;
