-- ============================================================================
-- Adiciona 'awaiting_training' ao CHECK de voices.status
-- Slice 2: status após validação OK, antes do RunPod pegar o job (Slice 3).
-- ============================================================================

alter table public.voices
  drop constraint if exists voices_status_check;

alter table public.voices
  add constraint voices_status_check
  check (status in (
    'uploading',
    'validating',
    'awaiting_training',
    'rejected_too_short',
    'training',
    'ready',
    'failed'
  ));
