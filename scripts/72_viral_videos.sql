-- 72: "Vídeos Virais" — acervo dos virais achados por nicho.
--
-- O Johnny roda a busca no console do Apify; a plataforma IMPORTA o resultado
-- e mostra em miniaturas. Nada é baixado automaticamente: o vídeo só vai pro
-- R2 quando alguém MARCA que quer trabalhar com ele (senão o bucket vira
-- depósito de lixo — regra do Johnny 14/08).
create table if not exists public.viral_videos (
  id uuid primary key default gen_random_uuid(),
  plataforma text not null default 'tiktok',
  -- id do vídeo NA REDE (não o nosso): âncora da deduplicação entre buscas.
  video_id text not null,
  url text not null,
  autor text,
  autor_seguidores bigint,
  legenda text,
  likes bigint not null default 0,
  views bigint,
  comentarios bigint,
  compartilhamentos bigint,
  publicado_em timestamptz,
  duracao_seg numeric,
  thumb_url text,
  -- URL direta do mp4 na CDN da rede: EXPIRA. Serve pro player e pro
  -- download sob demanda; se falhar, cai pro link do post.
  video_url text,
  hashtags text[],
  -- Score de viralidade (engajamento amortecido pela idade) — ordenação padrão.
  score numeric not null default 0,
  -- De onde veio: o termo buscado e a execução do Apify que trouxe.
  termo_busca text,
  origem_run_id text,
  -- Fluxo de download: só o marcado desce pro R2.
  selecionado boolean not null default false,
  selecionado_por uuid references public.profiles(id) on delete set null,
  selecionado_em timestamptz,
  download_status text not null default 'nao_baixado',
  r2_key text,
  download_erro text,
  criado_em timestamptz not null default now()
);

-- Mesmo vídeo achado em duas buscas = uma linha só (o import faz upsert).
create unique index if not exists viral_videos_unico
  on public.viral_videos (plataforma, video_id);

-- Ordenações da tela: os mais quentes primeiro, e a fila de download.
create index if not exists viral_videos_score_idx
  on public.viral_videos (score desc, likes desc);
create index if not exists viral_videos_selecionados_idx
  on public.viral_videos (selecionado, download_status)
  where selecionado = true;

alter table public.viral_videos enable row level security;
-- Sem policies: acesso só via service role (rotas autenticadas), igual às
-- outras tabelas do app.
