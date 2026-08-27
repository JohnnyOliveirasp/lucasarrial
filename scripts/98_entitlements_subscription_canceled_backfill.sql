-- 98 — Backfill do incidente #161: entitlements gravados como `active` cuja
--      assinatura já estava CANCELED/EXPIRED do lado da Hotmart.
--
-- ⚠️ NÃO APLICADA. Correção EM MASSA em tabela de pagamento → aval do Johnny.
--
-- CAUSA (corrigida no código no mesmo PR): o PURCHASE_COMPLETE chega ~7,8 dias
-- depois do APPROVED; se o aluno cancelou no meio, vem com
-- data.subscription.status = CANCELED e, ainda assim, grantAccess regravava
-- status='active'. Não existe SUBSCRIPTION_CANCELLATION para esses casos.
--
-- O QUE ESTE SCRIPT FAZ: só muda `status` ('active' → 'canceled'/'expired').
-- NÃO toca em access_until (o período pago fica), NÃO toca em crédito, NÃO
-- toca em profiles. Pela regra 9 (entitlements.ts:152-153) "canceled com
-- access_until futuro CONTINUA com acesso", então os 17 com data futura não
-- perdem nada; os 173 já expirados só passam a contar certo no churn.
--
-- MEDIDO 27/08 (Frank, #161): 190 linhas active+CANCELED. O Cassio
-- (5aaec7e9…) já foi corrigido à mão → o script pega as 189 restantes.
--
-- ENSAIO (rodar antes, conferir o número):
--   select count(*) from public.entitlements
--    where provider='hotmart' and status='active'
--      and upper(raw_event->'subscription'->>'status') in ('CANCELED','CANCELLED','EXPIRED','INACTIVE');
--
-- REVERSÃO: não há como distinguir depois quais eram 'active' por este bug e
-- quais por outro; por isso o script grava a lista antes de mudar.

begin;

create table if not exists public._backfill_161_entitlements as
select id, status as status_antes, access_until, updated_at, now() as backfill_at
  from public.entitlements
 where provider = 'hotmart'
   and status = 'active'
   and upper(raw_event->'subscription'->>'status') in ('CANCELED','CANCELLED','EXPIRED','INACTIVE');

update public.entitlements e
   set status = case upper(e.raw_event->'subscription'->>'status')
                  when 'EXPIRED' then 'expired'
                  else 'canceled'
                end,
       updated_at = now()
 where e.provider = 'hotmart'
   and e.status = 'active'
   and upper(e.raw_event->'subscription'->>'status') in ('CANCELED','CANCELLED','EXPIRED','INACTIVE');

-- conferência: tem que bater com o ensaio (189 esperado em 27/08)
select count(*) as corrigidos from public._backfill_161_entitlements;

commit;

-- Depois: recomputar o acesso dos afetados COM access_until futuro (17), para
-- profiles refletir "canceled com período pago" e não "active":
--   node _frank/ferramentas/backfill_acesso_pago.cjs  (ensaio primeiro)
