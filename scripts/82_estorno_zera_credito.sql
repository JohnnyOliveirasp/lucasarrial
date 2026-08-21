-- ============================================================================
-- 82 — estorno zera o crédito de mensalidade
-- Regra do Johnny 18/08 ("ela cancela tudo porque ela pediu o estorno da
-- compra", _frank/ordens/2026-08-18_regra_do_trial.md + ordem do dia):
--
--   pagou e CANCELOU      → MANTÉM o crédito (o dinheiro ficou com a gente)
--   trial e saiu          → zera no dia 10 (mig 80/81, expire_trial_credits)
--   pagou e foi ESTORNADO → zera credits_subscription  ← ESTA MIGRATION
--
-- Buraco que ela fecha: revokeAccess (entitlements.ts) só trocava o status do
-- entitlement; a pessoa recebia o dinheiro de volta e seguia com os créditos —
-- e como o portão de clone/imagem é o crédito, seguia gerando de graça
-- (3 contas, ~396 mil créditos, zeradas na mão em 18/08).
--
-- credits_extra NUNCA é tocado: nesse grupo ele vem de reembolso por geração
-- que falhou, cortesia e bônus de desculpa — dívida NOSSA com o aluno
-- (caso real: contatoabreu25, 8.112 de 5 video_clone_refund, ficam).
--
-- Chamada pelo webhook da Hotmart (route.ts) nos eventos PURCHASE_REFUNDED,
-- PURCHASE_CHARGEBACK e PURCHASE_PROTEST — e SÓ neles. Cancelamento e
-- expiração passam longe desta função por construção (o webhook decide).
--
-- Idempotência: o próprio lançamento no livro-razão é o marcador — chave
-- (user_id, ref_type='estorno', ref_id=transação estornada). O mesmo evento
-- reentregue pela Hotmart não lança duas vezes; e se a pessoa comprar DE NOVO
-- depois do estorno, um reprocessamento do evento antigo não apaga o crédito
-- novo (o marcador da transação antiga já existe → no-op). O marcador entra
-- MESMO quando o saldo já era 0, senão a janela entre retry do webhook e uma
-- recompra zeraria crédito que nasceu depois do estorno.
--
-- ⚠️ ESPELHO — NÃO APLICADO. DDL aguardando aprovação do Johnny (regra 21).
-- ============================================================================

-- Sem security definer: só toca public.profiles e public.credit_transactions,
-- que o service_role já alcança (mesmo padrão de debit_credits, mig 13).
-- auth.users não entra aqui — o user_id chega resolvido pelo webhook.
create or replace function public.zero_subscription_credits_on_refund(
  p_user_id    uuid,
  p_ref_id     text,              -- transação estornada (chave de idempotência)
  p_event_type text default null  -- PURCHASE_REFUNDED | ..CHARGEBACK | ..PROTEST (só pra nota)
) returns jsonb
language plpgsql
as $$
declare
  v_sub int; v_extra int;
begin
  if p_ref_id is null or p_ref_id = '' then
    raise exception 'p_ref_id (transacao do estorno) e obrigatorio';
  end if;

  -- já lançado pra ESTA transação → reentrega/reprocessamento é no-op
  if exists (
    select 1 from public.credit_transactions
     where user_id = p_user_id and ref_type = 'estorno' and ref_id = p_ref_id
  ) then
    return jsonb_build_object('ok', true, 'already_processed', true, 'debited', 0);
  end if;

  select credits_subscription, credits_extra into v_sub, v_extra
    from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  v_sub   := greatest(coalesce(v_sub, 0), 0);
  v_extra := coalesce(v_extra, 0);

  if v_sub > 0 then
    update public.profiles
       set credits_subscription = 0, updated_at = now()
     where id = p_user_id;
  end if;

  -- lançamento auditável + marcador de idempotência (entra mesmo com saldo 0)
  insert into public.credit_transactions(user_id, kind, amount, balance_after, ref_type, ref_id, note)
    values (p_user_id, 'adjustment', -v_sub, v_extra, 'estorno', p_ref_id,
            'dinheiro devolvido (' || coalesce(p_event_type, 'estorno') || ') em '
            || to_char(now(), 'YYYY-MM-DD')
            || '; credito de mensalidade zerado (-' || v_sub
            || '); credits_extra preservado (' || v_extra || ')');

  return jsonb_build_object('ok', true, 'already_processed', false,
                            'debited', v_sub, 'balance', v_extra);
end;
$$;

-- mesmo padrão de ACL das mig 80/81: fora do alcance de anon/authenticated;
-- o service_role executa (grant explícito pra ficar auto-contido).
revoke all on function public.zero_subscription_credits_on_refund(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.zero_subscription_credits_on_refund(uuid, text, text)
  to service_role;
