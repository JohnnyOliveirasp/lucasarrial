-- 51: F2 — o status 'video_ready' entrou no código (mig 48) mas o CHECK da
-- tabela nunca foi atualizado → TODA finalização de vídeo editado violava a
-- constraint (webhook e poll falhavam em silêncio; projeto girava pra sempre).
-- Bug pego pelo Lucas no teste real (2 projetos presos 7h). (Espelho da
-- migration MCP 20260725* studio_status_video_ready.)
alter table studio_projects drop constraint studio_projects_status_check;
alter table studio_projects add constraint studio_projects_status_check
  check (status = any (array['processing'::text, 'audio_ready'::text, 'video_ready'::text, 'failed'::text]));
