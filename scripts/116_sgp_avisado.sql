-- 116 — SGP: o carimbo de que o ALUNO FOI AVISADO de que o clone ficou pronto.
--
-- PEDIDO (Johnny, recado 6, 15/09): *"SEPARAR os dois estados. PRONTO = o
-- sistema gerou. ENTREGUE = o ALUNO FOI AVISADO. Não basta renomear rótulo:
-- 'entregue' precisa de um carimbo próprio (quando, por qual canal), porque ele
-- afirma um fato sobre o mundo, não sobre a nossa fila."*
--
-- ---------------------------------------------------------------------------
-- POR QUE 116 E NÃO 115
-- ---------------------------------------------------------------------------
-- O recado mandou numerar 115+ porque houve colisão de cinco '108' num dia só.
-- Conferido antes de escolher o número: o 115 JÁ ESTÁ TRIPLAMENTE OCUPADO em
-- branches abertas — `115_sgp_cobrado_canal.sql`, `115_trial_periods.sql` e
-- `115_heygen_senha.sql`. Repetir o erro que o recado acabou de citar seria
-- difícil de explicar, então esta é a 116.
--
-- ---------------------------------------------------------------------------
-- O QUE NÃO EXISTE HOJE (medido no banco vivo em 15/09, não suposto)
-- ---------------------------------------------------------------------------
-- Sondando coluna a coluna via PostgREST, em produção:
--   · `cobrado_em` (106) .......... EXISTE
--   · `erro_manual_em` (109) ...... EXISTE
--   · `concluido_em` (110) ........ EXISTE
--   · `responsavel`, `origem` ..... EXISTEM (nascidas fora do git)
--   · `avisado_em/por/canal` ...... AUSENTES  ← é o que esta migration cria
--
-- E a função viva do gatilho foi lida de `pg_proc` (não deduzida do git): é
-- EXATAMENTE a da 110, com o array de 10 chaves. Ou seja, 106/109/110 estão
-- todas aplicadas e esta 116 é a próxima da fila, sem buraco no meio.
--
-- ---------------------------------------------------------------------------
-- 🚨 O MESMO CUIDADO DA 110 — O GATILHO `sgp_pedidos_touch`
-- ---------------------------------------------------------------------------
-- `atualizado_em` é de onde sai o "parado há" do painel. Sem incluir as três
-- colunas novas na lista de anotações preservadas, clicar em "Avisei o aluno"
-- numa linha parada há 5 dias a transformaria em "parado há 0min", destruindo o
-- relógio real — e justamente na marca que a pessoa clica achando que está
-- registrando um cuidado com o aluno.
--
-- Esta função é um SUPERCONJUNTO ESTRITO da que está no ar: as MESMAS 10 chaves
-- mais 3. Nenhum UPDATE que toque coluna de produto muda de comportamento.
--
-- ⚠️ `responsavel` NÃO PODE SAIR DAQUI (ver 109 e 110).
--
-- ---------------------------------------------------------------------------
-- ⚠️ NÃO APLICADA por quem escreveu. Quem aplica é o Johnny, depois de auditar.
-- ---------------------------------------------------------------------------
-- O painel foi escrito pra funcionar COM ou SEM estas colunas. Sem elas, quem
-- responde "o aluno foi avisado?" é `profiles.onboarding_ready_email_at`, que
-- já existe e já cobre 81 dos 82 pedidos prontos (ver lib/sgp/aviso.ts). Então
-- esta migration NÃO é pré-requisito pro corte GERADO/ENTREGUE funcionar — ela
-- é o que permite o time REGISTRAR um aviso dado por fora (WhatsApp, ligação),
-- que hoje não tem onde ser anotado.
--
-- ⚠️ E O QUE ELA EXPRESSAMENTE NÃO FAZ: não escreve `avisado_em` em lugar
-- nenhum. NENHUM BACKFILL, nem nos 82 pedidos prontos. O recado foi explícito:
-- carimbar "avisado" retroativamente trocaria uma mentira por outra pior. Quem
-- não tem carimbo fica em GERADO, que é o estado honesto de "não sei".

-- ---------------------------------------------------------------------------
-- 1) As três colunas
-- ---------------------------------------------------------------------------
alter table public.sgp_pedidos
  add column if not exists avisado_em    timestamptz,
  add column if not exists avisado_por   text,
  add column if not exists avisado_canal text;

comment on column public.sgp_pedidos.avisado_em is
  'Quando alguém registrou que o ALUNO FOI AVISADO de que o clone ficou pronto. '
  'NÃO é status = ''pronto'' (isso é o robô dizendo que GEROU) e NÃO é '
  'concluido_em (isso é o time dizendo que encerrou o atendimento). É a única '
  'coluna que afirma algo sobre o ALUNO. Nulo significa "não há registro de '
  'aviso" — nunca "não foi avisado": alguém pode ter avisado por fora sem '
  'registrar, e a tela diz isso com todas as letras.';

comment on column public.sgp_pedidos.avisado_por is
  'E-mail (ou user_id, quando o e-mail é nulo) de quem registrou o aviso. Mesma '
  'regra de autoria das 109/110: nunca gravar null, sempre rastreável.';

comment on column public.sgp_pedidos.avisado_canal is
  'Por onde o aluno foi avisado: "WhatsApp", "e-mail", "ligação". O recado 6 '
  'pediu "quando, POR QUAL CANAL" — sem o canal o carimbo não dá pra auditar, '
  'porque cada canal tem uma chance de chegar muito diferente.';

-- ---------------------------------------------------------------------------
-- 2) O gatilho de `atualizado_em` — superconjunto estrito do da 110
-- ---------------------------------------------------------------------------
create or replace function public.sgp_pedidos_touch()
returns trigger language plpgsql as $$
declare
  -- `atualizado_em` entra na lista porque é o campo que estamos decidindo; as
  -- demais são as anotações do TIME. Chave que não existe na linha é ignorada
  -- pelo `-`, então esta função não exige nenhuma das migrations anteriores.
  --
  -- ⚠️ `responsavel` NÃO PODE SAIR DAQUI (ver migrations 109 e 110).
  anotacoes text[] := array[
    'atualizado_em',
    'responsavel',
    'cobrado_em', 'cobrado_por',
    'erro_manual_em', 'erro_manual_por', 'erro_manual_motivo',
    'concluido_em', 'concluido_por', 'concluido_motivo',
    'avisado_em', 'avisado_por', 'avisado_canal'
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
-- da função. Recriado abaixo por idempotência, igual à 100, 106, 109 e 110.
drop trigger if exists sgp_pedidos_touch on public.sgp_pedidos;
create trigger sgp_pedidos_touch before update on public.sgp_pedidos
  for each row execute function public.sgp_pedidos_touch();

-- ---------------------------------------------------------------------------
-- ⚠️ ORDEM DE APLICAÇÃO
-- ---------------------------------------------------------------------------
-- Esta 116 SUBSTITUI o pedaço de gatilho da 106, da 109 e da 110 (é
-- superconjunto das três). NUNCA aplicar qualquer uma delas DEPOIS desta:
-- qualquer uma recria a função sem conhecer `avisado_*`, e a partir daí
-- registrar um aviso volta a zerar o "parado há" da linha — silenciosamente.
--
-- ANTES DE RODAR, conferir que a função viva é mesmo a da 110:
--   select prosrc from pg_proc where proname = 'sgp_pedidos_touch';
-- Em 15/09 ela era, conferida assim. Se aparecer alguma chave que não está no
-- array acima, ACRESCENTE antes de aplicar em vez de sobrescrever — uma
-- proteção que some não avisa.
--
-- ---------------------------------------------------------------------------
-- RISCO DE APLICAR
-- ---------------------------------------------------------------------------
-- Baixo, pelo mesmo motivo da 109 e da 110: nada aqui reescreve dado existente.
--  · `add column if not exists` em 3 colunas nulas — PG 11+ não reescreve a
--    tabela para coluna nullable sem default, e sgp_pedidos tem 267 linhas
--    (medido 15/09);
--  · a função é um `create or replace` cujo caminho padrão é o comportamento de
--    hoje, e cuja única diferença é proteger três colunas a mais;
--  · nenhum UPDATE de dado, NENHUM BACKFILL, nenhum índice, nenhuma constraint.
-- O caso novo que o gatilho passa a tratar não acontece hoje, porque as colunas
-- não existem antes deste `alter table`.
--
-- ---------------------------------------------------------------------------
-- REVERTER (se precisar)
-- ---------------------------------------------------------------------------
-- -- Volta a função EXATAMENTE à da migration 110 (a que está no ar hoje):
-- create or replace function public.sgp_pedidos_touch()
-- returns trigger language plpgsql as $$
-- declare
--   anotacoes text[] := array[
--     'atualizado_em',
--     'responsavel',
--     'cobrado_em', 'cobrado_por',
--     'erro_manual_em', 'erro_manual_por', 'erro_manual_motivo',
--     'concluido_em', 'concluido_por', 'concluido_motivo'
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
-- -- E, se quiser tirar as colunas (isto APAGA os avisos registrados pelo time):
-- alter table public.sgp_pedidos drop column if exists avisado_em;
-- alter table public.sgp_pedidos drop column if exists avisado_por;
-- alter table public.sgp_pedidos drop column if exists avisado_canal;
--
-- ⚠️ Reverter SÓ A FUNÇÃO com as colunas ainda de pé é o pior dos mundos: cada
-- registro de aviso passa a destruir o "parado há" daquela linha. Se for pra
-- reverter, reverta os dois ou nenhum.
