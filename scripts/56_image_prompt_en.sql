-- 56: prompt do gerador de imagens em pt-BR pro aluno (pedido Johnny 29/07).
-- `prompt` passa a ser o texto que o aluno vê/edita (pt); `prompt_en` é a
-- tradução que vai pro modelo (gpt/seedream) — inclusive no retry. Rows
-- antigas ficam com prompt_en null (prompt já era inglês; retry usa fallback).
-- (Espelho da migration MCP 20260729* image_prompt_en.)
alter table public.image_generations
  add column if not exists prompt_en text;
