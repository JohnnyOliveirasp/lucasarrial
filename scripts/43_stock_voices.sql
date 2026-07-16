-- 43: Vozes Prontas (catálogo de estoque) — F0 fundação.
-- Vozes treinadas pela FastCloner a partir de acervos CC-BY (CML-TTS pt/es,
-- LibriTTS-R en), donas = conta de sistema. Alunos podem LER (aparecem no
-- seletor de geração), nunca alterar/apagar (a policy ALL de dono continua
-- valendo só pro próprio user_id; estoque não tem policy de escrita).

alter table voices add column if not exists is_stock boolean not null default false;

create index if not exists voices_stock_idx on voices (is_stock) where is_stock;

create policy voices_stock_read on voices
  for select to authenticated
  using (is_stock = true);
