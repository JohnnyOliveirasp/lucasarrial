-- 32: custo do Vídeo Clone no financeiro do /admin
-- Agrega jobs por tier no período (todos os status — GPU foi gasta mesmo em falha).
-- APLICADA via MCP Supabase em 2026-07-09 (migration admin_video_clones).
create or replace function public.admin_video_clones(p_since timestamptz, p_until timestamptz default now())
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  from (
    select tier,
           count(*)::int as n,
           round(coalesce(sum(duration_seconds), 0)::numeric, 1) as seconds
    from public.video_clones
    where created_at >= p_since
      and created_at < p_until
    group by tier
  ) t;
$$;
