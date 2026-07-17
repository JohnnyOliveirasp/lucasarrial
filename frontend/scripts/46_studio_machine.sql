-- 46: Máquina de Edição Automática (modo piloto-automático do Vídeo Estúdio).
-- auto_pilot: projeto avança sozinho (tts -> tts_prepare -> cenas -> montagem).
ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS auto_pilot boolean NOT NULL DEFAULT false;
ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS script_text text;
ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS machine_voice_id uuid;
ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS machine_step text;
ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS machine_music_key text;
ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS machine_job_id text;
-- Variações por troca de legenda (E4)
ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS variants_job_id text;
ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS variants_status text;
ALTER TABLE studio_projects ADD COLUMN IF NOT EXISTS variant_paths jsonb;
-- Banco de cenas tipado (broll reusa pra sempre; produto é específico)
ALTER TABLE studio_scenes ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'broll';
ALTER TABLE studio_scenes ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
