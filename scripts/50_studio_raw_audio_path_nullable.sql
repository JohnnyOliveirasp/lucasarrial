-- 50: F2 — projeto kind='video' não tem áudio bruto; a mig 48 adicionou as
-- colunas de vídeo mas esqueceu de relaxar o NOT NULL (bug pego pelo Lucas
-- no 1º teste real: "Failed to create studio project"). (Espelho da
-- migration MCP 20260724144837 studio_raw_audio_path_nullable.)
alter table public.studio_projects alter column raw_audio_path drop not null;
