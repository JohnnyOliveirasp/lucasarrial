-- 94 — telemetria do QA de geração (#52, 24/08).
-- Até aqui cobertura, lacuna e regens só existiam no log do RunPod, que expira
-- ~30 min depois do job: ninguém conseguia medir o padrão sem baixar log.
-- O worker já devolve `qa` no output; agora fica gravado na geração, no
-- sucesso E na falha.
alter table public.generations add column if not exists qa jsonb;
comment on column public.generations.qa is
  'Saída qa do worker (echo/coverage/intrusion/regens/rescue) + campos coverage_* na falha. Mig 94, #52.';
