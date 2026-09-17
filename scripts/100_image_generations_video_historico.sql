-- 100 — Animar Imagem: histórico dos vídeos já pagos (incidente #439 / 75c33ee1)
--
-- NÃO APLICADO. Commitado pra leitura e aval (ordem de 18/08, "DDL pelo git").
-- Autor: Frank, ronda das falhas de 17/09 ~16hZ.
--
-- ============================ O PROBLEMA ============================
-- imageVideoKey() (frontend/src/lib/images/video-sync.ts:34-36) monta a chave
-- do R2 por ID DA IMAGEM:
--     {userId}/images/{imageId}/video.{ext}
-- Ela é DETERMINÍSTICA. Cada nova animação da mesma imagem grava por cima da
-- anterior no R2, e images/[id]/video/route.ts:150-161 zera `video_path` e
-- sobrescreve task_id/custo na MESMA row. N animações pagas -> 1 arquivo, e a
-- row não guarda nem o rastro das anteriores.
--
-- Medido por mim no razão de créditos, RE-MEDIDO às 15h50Z de 17/09 (não
-- herdado da nota das 13h49Z). credit_transactions guarda UMA LINHA POR
-- DESPACHO, ref_type='image_video', ref_id = id da imagem — e é a única
-- testemunha que sobrou, porque a row foi sobrescrita:
--     451 despachos pagos sobrescritos por um despacho posterior na MESMA
--     imagem, 1.122.940 créditos, 195 alunos, 304 imagens,
--     de 11/07/2026 até 17/09/2026 14:30Z.
-- Às 13h49Z de hoje eram 450 / 1.121.620 / 194. O +1 nasceu DEPOIS, e é o
-- ponto que mais importa deste arquivo: ver o bloco "AINDA ACONTECE" no fim.
--
-- Já está no ar (PR #326, merge cff9f6c, deploy SUCCESS 17/09) a perna do
-- CONSENTIMENTO: com vídeo pronto, "Gerar de novo" não despacha no 1º clique —
-- abre aviso com custo, Baixar e Cancelar. Isso avisa o aluno; NÃO conserta o
-- defeito. A chave continua por ID da imagem e o vídeo pago continua morrendo.
--
-- ===================== POR QUE PRECISA DE COLUNA =====================
-- Versionar a key sozinho seria trivial (imageVideoKey tem UM call site e toda
-- leitura sai de video_path) — mas seria TROCAR UM DEFEITO POR OUTRO PIOR:
-- chavesApagaveisDoHistorico() (frontend/src/lib/images/refs-pure.ts:43-57)
-- monta o DELETE do histórico pelas COLUNAS DA ROW, nunca por prefixo. Com key
-- versionada e sem coluna de histórico, o aluno apaga a geração, o DELETE leva
-- só a última versão, e TODAS as anteriores viram lixo PERMANENTE no R2 — dado
-- que ele mandou apagar, sem rastro e sem forma de apagar depois. Destruição
-- silenciosa viraria RETENÇÃO silenciosa, que além de pior tem cara de LGPD.
-- Por isso key versionada e histórico sobem JUNTOS, e o DDL vem primeiro.
--
-- ============================= O DDL =============================
-- Uma coluna. Sem tabela nova, sem índice, sem backfill.
-- Aditiva e default não-nulo: nenhuma leitura existente muda de resultado, e
-- código velho que não conhece a coluna continua funcionando.

alter table public.image_generations
  add column if not exists video_paths_anteriores text[] not null default '{}';

comment on column public.image_generations.video_paths_anteriores is
  'Chaves R2 dos vídeos de animações ANTERIORES desta imagem, na ordem de despacho. '
  'Existe por duas razões: (1) a key do vídeo passa a ser versionada por despacho, '
  'então o vídeo já pago não é mais sobrescrito; (2) chavesApagaveisDoHistorico() '
  'apaga por COLUNA, nunca por prefixo — sem esta lista as versões antigas virariam '
  'lixo permanente no R2 quando o aluno apagasse a geração. Incidente #439.';

-- ======================= O QUE O CÓDIGO FAZ DEPOIS =======================
-- (vai em PR próprio, que só pode ser mergeado DEPOIS desta coluna existir no
--  banco — DDL commitado não é DDL aplicado)
--
-- 1. video-sync.ts:34-36 — imageVideoKey passa a receber um discriminador de
--    despacho (o video_kie_task_id, que já é único por despacho e já está na
--    row) e monta {userId}/images/{imageId}/video-{taskId}.{ext}.
-- 2. images/[id]/video/route.ts:150-161 — ANTES do update que zera video_path,
--    ler o video_path atual e, se não for nulo, anexá-lo a
--    video_paths_anteriores. É o único ponto que destrói hoje.
-- 3. refs-pure.ts — RowHistoricoImagem ganha video_paths_anteriores, e
--    chavesApagaveisDoHistorico() passa a incluí-lo no flatMap (continua
--    filtrando `{user}/refs/`, incidente 1970fcaa). O .select() do DELETE em
--    images/route.ts:130 passa a trazer a coluna.
--
-- =========================== AINDA ACONTECE ===========================
-- A perna do consentimento entrou no ar às 13:53:16Z (run 35229632170).
-- Às 14:30:37Z e 14:32:11Z — 37 e 39 minutos DEPOIS — a imagem
-- ccc7f4fe-3a0a-4619-a029-655c9e2ce4fc (aluno com acesso Hotmart vivo) recebeu
-- DOIS despachos pagos de 1320 créditos com 94 segundos entre eles, sem estorno
-- nenhum. A trava de concorrência do route.ts:59-61 recusa despacho enquanto o
-- anterior está pending/generating, então no 2º clique o primeiro JÁ ESTAVA em
-- estado terminal. Sem estorno, o terminal provável é `ready` — ou seja, um
-- vídeo pago foi substituído com o conserto do consentimento já no ar.
--
-- E EU NÃO CONSIGO DIZER SE ELE CONSENTIU. Essa é a parte que este DDL não
-- resolve e que precisa ficar escrita: a casa não grava em lugar nenhum que o
-- aviso foi exibido. Do banco, "aluno leu o aviso e escolheu substituir"
-- (conserto funcionando) e "o aviso não apareceu e o vídeo morreu calado"
-- (conserto furado) são a MESMA linha. Há ainda um terceiro caminho conhecido:
-- aba aberta ANTES de 13:53 segue com o bundle velho de 1 clique até recarregar.
-- Não afirmo qual dos três foi. Afirmo que os três são indistinguíveis daqui, e
-- que isso é um defeito de instrumento — não uma dúvida sobre este aluno.
--
-- ============================ O QUE ISTO NÃO FAZ ============================
-- NÃO devolve o que já foi destruído: os 451 despachos sobrescritos até hoje
-- não têm de onde voltar — o próprio defeito apagou a prova (a row guardava um
-- task_id só, sobrescrito junto, então nem pela API do provedor dá pra
-- reconsultar). Este DDL para a sangria daqui pra frente.
-- NÃO decide estorno: os 1.122.940 créditos são alçada do Johnny (regra 8) e
-- seguem pendentes de decisão dele, em separado.
-- NÃO expõe as versões antigas na tela do aluno: isso é produto, não migração.
