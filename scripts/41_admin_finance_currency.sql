-- 41: admin_finance em BRL DE VERDADE — compra internacional não infla mais o ENTROU.
-- Caso joana 2026-07-15: renovação na Argentina veio price={value:32499, currency:"ARS"}
-- e foi somada como R$ 32.499,00 (real ≈ R$ 106,48) ⇒ ENTROU(REAL) do /admin mostrou
-- R$ 33.566 com 12 vendas (11×R$97 + a distorção).
-- Valor por evento agora:
--   1. price.value quando currency_value = BRL (ou ausente — payload antigo);
--   2. senão original_offer_price.value quando BRL (equivalente em tabela);
--   3. senão a comissão do PRODUCER convertida pra BRL (currency_conversion);
--   4. senão 0 — nunca soma moeda estrangeira crua.
-- Mesma regra nos refunds. Restante idêntico à migration 26.

drop function if exists admin_finance(timestamptz, timestamptz, text);
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
    case
      when coalesce(payload->'data'->'purchase'->'price'->>'currency_value', 'BRL') = 'BRL'
        then coalesce((payload->'data'->'purchase'->'price'->>'value')::numeric, 0)
      when payload->'data'->'purchase'->'original_offer_price'->>'currency_value' = 'BRL'
        then coalesce((payload->'data'->'purchase'->'original_offer_price'->>'value')::numeric, 0)
      else coalesce((
        select (c->'currency_conversion'->>'converted_value')::numeric
        from jsonb_array_elements(coalesce((payload::jsonb)->'data'->'commissions', '[]'::jsonb)) c
        where c->>'source' = 'PRODUCER'
          and c->'currency_conversion'->>'converted_to_currency' = 'BRL'
        limit 1
      ), 0)
    end as value,
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
    coalesce(sum(
      case
        when coalesce(payload->'data'->'purchase'->'price'->>'currency_value', 'BRL') = 'BRL'
          then coalesce((payload->'data'->'purchase'->'price'->>'value')::numeric, 0)
        when payload->'data'->'purchase'->'original_offer_price'->>'currency_value' = 'BRL'
          then coalesce((payload->'data'->'purchase'->'original_offer_price'->>'value')::numeric, 0)
        else coalesce((
          select (c->'currency_conversion'->>'converted_value')::numeric
          from jsonb_array_elements(coalesce((payload::jsonb)->'data'->'commissions', '[]'::jsonb)) c
          where c->>'source' = 'PRODUCER'
            and c->'currency_conversion'->>'converted_to_currency' = 'BRL'
          limit 1
        ), 0)
      end
    ), 0) as total,
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
