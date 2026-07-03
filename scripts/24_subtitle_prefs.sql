-- 24: preferências de legenda do vídeo final (Fase 5).
-- subtitle_style (migration 23) guarda o PRESET (agora 10 opções);
-- aqui entram posição e tamanho escolhidos pelo usuário.
-- NULL = usa o padrão do preset (ex.: "one_word" fica no centro).

alter table public.video_projects
  add column if not exists subtitle_position text
    check (subtitle_position in ('bottom', 'center', 'top')),
  add column if not exists subtitle_size text
    check (subtitle_size in ('normal', 'large'));
