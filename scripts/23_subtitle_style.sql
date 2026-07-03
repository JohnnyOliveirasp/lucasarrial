-- ============================================================================
-- 23_subtitle_style.sql
-- Fase 5: estilo de legenda escolhido pelo usuário na montagem do vídeo final.
-- Valores: 'karaoke' (amarelo palavra-a-palavra) | 'clean' (branco limpo) |
-- 'boxed' (faixa preta). O worker lê isto pra montar o .ass. Idempotente.
-- ============================================================================

alter table public.video_projects
  add column if not exists subtitle_style text not null default 'karaoke';
