-- ============================================================================
-- 08: alpha do LoRA POR VOZ
-- O alpha tem que casar treino<->inferência. Mudamos o default novo p/ 32, mas
-- LoRAs antigas foram treinadas em 16. Guardamos o alpha usado em cada voz pra
-- inferir com o valor certo (32 p/ novas, 16 p/ antigas) — a imagem nova NÃO
-- quebra LoRA antiga. Backfill: tudo que já existe foi treinado em 16.
-- Idempotente.
-- ============================================================================
alter table public.voices add column if not exists lora_alpha int;
update public.voices set lora_alpha = 16 where lora_alpha is null;
