-- 45: metadados de exibição das Vozes Prontas (catálogo estilo ElevenLabs).
-- description = frase curta no card; accent = override de bandeira (ex.: pt-PT).
ALTER TABLE voices ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE voices ADD COLUMN IF NOT EXISTS accent text;
