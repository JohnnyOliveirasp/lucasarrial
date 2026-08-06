-- 62: cache da tradução es do prompt de imagem (exibição no idioma da página;
-- pt = coluna prompt, en = prompt_en de mig 56, es = lazy aqui).
alter table public.image_generations add column prompt_es text;
