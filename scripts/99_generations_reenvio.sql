-- 99 — reenvio automático da geração que estourou o teto (#15, 28/08).
-- O chamado reincidiu em 28/08 18:16 com a prova mais limpa que já tivemos:
-- o MESMO aluno, com o MESMO texto (208 e 209 chars), estourou 491s e, ao
-- refazer à mão 9 minutos depois, terminou em 89s. Não é régua nem tamanho de
-- texto — é worker travado, e refazer resolve. Estas duas colunas permitem que
-- o refazer seja automático:
--   request_params  — o input exato daquela geração, MENOS as URLs assinadas
--                     (elas expiram; são refeitas no reenvio a partir das
--                     chaves já guardadas em audio_path/reference_audio_path).
--                     Sem isto o reenvio perderia a escolha de ritmo da tela
--                     (speed) e os overrides de pacing da voz.
--   request_attempts— trava do reenvio: é o claim atômico que garante UMA
--                     tentativa extra, mesmo com webhook e poll correndo
--                     juntos. 1 = envio original.
alter table public.generations add column if not exists request_params jsonb;
alter table public.generations
  add column if not exists request_attempts smallint not null default 1;
comment on column public.generations.request_params is
  'Input mandado ao worker sem as URLs assinadas, p/ reenvio idêntico. Mig 99, #15.';
comment on column public.generations.request_attempts is
  'Envios ao RunPod desta geração (1 = original). Claim atômico do reenvio. Mig 99, #15.';
