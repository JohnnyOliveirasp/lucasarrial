-- 109 — SGP: o time marca "deu erro" numa linha que o sistema acha que está boa.
--
-- PEDIDO (Lucas, 10/09, reenviado em 14/09): *"desses que já estão prontos, ou
-- aguardando ou erro, precisamos deixar explicitamente nessa tela para meu time
-- ver"*. A parte de PRONTO/AGUARDANDO sai dos campos que já existem e não precisa
-- de banco nenhum (ver lib/sgp/painel.ts › situacao). O que precisa de banco é o
-- terceiro estado: o time descobre POR FORA (aluno avisou no WhatsApp, o material
-- veio errado) que um pedido deu errado, e hoje não tem onde registrar isso.
--
-- ---------------------------------------------------------------------------
-- POR QUE COLUNA NOVA E NÃO A COLUNA `erro` QUE JÁ EXISTE
-- ---------------------------------------------------------------------------
-- Foi a primeira tentativa, e ela está errada por três motivos MEDIDOS:
--
--   1. `erro` tem dono, e o dono é o sistema. `lib/sgp/etapas.ts:98` carimba o
--      motivo da falha técnica com o cadeado `!pedido.erro` — "nunca sobrescreve
--      um erro que já foi escrito por outro caminho". Um atendente escrevendo ali
--      antes do robô FAZ O ROBÔ CALAR: a falha técnica de verdade some.
--   2. `erro` não tem autoria nem data. Fechamento sem autor auditável é o que a
--      casa já decidiu não repetir (lib/incidents/closure.ts).
--   3. Escrever em `erro` passa pelo gatilho abaixo e ZERA o "parado há" da linha
--      — o mesmo estrago que a migration 106 existe para impedir.
--
-- Medido em 14/09 no banco vivo: 236 pedidos, ZERO com `erro` preenchido e ZERO
-- em `falhou`. Ou seja: hoje a coluna `erro` nunca dispara, e o estado ERRO da
-- tela só existe de verdade depois destas colunas.
--
-- ---------------------------------------------------------------------------
-- 🚨 ACHADO DE 14/09 QUE MUDA A ORDEM DE APLICAÇÃO — LER ANTES DE RODAR
-- ---------------------------------------------------------------------------
-- O banco de PRODUÇÃO divergiu do git, e isso foi medido, não suposto. Lendo
-- `pg_proc.prosrc` do banco vivo, a função `sgp_pedidos_touch` que está rodando
-- HOJE **não é** a da migration 100 nem a da 106. Ela é uma terceira versão,
-- aplicada fora do git, que já trata anotação — e que protege uma coluna que
-- nenhuma migration deste repositório cria:
--
--     (to_jsonb(new) - 'responsavel' - 'cobrado_em' - 'cobrado_por' - 'atualizado_em')
--       = (to_jsonb(old) - ... )  →  new.atualizado_em = old.atualizado_em
--
-- E o `information_schema` confirma três colunas vivas em `sgp_pedidos` que não
-- existem em `scripts/*.sql` nem em `lib/sgp/types.ts`: `origem`, `responsavel`
-- e `origem_dados`.
--
-- DUAS CONSEQUÊNCIAS PRÁTICAS:
--
--  1. Esta migration PRESERVA `responsavel` na lista de anotações. Sem isso, ela
--     seria uma regressão silenciosa: quem escrevesse `responsavel` voltaria a
--     zerar o "parado há" da linha — exatamente o estrago que a 106 documenta.
--
--  2. ⚠️ A MIGRATION 106, COMO ESTÁ NO GIT, FICOU PERIGOSA. Ela recria a função
--     numa versão que NÃO conhece `responsavel`. Aplicá-la hoje derrubaria uma
--     proteção que já está no ar. Esta 109 SUBSTITUI o pedaço de gatilho da 106
--     (e é um superconjunto dele: cobrança + responsável + erro manual), então a
--     106 só precisa ser aplicada pelas suas duas COLUNAS.
--     RECOMENDAÇÃO: aplicar a 109 DEPOIS da 106, ou aplicar só o `alter table`
--     da 106 e deixar o gatilho por conta desta aqui. NUNCA a 106 depois da 109.
--
-- ---------------------------------------------------------------------------
-- ⚠️ NÃO APLICADA por quem escreveu. Quem aplica é o Johnny.
-- Esta migration é AUTOSSUFICIENTE: roda com ou sem a 106 (conferido em 14/09 —
-- a 106 NÃO está aplicada). A função abaixo apaga chaves por NOME em jsonb, e
-- apagar chave inexistente é no-op, então ela não exige `cobrado_em` existir.
-- O código foi escrito para funcionar com ou sem estas colunas: sem elas a tela
-- continua mostrando PRONTO/AGUARDANDO normalmente e o botão "Marcar erro" se
-- explica em vez de dar 500 (ver o fallback em lib/sgp/cobranca.ts).

-- ---------------------------------------------------------------------------
-- 1) As três colunas
-- ---------------------------------------------------------------------------
alter table public.sgp_pedidos
  add column if not exists erro_manual_em     timestamptz,
  add column if not exists erro_manual_por    text,
  add column if not exists erro_manual_motivo text;

comment on column public.sgp_pedidos.erro_manual_em is
  'Quando alguém do time marcou "deu erro" no /admin/sgp. Diferente do "já '
  'cobrei" (cobrado_em), esta marca NÃO vence sozinha e NÃO se invalida quando o '
  'aluno mexe: é uma afirmação de defeito, não um timer. Só sai por clique em '
  '"desfazer" — quem marcou pode ter visto algo que o sistema não vê.';

comment on column public.sgp_pedidos.erro_manual_por is
  'E-mail (ou user_id, quando o e-mail é nulo) de quem marcou. Mesma regra de '
  'autoria de lib/incidents/closure.ts: nunca gravar null, sempre rastreável.';

comment on column public.sgp_pedidos.erro_manual_motivo is
  'O que o atendente viu, nas palavras dele ("aluno disse que a voz não é dele"). '
  'Opcional e truncado em 500 chars na rota. NÃO confundir com a coluna `erro`, '
  'que é do sistema e é escrita pelo robô em lib/sgp/etapas.ts.';

-- ---------------------------------------------------------------------------
-- 2) O gatilho de `atualizado_em` — o ponto não óbvio, herdado da 106
-- ---------------------------------------------------------------------------
-- `sgp_pedidos_touch` (migration 100) faz `new.atualizado_em = now()` em TODO
-- update, incondicionalmente. E `atualizado_em` é EXATAMENTE o relógio de onde
-- sai o "parado há" do painel (lib/sgp/painel.ts › montarLinha).
--
-- Sem isto, marcar erro numa aluna parada há 4 dias a transformaria em "parado há
-- 0min", tirando-a do vermelho e do contador — PARA SEMPRE, porque o relógio real
-- teria sido destruído. Anotação do TIME não é movimentação do PEDIDO.
--
-- A função que está VIVA hoje já faz isso para `responsavel`, `cobrado_em` e
-- `cobrado_por`. Esta aqui é a MESMA função com três chaves a mais e a lista
-- escrita como array em vez de uma corrente de `-` — nada mais muda.
--
-- Em particular, NÃO foi acrescentado nenhum guarda de "alguma coisa mudou": o
-- comportamento da produção para um UPDATE que não altera nada (preservar
-- `atualizado_em`) fica idêntico. Mudar isso não foi pedido e seria uma
-- alteração de comportamento escondida dentro de uma migration de coluna.
--
-- A comparação é sobre a linha inteira em jsonb menos essas chaves, então ninguém
-- precisa lembrar de mexer aqui quando nascer uma coluna de produto nova: na
-- dúvida cai no `now()`, que é o comportamento atual.
--
-- Operador conferido em 14/09 contra o banco vivo (PostgreSQL 17.6), com um
-- SELECT sobre uma linha real de `sgp_pedidos`: `jsonb - text[]` existe e a
-- comparação devolve o esperado.
create or replace function public.sgp_pedidos_touch()
returns trigger language plpgsql as $$
declare
  -- `atualizado_em` entra na lista porque é o campo que estamos decidindo; as
  -- demais são as anotações do time. Chave que não existe na linha é ignorada
  -- pelo `-`, e é por isso que esta função não exige a 106 aplicada.
  --
  -- ⚠️ `responsavel` NÃO PODE SAIR DAQUI: a coluna existe em produção (medido
  -- 14/09) e a função viva já a protege, embora ela não apareça em migration
  -- nenhuma deste repositório. Tirá-la seria uma regressão silenciosa.
  anotacoes text[] := array[
    'atualizado_em',
    'responsavel',
    'cobrado_em', 'cobrado_por',
    'erro_manual_em', 'erro_manual_por', 'erro_manual_motivo'
  ];
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - anotacoes) = (to_jsonb(old) - anotacoes)
  then
    -- Anotação do TIME não é movimentação do PEDIDO. O relógio não anda.
    new.atualizado_em = old.atualizado_em;
    return new;
  end if;

  new.atualizado_em = now();
  return new;
end $$;

-- O gatilho em si não muda (segue `before update ... for each row`), só o corpo
-- da função. Recriado abaixo por idempotência, igual à 100 e à 106.
drop trigger if exists sgp_pedidos_touch on public.sgp_pedidos;
create trigger sgp_pedidos_touch before update on public.sgp_pedidos
  for each row execute function public.sgp_pedidos_touch();

-- ---------------------------------------------------------------------------
-- RISCO DE APLICAR
-- ---------------------------------------------------------------------------
-- Baixo, e o motivo é que nada aqui reescreve dado existente:
--  · `add column if not exists` em 3 colunas nulas — não trava tabela grande
--    (PG 11+ não reescreve a tabela para coluna nullable sem default), e a
--    sgp_pedidos tem 236 linhas;
--  · a função do gatilho é um `create or replace` cujo caminho padrão (o `else`)
--    é byte-a-byte o comportamento de hoje;
--  · nenhum UPDATE de dado, nenhum backfill, nenhum índice.
-- O caso novo que o gatilho passa a tratar (update que mexe SÓ em anotação) hoje
-- não acontece nunca, porque as colunas de anotação não existem.
--
-- ---------------------------------------------------------------------------
-- REVERTER (se precisar)
-- ---------------------------------------------------------------------------
-- -- Volta a função EXATAMENTE ao que está em produção hoje (lido de pg_proc em
-- -- 14/09). NÃO use o corpo da migration 100 aqui: ela não conhece `responsavel`.
-- create or replace function public.sgp_pedidos_touch()
-- returns trigger language plpgsql as $$
-- begin
--   if tg_op = 'UPDATE'
--      and (to_jsonb(new) - 'responsavel' - 'cobrado_em' - 'cobrado_por' - 'atualizado_em')
--        = (to_jsonb(old) - 'responsavel' - 'cobrado_em' - 'cobrado_por' - 'atualizado_em')
--   then
--     new.atualizado_em = old.atualizado_em;
--     return new;
--   end if;
--   new.atualizado_em = now();
--   return new;
-- end $$;
-- -- E, se quiser tirar as colunas (isto APAGA as marcações do time):
-- alter table public.sgp_pedidos drop column if exists erro_manual_em;
-- alter table public.sgp_pedidos drop column if exists erro_manual_por;
-- alter table public.sgp_pedidos drop column if exists erro_manual_motivo;
--
-- Reverter só a função é seguro a qualquer momento: o painel volta ao
-- comportamento de hoje e o pior que acontece é marcar erro (ou "já cobrei")
-- zerar o "parado há" daquela linha.
