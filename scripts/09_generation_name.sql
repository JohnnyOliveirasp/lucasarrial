-- ============================================================================
-- 09 — generations.name (nome editavel do audio gerado)
-- O usuario pode renomear cada audio no historico. Nullable: quando vazio,
-- o front exibe o nome da voz / texto como fallback (comportamento antigo).
-- Idempotente.
-- ============================================================================

alter table public.generations
  add column if not exists name text;

comment on column public.generations.name is
  'Nome amigavel definido pelo usuario p/ o audio gerado. Null = usar fallback (nome da voz).';
