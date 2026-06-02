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
export type Plan = "free" | "pro";

type Timestamp = string; // ISO-8601

// ───────── profiles ─────────
export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: Plan;
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
      usage_monthly: { Row: UsageMonthlyRow; Insert: UsageMonthlyInsert; Update: UsageMonthlyUpdate; Relationships: Rel };
      api_keys:      { Row: ApiKeyRow;       Insert: ApiKeyInsert;       Update: ApiKeyUpdate;       Relationships: Rel };
      user_consents: { Row: UserConsentRow;  Insert: UserConsentInsert;  Update: UserConsentUpdate;  Relationships: Rel };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
