-- 55: fallback Seedream 5.0 Pro no gerador de imagens. kie_model registra o
-- modelo que ATENDEU a geração (gpt titular; seedream só por contingência do
-- disjuntor — nunca escolha do aluno). Default cobre o histórico (tudo GPT).
-- (Espelho da migration MCP 20260729* image_kie_model.)
alter table public.image_generations
  add column if not exists kie_model text not null default 'gpt-image-2-image-to-image';
