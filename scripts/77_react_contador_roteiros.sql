-- 77: quantas vezes ESTA pessoa já mandou o Gemini assistir ESTE vídeo.
--
-- Cada escrita manda o mp4 INTEIRO pro Gemini (com download e banda). O
-- Johnny apertou o botão 3x testando e viu o buraco: sem contador, dá pra
-- ficar clicando de graça.
--
-- Régua: a 1ª escrita está inclusa na taxa do React (300 cr); da 2ª em
-- diante cobra 50 cr. O contador sobe SÓ quando a escrita dá certo — falha
-- não vira cobrança na tentativa seguinte.
alter table public.viral_user_videos
  add column if not exists roteiros_gerados integer not null default 0;
