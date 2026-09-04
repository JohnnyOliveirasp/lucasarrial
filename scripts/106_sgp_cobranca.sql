-- 106 — SGP: o time marca "já cobrei" sem apagar o alerta.
--
-- PEDIDO (Lucas, 04/09): o time cobrou a Wallana pelo WhatsApp, mas /admin/sgp
-- continua gritando "parado há 4 dias, cobrar o aluno". Eles precisam registrar
-- que já agiram.
--
-- O QUE ESTA MIGRATION *NÃO* FAZ, DE PROPÓSITO: não existe "resolver" nem
-- "arquivar". A aluna CONTINUA parada (1 de 4 fotos, sem mexer há 4 dias) —
-- esconder a linha sumiria com o alerta, não com o problema, e o problema é
-- uma aluna que pagou. A marca só SILENCIA o alerta por um período; passado o
-- período, a linha volta a alertar sozinha.
--
-- ⚠️ NÃO APLICADA. Quem aplica é o Johnny. O código do painel foi escrito para
-- funcionar com ou sem estas colunas (a tela não quebra e o botão some enquanto
-- a migration não entrar) — ver o fallback em api/v1/admin/sgp/route.ts.

-- ---------------------------------------------------------------------------
-- 1) As duas colunas
-- ---------------------------------------------------------------------------
alter table public.sgp_pedidos
  add column if not exists cobrado_em  timestamptz,
  add column if not exists cobrado_por text;

comment on column public.sgp_pedidos.cobrado_em is
  'Quando alguém do time marcou "já cobrei" no /admin/sgp. Silencia o alerta '
  'por SGP_COBRANCA_SILENCIO_HORAS (48h por padrão) e depois volta a alertar. '
  'NÃO é resolução: o pedido continua parado até o ALUNO mexer.';

comment on column public.sgp_pedidos.cobrado_por is
  'E-mail (ou user_id, quando o e-mail é nulo) de quem clicou. Mesma regra de '
  'autoria de lib/incidents/closure.ts: nunca gravar null, sempre rastreável.';

-- ---------------------------------------------------------------------------
-- 2) O ponto NÃO ÓBVIO desta migration: o gatilho que carimba `atualizado_em`
-- ---------------------------------------------------------------------------
-- `sgp_pedidos_touch` (migration 100) faz `new.atualizado_em = now()` em TODO
-- update, incondicionalmente. E `atualizado_em` é EXATAMENTE o relógio de onde
-- sai o "parado há" do painel (lib/sgp/painel.ts:138).
--
-- Ou seja: sem mexer no gatilho, clicar em "Já cobrei" gravaria cobrado_em E
-- zeraria atualizado_em de quebra. Efeito na tela: a aluna parada há 4 dias
-- viraria "parado há 0min", sairia do vermelho e do contador — e continuaria
-- assim PARA SEMPRE, porque o relógio real teria sido destruído. É exatamente o
-- "botão que some com a linha" que o pedido proíbe, só que pior: silencioso e
-- irreversível. Este é o motivo de a migration existir, e não só um `alter table`.
--
-- O conserto: quando o ÚNICO campo que mudou for a cobrança, o gatilho preserva
-- `atualizado_em`. Qualquer outro update (o aluno mandando foto, o robô mudando
-- status) segue carimbando `now()` — comportamento idêntico ao de hoje.
--
-- A comparação é feita sobre a linha inteira em jsonb menos os três campos em
-- questão: assim ninguém precisa lembrar de atualizar esta função quando uma
-- coluna nova nascer. Na dúvida ele cai no `now()`, que é o comportamento atual.
create or replace function public.sgp_pedidos_touch()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and (new.cobrado_em  is distinct from old.cobrado_em
          or new.cobrado_por is distinct from old.cobrado_por)
     and (to_jsonb(new) - 'cobrado_em' - 'cobrado_por' - 'atualizado_em')
       = (to_jsonb(old) - 'cobrado_em' - 'cobrado_por' - 'atualizado_em')
  then
    -- Cobrança do TIME não é movimentação do PEDIDO. O relógio não anda.
    new.atualizado_em = old.atualizado_em;
    return new;
  end if;

  new.atualizado_em = now();
  return new;
end $$;

-- O gatilho em si não muda (segue `before update ... for each row`), só o corpo
-- da função. Recriado abaixo por idempotência, igual à 100.
drop trigger if exists sgp_pedidos_touch on public.sgp_pedidos;
create trigger sgp_pedidos_touch before update on public.sgp_pedidos
  for each row execute function public.sgp_pedidos_touch();

-- ---------------------------------------------------------------------------
-- REVERTER (se precisar)
-- ---------------------------------------------------------------------------
-- create or replace function public.sgp_pedidos_touch()
-- returns trigger language plpgsql as $$
-- begin
--   new.atualizado_em = now();
--   return new;
-- end $$;
-- alter table public.sgp_pedidos drop column if exists cobrado_em;
-- alter table public.sgp_pedidos drop column if exists cobrado_por;
--
-- Reverter só a função é seguro a qualquer momento: o painel volta ao
-- comportamento de hoje e o pior que acontece é um clique em "Já cobrei"
-- zerar o "parado há" daquela linha.
