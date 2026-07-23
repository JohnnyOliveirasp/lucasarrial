-- 48: Estúdio F2 — entrada de vídeo (CapCut automático).
-- kind: 'audio' (F0, default) | 'video' (F2). Vídeo bruto sobe pro R2 e o
-- worker devolve o editado; demais colunas (durations, words, report, status)
-- são REUSADAS do fluxo de áudio.
alter table public.studio_projects
  add column if not exists kind text not null default 'audio',
  add column if not exists raw_video_path text,
  add column if not exists edited_video_path text;
