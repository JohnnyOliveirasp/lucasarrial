-- 95 · Dois níveis de acesso ao /admin: ADMIN e SUPORTE.
--
-- Pedido do Johnny (24/08), na hora de dar acesso à Karen (gerente de
-- suporte): *"números de faturamento, resultados, acho bom não compartilhar
-- com estas pessoas... ela é gerente, mas admin seria visto somente as falhas
-- e o agente"*. Até aqui a allowlist era binária — quem entrava no /admin via
-- TUDO, inclusive caixa, lucro e a régua de retirada dos sócios.
--
--   admin   = acesso total (o que sempre existiu).
--   suporte = SÓ Falhas (chamados/incidentes) e Agente (painel da Fast).
--             Não vê Visão geral (dinheiro), Usuários, Campanhas, Cortesias,
--             Históricos nem a gestão de Admins.
--
-- Default 'admin' de propósito: as 5 linhas que já existiam são sócios/time
-- e não podem perder acesso numa migration. Quem for suporte é marcado a mão
-- (ou pela tela /admin/admins).
--
-- ⚠️ A tabela é a fonte editável, mas a env ADMIN_EMAILS segue como fallback
-- de bootstrap — e quem entra por ela é sempre 'admin' (lib/admin/guard.ts).
-- Não coloque gente de suporte na env, ou o papel é ignorado.

alter table admin_emails
  add column if not exists role text not null default 'admin';

alter table admin_emails drop constraint if exists admin_emails_role_check;
alter table admin_emails add constraint admin_emails_role_check
  check (role in ('admin', 'suporte'));

comment on column admin_emails.role is
  'admin = painel inteiro (inclui financeiro) · suporte = so Falhas + Agente. Pedido do Johnny 24/08.';

-- A primeira do papel novo: Karen, gerente de suporte (24/08).
update admin_emails set role = 'suporte'
 where email = 'karenarrialvivant@gmail.com';
