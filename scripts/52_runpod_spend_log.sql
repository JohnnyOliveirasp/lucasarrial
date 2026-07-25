-- 52: leituras periódicas do saldo REAL do RunPod (clientBalance + spend/h).
-- Gravadas de hora em hora pelo sweeper (/api/v1/agent/sweep-clones). O /admin
-- usa a QUEDA de saldo entre leituras como custo real de GPU no lucro
-- (recarga = saldo sobe = ignorado). Pedido Johnny 25/07: cartão do Lucas
-- ($100 + $100) não aparecia em lugar nenhum. (Espelho da migration MCP
-- 20260725* runpod_spend_log.)
create table if not exists runpod_spend_log (
  at timestamptz primary key default now(),
  balance_usd numeric not null,
  spend_per_hr_usd numeric
);
alter table runpod_spend_log enable row level security;
