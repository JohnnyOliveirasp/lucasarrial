-- 84_video_projects_sem_narracao.sql
--
-- POR QUE ISTO EXISTE (19/08):
-- No Vídeo Vendas a narração virou OPCIONAL (ordem do Johnny) — dá pra entregar
-- o vídeo só com legenda, ou mudo, pra pessoa legendar depois.
--
-- Só que quem decide a tela é `audio_path IS NULL` (ver ProjectSwitch): sem
-- áudio, o projeto fica preso na tela de montagem para sempre. E `audio_path`
-- vazio não distingue as duas situações opostas:
--   - "ainda não gravei"        → tem que continuar na montagem
--   - "escolhi não ter narração" → tem que seguir pro wizard
--
-- Esta coluna guarda essa ESCOLHA. Sem ela, a única alternativa seria gravar um
-- áudio de silêncio só pra destravar o fluxo — que é exatamente o que quebrou a
-- geração da Fernanda em 18/08 (áudio mudo derrubando o WanVideoSampler).
--
-- SEGURANÇA: puramente ADITIVO, com DEFAULT false. Projeto antigo continua
-- exatamente como está: nenhum deles escolheu dispensar narração.
--
-- REVERSÃO: ALTER TABLE public.video_projects DROP COLUMN IF EXISTS sem_narracao;

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS sem_narracao boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.video_projects.sem_narracao IS
  'true = a pessoa escolheu seguir SEM narracao (video so com legenda, ou mudo pra ela legendar depois). Distingue de audio_path NULL, que significa "ainda nao gravou". Desde 19/08, quando a narracao virou opcional no Video Vendas.';
