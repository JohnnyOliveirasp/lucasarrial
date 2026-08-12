-- 70: referência FIXA do estúdio de imagem definida no servidor.
-- Onboarding via planilha (12/08): a foto importada do Drive vira a imagem de
-- referência do clone do aluno. O estúdio (image-studio.tsx) usa esta coluna
-- como fallback quando o localStorage está vazio (1º login) — endpoint
-- GET /api/v1/images/ref-default.
alter table public.profiles
  add column if not exists image_ref_key text;

comment on column public.profiles.image_ref_key is
  'Chave R2 da referência fixa do estúdio de imagem (onboarding via planilha define; aluno sobrescreve ao trocar a referência no estúdio... hoje só leitura via ref-default).';
