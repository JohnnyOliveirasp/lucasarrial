-- 89 — onboarding_runs: o que o robô da planilha tentou, e por que falhou.
--
-- 22/08 (Johnny): "não é ler a nota, é entender o porquê no SISTEMA".
-- Até hoje a rota /api/v1/onboarding/import não gravava NADA: devolvia o
-- motivo pro Apps Script, que escrevia numa nota de célula truncada em ~300
-- caracteres. Investigar uma linha em Erro significava garimpar a nota,
-- baixar o arquivo do aluno na mão e adivinhar. Agora vira consulta SQL.
--
-- Uma linha por POST (cada tentativa de uma linha da planilha).

create table if not exists public.onboarding_runs (
  id             uuid primary key default gen_random_uuid(),
  criado_em      timestamptz not null default now(),

  -- de onde veio
  linha          integer,                -- linha da planilha SGP - Onboarding
  email          text not null,
  user_id        uuid,                   -- conta resolvida (criada ou existente)
  conta_criada   boolean not null default false,

  -- resultado geral
  ok             boolean not null default false,
  etapa_falha    text,                   -- 'imagens' | 'audio' | 'conta' | null
  motivo         text,                   -- motivo curto (o mesmo que vai pra nota)
  erro_detalhe   text,                   -- stack/mensagem inteira, SEM truncar

  -- o que foi tentado
  imagens_pedidas  integer not null default 0,
  audios_pedidos   integer not null default 0,
  images_link      text,
  audios_link      text,

  -- o que aconteceu com cada arquivo: [{id, tamanho_bytes, tipo_declarado,
  -- tipo_real, resultado: 'importado'|'ja_existia'|'ignorado'|'falhou', motivo}]
  -- É aqui que mora a resposta: "o Drive DECLAROU octet-stream mas o arquivo
  -- ERA HEIC", "tinha 8.944MB contra teto de 419MB".
  arquivos       jsonb not null default '[]'::jsonb,

  -- espelho do que a rota devolveu (images/avatars/audios), pra conferir
  -- sem precisar reprocessar
  resultado      jsonb not null default '{}'::jsonb
);

create index if not exists onboarding_runs_linha_idx    on public.onboarding_runs (linha, criado_em desc);
create index if not exists onboarding_runs_email_idx    on public.onboarding_runs (lower(email), criado_em desc);
create index if not exists onboarding_runs_falha_idx    on public.onboarding_runs (etapa_falha, criado_em desc) where ok = false;
create index if not exists onboarding_runs_criado_idx   on public.onboarding_runs (criado_em desc);

comment on table public.onboarding_runs is
  'Uma linha por tentativa do robô da planilha SGP - Onboarding. Serve pra responder "por que esta linha deu erro" sem depender da nota da célula.';

-- Só o service_role escreve/lê (a rota usa admin). Sem acesso de aluno.
alter table public.onboarding_runs enable row level security;
