-- 88 — DÉBITO DO ONBOARDING PODE DEIXAR O ALUNO NEGATIVO
--
-- POR QUE (decisão do Johnny, 21/08): o onboarding pela planilha cobra o treino
-- da voz (10.000) e os avatares (525 cada). Muita linha chega ANTES de o aluno
-- assinar — ele ainda não tem crédito nenhum. Pela regra geral ("crédito é o
-- único gate") nada roda, a voz fica `awaiting_training` e a linha trava. O
-- Johnny decidiu que no onboarding a gente FAZ MESMO ASSIM: o aluno fica com
-- saldo negativo e, quando assinar, os 100k da assinatura já chegam com esse
-- débito descontado. É paliativo pra desafogar a fila; vale também para as
-- linhas hoje em "Erro" que ainda não foram feitas.
--
-- ⚠️ SÓ O ONBOARDING. A `debit_credits` normal NÃO MUDA UMA VÍRGULA — continua
-- recusando com `insufficient`. Esta é uma função NOVA, com nome próprio, que
-- só `lib/onboarding/treino.ts` e `lib/onboarding/avatares.ts` chamam. Se o
-- gate caísse na função geral, voltaria o caso do Stripe em modo de teste:
-- gente usando de graça sem ninguém ver. Separar por FUNÇÃO (e não por flag)
-- é o que torna impossível ligar o negativo em outro lugar sem querer.
--
-- COMO O NEGATIVO SE PAGA SOZINHO: `grant_subscription_credits` faz
-- `credits_subscription = p_amount` (reset) e `credits_extra` fica intacto. Então
-- o débito do onboarding vai TODO para `credits_extra` (que pode ficar negativo)
-- e NUNCA para `credits_subscription`. Na assinatura: subscription vira 100.000,
-- extra continua -10.525, total = 89.475. O desconto acontece sem código novo
-- em lugar nenhum. Se o débito fosse na subscription, o reset apagaria a dívida.
--
-- O HISTÓRICO REGISTRA IGUAL: mesma `credit_transactions`, `balance_after` pode
-- ser negativo (a coluna é `int`, sem CHECK — conferido na 13). Estorno automático
-- de treino falho (`addExtraCredits` no finalize-training) credita em `extra`,
-- exatamente onde o débito caiu. Nada de idempotência muda.
--
-- REVERSÍVEL: `drop function public.debit_credits_onboarding;` e voltar os dois
-- arquivos do onboarding a chamar `debit_credits`. Saldos já negativos ficam —
-- são dívidas reais de serviço entregue.

create or replace function public.debit_credits_onboarding(
  p_user_id  uuid,
  p_amount   int,
  p_kind     text,
  p_ref_type text default null,
  p_ref_id   text default null,
  p_note     text default null
) returns jsonb
language plpgsql
as $$
declare
  v_sub int; v_extra int; v_balance int;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive (got %)', p_amount;
  end if;

  select credits_subscription, credits_extra into v_sub, v_extra
    from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  -- Sem a trava `if v_total < p_amount then insufficient` de propósito: aqui
  -- o negativo é a regra. Tudo sai de `credits_extra` (ver cabeçalho).
  v_balance := coalesce(v_sub,0) + coalesce(v_extra,0) - p_amount;

  update public.profiles
     set credits_extra = coalesce(credits_extra,0) - p_amount,
         updated_at = now()
   where id = p_user_id;

  insert into public.credit_transactions(user_id, kind, amount, balance_after, ref_type, ref_id, note)
    values (p_user_id, p_kind, -p_amount, v_balance, p_ref_type, p_ref_id,
            coalesce(p_note, '') || ' [onboarding: pode ficar negativo]');

  return jsonb_build_object('ok', true, 'balance', v_balance,
    'from_subscription', 0, 'from_extra', p_amount,
    'went_negative', v_balance < 0);
end;
$$;

comment on function public.debit_credits_onboarding is
  'Débito EXCLUSIVO do onboarding pela planilha: não tem gate de saldo, pode deixar o aluno negativo (só em credits_extra, pra sobreviver ao reset da assinatura). NUNCA usar fora de lib/onboarding — o resto do sistema mantém debit_credits com a trava.';
