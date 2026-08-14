-- 73: "descartado" — memória do que o Johnny já rejeitou.
--
-- Antes o apagar era DELETE de verdade: o vídeo sumia, mas voltava inteiro na
-- próxima busca do mesmo nicho, porque nada lembrava que ele tinha sido
-- rejeitado. Agora é descarte lógico — some da tela e NÃO volta.
--
-- Como o import faz upsert só das colunas que ele manda (e ele não manda
-- `descartado`), reimportar atualiza as métricas e preserva o descarte.
alter table public.viral_videos
  add column if not exists descartado boolean not null default false,
  add column if not exists descartado_em timestamptz;

-- A listagem sempre filtra por descartado = false.
create index if not exists viral_videos_visiveis_idx
  on public.viral_videos (descartado, score desc);
