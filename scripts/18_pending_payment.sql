-- ============================================================================
-- 18_pending_payment.sql
-- Aviso de "pagamento pendente" (Pix/boleto). Quando a Hotmart avisa que um
-- pagamento assíncrono foi GERADO mas ainda não pago (PURCHASE_BILLET_PRINTED /
-- status WAITING_PAYMENT), marcamos o perfil pra mostrar um banner "aguardando
-- pagamento — acesso libera ao confirmar". Limpo ao aprovar/expirar/cancelar.
-- Aplicar via Transaction Pooler (porta 6543). Idempotente.
-- ============================================================================
alter table public.profiles
  add column if not exists pending_payment_at timestamptz;

comment on column public.profiles.pending_payment_at is
  'Pagamento assíncrono (Pix/boleto) gerado e aguardando confirmação. NULL = nada pendente. Setado no webhook em PURCHASE_BILLET_PRINTED/status de espera; limpo ao aprovar/expirar/cancelar.';
