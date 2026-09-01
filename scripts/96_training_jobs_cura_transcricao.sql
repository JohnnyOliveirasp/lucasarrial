-- ============================================================================
-- 96 — observabilidade da CURA do transcript de referência + build do worker
--      (incidente 52 / qa_coverage)
--
-- POR QUE: a "cura" do transcript (2ª passada de whisper no clipe final, caso
-- Negrini #124) roda dentro do treino e decide CALADA. Em
-- runpod-worker/jobs/train_reference.py, `texto = real or texto_previsto`:
-- whisper explodindo e whisper voltando mudo caíam os DOIS no texto previsto,
-- indistinguíveis depois do fato. Resultado: ninguém conseguia dizer se uma
-- voz teve o transcript curado ou não, e cada ronda re-investigava do zero —
-- é isso que vinha queimando ronda no incidente 52.
--
-- E training_jobs não guardava NADA da imagem do worker: "esse treino saiu de
-- que build?" só se respondia por data, no olho, comparando com o histórico de
-- deploy. Com deploy a cada push, isso não é resposta.
--
--   reference_cura_ramo        = qual caminho rodou de fato:
--                                curado         · a 2ª passada rodou e
--                                                 SUBSTITUIU o texto previsto
--                                fallback_vazio · whisper voltou vazio/None →
--                                                 ficou o previsto
--                                fallback_erro  · whisper levantou exceção →
--                                                 ficou o previsto (ver _erro)
--                                sem_previsto   · não havia nem um nem outro →
--                                                 transcript vazio
--   reference_cura_texto_antes = o texto que o seletor havia previsto, ANTES
--                                da cura. Forma o par antes/depois com
--                                voices.reference_transcript (o "depois", que
--                                já é gravado hoje) — dá pra ver O QUE a cura
--                                mudou, não só QUE ela rodou.
--   reference_cura_erro        = mensagem da exceção quando ramo=fallback_erro.
--                                Preenchida também no ramo sem_previsto: o ramo
--                                diz DE ONDE veio o texto, o erro não se perde.
--   worker_image               = identidade do build ("<branch>@<sha> pod=...",
--                                carimbada na imagem pelo CI via ARG/ENV
--                                WORKER_IMAGE). "desconhecida" = build local
--                                sem o carimbo — a verdade, não um palpite.
--
-- POR QUE EM training_jobs E NÃO EM voices: a cura e o build são propriedades
-- DAQUELA RODADA de treino, não da voz. Uma voz retreinada 3× teve 3 curas e
-- pode ter saído de 3 builds diferentes; gravar em `voices` sobrescreveria o
-- histórico justamente no caso — o retreino — em que a comparação importa.
-- `voices.reference_transcript` continua sendo o "depois" vigente, e é o que
-- se compara com o `_texto_antes` da linha de training_jobs correspondente.
--
-- Preenchidas em UPDATE separado e best-effort DEPOIS do gate idempotente
-- (finalize-training.ts, registrarCuraEBuild), mesmo padrão da mig 90: se esta
-- migration ainda não estiver aplicada, a telemetria falha sozinha, o log
-- `voice.train.transcript_cura` já guardou o dado, e a finalização do treino
-- (voz → ready, estorno, amostra) segue intacta. Observabilidade não pode
-- quebrar o produto.
--
-- ⚠️ Só grava treino NOVO. Linhas antigas ficam com as 4 colunas nulas — nulo
-- aqui significa "worker anterior a este build, não dá pra saber", e NÃO
-- "a cura não rodou". Não tratar nulo como falha em varredura.
-- ============================================================================

alter table public.training_jobs
  add column if not exists reference_cura_ramo        text,
  add column if not exists reference_cura_texto_antes text,
  add column if not exists reference_cura_erro        text,
  add column if not exists worker_image               text;

comment on column public.training_jobs.reference_cura_ramo is
  'Ramo da 2a passada de whisper no transcript da referencia: curado | fallback_vazio | fallback_erro | sem_previsto. Nulo = treino anterior a mig 96, nao "nao rodou". Incidente 52.';
comment on column public.training_jobs.reference_cura_texto_antes is
  'Texto previsto pelo seletor ANTES da cura; o "depois" e voices.reference_transcript. Incidente 52.';
comment on column public.training_jobs.reference_cura_erro is
  'Mensagem da excecao do whisper da cura (ramo fallback_erro, e tambem sem_previsto). Incidente 52.';
comment on column public.training_jobs.worker_image is
  'Identidade do build do worker que rodou o treino ("<branch>@<sha> pod=..."), carimbada pelo CI. "desconhecida" = build local sem carimbo.';

-- Varredura típica ("a cura está caindo no fallback com que frequência, e em
-- que build?") — sem índice de propósito: training_jobs é pequena e a consulta
-- é de investigação, não de caminho quente.
--
--   select worker_image, reference_cura_ramo, count(*)
--     from public.training_jobs
--    where reference_cura_ramo is not null
--    group by 1, 2
--    order by 1, 3 desc;
