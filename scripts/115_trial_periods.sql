-- ============================================================================
-- 115 — trial_periods: a data-fim do trial ganha lugar próprio
--
-- ⚠️ ESPELHO — NÃO APLICADO. DDL aguardando aprovação do Johnny (regra 21).
-- ⚠️ Numerada 115 de propósito: a maior aplicada é a 114
--    (114_voices_reference_cut_mode.sql), e já houve colisão de cinco arquivos
--    "108" em 15/09.
--
-- ── Por que esta tabela existe (o mecanismo é NOVO, não é ajuste)
--
-- Regra do dono (weekly 14/09): o prazo do trial passa a depender do produto
-- comprado — FCI 7 · SGP 30 · CPL 30 · AI Content 90; mais de um produto recebe
-- o MAIOR prazo, NUNCA a soma. A regra pura (e os testes dela) vive em
-- frontend/src/lib/payments/trial-prazo.ts.
--
-- HOJE NÃO EXISTE DATA-FIM DE TRIAL GRAVADA EM LUGAR NENHUM. Medi antes de
-- escrever: o trial não é concedido por nós, ele é DEDUZIDO retroativamente do
-- Hotmart, sempre em SQL e sempre na hora —
--   "PURCHASE_APPROVED com recurrence_number = 1 e price.value = 0",
--   trial_start = min(received_at) por e-mail
-- (mig 63 admin_trial_stats; mig 80/85 expire_trial_credits). A "validade" é um
-- PARÂMETRO da varredura (p_grace_days default 10), aplicado sobre o
-- trial_start no instante em que a função roda. Nada disso sobrevive à
-- pergunta "até quando vale o trial DESTA pessoa?", que é exatamente a
-- pergunta que a regra nova faz, que a tela precisa mostrar e que o botão
-- "Ativar" (cartão 3/4) depende.
--
-- A data-fim passa a morar AQUI, numa linha por pessoa, e não numa coluna de
-- `profiles`, por três razões:
--   1. o trial tem CICLO PRÓPRIO (direito -> ativado -> fim) e histórico de
--      quais produtos o compuseram; isso é uma entidade, não um atributo;
--   2. `profiles` só existe depois que a pessoa CRIA CONTA, e o direito ao
--      trial nasce na COMPRA, que é anterior (é a compra órfã de sempre —
--      dedupe por e-mail, igual ao resto da casa: trial_credit_expirations,
--      admin_trial_stats, expire_trial_credits);
--   3. manter em profiles obrigaria a varredura e as telas a reconstruir o
--      "quais produtos" toda vez, que é o defeito que esta migration remove.
--
-- ── ⚠️⚠️ COLISÃO MEDIDA COM A EXPIRAÇÃO DE 10 DIAS — LEIA ANTES DE APLICAR
--
-- `expire_trial_credits` ZERA `credits_subscription` em trial_start + 10 dias
-- (p_grace_days default 10; o sweep de 5min chama sem argumento, então usa o
-- default). Um trial de SGP de 30 dias teria, hoje, o crédito morto no dia 10:
-- 20 dos 30 dias seriam um trial sem crédito nenhum, ou seja, uma promessa
-- falsa na tela. AI Content (90) seria pior ainda.
--
-- Estado REAL medido em produção hoje (15/09), leitura só, sem chamar a RPC:
--   - `trial_credit_expirations` EXISTE e tem 328 linhas (97 zeroed, 231 paid);
--   - `trial_expiry_config` e `billing_allowlist` NÃO EXISTEM
--     -> a mig 85 (kill-switch + teto + allowlist) NUNCA FOI APLICADA;
--   - as 328 linhas têm TODAS o mesmo resolved_at (2026-08-18T18:45:05Z) e não
--     houve NENHUMA resolução nos ~28 dias seguintes
--     -> a função viva está parada. Bate com o cabeçalho da própria mig 85
--        ("DESLIGAR EXIGIA MUTILAR A FUNÇÃO EM PRODUÇÃO — o corpo vivo divergiu
--        do repo por 2 dias"): o corpo em produção foi neutralizado à mão e o
--        repo não sabe qual é.
--
-- CONSEQUÊNCIA PRÁTICA: a trava de 10 dias está DORMENTE, mas DESPROTEGIDA —
-- sem kill-switch, sem teto e com corpo desconhecido. Quem religar a varredura
-- sem reconciliar o prazo vai zerar crédito de trial de 30 e 90 dias no dia 10.
--
-- POR ISSO ESTA MIGRATION **NÃO TOCA** EM expire_trial_credits. Um
-- `create or replace` aqui sobrescreveria um corpo que ninguém leu e poderia
-- RESSUSCITAR uma varredura que foi desligada à mão depois de um incidente —
-- exatamente o tipo de efeito colateral silencioso que custou os 14 zerados de
-- 18/08. A reconciliação (fazer a varredura ler `trial_periods.fim` em vez de
-- trial_start + 10) é um ATO SEPARADO E EXPLÍCITO, que exige antes:
--   (a) ler o corpo vivo da função em produção e trazê-lo pro repo;
--   (b) decidir o que fazer com a mig 85, que está escrita e não aplicada.
-- Enquanto isso não acontecer, NÃO conceder trial > 10 dias em produção.
-- ============================================================================

create table if not exists public.trial_periods (
  -- pessoa = e-mail, MESMO dedupe do resto da casa (trial_credit_expirations,
  -- admin_trial_stats, expire_trial_credits). Classificar por ASSINATURA em vez
  -- de por PESSOA é a armadilha registrada de 18/08: 2 em 180 tinham cancelado
  -- um trial e tinham OUTRA assinatura ativa.
  email        text primary key,
  user_id      uuid references auth.users(id) on delete set null,

  -- quando a COMPRA deu direito ao trial (anterior à conta existir)
  entitled_at  timestamptz not null,

  -- quando o ALUNO ativou. NULL = direito concedido e não usado; é este NULL
  -- que alimenta o filtro "trial não ativado" do admin e a métrica
  -- "% de compradores SGP que ativaram em até 7 dias".
  activated_at timestamptz,

  -- a janela, só depois de ativado. fim = activated_at + dias.
  fim          timestamptz,

  -- o MAIOR prazo entre os produtos da pessoa (nunca a soma). Vive gravado
  -- porque é ele que sobrevive a "comprou outro produto depois".
  dias         int not null check (dias > 0),

  status       text not null
                 check (status in ('entitled','active','paying')),

  -- histórico: [{product_code, dias, at, evento_id, conhecido}]
  -- "já pagante -> NÃO MUDA NADA, só registra no histórico" mora aqui: a linha
  -- fica em status 'paying', `fim` continua NULL, e o produto ainda assim é
  -- anexado a este array.
  produtos     jsonb not null default '[]'::jsonb,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- coerência: ativado <-> tem fim. Impede linha meia-boca.
  constraint trial_periods_ativado_tem_fim
    check ((activated_at is null) = (fim is null)),
  constraint trial_periods_active_e_ativado
    check (status <> 'active' or activated_at is not null)
);

comment on table public.trial_periods is
  'Trial por produto (regra 14/09): direito, ativação e DATA-FIM do trial. Fonte única do "até quando vale". Prazo = o MAIOR entre os produtos, nunca a soma. Regra pura e testada em frontend/src/lib/payments/trial-prazo.ts.';
comment on column public.trial_periods.activated_at is
  'NULL = trial concedido e NÃO ativado (filtro do admin + métrica de ativação em 7 dias).';
comment on column public.trial_periods.dias is
  'O MAIOR prazo entre os produtos da pessoa. NUNCA a soma — somar seria o defeito mais caro aqui, porque trial comprido não gera reclamação, só aparece na fatura.';

alter table public.trial_periods enable row level security;  -- service-only

-- ── idempotência do webhook, no banco ────────────────────────────────────────
-- A Hotmart REENTREGA. A mesma transação não pode esticar o trial duas vezes.
-- A trava é esta unique: quem já aplicou o evento não aplica de novo. É a
-- mesma chave que a regra pura usa (decidirTrial(..., eventoId, jaAplicados)).
create table if not exists public.trial_period_events (
  email      text not null,
  evento_id  text not null,                -- transação da Hotmart
  product_code text,
  dias       int,
  acao       text not null
               check (acao in ('criar','estender','nada')),
  motivo     text,                          -- pagante | ja_aplicado | prazo_nao_aumenta
  applied_at timestamptz not null default now(),
  primary key (email, evento_id)
);
comment on table public.trial_period_events is
  'Marcador de idempotência do trial por produto: uma linha por (pessoa, transação Hotmart). Reentrega do webhook vira no-op.';
alter table public.trial_period_events enable row level security;  -- service-only

-- ── índices das duas telas pedidas no cartão ─────────────────────────────────
-- filtro "trial não ativado" do admin SGP
create index if not exists trial_periods_nao_ativado_idx
  on public.trial_periods (entitled_at)
  where activated_at is null;

-- métrica "% que ativou em até 7 dias" + listagem por data-fim
create index if not exists trial_periods_fim_idx
  on public.trial_periods (fim)
  where fim is not null;
