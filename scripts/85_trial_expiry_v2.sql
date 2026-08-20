-- ============================================================================
-- 85 — expire_trial_credits v2: corrige a detecção e blinda a varredura
--
-- ⚠️ ESPELHO — NÃO APLICADO. DDL aguardando aprovação do Johnny (regra 21).
-- ⚠️ APLICAR ESTA MIGRATION **NÃO RELIGA** A VARREDURA: a função v2 nasce
--    atrás de um kill-switch (trial_expiry_config.enabled = false). Religar
--    é um segundo ato, explícito e separado do DDL:
--      update public.trial_expiry_config set enabled = true, updated_at = now();
--
-- ── O que aconteceu de verdade em 18/08 (prova: _frank/prova/2026-08-18_os_14_nunca_pagaram.md)
--
-- O corpo vivo em produção diz "zerou 14 pagantes". ESSE COMENTÁRIO ESTÁ
-- ERRADO e não pode sobreviver: dos 14 zerados, 13 NUNCA pagaram (0 de 14 com
-- cobrança COMPLETE/APPROVED de valor > 0, confirmado na Hotmart viva E no
-- payment_events, dois caminhos independentes). O engano foi da DEVOLUÇÃO, que
-- leu `price.value > 0` na API REST e tratou mensalidade OVERDUE como paga.
-- Essa armadilha é da API REST — no webhook ela NÃO existe: PURCHASE_APPROVED
-- só chega quando a cobrança é aprovada de fato (conferido em produção 20/08:
-- os equivalentes de "cobrança emitida e não paga" chegam como PURCHASE_DELAYED
-- e PURCHASE_BILLET_PRINTED, que a v1 já ignorava corretamente).
--
-- Onde a v1 ERROU de verdade (e o que a v2 muda):
--
-- 1. SEM ALLOWLIST — zerou o Lucas (sócio). bypassesBilling vive no código do
--    app (lib/credits/access.ts) e a função no banco não passa por lá. A v2
--    embute a allowlist em SQL (billing_allowlist) e pula esses e-mails antes
--    de qualquer outra decisão. MANTER EM SINCRONIA com COMP_ACCESS_EMAILS /
--    ADMIN_EMAILS do app.
--
-- 2. FONTE ÚNICA E COMPROVADAMENTE INCOMPLETA — "pagou" = só payment_events.
--    Ausência de evento não é ausência de pagamento: em 20/08, 124 das 139
--    pessoas no filtro tinham entitlement ATIVO vigente (prova:
--    _frank/prova/2026-08-20_cancelamentos_de_19-08.md item 2) — quase
--    certamente pagaram e o evento é que não está no nosso banco. A guarda de
--    entitlement da v1 salvava essas 124, MAS:
--
-- 3. GUARDA ESTREITA DEMAIS — a v1 só aceitava status='active'. Quem PAGOU,
--    cancelou e ainda está no período pago fica com status='canceled' e
--    access_until no futuro (webhooks/hotmart/route.ts:236 grava assim; hoje
--    há 15 linhas nesse estado). Se o pagamento dessa pessoa não estiver em
--    payment_events, a v1 zeraria um pagante — a assinatura exata do 18/08.
--    A v2 aceita também canceled com access_until vigente.
--
-- 4. SEM TETO — uma rodada ruim zerou 14 pessoas / 1.356.554 créditos em um
--    sweep, sem freio. A v2 conta quantos DÉBITOS REAIS a rodada faria e, se
--    passar do teto (trial_expiry_config.max_zeroed_per_round, default 20),
--    DESFAZ TUDO (rollback do bloco) e devolve ok:false — o sweep loga a
--    falha a cada 5min até um humano olhar. Zerar em massa é sintoma de erro
--    sistêmico, nunca de rotina.
--
-- 5. DESLIGAR EXIGIA MUTILAR A FUNÇÃO EM PRODUÇÃO — o corpo vivo divergiu do
--    repo por 2 dias. A v2 tem kill-switch em tabela: desligada, devolve
--    ok:true + disabled:true + zeros (no-op silencioso e proposital, não é
--    falha); religar/desligar é um UPDATE de uma linha, sem DDL.
--
-- 6. ROBUSTEZ DE FONTE — "pagou" agora aceita PURCHASE_APPROVED **ou**
--    PURCHASE_COMPLETE (valor > 0, recurrence presente). Hoje isso não muda
--    ninguém (conferido em produção 20/08: 0 pessoas pagas só via COMPLETE),
--    mas protege contra entrega perdida do webhook APPROVED.
--
-- ── Grafia do campo (confirmada em produção 20/08, não é suposição):
--    payment_events (webhook): 2.516 purchases com `recurrence_number`,
--    ZERO com `recurrency_number`. A grafia da v1 estava CERTA para o webhook.
--    `recurrency_number` é a grafia da API REST /subscriptions/{code}/purchases
--    e só interessa às ferramentas .cjs que falam com a Hotmart viva.
--
-- Convenções mantidas da 81: security definer + set search_path = public
-- (motivo: ler auth.users), EXECUTE revogado de public/anon/authenticated,
-- mesma assinatura (o sweep chama rpc sem argumentos).
-- ============================================================================

-- ── kill-switch + teto: religar é decisão explícita, nunca efeito colateral ──
create table if not exists public.trial_expiry_config (
  id                   boolean primary key default true check (id),  -- linha única
  enabled              boolean not null default false,
  max_zeroed_per_round int     not null default 20 check (max_zeroed_per_round > 0),
  updated_at           timestamptz not null default now(),
  note                 text
);
comment on table public.trial_expiry_config is
  'Kill-switch e teto da expire_trial_credits. enabled=false = no-op silencioso. Religar é UPDATE explícito, nunca efeito de DDL.';
alter table public.trial_expiry_config enable row level security;  -- service-only

insert into public.trial_expiry_config (id, enabled, note)
  values (true, false,
          'nasce DESLIGADA (incidente 18/08). Religar só com aval do Johnny, depois do dry-run seco conferido.')
  on conflict (id) do nothing;

-- ── allowlist da equipe DENTRO do SQL (lição do Lucas, 18/08) ────────────────
-- Espelho de bypassesBilling (frontend/src/lib/credits/access.ts): default de
-- COMP_ACCESS_EMAILS + ADMIN_EMAILS do .env. A função no banco não enxerga o
-- env do app, então a proteção precisa viver AQUI. Se a lista do app mudar,
-- mudar AQUI JUNTO.
create table if not exists public.billing_allowlist (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);
comment on table public.billing_allowlist is
  'E-mails que nunca sofrem automação de saldo (equipe/admin). Espelho em SQL do bypassesBilling do app.';
alter table public.billing_allowlist enable row level security;  -- service-only

insert into public.billing_allowlist (email, note) values
  ('johnny.oliveirasp@gmail.com', 'dono (ADMIN_EMAILS + COMP_ACCESS_EMAILS)'),
  ('lucas.m.arrial@gmail.com',    'sócio (COMP_ACCESS_EMAILS) — zerado por engano em 18/08'),
  ('eduardo@lucasarrial.com',     'equipe (COMP_ACCESS_EMAILS)')
  on conflict (email) do nothing;

-- ── a função v2 ──────────────────────────────────────────────────────────────
create or replace function public.expire_trial_credits(p_grace_days int default 10)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_enabled boolean;
  v_cap int;
  v_user uuid;
  v_sub int; v_extra int;
  v_checked int := 0; v_zeroed int := 0; v_credits int := 0;
  v_debits int := 0;           -- pessoas com débito REAL (v_sub > 0) — é sobre isto que o teto vale
  v_paid int := 0; v_no_account int := 0; v_active_access int := 0;
  v_allowlist int := 0; v_canceled_vigente int := 0;
begin
  -- kill-switch: desligada = no-op silencioso E PROPOSITAL (não é falha).
  select enabled, max_zeroed_per_round into v_enabled, v_cap
    from public.trial_expiry_config where id = true;
  if v_enabled is distinct from true then
    return jsonb_build_object(
      'ok', true, 'disabled', true,
      'checked', 0, 'zeroed', 0, 'credits_zeroed', 0, 'marked_paid', 0,
      'skipped_no_account', 0, 'skipped_active_access', 0);
  end if;

  -- bloco com EXCEPTION: o RAISE do teto desfaz TUDO que o loop escreveu.
  begin
    for r in
      with ap as (
        select event_type,
               payload->'data'->'purchase' as pu,
               lower(coalesce(payload->'data'->'buyer'->>'email','')) as email,
               received_at
        from public.payment_events
        where provider = 'hotmart'
          and event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')
      ),
      trials as (
        -- critério do painel (mig 63), inalterado: APPROVED rec 1 + valor 0,
        -- primeiro evento por e-mail
        select email, min(received_at) as trial_start
        from ap
        where event_type = 'PURCHASE_APPROVED'
          and (pu->'price'->>'value')::numeric = 0
          and (pu->>'recurrence_number')::int = 1
        group by 1
      ),
      paid as (
        -- pagamento de verdade DA ASSINATURA: valor > 0 com recurrence presente.
        -- APPROVED **ou** COMPLETE (item 6 do cabeçalho). Grafia
        -- `recurrence_number` é a do WEBHOOK — confirmada em produção 20/08.
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

      -- equipe/admin: fora de QUALQUER automação de saldo, sem nem marcar
      if exists (select 1 from public.billing_allowlist b where b.email = r.email) then
        v_allowlist := v_allowlist + 1;
        continue;
      end if;

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

      -- trava por pessoa, ALARGADA (item 3 do cabeçalho): acesso vigente por
      -- outra via — active, OU canceled ainda dentro do período pago — pula
      -- SEM marcar. Entitlement vivo pra quem "nunca pagou" no payment_events
      -- quase sempre = pagamento real cujo evento não chegou. Cada caso desses
      -- exige confirmação individual na Hotmart, nunca decisão automática.
      if exists (
        select 1 from public.entitlements en
        where en.user_id = v_user
          and en.status = 'active'
          and (en.access_until is null or en.access_until > now())
      ) then
        v_active_access := v_active_access + 1;
        continue;
      end if;
      if exists (
        select 1 from public.entitlements en
        where en.user_id = v_user
          and en.status = 'canceled'
          and en.access_until is not null and en.access_until > now()
      ) then
        v_canceled_vigente := v_canceled_vigente + 1;
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
        v_debits := v_debits + 1;
      end if;

      insert into public.trial_credit_expirations(email, user_id, trial_start, outcome, debited)
        values (r.email, v_user, r.trial_start, 'zeroed', v_sub)
        on conflict (email) do nothing;
      v_zeroed := v_zeroed + 1;
      v_credits := v_credits + v_sub;
    end loop;

    -- teto por rodada (item 4): mais débitos reais que o teto = sintoma de
    -- erro sistêmico. Aborta a rodada INTEIRA (rollback deste bloco).
    if v_debits > v_cap then
      raise exception 'teto' using errcode = 'TR001';
    end if;
  exception
    when sqlstate 'TR001' then
      return jsonb_build_object(
        'ok', false,
        'error', format(
          'teto por rodada excedido: %s pessoas com debito real > teto %s — NADA foi zerado (rollback); rodada abortada para revisao humana',
          v_debits, v_cap),
        'would_zero', v_zeroed,
        'would_zero_credits', v_credits);
  end;

  return jsonb_build_object(
    'ok', true,
    'checked', v_checked,
    'zeroed', v_zeroed,
    'credits_zeroed', v_credits,
    'debited_people', v_debits,
    'marked_paid', v_paid,
    'skipped_no_account', v_no_account,
    'skipped_active_access', v_active_access,
    'skipped_canceled_vigente', v_canceled_vigente,
    'skipped_allowlist', v_allowlist
  );
end;
$$;

-- create or replace preserva a ACL, mas re-declara pra ficar auto-contido:
revoke all on function public.expire_trial_credits(int) from public, anon, authenticated;
