-- ============================================================================
-- 82 — telemetria do RunPod na falha de geração (incidente d3d8d1b2)
--
-- "Tempo de execução estourado" reincide desde 21/07 (15 ocorrências) e nunca
-- fecha porque não guardamos o que o job fez: o status no RunPod expira ~30min
-- depois do fim (_frank/02_ACESSOS.md) e toda investigação posterior bate em
-- 404. Já foi DESCARTADO por medição: não é tamanho de texto (59 chars
-- estourou 20min), não é capacidade (9 de 15 timeouts com zero geração em
-- voo), não é endpoint específico. Sobra a hipótese NÃO PROVADA de cold start
-- / worker que morre sem rodar.
--
-- Estas duas colunas separam o que elapsed_seconds não separa:
--   delay_seconds     = delayTime do RunPod  → quanto o job ESPEROU NA FILA
--   execution_seconds = executionTime        → quanto RODOU de fato
-- Preenchidas NO MOMENTO da falha (webhook e poll — o status ainda está vivo),
-- por UPDATE separado do que marca failed: se esta migration ainda não tiver
-- sido aplicada, o UPDATE de telemetria falha sozinho e o estorno do aluno
-- segue intacto. Na próxima ocorrência: delay alto + execution baixo/nulo =
-- cold start / nunca rodou; delay baixo + execution no teto = hang do worker.
--
-- ⚠️ ESPELHO — NÃO APLICADO. DDL aguardando aprovação do Johnny.
-- ============================================================================

alter table public.generations
  add column if not exists delay_seconds     double precision,
  add column if not exists execution_seconds double precision;

comment on column public.generations.delay_seconds is
  'delayTime do RunPod em segundos (espera na fila antes de rodar). Gravado na falha — incidente d3d8d1b2.';
comment on column public.generations.execution_seconds is
  'executionTime do RunPod em segundos (tempo rodando de fato). Gravado na falha — incidente d3d8d1b2.';
