-- 54: retry automático de geração de imagem (caso Kie sobrecarregado 28-29/07:
-- onda de "Internal Error" + "Image fetch failed" — 24 falhas cobradas sem
-- estorno desde 01/07). retry_count trava o resubmit automático em 1x
-- (claim condicional 0→1 no sync). (Espelho da migration MCP 20260729*.)
alter table public.image_generations
  add column if not exists retry_count int not null default 0;
