-- 26: filtros por período CALENDÁRIO no /admin (dia/mês/ano).
-- admin_metrics e admin_finance ganham p_until (default now()) — junho = [01/06, 01/07),
-- não "últimos 30 dias". p_until default mantém compatível com o código em produção.

drop function if exists admin_metrics(timestamptz);
create or replace function admin_metrics(
  p_since timestamptz,
  p_until timestamptz default now()
)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'users_total',          (select count(*) from profiles),
    'users_new',            (select count(*) from profiles where created_at >= p_since and created_at < p_until),
    'subs_active',          (select count(*) from profiles where access_until > now()),
    'online_now',           (select count(*) from profiles where last_seen_at > now() - interval '90 seconds'),
    'voices_total',         (select count(*) from voices),
    'voices_ready',         (select count(*) from voices where status = 'ready'),
    'voices_training',      (select count(*) from voices where status = 'training'),
    'voices_failed',        (select count(*) from voices where status = 'failed'),
    'gens_total',           (select count(*) from generations),
    'gens_period',          (select count(*) from generations where created_at >= p_since and created_at < p_until),
    'gens_failed',          (select count(*) from generations where status = 'failed'),
    'gens_chars_period',    (select coalesce(sum(length(coalesce(text_raw, ''))), 0) from generations where created_at >= p_since and created_at < p_until and status = 'ready'),
    'trainings_done',       (select count(*) from training_jobs where status = 'completed'),
    'trainings_period',     (select count(*) from training_jobs where status = 'completed' and coalesce(finished_at, created_at) >= p_since and coalesce(finished_at, created_at) < p_until),
    'trainings_failed',     (select count(*) from training_jobs where status = 'failed'),
    'credits_consumed',     (select coalesce(-sum(amount), 0) from credit_transactions where amount < 0 and created_at >= p_since and created_at < p_until)
  );
$$;
revoke all on function admin_metrics(timestamptz, timestamptz) from public, anon, authenticated;

drop function if exists admin_finance(timestamptz, text);
create or replace function admin_finance(
  p_since timestamptz,
  p_until timestamptz default now(),
  p_product_id text default '7851642'
)
returns json
language sql
security definer
set search_path = public
as $$
with approved as (
  select
    buyer_email,
    coalesce((payload->'data'->'purchase'->'price'->>'value')::numeric, 0) as value,
    received_at,
    (
      buyer_email ilike '%@example.com'
      or buyer_email in ('johnny.optimal@gmail.com', 'johnny.milum001@gmail.com', 'johnny.oliveirasp1@gmail.com', 'jmo.usa.007@gmail.com')
    ) as is_test
  from payment_events
  where event_type = 'PURCHASE_APPROVED'
    and payload->'data'->'product'->>'id' = p_product_id
),
refunds as (
  select
    coalesce(sum(coalesce((payload->'data'->'purchase'->'price'->>'value')::numeric, 0)), 0) as total,
    count(*) as n
  from payment_events
  where event_type in ('PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK')
    and payload->'data'->'product'->>'id' = p_product_id
    and received_at >= p_since and received_at < p_until
    and not (
      buyer_email ilike '%@example.com'
      or buyer_email in ('johnny.optimal@gmail.com', 'johnny.milum001@gmail.com', 'johnny.oliveirasp1@gmail.com', 'jmo.usa.007@gmail.com')
    )
)
select json_build_object(
  'paid_count',        (select count(*) from approved where not is_test and value > 0),
  'paid_total',        (select coalesce(sum(value), 0) from approved where not is_test and value > 0),
  'paid_count_period', (select count(*) from approved where not is_test and value > 0 and received_at >= p_since and received_at < p_until),
  'paid_total_period', (select coalesce(sum(value), 0) from approved where not is_test and value > 0 and received_at >= p_since and received_at < p_until),
  'offer_count',        (select count(*) from approved where not is_test and value = 0),
  'offer_count_period', (select count(*) from approved where not is_test and value = 0 and received_at >= p_since and received_at < p_until),
  'test_count',        (select count(*) from approved where is_test),
  'refund_total',      (select total from refunds),
  'refund_count',      (select n from refunds),
  'paid_by_day', (
    select coalesce(json_agg(json_build_object('day', d, 'revenue', v, 'sales', s) order by d), '[]'::json)
    from (
      select received_at::date as d, sum(value) as v, count(*) as s
      from approved where not is_test and value > 0 and received_at >= p_since and received_at < p_until
      group by 1
    ) t
  ),
  'images_by_res', (
    select coalesce(json_agg(json_build_object('resolution', r, 'n', n)), '[]'::json)
    from (
      select resolution as r, count(*) as n
      from image_generations where status = 'ready' and created_at >= p_since and created_at < p_until
      group by 1
    ) t
  ),
  'scene_images_by_res', (
    select coalesce(json_agg(json_build_object('resolution', r, 'n', n)), '[]'::json)
    from (
      select coalesce(resolution, '1K') as r, count(*) as n
      from video_scenes where image_status = 'ready' and created_at >= p_since and created_at < p_until
      group by 1
    ) t
  ),
  'scene_videos_by_tier', (
    select coalesce(json_agg(json_build_object('tier', tr, 'n', n)), '[]'::json)
    from (
      select coalesce(video_tier, 'bronze') as tr, count(*) as n
      from video_scenes where video_status = 'ready' and created_at >= p_since and created_at < p_until
      group by 1
    ) t
  )
);
$$;
revoke all on function admin_finance(timestamptz, timestamptz, text) from public, anon, authenticated;
