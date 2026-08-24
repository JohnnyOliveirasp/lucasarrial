-- ============================================================================
-- 90 — erro CRU do RunPod na falha do Vídeo Clone (rajada agshortcut 22/08)
--
-- Gêmeo da telemetria que a geração de áudio JÁ tem (webhook runpod/route.ts
-- ~219, incidente d3d8d1b2): na falha, generations grava o erro cru + o
-- elapsed_seconds. O Vídeo Clone descartava os dois — friendlyCloneError
-- (lib/video-clone/finalize.ts) só reconhece OOM e timeout, todo o resto vira
-- a frase genérica e o texto técnico do RunPod era jogado fora NO INSTANTE da
-- falha. Como o status do job expira no RunPod (~30min–2h → 404), investigação
-- posterior chegava sem evidência nenhuma: 9 falhas do agshortcut@gmail.com em
-- 22/08 ficaram sem causa atribuível por exatamente isso.
--
--   raw_error       = texto técnico do RunPod (output.error/error), até 500
--                     chars. Diagnóstico interno; o aluno segue vendo SÓ a
--                     mensagem amigável em error_message.
--   elapsed_seconds = executionTime do RunPod em segundos. Separa HANG
--                     (tempo alto) de COLD START/nunca rodou (tempo baixo ou
--                     nulo) sem depender de log que expira.
--
-- Preenchidas em UPDATE separado e best-effort DEPOIS do gate que marca
-- failed: se esta migration ainda não estiver aplicada, a telemetria falha
-- sozinha e o estorno automático do aluno segue intacto.
--
-- ⚠️ NUNCA concatenar raw_error dentro de error_message: a assinatura do
-- incidente deriva do texto do erro (src/lib/incidents/classify.ts) e
-- identificador alfanumérico não normaliza — já estilhaçou a mesma falha em
-- 4 incidentes.
-- ============================================================================

alter table public.video_clones
  add column if not exists raw_error       text,
  add column if not exists elapsed_seconds numeric;

comment on column public.video_clones.raw_error is
  'Erro CRU do RunPod na falha (até 500 chars) — diagnóstico interno; o usuário vê error_message (amigável). Rajada agshortcut 22/08.';
comment on column public.video_clones.elapsed_seconds is
  'executionTime do RunPod em segundos, gravado na falha — separa hang de cold start sem depender de log que expira.';
