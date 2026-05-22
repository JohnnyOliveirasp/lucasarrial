-- ============================================================================
-- 05: referência opcional na geração
-- Com a LoRA, a referência deixou de ser obrigatória (gera só com a LoRA).
-- reference_audio_path / reference_transcript passam a aceitar NULL.
-- Idempotente.
-- ============================================================================
alter table public.generations alter column reference_audio_path drop not null;
alter table public.generations alter column reference_transcript  drop not null;
