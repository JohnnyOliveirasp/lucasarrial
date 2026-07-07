-- 27: Vídeo Vendas TikTok — mesmo pipeline do Vídeo História (video_projects),
-- diferenciado por `kind`. Cenas/imagens/vídeos/render funcionam SEM MUDANÇA.
-- Fotos da PESSOA reusam reference_image_paths; as do PRODUTO são novas.

alter table video_projects
  add column if not exists kind text not null default 'story'
    check (kind in ('story', 'sales')),
  add column if not exists product_image_paths text[],
  add column if not exists product_price text,
  add column if not exists product_link text,
  add column if not exists product_description text,
  add column if not exists product_analysis text;

comment on column video_projects.kind is 'story = Vídeo História; sales = Vídeo Vendas TikTok';
comment on column video_projects.product_analysis is 'Análise da IA (visão) do produto+pessoa — base do roteiro de venda';
