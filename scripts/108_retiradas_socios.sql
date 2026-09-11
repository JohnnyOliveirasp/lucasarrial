-- 108 — retiradas_socios: o dinheiro que os sócios TIRAM do caixa.
--
-- ⚠️ NÃO APLICADA. Rodar este SQL é decisão do Johnny. Enquanto a tabela não
-- existir, nada quebra: o painel detecta a ausência (erro 42P01/PGRST205),
-- mostra o aviso "migration 108 não aplicada" e o bloco de Retiradas aparece
-- vazio — o "Lucro (caixa)" e todos os outros KPIs continuam exatamente como
-- estão hoje. Merge deste PR sem rodar o SQL não muda nenhum número.
--
-- POR QUE EXISTE
-- Pedido do Johnny 11/09: já houve três retiradas de R$ 2.947,00 (uma por
-- sócio — Johnny, Lucas e Eduardo), sacadas da Hotmart, e elas não aparecem em
-- lugar nenhum do /admin. O painel financeiro mostra quanto entrou, quanto saiu
-- e quanto sobrou de lucro, mas não mostra quanto do lucro já foi distribuído.
--
-- REGRA CONTÁBIL (aprovada pelo Johnny, não pode ser quebrada)
-- Retirada de sócio NÃO É DESPESA. Ela não entra no KPI "Saiu (gastos)", não
-- entra no `totalOut` e NÃO mexe no "Lucro (caixa)". Se entrasse, o lucro
-- despencaria e a margem passaria a mentir — como se a operação tivesse gasto
-- esse dinheiro, e não gastou: é lucro sendo distribuído. O que a tela faz é
-- mostrar, ABAIXO do lucro, um bloco separado de Retiradas e um número final
-- "Em caixa" = Lucro (caixa) − retiradas do período.
--
-- ACESSO
-- RLS ligado e SEM policy: nem `anon` nem `authenticated` enxergam a tabela.
-- Só o service_role (rotas /api/v1/admin/* atrás do gateAdmin) escreve e lê.

create table if not exists public.retiradas_socios (
  id             uuid primary key default gen_random_uuid(),

  -- quanto saiu, em R$ (nunca zero nem negativo: retirada é sempre um saque)
  valor          numeric(12,2) not null check (valor > 0),

  -- para qual sócio foi. Texto livre de propósito: entrar um quarto sócio não
  -- deve exigir migration. A lista fechada que a UI oferece vive no app
  -- (lib/admin/retiradas-calc.ts → SOCIOS).
  socio          text not null check (length(btrim(socio)) > 0),

  -- quando o dinheiro saiu de fato (é por esta coluna que o filtro de período
  -- do /admin recorta o bloco de Retiradas) — não confundir com criado_em.
  retirada_em    timestamptz not null default now(),

  -- de onde saiu o dinheiro. Hoje é sempre a Hotmart.
  origem         text not null default 'hotmart',

  -- e-mail do admin que registrou a linha no painel (auditoria).
  registrado_por text,

  criado_em      timestamptz not null default now()
);

-- O painel sempre lê por janela de período, do mais recente pro mais antigo.
-- `id` no fim dá ordem estável pra paginação (contrato do fetchAllPages).
create index if not exists retiradas_socios_retirada_em_idx
  on public.retiradas_socios (retirada_em desc, id);

alter table public.retiradas_socios enable row level security;
revoke all on table public.retiradas_socios from anon, authenticated;

-- ───────── seed: as três retiradas que JÁ aconteceram ─────────
-- R$ 2.947,00 para cada sócio (total R$ 8.841,00), sacadas da Hotmart.
--
-- ⚠️ SUPOSIÇÃO EXPLÍCITA: a data exata dos três saques não foi informada — o
-- seed usa 11/09/2026 (o dia em que o Johnny pediu o registro), em horário de
-- Brasília, pra que apareçam já no período corrente. Se a data real for outra,
-- corrigir com UPDATE em vez de reaplicar o seed.
--
-- Idempotente: marcado por `registrado_por = 'seed:migration-108'`, então rodar
-- a migration duas vezes não duplica as linhas.
insert into public.retiradas_socios (valor, socio, retirada_em, origem, registrado_por)
select v.valor, v.socio, timestamptz '2026-09-11 12:00:00-03:00', 'hotmart', 'seed:migration-108'
from (values
  (2947.00::numeric, 'Johnny'),
  (2947.00::numeric, 'Lucas'),
  (2947.00::numeric, 'Eduardo')
) as v(valor, socio)
where not exists (
  select 1 from public.retiradas_socios where registrado_por = 'seed:migration-108'
);
