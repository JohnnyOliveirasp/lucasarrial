-- 109 — status `canceled` em video_clones (necessária pro PR do cancelamento)
--
-- ⚠️ APLICAR ANTES de subir o código do cancelamento. Quem inverter a ordem vai
-- ver `23514 violates check constraint` na primeira vez que um aluno cancelar.
--
-- A boa notícia: esta migration é PERMISSIVA (só ACRESCENTA um valor à lista).
-- Aplicar cedo é inofensivo — enquanto o código novo não subir, ninguém grava
-- `canceled` e o comportamento do banco é idêntico ao de hoje. Ou seja, dá pra
-- aplicar com folga, sem janela e sem coordenar com o deploy.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUE ELA É NECESSÁRIA (medido no banco VIVO em 13/09, não deduzido)
--
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint where conrelid = 'public.video_clones'::regclass;
--
-- devolveu:
--   video_clones_pkey          PRIMARY KEY (id)
--   video_clones_status_check  CHECK (status = ANY (ARRAY['pending','generating','ready','failed']))
--   video_clones_tier_check    CHECK (tier = ANY (ARRAY['480p','720p','480p-v2','480p-v3']))
--   video_clones_user_id_fkey  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
--
-- Ou seja: `canceled` é RECUSADO pelo banco hoje. Diferente do caso do script
-- 107 (onde a coluna era text livre e o CHECK era opcional), aqui a constraint
-- EXISTE e bloqueia — esta migration não é endurecimento, é pré-requisito.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUE `canceled` E NÃO REUSAR `failed`
--
-- Reusar `failed` não precisaria de migration nenhuma, e foi a primeira opção
-- considerada. Foi descartada por duas razões medidas:
--
--   1. Mataria a taxa de falha como sinal de saúde. Na janela de 14 dias
--      (13/09) a distribuição real é: ready 762 | failed 25 | generating 1.
--      Os 25 `failed` são defeito NOSSO, e é isso que o time olha pra saber se
--      o produto está doente. Enfiar cancelamento voluntário do aluno no mesmo
--      balde cega exatamente a métrica que serve pra detectar regressão.
--
--   2. O aluno veria "Falhou" em vermelho por uma coisa que ELE escolheu —
--      lendo como "o sistema quebrou" bem no momento em que a gente está
--      tentando devolver o controle pra ele.
--
-- ─────────────────────────────────────────────────────────────────────────
-- RISCO DE APLICAR
--
-- 1. Validação das linhas existentes. `ADD CONSTRAINT ... CHECK` valida a
--    tabela inteira e FALHA (sem gravar nada) se uma única linha estiver fora
--    da lista. A lista nova é um SUPERCONJUNTO estrito da atual, então toda
--    linha que passa hoje passa depois. Valida limpo por construção.
--
-- 2. Lock. `ALTER TABLE ... ADD CONSTRAINT` pega ACCESS EXCLUSIVE e faz seq
--    scan. A tabela tem ~800 linhas na janela recente — milissegundos. Não
--    precisa de janela de manutenção.
--
-- 3. Reversível em uma linha, sem perda de dado (ver ROLLBACK no fim).
--
-- ─────────────────────────────────────────────────────────────────────────
-- PASSO 0 — CONFERÊNCIA (rode ANTES; só leitura, não altera nada).
-- Tem que voltar ZERO linhas.
--
-- select status, count(*)
--   from public.video_clones
--  where status not in ('pending','generating','ready','failed','canceled')
--  group by status;

-- ─────────────────────────────────────────────────────────────────────────
-- A MIGRATION
--
-- Idempotente: o DROP IF EXISTS deixa reexecutar sem erro.

alter table public.video_clones
  drop constraint if exists video_clones_status_check;

alter table public.video_clones
  add constraint video_clones_status_check
  check (status in (
    'pending',
    'generating',
    'ready',
    'failed',
    'canceled'   -- o aluno desistiu da espera; crédito estornado
  ));

comment on constraint video_clones_status_check on public.video_clones is
  'Vocabulário de status do Vídeo Clone. `canceled` = desistência do ALUNO (estorno via ref_type video_clone_cancel), distinto de `failed` = defeito nosso (estorno via video_clone_refund, que alimenta o detector de rajada). Status novo muda a constraint ANTES do código.';

-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK. Atenção à ordem: se já existir linha `canceled` gravada, recriar a
-- constraint ANTIGA falha. Primeiro derrube o código novo, depois:
--
--   -- 1. ver se sobrou linha cancelada
--   select count(*) from public.video_clones where status = 'canceled';
--
--   -- 2. se sobrou, decidir o destino dela. `failed` preserva o estorno já
--   --    aplicado e mantém a linha excluível pelo aluno:
--   update public.video_clones set status = 'failed' where status = 'canceled';
--
--   -- 3. só então voltar a constraint antiga
--   alter table public.video_clones drop constraint if exists video_clones_status_check;
--   alter table public.video_clones add constraint video_clones_status_check
--     check (status in ('pending','generating','ready','failed'));
