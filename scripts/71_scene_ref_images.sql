-- 71: C4 do Cenas 2.0 (13/08) — fotos de referência da PESSOA numa cena.
-- Cena gerada com a pessoa (opt-in do aluno na estação Cenas) guarda as
-- chaves R2 das fotos usadas: o retry de QA e o fallback de animação
-- redespacham com as mesmas referências. Cena com ref_image_paths é
-- SEMPRE shared=false (nunca entra no banco global).
alter table public.studio_scenes
  add column if not exists ref_image_paths jsonb;
