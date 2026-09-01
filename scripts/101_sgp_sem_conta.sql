-- 101 — SGP: o aluno percorre o wizard SEM conta na plataforma.
--
-- 29/08 (Johnny): "este cadastro só acontecerá na plataforma na etapa final,
-- depois da revisão". Antes a tela 1 já criava a conta no Supabase Auth — o
-- aluno virava usuário da plataforma antes de entregar qualquer material.
--
-- Agora o pedido é identificado por uma SESSÃO (cookie httpOnly), e o
-- `user_id` só é preenchido no "Confirmar e Enviar". O código de 6 dígitos
-- que prova o e-mail passa a ser NOSSO (enviado pelo suporte@), guardado
-- aqui como hash — nunca em texto.

alter table public.sgp_pedidos
  alter column user_id drop not null,
  add column if not exists sessao uuid not null default gen_random_uuid(),
  add column if not exists nome text,
  add column if not exists email text,
  add column if not exists whatsapp text,
  add column if not exists email_verificado_at timestamptz,
  add column if not exists codigo_hash text,
  add column if not exists codigo_expira_em timestamptz,
  add column if not exists codigo_tentativas integer not null default 0,
  add column if not exists conta_existente boolean not null default false;

create unique index if not exists sgp_pedidos_sessao_key on public.sgp_pedidos (sessao);
create index if not exists sgp_pedidos_email_idx on public.sgp_pedidos (lower(email));

comment on column public.sgp_pedidos.sessao is
  'Dono do pedido enquanto não há conta. Vive num cookie httpOnly do navegador.';
comment on column public.sgp_pedidos.codigo_hash is
  'SHA-256 do código de 6 dígitos enviado por e-mail. O código em si nunca é gravado.';
