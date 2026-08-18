-- ============================================================================
-- 82 — expire_trial_credits: não debitar quem tem COBRANÇA EM VOO
--
-- O QUE QUEBROU (18/08, primeira rodada real da mig 81):
-- a varredura debitou 100.000 de 14 pessoas. Auditoria na Hotmart
-- (GET /subscriptions/{code}/purchases, corpo cru, caso a caso) mostrou que
-- NENHUMA das 14 tem cobrança PAGA: todas têm rec#1 valor 0 COMPLETE (o trial)
-- e cobranças de R$97 em status OVERDUE / WAITING_PAYMENT — boleto emitido e
-- NÃO pago, assinatura PAST_DUE (13) ou ACTIVE (1). Ou seja: a detecção de
-- "pagou" não deixou passar pagamento nenhum — o que a função NÃO detectava
-- era o estado intermediário "está sendo cobrado e ainda não pagou".
--
-- POR QUE ISSO É BUG mesmo sem pagamento perdido:
-- a regra do trial (_frank/ordens/2026-08-18_regra_do_trial.md) diz explícito
-- que a pergunta certa do código não é "faz tempo que expirou?", é "TEM ALGUMA
-- COBRANÇA EM VOO?" — um pagamento que chega atrasado tem que reativar a
-- pessoa, não encontrar a conta zerada. E a regra 9 do manual (decisão de
-- 18/08 com o Lucas) manda não zerar PAST_DUE: cobrança em atraso não é
-- cancelamento. As 14 estavam exatamente nesse estado — Hotmart ainda emitindo
-- boleto novo por ciclo — e a função tratou como "nunca pagou → zera".
--
-- A CORREÇÃO (princípio: só debita quem foi CONFIRMADO como não-pagante;
-- na dúvida, PULA e reporta):
--   * paid  — prova de pagamento: evento APPROVED **ou COMPLETE** com valor > 0
--             e recurrence_number presente. (Antes só APPROVED: se o webhook
--             perder o APPROVED e chegar só o COMPLETE, o pagamento existe do
--             mesmo jeito — não podemos debitar por buraco no nosso espelho.)
--   * billed — NOVO: existe QUALQUER evento com purchase.price.value > 0 para
--             o e-mail (BILLET_PRINTED, DELAYED, EXPIRED, CANCELED, avulsa…).
--             Se billed e não paid → EM COBRANÇA → pula SEM marcar, conta em
--             skipped_em_cobranca. A pessoa fica pendente: se o boleto for pago,
--             vira 'paid' na rodada seguinte; nosso payment_events é um ESPELHO
--             de webhook, não a verdade — cobrança aberta = não confirmado.
--   * zera  — só quem passou do dia 10 E não tem NENHUM evento com valor > 0:
--             aderiu ao trial e saiu antes de qualquer cobrança. Esse é o único
--             caso em que "não pagou" é confirmável só com o nosso banco.
--
-- O que NÃO muda: critério de trial (paridade com o painel, mig 63: APPROVED
-- rec 1 valor 0), trava de entitlement ativo, credits_extra intocado,
-- idempotência pelo marcador, security definer + search_path da mig 81.
--
-- Custo: o CTE agora varre todos os eventos hotmart (não só APPROVED) — hoje
-- ~3,2 mil linhas, irrelevante a cada 5min. O índice parcial da 80 continua
-- válido para nada quebrar; não é mais o caminho único.
--
-- ⚠️ ATENÇÃO AO APLICAR: a função em produção está com o corpo trocado por um
-- stub desativado (18/08, manual). Aplicar esta migration REATIVA a varredura
-- já corrigida. Aplicar só com o ok do Johnny, depois dos testes com os 14
-- casos reais (harness em _Bugs/harness_trial_expiry_v2/, saída no PR).
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
  v_em_cobranca int := 0;
begin
  for r in
    with ev as (
      -- TODOS os eventos hotmart (não só APPROVED): precisamos enxergar boleto
      -- emitido/atrasado pra saber que existe cobrança em voo
      select event_type,
             payload->'data'->'purchase' as pu,
             lower(coalesce(payload->'data'->'buyer'->>'email','')) as email,
             received_at
      from public.payment_events
      where provider = 'hotmart'
    ),
    trials as (
      -- critério do painel (mig 63), INALTERADO: APPROVED rec 1 + valor 0,
      -- primeiro evento por e-mail
      select email, min(received_at) as trial_start
      from ev
      where event_type = 'PURCHASE_APPROVED'
        and (pu->'price'->>'value')::numeric = 0
        and (pu->>'recurrence_number')::int = 1
      group by 1
    ),
    paid as (
      -- prova de pagamento da assinatura: valor > 0 com recurrence presente,
      -- em APPROVED ou COMPLETE (COMPLETE sozinho também prova — o webhook
      -- pode ter perdido o APPROVED)
      select distinct email from ev
      where event_type in ('PURCHASE_APPROVED', 'PURCHASE_COMPLETE')
        and (pu->'price'->>'value')::numeric > 0
        and (pu->>'recurrence_number') is not null
    ),
    billed as (
      -- houve QUALQUER cobrança com valor (boleto emitido, atraso, expirada,
      -- cancelada, avulsa): a pessoa NÃO é confirmável como não-pagante
      select distinct email from ev
      where (pu->'price'->>'value')::numeric > 0
    )
    select t.email, t.trial_start,
           (p.email is not null) as has_paid,
           (b.email is not null) as has_charge
    from trials t
    left join paid   p on p.email = t.email
    left join billed b on b.email = t.email
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

    -- COBRANÇA EM VOO (o bug de 18/08): foi cobrado e ainda não pagou.
    -- Não debita, não marca — fica pendente até a cobrança se resolver.
    -- Se pagar (mesmo atrasado), a rodada seguinte marca 'paid' com o crédito
    -- intacto. Aparece toda rodada em skipped_em_cobranca — é sinal vivo,
    -- não anomalia.
    if r.has_charge then
      v_em_cobranca := v_em_cobranca + 1;
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
                || ' dias; nenhuma cobranca com valor no historico; '
                || 'credito de mensalidade zerado em ' || to_char(now(), 'YYYY-MM-DD'));
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
    'skipped_em_cobranca', v_em_cobranca,
    'skipped_no_account', v_no_account,
    'skipped_active_access', v_active_access
  );
end;
$$;

-- create or replace preserva a ACL, mas re-declara pra ficar auto-contido:
revoke all on function public.expire_trial_credits(int) from public, anon, authenticated;
