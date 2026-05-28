-- ============================================================================
-- 08: alpha do LoRA POR VOZ
-- O alpha tem que casar treino<->inferencia. O default novo voltou para 16,
-- igual ao VoiceLoraStudio. Guardamos o alpha usado em cada voz pra inferir
-- com o valor certo. Backfill: tudo que nao tiver valor salvo fica em 16.
-- Idempotente.
-- ============================================================================
alter table public.voices add column if not exists lora_alpha int;
update public.voices set lora_alpha = 16 where lora_alpha is null;
