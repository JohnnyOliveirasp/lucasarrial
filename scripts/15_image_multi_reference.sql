-- ============================================================================
-- 15_image_multi_reference.sql
-- Permite MÚLTIPLAS fotos de referência por geração de imagem (gpt-image-2
-- aceita input_urls com varias imagens). Guardamos todas as keys pra exibir e
-- pra limpar do R2 no delete. `input_image_path` (singular) continua = a 1a foto
-- (back-compat / not null).
-- ============================================================================
alter table public.image_generations
  add column if not exists input_image_paths text[];
