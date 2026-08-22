-- 91 · A miniatura do viral passa a ser NOSSA.
--
-- Problema medido em 22/08: as 560 linhas de viral_videos guardam thumb_url
-- apontando pro CDN do TikTok, com assinatura e prazo (x-expires). A galeria
-- aparecia e depois ia apagando sozinha — 403 no console, uma a uma, conforme
-- as assinaturas venciam. O Johnny: "fiquei um tempo sem entrar e agora não
-- aparece mais".
--
-- thumb_r2_key = a cópia no NOSSO R2 (bucket permanente, o mesmo das imagens;
-- NÃO o de generations, que tem TTL de 30 dias e recriaria o problema).
-- thumb_url continua como está: é o endereço de origem e o fallback de quem
-- ainda não foi copiado.

alter table viral_videos add column if not exists thumb_r2_key text;

comment on column viral_videos.thumb_r2_key is
  'Miniatura copiada pro nosso R2 (bucket permanente). A thumb_url do TikTok é assinada e EXPIRA — servir direto dela faz a galeria apagar sozinha com o tempo.';

-- Quem ainda não tem cópia (o backfill varre por aqui).
create index if not exists viral_videos_sem_thumb_r2_idx
  on viral_videos (criado_em desc)
  where thumb_r2_key is null;
