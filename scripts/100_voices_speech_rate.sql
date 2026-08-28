-- 100 (escrita 25/08 como '96', renumerada 28/08 porque a 96 da main e' a cura da transcricao).
-- JA APLICADA no banco em 25/08 01:15 UTC (as duas colunas existem). Fica pelo registro.
-- velocidade natural de fala da pessoa, medida no treino.
-- Caso Ellen (draellenca): o clone falava o mesmo texto em metade do tempo dela.
-- O VoxCPM copia o ritmo da referencia; agora o treino mede a mediana
-- (palavras/s das candidatas) e escolhe a referencia nesse ritmo.
alter table public.voices
  add column if not exists speech_rate_wps numeric(5,2),      -- mediana da pessoa
  add column if not exists reference_rate_wps numeric(5,2);   -- da referencia escolhida
comment on column public.voices.speech_rate_wps is 'palavras/s, mediana das janelas do audio de treino (25/08)';
comment on column public.voices.reference_rate_wps is 'palavras/s da referencia escolhida (25/08)';
