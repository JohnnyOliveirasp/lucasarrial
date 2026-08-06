-- 63: funil do trial de 7 dias (pedido Lucas 06/08) — conversão trial→assinante.
-- Trial = PURCHASE_APPROVED recurrence 1 com valor 0; conversão = recurrence 2+
-- com valor > 0 (dedupe por e-mail do comprador). "Maduro" = trial com 8+ dias.
create or replace function public.admin_trial_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with ap as (
    select payload->'data'->'purchase' as pu,
           lower(coalesce(payload->'data'->'buyer'->>'email','')) as email,
           received_at
    from payment_events
    where provider = 'hotmart' and event_type = 'PURCHASE_APPROVED'
  ),
  trials as (
    select email, min(received_at) as trial_start
    from ap
    where (pu->'price'->>'value')::numeric = 0 and (pu->>'recurrence_number')::int = 1
    group by 1
  ),
  convs as (
    select distinct email from ap
    where (pu->>'recurrence_number')::int >= 2 and (pu->'price'->>'value')::numeric > 0
  )
  select jsonb_build_object(
    'started', count(*),
    'matured', count(*) filter (where trial_start <= now() - interval '8 days'),
    'converted', count(*) filter (where trial_start <= now() - interval '8 days' and email in (select email from convs)),
    'in_trial', count(*) filter (where trial_start > now() - interval '8 days'),
    'started_30d', count(*) filter (where trial_start >= now() - interval '30 days')
  )
  from trials;
$$;
revoke all on function public.admin_trial_stats() from public, anon, authenticated;
