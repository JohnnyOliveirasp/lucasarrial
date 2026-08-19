-- 82_video_projects_product_idea.sql
--
-- POR QUE ISTO EXISTE (18/08):
-- No Vídeo Vendas, o único passo obrigatório passou a ser o PRODUTO. "Quem
-- apresenta" e a "análise do produto" viraram opcionais (ordem do Johnny).
--
-- Só que o gerador de roteiro partia da análise — era ela que dizia o que o
-- produto é e para quem. Com a análise opcional, o roteiro ficaria sem ponto
-- de partida nenhum. Esta coluna guarda a IDEIA escrita pela pessoa, que passa
-- a ser a outra origem possível: gerar roteiro exige **ideia OU análise**.
--
-- SEGURANÇA: puramente ADITIVO. Não altera nem remove coluna existente, não
-- toca em dado. Projeto antigo fica com NULL e segue funcionando pela análise,
-- como sempre funcionou.
--
-- REVERSÃO: ALTER TABLE public.video_projects DROP COLUMN IF EXISTS product_idea;

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS product_idea text NULL;

COMMENT ON COLUMN public.video_projects.product_idea IS
  'Ideia do produto escrita pela pessoa (o que é, para quem, qual o gancho). Ponto de partida do roteiro quando a análise por IA nao foi feita — desde 18/08 a análise e opcional. Gerar roteiro exige product_idea OU product_analysis.';
