/**
 * Tipagem mínima das tabelas do Supabase pra type-safety no SDK.
 * Não substitui `supabase gen types typescript` em produção, mas cobre
 * as colunas usadas pelo backend hoje.
 */

export type VoiceStatus =
  | "uploading"
  | "validating"
  | "awaiting_training"
  | "rejected_too_short"
  | "training"
  | "ready"
  | "failed";

export type TrainingJobStatus = "queued" | "running" | "completed" | "failed";
export type GenerationStatus = "pending" | "generating" | "ready" | "failed";
export type ImageGenerationStatus = "pending" | "generating" | "ready" | "failed";
export type Plan = "free" | "pro";

// ───────── pagamentos ─────────
export type PaymentProvider = "hotmart" | "mercadopago" | "stripe";
export type EntitlementStatus =
  | "active"
  | "canceled"
  | "refunded"
  | "chargeback"
  | "expired"
  | "past_due";

type Timestamp = string; // ISO-8601

// JSON serializável (igual aos types gerados pelo Supabase). Colunas jsonb usam
// este tipo — `unknown` quebra a tipagem de insert/update do supabase-js.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ───────── profiles ─────────
export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: Plan;
  access_until: Timestamp | null; // cache de entitlements; NULL = sem acesso OU vitalício (ver access_source)
  access_source: PaymentProvider | null; // provedor que liberou o acesso atual
  credits_subscription: number; // créditos do plano (zeram/recarregam no ciclo)
  credits_extra: number;        // créditos avulsos comprados (não expiram)
  pending_payment_at: Timestamp | null; // Pix/boleto gerado aguardando pagamento (banner); NULL = nada pendente
  last_seen_at: Timestamp | null; // heartbeat p/ "online agora" no /admin
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type ProfileInsert = {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  plan?: Plan;
};
export type ProfileUpdate = Partial<ProfileRow>;

// ───────── voices ─────────
export type VoiceRow = {
  id: string;
  user_id: string;
  name: string;
  status: VoiceStatus;
  duration_seconds: number | null;
  raw_audio_paths: string[];
  lora_path: string | null;
  reference_audio_path: string | null;
  reference_transcript: string | null;
  lora_alpha: number | null;
  tts_silence_ms: number | null;
  tts_crossfade_ms: number | null;
  runpod_job_id: string | null;
  error_message: string | null;
  trained_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type VoiceInsert = {
  id?: string;
  user_id: string;
  name: string;
  status?: VoiceStatus;
  duration_seconds?: number | null;
  raw_audio_paths?: string[];
  lora_path?: string | null;
  runpod_job_id?: string | null;
  error_message?: string | null;
};
export type VoiceUpdate = Partial<VoiceRow>;

// ───────── training_jobs ─────────
export type TrainingJobRow = {
  id: string;
  voice_id: string;
  user_id: string;
  runpod_job_id: string;
  status: TrainingJobStatus;
  steps: number | null;
  final_loss: number | null;
  elapsed_seconds: number | null;
  error_message: string | null;
  started_at: Timestamp | null;
  finished_at: Timestamp | null;
  created_at: Timestamp;
};
export type TrainingJobInsert = {
  voice_id: string;
  user_id: string;
  runpod_job_id: string;
  status?: TrainingJobStatus;
};
export type TrainingJobUpdate = Partial<TrainingJobRow>;

// ───────── generations ─────────
export type GenerationRow = {
  id: string;
  user_id: string;
  voice_id: string;
  name: string | null;
  text_raw: string;
  text_normalized: string | null;
  reference_audio_path: string;
  reference_transcript: string;
  audio_path: string | null;
  sample_rate: number | null;
  duration_seconds: number | null;
  elapsed_seconds: number | null;
  status: GenerationStatus;
  error_message: string | null;
  runpod_job_id: string | null;
  created_at: Timestamp;
};
export type GenerationInsert = {
  user_id: string;
  voice_id: string;
  text_raw: string;
  reference_audio_path: string;
  reference_transcript: string;
  runpod_job_id?: string | null;
};
export type GenerationUpdate = Partial<GenerationRow>;

// ───────── image_generations ─────────
export type ImageGenerationRow = {
  id: string;
  user_id: string;
  name: string | null;
  prompt: string;
  idea: string | null;
  input_image_path: string;
  input_image_paths: string[] | null;
  aspect_ratio: string;
  resolution: string;
  credits_cost: number;
  image_path: string | null;
  status: ImageGenerationStatus;
  kie_task_id: string | null;
  error_message: string | null;
  created_at: Timestamp;
};
export type ImageGenerationInsert = {
  id?: string;
  user_id: string;
  name?: string | null;
  prompt: string;
  idea?: string | null;
  input_image_path: string;
  input_image_paths?: string[] | null;
  aspect_ratio: string;
  resolution: string;
  credits_cost: number;
  status?: ImageGenerationStatus;
  kie_task_id?: string | null;
};
export type ImageGenerationUpdate = Partial<ImageGenerationRow>;

// ───────── usage_monthly ─────────
export type UsageMonthlyRow = {
  user_id: string;
  period_month: string;
  trainings_used: number;
  generations_used: number;
};
export type UsageMonthlyInsert = UsageMonthlyRow;
export type UsageMonthlyUpdate = Partial<UsageMonthlyRow>;

// ───────── api_keys ─────────
export type ApiKeyRow = {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  last_used_at: Timestamp | null;
  revoked_at: Timestamp | null;
  created_at: Timestamp;
};
export type ApiKeyInsert = {
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
};
export type ApiKeyUpdate = Partial<ApiKeyRow>;

// ───────── admin_emails ─────────
export type AdminEmailRow = {
  id: string;
  email: string;
  added_by: string | null;
  created_at: Timestamp;
};
export type AdminEmailInsert = {
  email: string;
  added_by?: string | null;
};
export type AdminEmailUpdate = Partial<AdminEmailRow>;

// ───────── user_consents ─────────
export type UserConsentRow = {
  id: string;
  user_id: string;
  consent_type: string;
  consent_version: string;
  accepted_at: Timestamp;
  ip_address: string | null;
  user_agent: string | null;
  revoked_at: Timestamp | null;
};
export type UserConsentInsert = {
  user_id: string;
  consent_type: string;
  consent_version: string;
  ip_address?: string | null;
  user_agent?: string | null;
};
export type UserConsentUpdate = Partial<UserConsentRow>;

// ───────── entitlements ─────────
export type EntitlementRow = {
  id: string;
  user_id: string | null;
  buyer_email: string;
  provider: PaymentProvider;
  product_code: string | null;
  offer_code: string | null;
  external_id: string;
  status: EntitlementStatus;
  access_until: Timestamp | null; // NULL = vitalício (pagamento único)
  raw_event: Json | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type EntitlementInsert = {
  user_id?: string | null;
  buyer_email: string;
  provider: PaymentProvider;
  product_code?: string | null;
  offer_code?: string | null;
  external_id: string;
  status: EntitlementStatus;
  access_until?: Timestamp | null;
  raw_event?: Json | null;
  updated_at?: Timestamp;
};
export type EntitlementUpdate = Partial<EntitlementRow>;

// ───────── payment_events ─────────
export type PaymentEventRow = {
  id: string;
  provider: PaymentProvider;
  event_id: string;
  event_type: string | null;
  buyer_email: string | null;
  payload: Json | null;
  received_at: Timestamp;
  processed_at: Timestamp | null;
  error: string | null;
};
export type PaymentEventInsert = {
  provider: PaymentProvider;
  event_id: string;
  event_type?: string | null;
  buyer_email?: string | null;
  payload?: Json | null;
  processed_at?: Timestamp | null;
  error?: string | null;
};
export type PaymentEventUpdate = Partial<PaymentEventRow>;

// ───────── credit_transactions ─────────
export type CreditTransactionRow = {
  id: string;
  user_id: string;
  kind: string;
  amount: number;
  balance_after: number;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  created_at: Timestamp;
};
export type CreditTransactionInsert = Omit<CreditTransactionRow, "id" | "created_at">;
export type CreditTransactionUpdate = Partial<CreditTransactionRow>;

// ───────── subscription_cancellations ─────────
export type SubscriptionCancellationRow = {
  id: string;
  user_id: string | null;
  reason: string | null;
  detail: string | null;
  created_at: Timestamp;
};
export type SubscriptionCancellationInsert = {
  user_id?: string | null;
  reason?: string | null;
  detail?: string | null;
};
export type SubscriptionCancellationUpdate = Partial<SubscriptionCancellationRow>;

// ───────── credit_campaigns (feature de bônus à parte) ─────────
export type CreditCampaignRow = {
  id: string;
  name: string;
  bonus_credits: number;
  trigger: string;
  starts_at: Timestamp;
  ends_at: Timestamp;
  active: boolean;
  created_by: string | null;
  created_at: Timestamp;
};
export type CreditCampaignInsert = {
  name: string;
  bonus_credits: number;
  trigger?: string;
  starts_at?: Timestamp;
  ends_at: Timestamp;
  active?: boolean;
  created_by?: string | null;
};
export type CreditCampaignUpdate = Partial<CreditCampaignRow>;

// ───────── credit_campaign_grants ─────────
export type CreditCampaignGrantRow = {
  campaign_id: string;
  user_id: string;
  credits: number;
  ref_id: string | null;
  granted_at: Timestamp;
};
export type CreditCampaignGrantInsert = {
  campaign_id: string;
  user_id: string;
  credits: number;
  ref_id?: string | null;
};
export type CreditCampaignGrantUpdate = Partial<CreditCampaignGrantRow>;

// ───────── Database (composição) ─────────
// Cada tabela precisa de `Relationships: []` pra satisfazer GenericTable do supabase-js v2.105+.
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};
type Rel = Relationship[];

export type Database = {
  public: {
    Tables: {
      profiles:      { Row: ProfileRow;      Insert: ProfileInsert;      Update: ProfileUpdate;      Relationships: Rel };
      voices:        { Row: VoiceRow;        Insert: VoiceInsert;        Update: VoiceUpdate;        Relationships: Rel };
      training_jobs: { Row: TrainingJobRow;  Insert: TrainingJobInsert;  Update: TrainingJobUpdate;  Relationships: Rel };
      generations:   { Row: GenerationRow;   Insert: GenerationInsert;   Update: GenerationUpdate;   Relationships: Rel };
      image_generations: { Row: ImageGenerationRow; Insert: ImageGenerationInsert; Update: ImageGenerationUpdate; Relationships: Rel };
      usage_monthly: { Row: UsageMonthlyRow; Insert: UsageMonthlyInsert; Update: UsageMonthlyUpdate; Relationships: Rel };
      api_keys:      { Row: ApiKeyRow;       Insert: ApiKeyInsert;       Update: ApiKeyUpdate;       Relationships: Rel };
      admin_emails:  { Row: AdminEmailRow;   Insert: AdminEmailInsert;   Update: AdminEmailUpdate;   Relationships: Rel };
      user_consents: { Row: UserConsentRow;  Insert: UserConsentInsert;  Update: UserConsentUpdate;  Relationships: Rel };
      entitlements:  { Row: EntitlementRow;  Insert: EntitlementInsert;  Update: EntitlementUpdate;  Relationships: Rel };
      payment_events:{ Row: PaymentEventRow; Insert: PaymentEventInsert; Update: PaymentEventUpdate; Relationships: Rel };
      credit_transactions: { Row: CreditTransactionRow; Insert: CreditTransactionInsert; Update: CreditTransactionUpdate; Relationships: Rel };
      subscription_cancellations: { Row: SubscriptionCancellationRow; Insert: SubscriptionCancellationInsert; Update: SubscriptionCancellationUpdate; Relationships: Rel };
      credit_campaigns: { Row: CreditCampaignRow; Insert: CreditCampaignInsert; Update: CreditCampaignUpdate; Relationships: Rel };
      credit_campaign_grants: { Row: CreditCampaignGrantRow; Insert: CreditCampaignGrantInsert; Update: CreditCampaignGrantUpdate; Relationships: Rel };
    };
    Views: Record<string, never>;
    Functions: {
      admin_metrics:      { Args: { p_since: string }; Returns: Json };
      admin_timeseries:   { Args: { p_since: string }; Returns: Json };
      admin_live_cloning: { Args: Record<string, never>; Returns: Json };
      admin_users:        { Args: Record<string, never>; Returns: Json };
      admin_failures:     { Args: { p_limit?: number }; Returns: Json };
      admin_history:      { Args: { p_limit?: number }; Returns: Json };
      debit_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_kind: string;
          p_ref_type?: string | null;
          p_ref_id?: string | null;
          p_note?: string | null;
        };
        Returns: Json;
      };
      grant_subscription_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_ref_type?: string | null;
          p_ref_id?: string | null;
        };
        Returns: Json;
      };
      add_extra_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_ref_type?: string | null;
          p_ref_id?: string | null;
        };
        Returns: Json;
      };
      apply_purchase_campaign_bonus: {
        Args: { p_user_id: string; p_ref_id?: string | null };
        Returns: Json;
      };
      admin_list_campaigns: { Args: Record<string, never>; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
