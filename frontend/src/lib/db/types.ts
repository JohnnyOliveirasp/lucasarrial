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
export type VideoProjectStatus =
  | "draft"
  | "scenes"
  | "images"
  | "videos"
  | "rendering"
  | "done"
  | "failed";
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
  image_ref_key: string | null; // referência FIXA do estúdio de imagem (mig 68, onboarding via planilha)
  onboarding_ready_email_at: Timestamp | null; // e-mail "plataforma pronta" enviado (13/08)
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
  /** Vozes Prontas (catálogo FastCloner) — migs 43-45. */
  is_stock: boolean | null;
  language: string | null;
  accent: string | null;
  description: string | null;
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
  /** Áudio ÚTIL (pós Demucs+VAD) medido pelo worker — migration 30. */
  useful_seconds: number | null;
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
  /** Tradução do prompt pro modelo (mig 56); null nas rows antigas (prompt já era en). */
  prompt_en: string | null;
  /** Cache da tradução es pra exibição do histórico (mig 62, lazy). */
  prompt_es: string | null;
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
  /** Resubmits automáticos por erro transiente do Kie (mig 54; máx 1). */
  retry_count: number;
  /** Modelo que atendeu a geração (mig 55): gpt titular; seedream = contingência. */
  kie_model: string;
  /** Erro CRU do Kie (mig 58) — error_message é a versão amigável pro aluno. */
  kie_raw_error: string | null;
  created_at: Timestamp;
  // Vídeo animado a partir da imagem (migration 28) — espelha video_scenes.
  video_path: string | null;
  video_status: ImageGenerationStatus | null;
  video_kie_task_id: string | null;
  video_prompt_pt: string | null;
  video_prompt_en: string | null;
  video_tier: string | null;
  video_credits_cost: number | null;
  video_error: string | null;
  /** Modelo que atendeu o vídeo (mig 65): titular do tier ou o fallback. */
  video_kie_model: string | null;
  /** Retentativas de fallback do vídeo já usadas (mig 65; máx 1). */
  video_retry_count: number;
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
  /** Import de upload próprio nasce pronto (status ready + arquivo no bucket). */
  image_path?: string | null;
  status?: ImageGenerationStatus;
  kie_task_id?: string | null;
  kie_model?: string;
  kie_raw_error?: string | null;
  prompt_en?: string | null;
};
export type ImageGenerationUpdate = Partial<ImageGenerationRow>;

// ───────── video_projects ─────────
export type VideoProjectRow = {
  id: string;
  user_id: string;
  name: string | null;
  status: VideoProjectStatus;
  source_generation_id: string | null;
  audio_path: string | null;
  audio_duration_seconds: number | null;
  script_text: string | null;
  aspect_ratio: string;
  scene_count: number | null;
  video_tier: string | null;
  final_video_path: string | null;
  reference_image_paths: string[] | null;
  image_consent_at: Timestamp | null;
  subtitle_style: string;
  subtitle_position: string | null;
  subtitle_size: string | null;
  error_message: string | null;
  created_at: Timestamp;
  // Vídeo Vendas TikTok (migration 27)
  kind: "story" | "sales";
  product_image_paths: string[] | null;
  product_price: string | null;
  product_link: string | null;
  product_description: string | null;
  product_analysis: string | null;
};
export type VideoProjectInsert = {
  id?: string;
  user_id: string;
  name?: string | null;
  status?: VideoProjectStatus;
  source_generation_id?: string | null;
  audio_path?: string | null;
  audio_duration_seconds?: number | null;
  script_text?: string | null;
  aspect_ratio?: string;
  scene_count?: number | null;
  video_tier?: string | null;
  final_video_path?: string | null;
  reference_image_paths?: string[] | null;
  image_consent_at?: Timestamp | null;
  kind?: "story" | "sales";
  product_image_paths?: string[] | null;
  product_price?: string | null;
  product_link?: string | null;
  product_description?: string | null;
  product_analysis?: string | null;
};
export type VideoProjectUpdate = Partial<VideoProjectRow>;

// ───────── video_scenes ─────────
export type VideoSceneRow = {
  id: string;
  video_project_id: string;
  user_id: string;
  idx: number;
  prompt_pt: string;
  prompt_en: string | null;
  script_excerpt: string | null;
  image_path: string | null;
  image_status: ImageGenerationStatus | null;
  image_kie_task_id: string | null;
  resolution: string;
  image_credits_cost: number;
  image_error: string | null;
  video_path: string | null;
  video_status: ImageGenerationStatus | null;
  video_kie_task_id: string | null;
  video_prompt_pt: string | null;
  video_prompt_en: string | null;
  video_tier: string | null;
  video_credits_cost: number;
  video_error: string | null;
  created_at: Timestamp;
};
export type VideoSceneInsert = {
  id?: string;
  video_project_id: string;
  user_id: string;
  idx: number;
  prompt_pt: string;
  prompt_en?: string | null;
  script_excerpt?: string | null;
};
export type VideoSceneUpdate = Partial<VideoSceneRow>;

// ───────── render_jobs ─────────
export type RenderJobStatus = "pending" | "processing" | "done" | "failed";
export type RenderJobRow = {
  id: string;
  video_project_id: string;
  user_id: string;
  status: RenderJobStatus;
  attempts: number;
  error: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type RenderJobInsert = {
  id?: string;
  video_project_id: string;
  user_id: string;
  status?: RenderJobStatus;
};
export type RenderJobUpdate = Partial<RenderJobRow>;

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

// ───────── heygen_accounts (mig 59 — BYOK "HeyGen dentro do FastCloner") ─────────
export type HeygenAccountRow = {
  id: string;
  user_id: string;
  /** AES-256-GCM (lib/heygen/crypto) — NUNCA devolver ao client. */
  api_key_encrypted: string;
  label: string | null;
  status: "active" | "invalid" | "revoked";
  remaining_credits: number | null;
  last_validated_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type HeygenAccountInsert = {
  user_id: string;
  api_key_encrypted: string;
  label?: string | null;
  status?: HeygenAccountRow["status"];
  remaining_credits?: number | null;
  last_validated_at?: Timestamp | null;
  updated_at?: Timestamp;
};
export type HeygenAccountUpdate = Partial<Omit<HeygenAccountRow, "id" | "user_id">>;

// ───────── heygen_videos (mig 60 — vídeos Avatar IV via conta do aluno) ─────────
export type HeygenVideoRow = {
  id: string;
  user_id: string;
  heygen_video_id: string | null;
  image_source: "platform_image" | "upload" | "heygen_look";
  audio_generation_id: string | null;
  title: string | null;
  status: "processing" | "ready" | "failed";
  video_path: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type HeygenVideoInsert = {
  user_id: string;
  heygen_video_id?: string | null;
  image_source: HeygenVideoRow["image_source"];
  audio_generation_id?: string | null;
  title?: string | null;
  status?: HeygenVideoRow["status"];
};
export type HeygenVideoUpdate = Partial<Omit<HeygenVideoRow, "id" | "user_id" | "created_at">>;

// ───────── scripts (mig 68 — Gerador de Roteiro) ─────────
export type ScriptRow = {
  id: string;
  user_id: string;
  idea: string;
  seconds: number;
  script: string;
  /** Modelo que escreveu (ROTEIRO_MODEL do dia) — o modelo é trocável sem deploy. */
  model: string | null;
  credits_charged: number;
  created_at: Timestamp;
};
export type ScriptInsert = {
  user_id: string;
  idea: string;
  seconds: number;
  script: string;
  model?: string | null;
  credits_charged?: number;
};
export type ScriptUpdate = Partial<Omit<ScriptRow, "id" | "user_id" | "created_at">>;

// ───────── viral_videos (mig 72 — "Vídeos Virais") ─────────
export type ViralVideoRow = {
  id: string;
  plataforma: string;
  /** id do vídeo NA REDE — âncora da dedup entre buscas. */
  video_id: string;
  url: string;
  autor: string | null;
  autor_seguidores: number | null;
  legenda: string | null;
  likes: number;
  views: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  publicado_em: Timestamp | null;
  duracao_seg: number | null;
  thumb_url: string | null;
  /** mp4 na CDN da rede: EXPIRA. Player e download sob demanda. */
  video_url: string | null;
  hashtags: string[] | null;
  score: number;
  termo_busca: string | null;
  origem_run_id: string | null;
  /** Só o marcado desce pro R2 — segura o bucket de virar depósito. */
  selecionado: boolean;
  selecionado_por: string | null;
  selecionado_em: Timestamp | null;
  download_status: string;
  r2_key: string | null;
  download_erro: string | null;
  /** Descarte lógico (mig 73): some da tela e a busca não traz de volta.
   *  ⚠️ Legado GLOBAL — a partir da mig 75 o descarte é pessoal
   *  (viral_user_videos); este aqui vale pra todo mundo e só sobrevive pro
   *  que já tinha sido jogado fora antes. */
  descartado: boolean;
  descartado_em: Timestamp | null;
  /** Quem PAGOU a busca que trouxe o vídeo (mig 75). */
  garimpado_por: string | null;
  /** Vantagem de 7 dias de quem garimpou; depois cai no acervo comum. */
  exclusivo_ate: Timestamp | null;
  criado_em: Timestamp;
};
export type ViralVideoInsert = Omit<ViralVideoRow, "id" | "criado_em"> & {
  id?: string;
  criado_em?: Timestamp;
};
export type ViralVideoUpdate = Partial<Omit<ViralVideoRow, "id" | "criado_em">>;

// ───────── viral_user_videos (mig 75 — a curadoria vira PESSOAL) ─────────
/**
 * O catálogo é comum a todos; o que é de cada um mora aqui. Reservar NÃO
 * baixa: o mp4 só desce quando a pessoa vai produzir o Video React.
 */
export type ViralUserVideoRow = {
  id: string;
  user_id: string;
  viral_id: string;
  /** "vou usar este" → entra em Meus Virais (só metadado + capa). */
  reservado: boolean;
  reservado_em: Timestamp | null;
  /** Descarte PESSOAL: some da minha grade, fica na dos outros. */
  descartado: boolean;
  descartado_em: Timestamp | null;
  /** Virou Video React — alimenta o selo "N pessoas usando". */
  usado: boolean;
  usado_em: Timestamp | null;
  download_status: string;
  r2_key: string | null;
  download_erro: string | null;
  /** Régua do TTL: arquivo sem uso há 60 dias sai do R2 (metadado fica). */
  arquivo_tocado_em: Timestamp | null;
  /** Quantas vezes o Gemini já assistiu ESTE vídeo pra ESTA pessoa (mig 77).
   *  A 1ª está inclusa no React; da 2ª em diante cobra. */
  roteiros_gerados: number;
  criado_em: Timestamp;
};
export type ViralUserVideoInsert = Omit<ViralUserVideoRow, "id" | "criado_em"> & {
  id?: string;
  criado_em?: Timestamp;
};
export type ViralUserVideoUpdate = Partial<Omit<ViralUserVideoRow, "id" | "criado_em">>;

// ───────── react_jobs (mig 76 — fila do Video React) ─────────
/** fila → baixando → clonando → montando → pronto | erro */
export type ReactJobRow = {
  id: string;
  user_id: string;
  viral_id: string;
  layout: string;
  roteiro: string;
  cta: string | null;
  /** vira chave do R2 assim que a foto sai do Kie pro nosso lado. */
  foto_url: string | null;
  audio_url: string | null;
  segundos: number;
  viral_r2_key: string | null;
  clone_job_id: string | null;
  clone_r2_key: string | null;
  status: string;
  erro: string | null;
  r2_key: string | null;
  /** mig 78 — mesmos ids de SUBTITLE_PRESETS; "none"/null = vídeo limpo. */
  legenda_estilo: string | null;
  legenda_posicao: string | null;
  legenda_tamanho: string | null;
  /** mig 79 — fundo do trecho "você em tela cheia"; null = fundo escuro. */
  fundo_key: string | null;
  criado_em: Timestamp;
  atualizado_em: Timestamp;
};
export type ReactJobInsert = Omit<ReactJobRow, "id" | "criado_em" | "atualizado_em"> & {
  id?: string;
  criado_em?: Timestamp;
  atualizado_em?: Timestamp;
};
export type ReactJobUpdate = Partial<Omit<ReactJobRow, "id" | "criado_em">>;

// ───────── script_messages (mig 69 — chat de ajuste do roteiro) ─────────
export type ScriptMessageRow = {
  id: string;
  script_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  /** Roteiro que ESTA resposta produziu (null = a resposta não mexeu no texto). */
  script_after: string | null;
  credits_charged: number;
  created_at: Timestamp;
};
export type ScriptMessageInsert = {
  script_id: string;
  user_id: string;
  role: ScriptMessageRow["role"];
  content: string;
  script_after?: string | null;
  credits_charged?: number;
};
export type ScriptMessageUpdate = Partial<Omit<ScriptMessageRow, "id" | "script_id" | "user_id" | "created_at">>;

// ───────── social_accounts (mig 61 — publicador próprio, IG primeiro) ─────────
export type SocialAccountRow = {
  id: string;
  user_id: string;
  platform: "instagram" | "tiktok";
  /** id do usuário NA plataforma (IG user id / TikTok open_id). */
  account_ref: string;
  username: string | null;
  auth_kind: "instagram_login" | "tiktok_oauth";
  /** AES-256-GCM (lib/social/crypto) — NUNCA devolver ao client. */
  access_token_encrypted: string;
  /** TikTok renova o access (24h) por refresh_token (365d); IG não usa. */
  refresh_token_encrypted: string | null;
  token_expires_at: Timestamp | null;
  status: "active" | "expired" | "revoked";
  connected_at: Timestamp;
  updated_at: Timestamp;
};
export type SocialAccountInsert = {
  user_id: string;
  platform?: SocialAccountRow["platform"];
  account_ref: string;
  username?: string | null;
  auth_kind?: SocialAccountRow["auth_kind"];
  access_token_encrypted: string;
  refresh_token_encrypted?: string | null;
  token_expires_at?: Timestamp | null;
  status?: SocialAccountRow["status"];
  updated_at?: Timestamp;
};
export type SocialAccountUpdate = Partial<Omit<SocialAccountRow, "id" | "user_id">>;

// ───────── publications (mig 61 — fila/histórico de posts) ─────────
export type PublicationRow = {
  id: string;
  user_id: string;
  account_id: string;
  platform: "instagram" | "tiktok";
  media_type: "reel" | "image" | "story";
  media_url: string;
  caption: string | null;
  scheduled_at: Timestamp | null;
  status: "ready" | "processing" | "published" | "failed";
  container_id: string | null;
  platform_post_id: string | null;
  permalink: string | null;
  /** TikTok: { privacy_level, disable_comment, brand_content, brand_organic }. */
  platform_options: Record<string, unknown> | null;
  attempts: number;
  error: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type PublicationInsert = {
  user_id: string;
  account_id: string;
  platform?: PublicationRow["platform"];
  media_type?: PublicationRow["media_type"];
  media_url: string;
  caption?: string | null;
  scheduled_at?: Timestamp | null;
  status?: PublicationRow["status"];
  platform_options?: PublicationRow["platform_options"];
};
export type PublicationUpdate = Partial<Omit<PublicationRow, "id" | "user_id" | "created_at">>;

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

// ───────── courtesy_campaigns (Cortesias sem Hotmart, migration 53) ─────────
export type CourtesyCampaignRow = {
  id: string;
  name: string;
  credits_per_person: number;
  starts_at: Timestamp;
  ends_at: Timestamp;
  active: boolean;
  created_by: string | null;
  created_at: Timestamp;
};
export type CourtesyCampaignInsert = {
  name: string;
  credits_per_person: number;
  starts_at?: Timestamp;
  ends_at: Timestamp;
  active?: boolean;
  created_by?: string | null;
};
export type CourtesyCampaignUpdate = Partial<CourtesyCampaignRow>;

// ───────── courtesy_grants (1 linha por e-mail da campanha) ─────────
export type CourtesyGrantRow = {
  campaign_id: string;
  email: string;
  user_id: string | null;
  amount: number;
  granted_at: Timestamp | null;
  expired_at: Timestamp | null;
  remaining_expired: number | null;
};
export type CourtesyGrantInsert = {
  campaign_id: string;
  email: string;
  user_id?: string | null;
  amount: number;
  granted_at?: Timestamp | null;
};
export type CourtesyGrantUpdate = Partial<CourtesyGrantRow>;

// ───────── video_clones (Vídeo Clone / InfiniteTalk, migration 29) ─────────
export type VideoCloneStatus = "pending" | "generating" | "ready" | "failed";
export type VideoCloneRow = {
  id: string;
  user_id: string;
  name: string | null;
  image_path: string;
  audio_path: string;
  duration_seconds: number;
  num_frames: number;
  tier: "480p" | "720p" | "480p-v2" | "480p-v3";
  credits_cost: number;
  status: VideoCloneStatus;
  runpod_job_id: string | null;
  video_path: string | null;
  error_message: string | null;
  created_at: Timestamp;
};
export type VideoCloneInsert = {
  id?: string;
  user_id: string;
  name?: string | null;
  image_path: string;
  audio_path: string;
  duration_seconds: number;
  num_frames: number;
  tier: "480p" | "720p" | "480p-v2" | "480p-v3";
  credits_cost?: number;
  status?: VideoCloneStatus;
  runpod_job_id?: string | null;
};
export type VideoCloneUpdate = Partial<VideoCloneRow>;

// ───────── studio_projects (Vídeo Estúdio F0, migration 33) ─────────
export type StudioProjectStatus = "processing" | "audio_ready" | "video_ready" | "failed";
/** F2 (mig 48): 'audio' = limpeza F0 · 'video' = CapCut automático. */
export type StudioProjectKind = "audio" | "video";
export type StudioMontageStatus = "idle" | "processing" | "ready" | "failed";
export type StudioTranscriptWord = { start: number; end: number; word: string };
export type StudioProjectRow = {
  id: string;
  user_id: string;
  name: string | null;
  status: StudioProjectStatus;
  kind: StudioProjectKind;
  raw_audio_path: string | null;
  raw_video_path: string | null;
  edited_video_path: string | null;
  clean_audio_path: string | null;
  duration_raw_seconds: number | null;
  duration_clean_seconds: number | null;
  kept_takes: number | null;
  removed_takes: number | null;
  transcript_words: StudioTranscriptWord[] | null;
  edit_report: string | null;
  runpod_job_id: string | null;
  error_message: string | null;
  montage_status: StudioMontageStatus;
  montage_job_id: string | null;
  video_path: string | null;
  montage_error: string | null;
  montage_report: string | null;
  scenes_status: StudioScenesStatus;
  scene_plan: StudioScenePlanItem[] | null;
  face_status: StudioFaceStatus;
  face_image_path: string | null;
  face_segments: StudioFaceSegment[] | null;
  created_at: Timestamp;
  /** Máquina de Edição Automática (mig 46). */
  auto_pilot: boolean;
  script_text: string | null;
  machine_voice_id: string | null;
  machine_step: string | null;
  machine_job_id: string | null;
  machine_music_key: string | null;
  variants_job_id: string | null;
  variants_status: string | null;
  variant_paths: string[] | null;
};
export type StudioFaceStatus = "idle" | "processing" | "ready" | "failed";
export type StudioFaceSegment = {
  role: "hook" | "close";
  sentence: number;
  start: number;
  end: number;
  audio_path: string;
  video_path: string;
  job_id: string | null;
  status: "processing" | "ready" | "failed";
};
export type StudioScenesStatus = "idle" | "generating" | "ready" | "failed";
/** Item do mapa frase→cena de um projeto (ordem = frases do transcript). */
export type StudioScenePlanItem = {
  sentence: number;
  text: string;
  scene_id: string;
  reused: boolean;
};

// ───────── studio_scenes (banco pessoal de b-roll, migration 35) ─────────
export type StudioSceneStatus =
  | "planning" | "generating_still" | "animating" | "ready" | "failed";
export type StudioSceneRow = {
  id: string;
  user_id: string;
  concept: string;
  prompt_en: string;
  dialect: "realista" | "craft";
  status: StudioSceneStatus;
  /** §2.7 da máquina: 'broll' reusa pra sempre; 'produto' é específico. */
  kind: "broll" | "produto";
  tags: string[];
  kie_task_id: string | null;
  /** QA F5: já regerou o still 1x por texto quebrado? */
  qa_retried: boolean;
  /** W4 (enxerto 2): já redespachou a animação 1x no modelo reserva? */
  anim_retried: boolean;
  /** Referência do débito da tentativa paga (chave do estorno automático). */
  debit_ref: string | null;
  /** F3 (mig 49): b-roll curado pelo admin — entra no reuso de TODOS. */
  shared: boolean;
  image_path: string | null;
  video_path: string | null;
  /** C4 (mig 71): fotos da PESSOA usadas na cena — retry/fallback redespacham
   *  com as mesmas referências; presença ⇒ shared=false sempre. */
  ref_image_paths: string[] | null;
  error_message: string | null;
  created_at: Timestamp;
};
export type StudioSceneInsert = {
  id?: string;
  user_id: string;
  concept: string;
  prompt_en: string;
  dialect?: "realista" | "craft";
  status?: StudioSceneStatus;
  kie_task_id?: string | null;
};
export type StudioSceneUpdate = Partial<StudioSceneRow>;
export type StudioProjectInsert = {
  id?: string;
  user_id: string;
  name?: string | null;
  status?: StudioProjectStatus;
  kind?: StudioProjectKind;
  raw_audio_path?: string | null;
  raw_video_path?: string | null;
  edited_video_path?: string | null;
  clean_audio_path?: string | null;
  runpod_job_id?: string | null;
};
export type StudioProjectUpdate = Partial<StudioProjectRow>;

// ───────── Agente de suporte WhatsApp (F0) ─────────
export type AgentChatKind = "private" | "group";
export type AgentChatMode = "auto" | "human";
export type AgentChatRow = {
  id: string;
  wa_jid: string;
  kind: AgentChatKind;
  name: string | null;
  mode: AgentChatMode;
  wa_phone: string | null;   // telefone real (dígitos) — resolvido de @lid via WAHA
  profile_id: string | null; // aluno vinculado (match telefone × checkout_phone Hotmart)
  last_message_at: Timestamp | null;
  created_at: Timestamp;
};
export type AgentChatInsert = {
  id?: string;
  wa_jid: string;
  kind: AgentChatKind;
  name?: string | null;
  mode?: AgentChatMode;
  last_message_at?: Timestamp | null;
};
export type AgentChatUpdate = Partial<AgentChatRow>;

export type AgentMessageKind =
  | "text" | "audio" | "image" | "video" | "document" | "sticker" | "other";
export type AgentMessageRow = {
  id: string;
  chat_id: string;
  wa_message_id: string | null;
  sender_jid: string | null;
  sender_name: string | null;
  from_me: boolean;
  role: "user" | "agent" | "human";
  kind: AgentMessageKind;
  content: string | null;
  created_at: Timestamp;
};
export type AgentMessageInsert = {
  id?: string;
  chat_id: string;
  wa_message_id?: string | null;
  sender_jid?: string | null;
  sender_name?: string | null;
  from_me?: boolean;
  role?: "user" | "agent" | "human";
  kind?: AgentMessageKind;
  content?: string | null;
  created_at?: Timestamp;
};
export type AgentMessageUpdate = Partial<AgentMessageRow>;

export type AgentSettingsRow = { id: number; enabled: boolean; updated_at: Timestamp };
export type AgentSettingsInsert = { id?: number; enabled?: boolean };
export type AgentSettingsUpdate = Partial<AgentSettingsRow>;

// ───────── Resgate da Fast (win-back por WhatsApp — mig 66) ─────────
/** Como a pessoa saiu, deduzido do USO (não do que ela disse). */
export type WinbackSegment = "nunca_ativou" | "usou_e_saiu" | "sem_conta";
/** pending→sending→sent→replied→(recovered|lost|optout) · blocked | skipped
 *  'sending' é o claim atômico: impede que duas rodadas do cron abram a mesma
 *  conversa duas vezes. */
export type WinbackStatus =
  | "pending" | "sending" | "sent" | "replied" | "recovered" | "lost" | "optout" | "blocked" | "skipped";

export type WinbackTargetRow = {
  id: string;
  email: string;
  phone_digits: string | null;
  profile_id: string | null;
  canceled_at: Timestamp | null;
  segment: WinbackSegment;
  survey_reason: string | null;
  survey_detail: string | null;
  status: WinbackStatus;
  chat_id: string | null;
  wa_jid: string | null;
  sent_at: Timestamp | null;
  delivered_at: Timestamp | null;
  replied_at: Timestamp | null;
  /** Canal e-mail (mig winback_email_channel): quando saiu e quando respondeu. */
  email_sent_at: Timestamp | null;
  email_replied_at: Timestamp | null;
  /** Texto EXATO enviado (cada e-mail é escrito na hora e sai diferente). */
  email_subject: string | null;
  email_body: string | null;
  outcome: string | null;
  outcome_detail: string | null;
  credits_granted: number;
  note: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};
export type WinbackTargetInsert = Partial<WinbackTargetRow> & { email: string };
export type WinbackTargetUpdate = Partial<WinbackTargetRow>;

export type WinbackSettingsRow = {
  id: number;
  enabled: boolean;
  day_index: number;
  last_send_date: string | null;
  sent_today: number;
  next_send_at: Timestamp | null;
  paused_until: Timestamp | null;
  credits_cap: number;
  last_note: string | null;
  updated_at: Timestamp;
};
export type WinbackSettingsInsert = Partial<WinbackSettingsRow>;
export type WinbackSettingsUpdate = Partial<WinbackSettingsRow>;

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
      video_projects: { Row: VideoProjectRow; Insert: VideoProjectInsert; Update: VideoProjectUpdate; Relationships: Rel };
      video_scenes: { Row: VideoSceneRow; Insert: VideoSceneInsert; Update: VideoSceneUpdate; Relationships: Rel };
      video_clones: { Row: VideoCloneRow; Insert: VideoCloneInsert; Update: VideoCloneUpdate; Relationships: Rel };
      studio_projects: { Row: StudioProjectRow; Insert: StudioProjectInsert; Update: StudioProjectUpdate; Relationships: Rel };
      studio_scenes: { Row: StudioSceneRow; Insert: StudioSceneInsert; Update: StudioSceneUpdate; Relationships: Rel };
      agent_chats: { Row: AgentChatRow; Insert: AgentChatInsert; Update: AgentChatUpdate; Relationships: Rel };
      agent_messages: { Row: AgentMessageRow; Insert: AgentMessageInsert; Update: AgentMessageUpdate; Relationships: Rel };
      agent_settings: { Row: AgentSettingsRow; Insert: AgentSettingsInsert; Update: AgentSettingsUpdate; Relationships: Rel };
      winback_targets: { Row: WinbackTargetRow; Insert: WinbackTargetInsert; Update: WinbackTargetUpdate; Relationships: Rel };
      winback_settings: { Row: WinbackSettingsRow; Insert: WinbackSettingsInsert; Update: WinbackSettingsUpdate; Relationships: Rel };
      render_jobs: { Row: RenderJobRow; Insert: RenderJobInsert; Update: RenderJobUpdate; Relationships: Rel };
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
      courtesy_campaigns: { Row: CourtesyCampaignRow; Insert: CourtesyCampaignInsert; Update: CourtesyCampaignUpdate; Relationships: Rel };
      courtesy_grants: { Row: CourtesyGrantRow; Insert: CourtesyGrantInsert; Update: CourtesyGrantUpdate; Relationships: Rel };
      heygen_accounts: { Row: HeygenAccountRow; Insert: HeygenAccountInsert; Update: HeygenAccountUpdate; Relationships: Rel };
      heygen_videos: { Row: HeygenVideoRow; Insert: HeygenVideoInsert; Update: HeygenVideoUpdate; Relationships: Rel };
      social_accounts: { Row: SocialAccountRow; Insert: SocialAccountInsert; Update: SocialAccountUpdate; Relationships: Rel };
      publications: { Row: PublicationRow; Insert: PublicationInsert; Update: PublicationUpdate; Relationships: Rel };
      scripts: { Row: ScriptRow; Insert: ScriptInsert; Update: ScriptUpdate; Relationships: Rel };
      script_messages: { Row: ScriptMessageRow; Insert: ScriptMessageInsert; Update: ScriptMessageUpdate; Relationships: Rel };
      viral_videos: { Row: ViralVideoRow; Insert: ViralVideoInsert; Update: ViralVideoUpdate; Relationships: Rel };
      viral_user_videos: { Row: ViralUserVideoRow; Insert: ViralUserVideoInsert; Update: ViralUserVideoUpdate; Relationships: Rel };
      react_jobs: { Row: ReactJobRow; Insert: ReactJobInsert; Update: ReactJobUpdate; Relationships: Rel };
    };
    Views: Record<string, never>;
    Functions: {
      admin_metrics:      { Args: { p_since: string }; Returns: Json };
      admin_timeseries:   { Args: { p_since: string }; Returns: Json };
      admin_finance:      { Args: { p_since: string; p_product_id?: string }; Returns: Json };
      admin_trial_stats:  { Args: Record<string, never>; Returns: Json };
      admin_live_cloning: { Args: Record<string, never>; Returns: Json };
      admin_video_clones: { Args: { p_since: string; p_until?: string }; Returns: Json };
      admin_users:        { Args: Record<string, never>; Returns: Json };
      admin_failures:     { Args: { p_limit?: number }; Returns: Json };
      admin_history:      { Args: { p_limit?: number; p_email?: string }; Returns: Json };
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
      expire_courtesy_credits: {
        Args: { p_user_id: string; p_max_amount: number; p_ref_id?: string | null };
        Returns: Json;
      };
      expire_trial_credits: {
        Args: { p_grace_days?: number };
        Returns: Json;
      };
      claim_alert: { Args: { p_key: string; p_cooldown_seconds: number }; Returns: boolean };
      claim_render_job: { Args: Record<string, never>; Returns: RenderJobRow | null };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
