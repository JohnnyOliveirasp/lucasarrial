-- 37: Vídeo Estúdio F5 — QA automático + cobrança por cena.
--   qa_retried: o still já foi regerado 1x por texto quebrado (QA visual)?
--   debit_ref:  referência do débito da tentativa paga (taskId do Kie no
--               despacho) — chave do estorno automático em falha.
-- Aplicada via MCP em 2026-07-10 (projeto yizerthyrgrajivlotcw).
alter table public.studio_scenes
  add column if not exists qa_retried boolean not null default false,
  add column if not exists debit_ref text;
