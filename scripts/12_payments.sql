-- ============================================================================
-- 12 — pagamentos / entitlements (Hotmart como checkout principal)
-- Fonte da verdade do ACESSO = este banco, alimentado por webhook.
-- `provider` já contempla 'mercadopago' p/ plugar fallback depois (não usado ainda).
-- Tudo idempotente (if not exists / on conflict no código).
-- ============================================================================

-- ── profiles: cache de acesso p/ gate rápido (plan já existe: free|pro) ──────
alter table public.profiles
  add column if not exists access_until  timestamptz,        -- NULL = sem acesso pago OU vitalício (ver access_source)
  add column if not exists access_source text;               -- 'hotmart' | 'mercadopago' | NULL

comment on column public.profiles.access_until is
  'Fim do acesso pago. NULL = sem acesso, OU vitalício quando access_source preenchido. Cache de entitlements.';
comment on column public.profiles.access_source is
  'Provedor que liberou o acesso atual (hotmart/mercadopago). NULL = nenhum.';

-- ── entitlements: 1 linha por compra/assinatura (fonte da verdade) ──────────
create table if not exists public.entitlements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,  -- NULL = órfão (e-mail ainda não bateu c/ login)
  buyer_email   text not null,                                      -- e-mail do comprador, normalizado lowercase
  provider      text not null default 'hotmart'
                  check (provider in ('hotmart', 'mercadopago')),
  product_code  text,                                               -- código do produto na Hotmart
  offer_code    text,                                               -- código da oferta
  external_id   text not null,                                      -- subscription code (recorrente) OU transaction (único)
  status        text not null
                  check (status in ('active','canceled','refunded','chargeback','expired','past_due')),
  access_until  timestamptz,                                        -- NULL = vitalício (pagamento único)
  raw_event     jsonb,                                              -- último payload recebido (auditoria/debug)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (provider, external_id)                                    -- upsert por compra/assinatura
);

create index if not exists entitlements_buyer_email_idx on public.entitlements (lower(buyer_email));
create index if not exists entitlements_user_id_idx      on public.entitlements (user_id);

comment on table public.entitlements is
  'Direitos de acesso por compra/assinatura. Fonte da verdade do acesso, populada por webhook de pagamento.';

-- ── payment_events: log + idempotência (mesmo evento chega +1x) ─────────────
create table if not exists public.payment_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,                                       -- id único do evento (Hotmart payload.id)
  event_type   text,                                                -- PURCHASE_APPROVED, SUBSCRIPTION_CANCELLATION, ...
  buyer_email  text,
  payload      jsonb,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,                                         -- NULL = recebido mas ainda não processado
  error        text,                                                -- preenchido se o processamento falhou
  unique (provider, event_id)                                       -- CHAVE DE IDEMPOTÊNCIA
);

comment on table public.payment_events is
  'Log de todo webhook de pagamento recebido. unique(provider,event_id) garante idempotência.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.entitlements  enable row level security;
alter table public.payment_events enable row level security;

-- usuário enxerga só os próprios entitlements; escrita é só via service_role (bypassa RLS)
drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own" on public.entitlements
  for select using (auth.uid() = user_id);

-- payment_events: sem policy = ninguém além do service_role acessa (correto)
