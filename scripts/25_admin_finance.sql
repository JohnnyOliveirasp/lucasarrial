-- 25: RPC admin_finance — dinheiro REAL (payment_events) + uso por ferramenta.
-- Motivo: o topo do /admin estimava faturamento por assinantes×R$97; agora soma
-- o que a Hotmart de fato aprovou, separando PAGO × OFERTA (R$0) × TESTES.
-- Filtra o produto da plataforma (7851642) — a conta Hotmart recebe eventos de
-- outros produtos do Lucas que NÃO são receita nossa.

create or replace function admin_finance(
  p_since timestamptz,
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
    and received_at >= p_since
    and not (
      buyer_email ilike '%@example.com'
      or buyer_email in ('johnny.optimal@gmail.com', 'johnny.milum001@gmail.com', 'johnny.oliveirasp1@gmail.com', 'jmo.usa.007@gmail.com')
    )
)
select json_build_object(
  -- vendas pagas (valor > 0, sem testes) — total e no período
  'paid_count',        (select count(*) from approved where not is_test and value > 0),
  'paid_total',        (select coalesce(sum(value), 0) from approved where not is_test and value > 0),
  'paid_count_period', (select count(*) from approved where not is_test and value > 0 and received_at >= p_since),
  'paid_total_period', (select coalesce(sum(value), 0) from approved where not is_test and value > 0 and received_at >= p_since),
  -- ofertas (aprovado com R$0 — trial/cortesia)
  'offer_count',        (select count(*) from approved where not is_test and value = 0),
  'offer_count_period', (select count(*) from approved where not is_test and value = 0 and received_at >= p_since),
  -- testes (excluídos de tudo, só contagem informativa)
  'test_count',        (select count(*) from approved where is_test),
  -- estornos/chargebacks no período
  'refund_total',      (select total from refunds),
  'refund_count',      (select n from refunds),
  -- receita real por dia (pro gráfico)
  'paid_by_day', (
    select coalesce(json_agg(json_build_object('day', d, 'revenue', v, 'sales', s) order by d), '[]'::json)
    from (
      select received_at::date as d, sum(value) as v, count(*) as s
      from approved where not is_test and value > 0 and received_at >= p_since
      group by 1
    ) t
  ),
  -- uso Kie no período (fonte = tabelas, inclui uso de admin: Kie cobra igual)
  'images_by_res', (
    select coalesce(json_agg(json_build_object('resolution', r, 'n', n)), '[]'::json)
    from (
      select resolution as r, count(*) as n
      from image_generations where status = 'ready' and created_at >= p_since
      group by 1
    ) t
  ),
  -- cenas do wizard: contagem por resolução/tier (colunas *_credits_cost ficam
  -- zeradas no uso de admin, mas o Kie cobra igual — o custo é calculado no app)
  'scene_images_by_res', (
    select coalesce(json_agg(json_build_object('resolution', r, 'n', n)), '[]'::json)
    from (
      select coalesce(resolution, '1K') as r, count(*) as n
      from video_scenes where image_status = 'ready' and created_at >= p_since
      group by 1
    ) t
  ),
  'scene_videos_by_tier', (
    select coalesce(json_agg(json_build_object('tier', tr, 'n', n)), '[]'::json)
    from (
      select coalesce(video_tier, 'bronze') as tr, count(*) as n
      from video_scenes where video_status = 'ready' and created_at >= p_since
      group by 1
    ) t
  )
);
$$;

revoke all on function admin_finance(timestamptz, text) from public, anon, authenticated;
