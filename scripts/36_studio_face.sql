-- 36: Vídeo Estúdio F4 — rosto do aluno (InfiniteTalk) nos pontos-âncora.
-- Regra C3 do export: o hook abre com uma PESSOA visível; fechamento idem.
-- face_segments = [{role:'hook'|'close', sentence, start, end, audio_path,
--                   video_path, job_id, status}]
-- APLICADA via MCP Supabase em 2026-07-10 (migration studio_face).
alter table public.studio_projects
  add column if not exists face_status text not null default 'idle'
    check (face_status in ('idle','processing','ready','failed')),
  add column if not exists face_image_path text,
  add column if not exists face_segments jsonb;
