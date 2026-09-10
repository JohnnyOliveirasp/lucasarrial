-- 108 — SGP: anotação do TIME não pode zerar o relógio do ALUNO.
--
-- ⚠️ NÃO APLICADA. Quem aplica é o Johnny. O código do painel foi escrito para
-- funcionar COM ou SEM esta migration — ver `relogioDoPedido` em
-- lib/sgp/painel.ts e a rota api/v1/admin/sgp/[id]/erro/route.ts.
--
-- ---------------------------------------------------------------------------
-- O PROBLEMA
-- ---------------------------------------------------------------------------
-- PEDIDO (Lucas, 10/09): o time precisa marcar "este aluno deu erro" direto na
-- tela /admin/sgp, como fazia na planilha antiga. A marca é gravada na coluna
-- `erro`, que já existe — sem coluna nova, como ele pediu.
--
-- Só que o gatilho `sgp_pedidos_touch` (migration 100, que é a que está
-- aplicada hoje) faz `new.atualizado_em = now()` em TODO update. E
-- `atualizado_em` é EXATAMENTE o relógio de onde sai o "parado há" do painel.
--
-- Efeito de marcar um erro sem esta migration: o aluno parado há 5 dias vira
-- "parado há 0min", sai do vermelho, sai do contador de parados — e fica assim
-- PARA SEMPRE, porque o relógio real foi destruído no clique. É o mesmo estrago
-- que a migration 106 conserta para a cobrança, e é exatamente o "botão que
-- some com o problema" que o pedido de 04/09 proíbe: silencioso e irreversível.
--
-- ---------------------------------------------------------------------------
-- O QUE ESTA MIGRATION FAZ
-- ---------------------------------------------------------------------------
-- Generaliza a regra que a 106 criou: quando um update mexe SOMENTE nos campos
-- de anotação do time (`cobrado_em`, `cobrado_por`, `erro`), `atualizado_em` é
-- preservado. Qualquer outro update (o aluno mandando foto, o robô mudando o
-- status) segue carimbando `now()` — idêntico a hoje.
--
-- Escrita SEM referenciar `new.cobrado_em`/`new.cobrado_por` no plpgsql, e sim
-- por diferença de jsonb: assim ela vale mesmo se a 106 ainda não tiver sido
-- aplicada (remover uma chave que não existe de um jsonb é um no-op, enquanto
-- `new.cobrado_em` estouraria em tempo de execução). Aplicar em qualquer ordem
-- funciona; aplicar esta SOZINHA já resolve os dois casos.
--
-- EFEITO COLATERAL ACEITO, e é bom: `lib/sgp/processar.ts` também escreve em
-- `erro` (sozinho) quando o clone de foto ou o treino de voz falha. Com esta
-- migration esse write deixa de reiniciar o "parado há". Está correto — o
-- pedido NÃO andou pra frente, ele quebrou; o relógio continuar contando desde
-- o envio é a leitura certa pro time.
--
-- RISCO: baixo. Só o corpo da função muda, o gatilho é o mesmo, não há DDL de
-- tabela nem backfill, e a queda (o `else`) é o comportamento de hoje. O pior
-- caso de um bug aqui é `atualizado_em` ser preservado quando não devia — o
-- painel mostraria um "parado há" MAIOR que o real, ou seja, errando pro lado
-- de alertar demais, nunca pro lado de esconder aluno.

create or replace function public.sgp_pedidos_touch()
returns trigger language plpgsql as $$
declare
  -- Anotação do TIME sobre o pedido. Não é movimentação DO pedido.
  campos_do_time constant text[] := array['cobrado_em', 'cobrado_por', 'erro'];
begin
  if tg_op = 'UPDATE'
     -- (a) nada fora dos campos de anotação mudou...
     and (to_jsonb(new) - campos_do_time - 'atualizado_em')
       = (to_jsonb(old) - campos_do_time - 'atualizado_em')
     -- (b) ...e alguma coisa de fato mudou (senão não é uma anotação, é um
     --     update vazio, e aí o comportamento de hoje é que vale).
     and (to_jsonb(new) - 'atualizado_em') is distinct from (to_jsonb(old) - 'atualizado_em')
  then
    new.atualizado_em = old.atualizado_em;
    return new;
  end if;

  new.atualizado_em = now();
  return new;
end $$;

comment on function public.sgp_pedidos_touch() is
  'Carimba atualizado_em a cada update, EXCETO quando o update mexe só na '
  'anotação do time (cobrado_em, cobrado_por, erro) — esses campos são o time '
  'falando SOBRE o pedido, não o pedido andando. Ver scripts/106 e 108.';

-- O gatilho em si não muda (segue `before update ... for each row`), só o corpo
-- da função. Recriado abaixo por idempotência, igual à 100 e à 106.
drop trigger if exists sgp_pedidos_touch on public.sgp_pedidos;
create trigger sgp_pedidos_touch before update on public.sgp_pedidos
  for each row execute function public.sgp_pedidos_touch();

-- ---------------------------------------------------------------------------
-- CONFERIR DEPOIS DE APLICAR (não destrutivo — roda dentro de uma transação
-- que dá rollback no fim, então não deixa marca em pedido nenhum)
-- ---------------------------------------------------------------------------
-- begin;
--   select id, atualizado_em as antes from public.sgp_pedidos limit 1;
--   update public.sgp_pedidos set erro = '[teste 108]'
--     where id = (select id from public.sgp_pedidos limit 1);
--   -- `atualizado_em` tem que estar IGUAL ao "antes":
--   select id, atualizado_em as depois, erro from public.sgp_pedidos
--     where id = (select id from public.sgp_pedidos limit 1);
--   -- e um update de verdade tem que continuar carimbando:
--   update public.sgp_pedidos set status = status
--     where id = (select id from public.sgp_pedidos limit 1);
-- rollback;

-- ---------------------------------------------------------------------------
-- REVERTER (volta ao comportamento da 106; se a 106 também não estiver
-- aplicada, use o bloco de reversão dela, que volta ao da 100)
-- ---------------------------------------------------------------------------
-- create or replace function public.sgp_pedidos_touch()
-- returns trigger language plpgsql as $$
-- begin
--   if tg_op = 'UPDATE'
--      and (new.cobrado_em  is distinct from old.cobrado_em
--           or new.cobrado_por is distinct from old.cobrado_por)
--      and (to_jsonb(new) - 'cobrado_em' - 'cobrado_por' - 'atualizado_em')
--        = (to_jsonb(old) - 'cobrado_em' - 'cobrado_por' - 'atualizado_em')
--   then
--     new.atualizado_em = old.atualizado_em;
--     return new;
--   end if;
--   new.atualizado_em = now();
--   return new;
-- end $$;
--
-- Reverter é seguro a qualquer momento: o painel volta a ler o relógio do
-- carimbo (`desde ...`) que a própria rota grava, e o pior que acontece é uma
-- marcação NOVA de erro zerar o "parado há" daquela linha.
