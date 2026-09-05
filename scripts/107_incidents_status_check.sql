-- 107 — CHECK de status em incidents (OPCIONAL / ENDURECIMENTO)
--
-- ⚠️ NÃO APLICADA. Quem aplica é o Johnny. E, diferente das outras, esta
-- migration NÃO É NECESSÁRIA para o PR #181 funcionar. Leia o porquê antes de
-- decidir — se a resposta for "não vale", jogue este arquivo fora sem dó.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUE ELA NÃO É NECESSÁRIA (medido no banco VIVO em 04/09, não deduzido)
--
--   select conname, contype, pg_get_constraintdef(oid)
--     from pg_constraint where conrelid = 'public.incidents'::regclass;
--
-- devolveu EXATAMENTE duas linhas:
--   incidents_pkey             PRIMARY KEY (id)
--   incidents_categoria_check  CHECK (categoria = ANY (ARRAY['tecnico','atendimento']))
--
-- Nenhuma delas toca `status`. A coluna é `text NOT NULL DEFAULT 'open'::text`,
-- sem CHECK e sem enum. Ou seja: o status novo `suporte_necessario` do PR #181
-- entra em produção SEM tocar no banco. A validação que existe de verdade hoje
-- é a lista em `frontend/src/lib/incidents/status.ts`.
--
-- Também medido na mesma ronda, porque era o risco herdado do PR #180 (lá o
-- gatilho `sgp_pedidos_touch` carimbava `atualizado_em` em todo update e teria
-- zerado o relógio de "parado há" em silêncio):
--
--   select tgname from pg_trigger
--    where tgrelid = 'public.incidents'::regclass and not tgisinternal;
--
-- devolveu VAZIO. `public.incidents` não tem NENHUM gatilho. `last_seen_at` é
-- `timestamptz NOT NULL DEFAULT now()` — DEFAULT vale no INSERT, não no UPDATE.
-- Logo a baixa de "aluno respondido", que só reescreve `agent_notes`, não mexe
-- em `last_seen_at`: a ordenação do painel e o relógio de "parado há"
-- continuam contando a verdade. O bug do #180 não se repete aqui.
--
-- (O gatilho `incidents_resolved_guard` do script 102 continua NÃO APLICADO —
-- é coerente com o vazio acima. Se um dia ele subir, convive com este PR: ele
-- só mexe em resolved_at/by/commit quando o status ENTRA ou SAI de
-- fixed/ignored, e `suporte_necessario` não é fechamento.)
--
-- ─────────────────────────────────────────────────────────────────────────
-- ENTÃO PRA QUE ESTE ARQUIVO EXISTE
--
-- Defesa em profundidade. Hoje um erro de digitação num status ("suport_
-- necessario") é gravado pelo banco sem reclamar, e o chamado some de todos os
-- filtros do painel — falha silenciosa, que é a pior classe. O CHECK transforma
-- isso em erro alto na hora da escrita.
--
-- O PREÇO, dito na cara: cria acoplamento. A partir daqui, status novo exige
-- DUAS mudanças (a lista em status.ts E esta constraint), nesta ordem: aplica a
-- migration ANTES de subir o código que escreve o status novo. Quem esquecer vai
-- ver `23514 violates check constraint` em produção. Se o time não quiser esse
-- contrato, NÃO aplique — o PR #181 vive perfeitamente sem ele.

-- ─────────────────────────────────────────────────────────────────────────
-- RISCO DE APLICAR
--
-- 1. Validação dos 247 registros existentes. `ADD CONSTRAINT ... CHECK` valida
--    a tabela inteira e FALHA (sem gravar nada) se um único registro estiver
--    fora da lista. Conferido em 04/09 — a distribuição real é:
--        fixed 180 | ignored 42 | aguardando_aluno 13 | investigating 12
--    Os 4 valores estão na lista abaixo, e `status` é NOT NULL. Então valida
--    limpo. AINDA ASSIM rode a conferência do passo 0: o banco muda sozinho
--    (o ingest cria chamado a toda hora) e este número é de 04/09.
--
-- 2. Lock. `ALTER TABLE ... ADD CONSTRAINT` pega ACCESS EXCLUSIVE e faz um
--    seq scan. Com 247 linhas isso é milissegundos. Não precisa de janela.
--
-- 3. Reversível em uma linha, sem perda de dado (ver ROLLBACK no fim).

-- ─────────────────────────────────────────────────────────────────────────
-- PASSO 0 — CONFERÊNCIA (rode isto ANTES; só leitura, não altera nada).
-- Tem que voltar ZERO linhas. Se voltar alguma, PARE: existe status fora do
-- vocabulário e a migration falharia. Corrija o dado antes.
--
-- select status, count(*)
--   from public.incidents
--  where status not in ('open','investigating','fixing','aguardando_aluno',
--                       'suporte_necessario','fixed','ignored')
--  group by status;

-- ─────────────────────────────────────────────────────────────────────────
-- A MIGRATION
--
-- Idempotente: o DROP IF EXISTS deixa reexecutar sem erro e é o que permite
-- reaplicar depois de acrescentar um status novo à lista.
--
-- ⚠️ A lista abaixo é ESPELHO de INCIDENT_STATUSES em
--    frontend/src/lib/incidents/status.ts. As duas nascem juntas ou não nascem.

alter table public.incidents
  drop constraint if exists incidents_status_check;

alter table public.incidents
  add constraint incidents_status_check
  check (status in (
    'open',
    'investigating',
    'fixing',
    'aguardando_aluno',
    'suporte_necessario',  -- PR #181, pedido do Lucas 04/09
    'fixed',
    'ignored'
  ));

comment on constraint incidents_status_check on public.incidents is
  'Vocabulário de status do chamado. Espelho de INCIDENT_STATUSES em frontend/src/lib/incidents/status.ts — status novo muda os DOIS, e a migration entra ANTES do código.';

-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK (uma linha, instantâneo, não perde dado nenhum — constraint não
-- guarda informação, só recusa escrita):
--
--   alter table public.incidents drop constraint if exists incidents_status_check;
--
-- Depois disso o comportamento volta a ser exatamente o de hoje: `status` é
-- text livre e quem valida é o status.ts.
