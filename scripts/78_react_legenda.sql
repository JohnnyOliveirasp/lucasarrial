-- 78: estilo de legenda do Video React (pedido do Johnny 14/08).
--
-- "a legenda eu preciso escolher da mesma forma que está no editor de vídeo":
-- os ids são os MESMOS SUBTITLE_PRESETS do editor (hormozi, beast, karaoke…),
-- então o que muda aqui é só onde a escolha fica guardada. 'none' = vídeo
-- limpo, sem texto queimado.
alter table public.react_jobs
  add column if not exists legenda_estilo text,
  add column if not exists legenda_posicao text,
  add column if not exists legenda_tamanho text;
