-- ============================================================================
-- 81 — expire_trial_credits: security definer (fix do permission denied)
--
-- A migration 80 criou a função SEM `security definer`, então ela roda como o
-- CHAMADOR (service_role, via PostgREST no sweep de 5min). Na linha do
-- `select id ... from auth.users` o service_role toma:
--
--   2026-08-18T18:25:03+00:00 "trial_expiry":{"ok":false,
--     "error":"expire_trial_credits: permission denied for table users"}
--
-- Fix: recriar a função com `security definer set search_path = public`,
-- a MESMA convenção já usada em 01_schema (handle_new_user), 21_ops_alerts
-- (claim_alert), 22_render_jobs (claim_render_job), 25/26 (admin_finance,
-- admin_metrics). A 80 já está aplicada em produção — migration aplicada não
-- se reescreve, por isso esta 81 só faz o `create or replace`.
--
-- search_path = public (e não `public, auth`): todas as referências do corpo
-- já são qualificadas por esquema (auth.users, public.*), então o search_path
-- estreito da convenção basta — e quanto mais estreito, menor a superfície de
-- sequestro de resolução de nomes num security definer.
--
-- Por que `security definer` é seguro aqui:
--   * único parâmetro é p_grace_days INT — tipado pelo Postgres, sem SQL
--     dinâmico (nenhum EXECUTE/format no corpo), então não há injeção possível;
--   * search_path fixado impede resolver nome em esquema malicioso;
--   * EXECUTE segue revogado de public/anon/authenticated (abaixo, igual à 80)
--     — só o service_role do sweep chama;
--   * o privilégio extra que o definer concede é exatamente o necessário:
--     LER auth.users pra resolver e-mail → user_id. Nada é escrito em auth.
--
-- Corpo IDÊNTICO ao da 80 — muda só o cabeçalho da função.
--
-- ⚠️ ESPELHO — NÃO APLICADO. DDL aguardando aprovação do Johnny (regra 21).
-- ============================================================================

create or replace function public.expire_trial_credits(p_grace_days int default 10)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_user uuid;
  v_sub int; v_extra int;
  v_checked int := 0; v_zeroed int := 0; v_credits int := 0;
  v_paid int := 0; v_no_account int := 0; v_active_access int := 0;
begin
  for r in
    with ap as (
      select payload->'data'->'purchase' as pu,
             lower(coalesce(payload->'data'->'buyer'->>'email','')) as email,
             received_at
      from public.payment_events
      where provider = 'hotmart' and event_type = 'PURCHASE_APPROVED'
    ),
    trials as (
      -- critério do painel (mig 63): rec 1 + valor 0, primeiro evento por e-mail
      select email, min(received_at) as trial_start
      from ap
      where (pu->'price'->>'value')::numeric = 0
        and (pu->>'recurrence_number')::int = 1
      group by 1
    ),
    paid as (
      -- pagamento de verdade DA ASSINATURA: valor > 0 com recurrence presente
      select distinct email from ap
      where (pu->'price'->>'value')::numeric > 0
        and (pu->>'recurrence_number') is not null
    )
    select t.email, t.trial_start, (p.email is not null) as has_paid
    from trials t
    left join paid p on p.email = t.email
    where t.trial_start <= now() - make_interval(days => p_grace_days)
      and not exists (select 1 from public.trial_credit_expirations e where e.email = t.email)
  loop
    v_checked := v_checked + 1;

    -- pagou ao menos uma mensalidade → mantém tudo, resolve pra sempre
    if r.has_paid then
      insert into public.trial_credit_expirations(email, trial_start, outcome, debited)
        values (r.email, r.trial_start, 'paid', 0)
        on conflict (email) do nothing;
      v_paid := v_paid + 1;
      continue;
    end if;

    -- resolve a conta pelo e-mail (o motivo do security definer: auth.users)
    select id into v_user from auth.users where lower(email) = r.email limit 1;
    if v_user is null then
      -- sem conta HOJE: nada a zerar, mas NÃO marca resolvido — se a conta
      -- nascer e reivindicar a compra órfã (100k), a próxima rodada zera.
      v_no_account := v_no_account + 1;
      continue;
    end if;

    -- trava por pessoa: acesso pago vigente por OUTRA via → não toca, não marca
    if exists (
      select 1 from public.entitlements en
      where en.user_id = v_user
        and en.status = 'active'
        and (en.access_until is null or en.access_until > now())
    ) then
      v_active_access := v_active_access + 1;
      continue;
    end if;

    -- zera SÓ credits_subscription, atômico e auditável
    select credits_subscription, credits_extra into v_sub, v_extra
      from public.profiles where id = v_user for update;
    if not found then
      v_no_account := v_no_account + 1;  -- auth.users sem profile: nada a zerar
      continue;
    end if;
    v_sub := greatest(coalesce(v_sub, 0), 0);

    if v_sub > 0 then
      update public.profiles
         set credits_subscription = 0, updated_at = now()
       where id = v_user;
      insert into public.credit_transactions(user_id, kind, amount, balance_after, ref_type, ref_id, note)
        values (v_user, 'adjustment', -v_sub, coalesce(v_extra, 0), 'trial_expirado', r.email,
                'trial de ' || to_char(r.trial_start, 'YYYY-MM-DD')
                || ' sem pagamento em ' || p_grace_days
                || ' dias; credito de mensalidade zerado em ' || to_char(now(), 'YYYY-MM-DD'));
    end if;

    insert into public.trial_credit_expirations(email, user_id, trial_start, outcome, debited)
      values (r.email, v_user, r.trial_start, 'zeroed', v_sub)
      on conflict (email) do nothing;
    v_zeroed := v_zeroed + 1;
    v_credits := v_credits + v_sub;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'checked', v_checked,
    'zeroed', v_zeroed,
    'credits_zeroed', v_credits,
    'marked_paid', v_paid,
    'skipped_no_account', v_no_account,
    'skipped_active_access', v_active_access
  );
end;
$$;

-- create or replace preserva a ACL, mas re-declara pra ficar auto-contido:
revoke all on function public.expire_trial_credits(int) from public, anon, authenticated;
