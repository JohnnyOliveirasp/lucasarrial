-- 110 — SGP: o time declara que CONCLUIU O ATENDIMENTO daquela linha.
--
-- PEDIDO (Lucas, 14/09, olhando a tela /admin/sgp): *"eu preciso de um botão de
-- conclusão aqui nessa tela, para que a equipe consiga concluir o atendimento"*.
--
-- ---------------------------------------------------------------------------
-- POR QUE ISTO NÃO EXISTE AINDA (auditado antes de escrever, não suposto)
-- ---------------------------------------------------------------------------
-- Nenhuma das marcações que o time já tem é esta, e as três diferenças são de
-- natureza, não de nome:
--
--   · 106 — `cobrado_em` é um SILENCIADOR com prazo. O próprio cabeçalho dela
--     diz, em caixa alta, que NÃO é resolução: passadas as 48h a linha volta a
--     gritar sozinha. É "já falei com ele", não "acabou".
--   · 109 — `erro_manual_em` é o OPOSTO de conclusão: é o time abrindo um
--     problema que o sistema não enxerga, não fechando um.
--   · O "concluído" que a tela mostra hoje é DERIVADO e não é clicável:
--     `lib/sgp/compradores.ts:377` faz `const concluido = statusPedido ===
--     'pronto'`. Isso é "o robô entregou o produto", que é uma afirmação sobre
--     o PEDIDO. O que falta é uma afirmação sobre o ATENDIMENTO, e ela só pode
--     vir de gente: o aluno foi reembolsado, desistiu, resolveu por fora, ou o
--     caso foi tratado e encerrado. O banco não tem como saber nada disso.
--
-- ---------------------------------------------------------------------------
-- 🚨 O PONTO QUE NÃO PODE PASSAR BATIDO — O GATILHO `sgp_pedidos_touch`
-- ---------------------------------------------------------------------------
-- `sgp_pedidos_touch` (migration 100) fazia `new.atualizado_em = now()` em TODO
-- update. E `atualizado_em` é EXATAMENTE o relógio de onde sai o "parado há" do
-- painel (`lib/sgp/painel.ts › montarLinha`).
--
-- Sem incluir as três colunas novas na lista de anotações preservadas, clicar em
-- "Concluir" numa aluna parada há 5 dias a transformaria em "parado há 0min" —
-- e PARA SEMPRE, porque o relógio real teria sido destruído no lugar. Ela sairia
-- do vermelho, do contador e de qualquer alerta futuro, sem ninguém perceber.
-- É o desastre que a 106 documenta no cabeçalho dela, e é pior aqui: a conclusão
-- é justamente a marca que a pessoa clica achando que está "fechando o caso".
--
-- ESTADO MEDIDO EM 14/09, no banco vivo, antes de escrever esta migration:
--   · `cobrado_em`, `cobrado_por` (106) → EXISTEM;
--   · `erro_manual_em`, `erro_manual_por`, `erro_manual_motivo` (109) → EXISTEM;
--   · `responsavel`, `origem`, `origem_dados` → EXISTEM (nascidas fora do git,
--     como a 109 já tinha anotado);
--   · `concluido_em`, `concluido_por`, `concluido_motivo` → AUSENTES.
-- Ou seja: a 109 JÁ ESTÁ APLICADA, e a função viva hoje é a dela. Esta 110 é a
-- MESMA função com três chaves a mais no array — um superconjunto estrito.
--
-- ⚠️ `responsavel` NÃO PODE SAIR DA LISTA, pelo mesmo motivo que a 109 registrou:
-- a coluna existe em produção e a função viva já a protege. Tirá-la seria uma
-- regressão silenciosa.
--
-- ⚠️ NÃO APLICADA por quem escreveu. Quem aplica é o Johnny, depois de auditar.
-- O código do painel foi escrito pra funcionar com ou sem estas colunas: sem
-- elas a tela continua de pé, o botão se explica em vez de dar 500, e o resto
-- da tela (cobrança, marcar erro, situação) não é afetado — ver o fallback por
-- GRUPO em `lib/sgp/cobranca.ts › criarFilaComFallback`.

-- ---------------------------------------------------------------------------
-- 1) As três colunas
-- ---------------------------------------------------------------------------
alter table public.sgp_pedidos
  add column if not exists concluido_em     timestamptz,
  add column if not exists concluido_por    text,
  add column if not exists concluido_motivo text;

comment on column public.sgp_pedidos.concluido_em is
  'Quando alguém do time declarou o ATENDIMENTO concluído no /admin/sgp. NÃO é '
  '"o aluno recebeu o produto" (isso é status = ''pronto''): é o time dizendo '
  'que não precisa mais mexer neste caso. A linha CONTINUA na tela — sumir com '
  'ela perderia de vista quem pagou e não recebeu. Sai só por "desfazer".';

comment on column public.sgp_pedidos.concluido_por is
  'E-mail (ou user_id, quando o e-mail é nulo) de quem clicou. Mesma regra de '
  'autoria de lib/incidents/closure.ts: nunca gravar null, sempre rastreável.';

comment on column public.sgp_pedidos.concluido_motivo is
  'O que a pessoa escreveu ao concluir ("aluno foi reembolsado", "resolvido no '
  'WhatsApp"). Opcional e truncado em 500 chars na rota. É o único lugar onde '
  'fica registrado POR QUE o caso foi encerrado.';

-- ---------------------------------------------------------------------------
-- 2) O gatilho de `atualizado_em` — superconjunto estrito do da 109
-- ---------------------------------------------------------------------------
-- Nada aqui muda de comportamento em relação ao que está no ar: são as MESMAS
-- regras com três nomes a mais no array. Um UPDATE que toque qualquer coluna de
-- produto continua caindo no `now()`, byte a byte como hoje.
create or replace function public.sgp_pedidos_touch()
returns trigger language plpgsql as $$
declare
  -- `atualizado_em` entra na lista porque é o campo que estamos decidindo; as
  -- demais são as anotações do TIME. Chave que não existe na linha é ignorada
  -- pelo `-`, então esta função não exige nenhuma das migrations anteriores.
  --
  -- ⚠️ `responsavel` NÃO PODE SAIR DAQUI (ver cabeçalho e migration 109).
  anotacoes text[] := array[
    'atualizado_em',
    'responsavel',
    'cobrado_em', 'cobrado_por',
    'erro_manual_em', 'erro_manual_por', 'erro_manual_motivo',
    'concluido_em', 'concluido_por', 'concluido_motivo'
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
-- da função. Recriado abaixo por idempotência, igual à 100, à 106 e à 109.
drop trigger if exists sgp_pedidos_touch on public.sgp_pedidos;
create trigger sgp_pedidos_touch before update on public.sgp_pedidos
  for each row execute function public.sgp_pedidos_touch();

-- ---------------------------------------------------------------------------
-- ⚠️ ORDEM DE APLICAÇÃO
-- ---------------------------------------------------------------------------
-- Esta 110 SUBSTITUI o pedaço de gatilho da 106 e da 109 (é superconjunto das
-- duas). NUNCA aplicar a 106 ou a 109 DEPOIS desta: qualquer uma delas recria a
-- função sem conhecer `concluido_*`, e a partir daí clicar em "Concluir" volta a
-- zerar o "parado há" da linha — silenciosamente.
--
-- ANTES DE RODAR, conferir que a função viva é mesmo a da 109 (o banco já
-- divergiu do git uma vez, é o achado que a 109 registra):
--   select prosrc from pg_proc where proname = 'sgp_pedidos_touch';
-- Se aparecer alguma chave que não está no array acima, ACRESCENTE antes de
-- aplicar em vez de sobrescrever — uma proteção que some não avisa.
--
-- ---------------------------------------------------------------------------
-- RISCO DE APLICAR
-- ---------------------------------------------------------------------------
-- Baixo, pelo mesmo motivo da 109: nada aqui reescreve dado existente.
--  · `add column if not exists` em 3 colunas nulas — PG 11+ não reescreve a
--    tabela para coluna nullable sem default, e sgp_pedidos tem ~236 linhas;
--  · a função é um `create or replace` cujo caminho padrão é o comportamento
--    de hoje, e cuja única diferença é proteger três colunas a mais;
--  · nenhum UPDATE de dado, nenhum backfill, nenhum índice, nenhuma constraint.
-- O caso novo que o gatilho passa a tratar hoje não acontece nunca, porque as
-- colunas de conclusão não existem antes deste `alter table`.
--
-- ---------------------------------------------------------------------------
-- REVERTER (se precisar)
-- ---------------------------------------------------------------------------
-- -- Volta a função EXATAMENTE à da migration 109 (a que está no ar hoje):
-- create or replace function public.sgp_pedidos_touch()
-- returns trigger language plpgsql as $$
-- declare
--   anotacoes text[] := array[
--     'atualizado_em',
--     'responsavel',
--     'cobrado_em', 'cobrado_por',
--     'erro_manual_em', 'erro_manual_por', 'erro_manual_motivo'
--   ];
-- begin
--   if tg_op = 'UPDATE'
--      and (to_jsonb(new) - anotacoes) = (to_jsonb(old) - anotacoes)
--   then
--     new.atualizado_em = old.atualizado_em;
--     return new;
--   end if;
--   new.atualizado_em = now();
--   return new;
-- end $$;
-- -- E, se quiser tirar as colunas (isto APAGA as conclusões do time):
-- alter table public.sgp_pedidos drop column if exists concluido_em;
-- alter table public.sgp_pedidos drop column if exists concluido_por;
-- alter table public.sgp_pedidos drop column if exists concluido_motivo;
--
-- ⚠️ Reverter SÓ A FUNÇÃO com as colunas ainda de pé é o pior dos mundos: o
-- botão continua na tela e cada clique passa a destruir o "parado há" daquela
-- linha. Se for pra reverter, reverta os dois ou nenhum.
