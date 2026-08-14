-- 74: temas do acervo de virais (contagem por termo buscado).
--
-- A tela precisa dos "temas" como fichas clicáveis (pedido do Johnny 14/08:
-- "precisamos melhorar o filtro por likes, por tema"). Contar no Node exigiria
-- puxar o acervo inteiro pra memória — com dezenas de milhares de vídeos isso
-- não fecha. O Postgres agrupa e devolve 50 linhas.
--
-- Sem security definer de propósito: quem chama é a service role das rotas,
-- que já passa por cima do RLS.
create or replace function public.virais_temas()
returns table (tema text, total bigint, marcados bigint)
language sql
stable
set search_path = public
as $$
  select
    coalesce(nullif(trim(termo_busca), ''), 'sem tema') as tema,
    count(*)::bigint as total,
    count(*) filter (where selecionado)::bigint as marcados
  from public.viral_videos
  where descartado = false
  group by 1
  order by 2 desc
  limit 50;
$$;

-- O agrupamento varre o acervo visível; sem isto vira seq scan quando crescer.
create index if not exists viral_videos_tema_idx
  on public.viral_videos (termo_busca)
  where descartado = false;
