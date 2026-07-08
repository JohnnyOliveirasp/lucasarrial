-- 31: Vídeo Clone ganha o fluxo V2 (fp8 + 4 steps flowmatch + colormatch)
-- APLICADA via MCP Supabase em 2026-07-09 (migration video_clones_tier_v2).
alter table public.video_clones drop constraint if exists video_clones_tier_check;
alter table public.video_clones
  add constraint video_clones_tier_check check (tier in ('480p','720p','480p-v2'));
