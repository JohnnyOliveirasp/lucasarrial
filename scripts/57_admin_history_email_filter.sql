-- 57: filtro por e-mail no Histórico do /admin (pedido Johnny 02/08).
-- admin_history ganha p_email (opcional): filtra treinos/gerações/pagamentos
-- pelo e-mail do aluno (ilike parcial) — achar a voz de uma pessoa sem rolar
-- os "últimos 40".
-- ⚠️ assinatura NOVA = o replace cria um OVERLOAD e o PostgREST fica ambíguo
-- (histórico voltou VAZIO em prod até dropar a antiga — lição 02/08).
drop function if exists public.admin_history(integer);

create or replace function public.admin_history(p_limit integer default 40, p_email text default null)
 returns json
 language sql
 security definer
 set search_path to 'public'
as $function$
  select json_build_object(
    'trainings', (
      select coalesce(json_agg(row_to_json(s) order by s.at desc), '[]'::json)
      from (
        select tj.id::text, coalesce(tj.finished_at, tj.created_at) at, tj.status,
               v.name as voice, p.email, tj.elapsed_seconds, tj.error_message as error
        from training_jobs tj
        left join voices v on v.id = tj.voice_id
        left join profiles p on p.id = tj.user_id
        where p_email is null or p.email ilike '%' || p_email || '%'
        order by tj.created_at desc limit p_limit
      ) s
    ),
    'generations', (
      select coalesce(json_agg(row_to_json(s) order by s.at desc), '[]'::json)
      from (
        select g.id::text, g.created_at at, g.status, g.name,
               v.name as voice, p.email, length(coalesce(g.text_raw, '')) as chars
        from generations g
        left join voices v on v.id = g.voice_id
        left join profiles p on p.id = g.user_id
        where p_email is null or p.email ilike '%' || p_email || '%'
        order by g.created_at desc limit p_limit
      ) s
    ),
    'payments', (
      select coalesce(json_agg(row_to_json(s) order by s.at desc), '[]'::json)
      from (
        select pe.id::text, pe.received_at at, pe.provider, pe.event_type,
               pe.buyer_email as email, pe.processed_at, pe.error
        from payment_events pe
        where p_email is null or pe.buyer_email ilike '%' || p_email || '%'
        order by pe.received_at desc limit p_limit
      ) s
    )
  );
$function$;
