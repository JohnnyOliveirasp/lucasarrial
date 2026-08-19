-- 83_video_scenes_image_started_at.sql
--
-- POR QUE ISTO EXISTE (18/08):
-- Uma cena podia ficar "gerando" para sempre. O poll consulta a Kie e engole a
-- falha de propósito (uma cena não pode derrubar as outras), então quando a Kie
-- perde a task ou nunca muda de estado, ninguém desiste: a pessoa fica olhando
-- o spinner e não tem botão, porque a UI só oferece refazer no estado de falha.
-- Caso do Johnny: cena 5 girando há 20 min enquanto as outras 11 ficaram prontas.
--
-- Para desistir na hora certa é preciso saber QUANDO a tentativa começou.
-- `created_at` não serve: é a data em que a cena nasceu, então uma cena antiga
-- que a pessoa mandou refazer agora seria marcada como estourada de imediato.
--
-- SEGURANÇA: puramente ADITIVO. Não altera nem remove coluna existente, não
-- toca em dado. Linha antiga fica NULL e cai no fallback de `created_at`.
--
-- REVERSÃO: ALTER TABLE public.video_scenes DROP COLUMN IF EXISTS image_started_at;

ALTER TABLE public.video_scenes
  ADD COLUMN IF NOT EXISTS image_started_at timestamptz NULL;

COMMENT ON COLUMN public.video_scenes.image_started_at IS
  'Quando a tentativa ATUAL de gerar a imagem comecou (setado no lote e no refazer). Base do teto de espera: passado o teto sem resposta da Kie, a cena vira failed e o botao de refazer aparece. NULL = linha anterior a 18/08.';
