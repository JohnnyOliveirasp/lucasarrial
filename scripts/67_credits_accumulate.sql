-- 67 — Créditos passam a ACUMULAR (decisão do Johnny, 10/08).
--
-- Regra nova, na palavra dele: "não pagou mais, os créditos permanecem na
-- plataforma até usar" e "renovou, os créditos somam e não apagam".
--
-- O QUE MUDA
-- Antes: `credits_subscription = p_amount` — atribuição. Toda renovação APAGAVA
-- o que a pessoa não tinha gastado e repunha 100.000. Quem pagava todo mês e
-- usava pouco ficava eternamente em 100k; 35 alunos perderam 2.037.848 créditos
-- assim (as outras 849 recargas repuseram saldo baixo, então beneficiaram).
-- Agora: soma. O que sobrou continua lá e o lote novo entra por cima.
--
-- POR QUE A IDEMPOTÊNCIA VEM JUNTO, E NÃO DEPOIS
-- A Hotmart avisa a MESMA transação duas vezes: PURCHASE_APPROVED (o dinheiro
-- entrou, na hora) e PURCHASE_COMPLETE (~7,8 dias depois, quando vence a
-- garantia). O webhook credita nos dois. Com reset isso era inofensivo — dois
-- lotes de 100.000 davam 100.000. Com soma viraria 200.000 por R$97.
-- Medido em 10/08: 361 dos 512 pagamentos (71%) geraram grant repetido;
-- a soma sem esta trava dobraria 63.600.000 créditos.
-- Por isso: um ref_id credita UMA vez. O segundo aviso vira no-op e devolve o
-- saldo atual, sem erro (o webhook não deve falhar por isso).
--
-- O QUE NÃO MUDA
-- - Crédito nunca expirou por tempo e continua não expirando.
-- - Pagamento não confirmado (Pix só gerado) continua sem creditar nada: o
--   guard de PAID_STATUSES no webhook é anterior a esta função.
-- - Nada é aplicado retroativamente. Vale do próximo pagamento em diante.
--
-- TETO DE ACÚMULO: 300.000 (decisão do Johnny, 10/08)
-- Crédito é GPU a pagar depois, então o acúmulo não pode ser infinito. A base
-- diz por que o teto é necessário e por que 300k é o número certo: a MEDIANA de
-- consumo é 25.385/mês contra 100.000 recebidos, ou seja, metade dos alunos
-- guarda ~75k todo mês e nunca vai gastar. Sem teto, 100 assinantes desse
-- perfil viram 90 milhões de créditos de dívida em um ano.
-- 300.000 = 3 mensalidades e ~12 meses de consumo do aluno mediano: quem some
-- por um trimestre inteiro não perde nada.
-- O teto age só sobre o bolsão da assinatura (credits_subscription). Pacote
-- avulso comprado (credits_extra) é dinheiro à parte e NÃO entra no limite.
--
-- AINDA EM ABERTO (decisão do Johnny, fora desta migração)
-- - PURCHASE_REFUNDED / PROTEST hoje revogam o acesso mas NÃO retiram crédito.
--   Com crédito na hora no APPROVED, essa ponta fica mais exposta.
-- - Os 35 alunos que já perderam crédito no reset antigo: decisão de 10/08 é
--   NÃO mexer ("deixa eles reclamarem e aí veremos").

create or replace function public.grant_subscription_credits(
  p_user_id uuid,
  p_amount int,
  p_ref_type text default null,
  p_ref_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_ja_creditou boolean;
  v_antes int;
  v_depois int;
  v_creditado int;
  v_teto constant int := 300000; -- 3 mensalidades; só limita o bolsão da assinatura
begin
  select credits_subscription into v_antes from public.profiles where id = p_user_id;
  if v_antes is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  -- Um pagamento, um crédito. O aviso repetido da mesma transação não credita
  -- de novo. Sem ref_id não dá pra saber se é repetição — segue o fluxo normal.
  if p_ref_id is not null then
    select exists (
      select 1 from public.credit_transactions
       where user_id = p_user_id
         and kind = 'subscription_grant'
         and ref_id = p_ref_id
    ) into v_ja_creditou;

    if v_ja_creditou then
      select credits_subscription + credits_extra into v_balance
        from public.profiles where id = p_user_id;
      return jsonb_build_object('ok', true, 'balance', coalesce(v_balance, 0), 'duplicate', true);
    end if;
  end if;

  -- ACUMULA (era atribuição), respeitando o teto. `greatest` garante que a
  -- recarga NUNCA reduz o saldo de quem já estiver acima do teto por crédito
  -- antigo: o piso é o que a pessoa já tem, então o pior caso é somar zero.
  update public.profiles
     set credits_subscription = greatest(
           credits_subscription,
           least(credits_subscription + p_amount, v_teto)
         ),
         updated_at = now()
   where id = p_user_id
  returning credits_subscription into v_depois;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  select credits_subscription + credits_extra into v_balance
    from public.profiles where id = p_user_id;

  -- O extrato registra o que ENTROU de fato, não os 100.000 nominais: se o teto
  -- cortou, o aluno precisa ver o valor real na tela de créditos.
  v_creditado := v_depois - v_antes;

  insert into public.credit_transactions(user_id, kind, amount, balance_after, ref_type, ref_id, note)
    values (
      p_user_id, 'subscription_grant', v_creditado, v_balance, p_ref_type, p_ref_id,
      case when v_creditado < p_amount
        then 'recarga do ciclo (limitada pelo teto de ' || v_teto || ')'
        else 'recarga do ciclo' end
    );

  return jsonb_build_object('ok', true, 'balance', v_balance, 'credited', v_creditado);
end;
$$;

-- Índice de apoio para o EXISTS acima (busca por user_id + ref_id).
-- NÃO é único de propósito: a base já carrega 636 grants repetidos do tempo do
-- reset (quando repetir era inofensivo), e um índice único não seria criado.
-- A trava real é o EXISTS — os dois avisos da mesma transação chegam com ~7,8
-- dias de diferença, então não há corrida a proteger.
create index if not exists credit_transactions_grant_ref_idx
  on public.credit_transactions (user_id, ref_id)
  where kind = 'subscription_grant' and ref_id is not null;
