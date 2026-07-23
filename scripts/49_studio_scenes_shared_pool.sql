-- 49: Estúdio F3 — acervo COMPARTILHADO de b-roll (curadoria admin).
-- shared=true: cena genérica (sem rosto/produto/marca) entra no banco de
-- TODOS os alunos pro reuso a custo zero. Só admin marca (curadoria manual;
-- consentimento do aluno entra quando abrir pra não-admin).
alter table public.studio_scenes
  add column if not exists shared boolean not null default false;
create index if not exists studio_scenes_shared_idx
  on public.studio_scenes (shared, status, kind) where shared = true;
