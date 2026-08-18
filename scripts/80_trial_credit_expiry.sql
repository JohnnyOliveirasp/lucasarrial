-- ============================================================================
-- 80 — trial vencido: crédito de mensalidade expira 10 dias após a adesão
-- Regra do Johnny 18/08 (_frank/ordens/2026-08-18_regra_do_trial.md):
-- o trial continua dando os 100.000 créditos, mas com VALIDADE de 10 dias
-- (7 de teste + 3 de carência). Sem pagamento de verdade até o dia 10,
-- credits_subscription zera. credits_extra NUNCA é tocado (dívida nossa com
-- o aluno). Uma regra só, sem ramificar por evento: quem cancela no dia 2
-- fica com o crédito até o dia 10 do mesmo jeito.
--
-- Chamada pelo sweep de 5min (sweep-clones → expire_trial_credits), mesmo
-- caminho da expiração de cortesia (52/53). Sem infraestrutura nova.
--
-- ⚠️ ESPELHO — NÃO APLICADO. DDL aguardando aprovação do Johnny (regra 21).
-- ============================================================================

-- ── marcador de resolução: dá idempotência e faz o no-op ser barato ──────────
-- Uma linha por PESSOA (e-mail) cujo trial já passou do dia 10 e foi decidido:
-- 'zeroed' (não pagou → crédito de mensalidade zerado, debited diz quanto) ou
-- 'paid' (pagou dentro do prazo → nunca mais entra na varredura).
-- Quem está aqui SAI da varredura pra sempre — rodar de novo é no-op.
create table if not exists public.trial_credit_expirations (
  email       text primary key,                                -- pessoa = e-mail (mesmo dedupe do painel)
  user_id     uuid references auth.users(id) on delete set null,
  trial_start timestamptz not null,                            -- min(received_at) da compra rec=1 valor=0
  outcome     text not null check (outcome in ('zeroed','paid')),
  debited     int  not null default 0,                         -- quanto de credits_subscription foi zerado
  resolved_at timestamptz not null default now()
);
comment on table public.trial_credit_expirations is
  'Trials que já passaram do dia 10 e foram resolvidos (zerado ou pagou). Marcador de idempotência da varredura.';

-- service-only (padrão admin): RLS ligada sem policies
alter table public.trial_credit_expirations enable row level security;

-- índice parcial pra varredura dos eventos aprovados não custar caro a cada 5min
create index if not exists payment_events_hotmart_approved_recv_idx
  on public.payment_events (received_at)
  where provider = 'hotmart' and event_type = 'PURCHASE_APPROVED';

-- ── função: a varredura inteira, atômica no banco ────────────────────────────
-- Trial = MESMO critério do painel (admin_trial_stats, mig 63): compra
-- PURCHASE_APPROVED com recurrence_number = 1 e price.value = 0, dedupe por
-- e-mail do comprador. Se o critério do painel mudar, mudar AQUI JUNTO.
--
-- "Pagou" = qualquer compra DA ASSINATURA com valor > 0 (recurrence_number
-- presente, qualquer número). Compra avulsa (sem recurrence_number) NÃO conta
-- como pagamento da mensalidade — o crédito extra dela fica intocado de
-- qualquer forma.
--
-- Trava por PESSOA (armadilha real de 18/08: 2 em 180 tinham cancelado um
-- trial mas tinham OUTRA assinatura ativa): além do "pagou" por e-mail, quem
-- tem entitlement ATIVO com acesso vigente é PULADO sem marcar — se aparecer
-- toda rodada no summary, é anomalia pra um humano olhar.
--
-- Idempotência em duas camadas: (1) o anti-join no marcador tira o resolvido
-- da varredura; (2) o débito só lança quando credits_subscription > 0 depois
-- do row lock — rodada dupla concorrente espera o lock, vê 0 e não lança nada.
create or replace function public.expire_trial_credits(p_grace_days int default 10)
returns jsonb
language plpgsql
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

    -- resolve a conta pelo e-mail
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

revoke all on function public.expire_trial_credits(int) from public, anon, authenticated;
