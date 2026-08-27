-- ============================================================================
-- 97 — o stderr do trainer sobrevive ao RunPod (incidente #11, "trainer failed")
--
-- POR QUE: quando o subprocess do treino morre, o worker JÁ manda o diagnóstico
-- pela rede. runpod-worker/jobs/train.py:96-101 devolve
--   {error: "trainer failed", trainer_returncode, stdout_tail, stderr_tail,
--    worker_image}
-- e o backend JOGA FORA os dois tails na porta: finalize-training.ts declarava
-- `stdout_tail`/`stderr_tail` no type TrainOutput e nunca os lia (conferido por
-- grep: as únicas ocorrências no projeto eram as declarações de tipo, em
-- finalize-training.ts e no webhook route.ts). Sobrava no banco só o texto
-- "trainer failed" — que diz QUE morreu e nada sobre POR QUÊ.
--
-- Consequência medida: o incidente #11 está aberto desde 21/07, com 3
-- ocorrências, e NUNCA foi diagnosticado. A única cópia do traceback vivia no
-- RunPod, e o RunPod PURGA: GET /v2/<endpoint>/status/9b4de4b2-16b7-4108-bbba-
-- e682760e8c23-e1 devolve 404 "job not found" ~9h depois da falha. Cada ronda
-- que ia investigar chegava depois da purga e reabria a mesma pergunta.
--
--   trainer_returncode = código de saída do subprocess do trainer. Diz COMO
--                        morreu: 1 = exceção Python; 137 = OOM-killer/SIGKILL;
--                        139 = SIGSEGV. Separa "bug no código" de "a máquina
--                        matou o processo" sem precisar ler o traceback.
--   trainer_stderr     = últimos 8000 chars do stderr do trainer (o worker já
--                        manda os últimos 2000 em stderr_tail — o teto maior é
--                        pra não ter que mexer aqui se o worker aumentar a
--                        janela). É onde mora o traceback.
--   trainer_stdout     = últimos 8000 chars do stdout (o worker manda 4000 em
--                        stdout_tail). Contexto do que o treino chegou a fazer
--                        antes de morrer: steps, loss, downloads.
--
-- ⚠️ POR QUE COLUNAS NOVAS E NÃO training_jobs.error_message: a função SQL
-- admin_failures() lê training_jobs.error_message como o campo `error`, e ele
-- alimenta errorSignature() em frontend/src/lib/incidents/classify.ts. Para
-- cause='bug' (o caso de "trainer failed", classify.ts:125) a assinatura de
-- dedup usa os primeiros 120 chars do texto normalizado. Se o texto passasse a
-- variar por ocorrência — e um traceback varia sempre — CADA falha viraria um
-- incidente NOVO e o #11 se estilhaçaria, que é exatamente a patologia do
-- "detector cego" já vista no d3d8d1b2. error_message tem que continuar
-- exatamente "trainer failed"; o diagnóstico mora fora dele. Há teste de
-- regressão travando isso em src/lib/incidents/classify.test.ts.
--
-- Preenchidas em UPDATE separado e best-effort DEPOIS do gate idempotente
-- (finalize-training.ts, registrarSaidaDoTrainer), mesmo padrão das migs 90 e
-- 96: se esta migration ainda não estiver aplicada, a telemetria falha sozinha,
-- o log `voice.train.trainer_failed` já guardou o dado, e a finalização do
-- treino (voz → failed, ESTORNO, alerta do suporte) segue intacta.
-- Observabilidade não pode quebrar o produto — muito menos o estorno.
--
-- ⚠️ Só grava treino NOVO, e só no caminho de FALHA do trainer. Linha com as 3
-- colunas nulas significa "treino que não morreu no trainer" OU "anterior a
-- esta migration" — NÃO "morreu sem deixar rastro". Não tratar nulo como falha
-- em varredura. No caminho feliz o worker devolve trainer_returncode=0 e nenhum
-- tail; não gravamos nada, porque "deu certo" já está em training_jobs.status.
--
-- ============================================================================
-- ⚠️⚠️ ESTA MIGRATION **NÃO** É PURAMENTE ADITIVA: ELA ESTREITA UM GRANT
-- ============================================================================
-- Além de criar as 3 colunas, ela TIRA de `anon`/`authenticated` o select no
-- nível de TABELA em public.training_jobs e devolve o select coluna a coluna,
-- só nas 13 colunas que já existiam. Leia o porquê antes de aprovar.
--
-- O QUE ESTAVA EM JOGO: as 3 colunas novas carregam TRACEBACK INTERNO —
-- caminho de container (/app/train_voxcpm_finetune.py), nome dos scripts
-- internos, pilha das bibliotecas e até 8000 chars de stdout do trainer.
-- E training_jobs tem uma policy de RLS de select AMPLA
-- (scripts/01_schema.sql:178-181, `training_jobs_self_select`, `for select
-- using (auth.uid() = user_id)`): a policy filtra LINHA, não COLUNA. Sem o
-- ajuste abaixo, no instante em que esta migration subisse, qualquer aluno
-- logado leria o traceback do próprio treino com o JWT dele, direto no
-- PostgREST:
--     GET /rest/v1/training_jobs?select=trainer_stderr
--
-- POR QUE NÃO BASTA `revoke select (trainer_stderr, ...)`: no PostgreSQL o
-- privilégio efetivo sobre uma coluna é a UNIÃO do grant de tabela com o de
-- coluna, e NÃO existe grant negativo. `revoke` de coluna só apaga entrada da
-- ACL de coluna; ele não subtrai nada do grant de tabela. Medido no catálogo
-- do banco de produção em 27/08, só leitura:
--
--   pg_class.relacl de public.training_jobs
--     {postgres=arwdDxtm/postgres, anon=arwdDxtm/postgres,
--      authenticated=arwdDxtm/postgres, service_role=arwdDxtm/postgres}
--     -> anon e authenticated têm 'r' (select) NO NÍVEL DE TABELA.
--
--   pg_attribute.attacl das 13 colunas -> NULL em TODAS as 13.
--     -> hoje não existe ACL de coluna nenhuma; o acesso do aluno vem 100% do
--        grant de tabela. Um `revoke select (coluna)` seria NO-OP: apagaria uma
--        entrada que não existe, o aluno continuaria lendo o traceback, e este
--        cabeçalho estaria mentindo pra quem aprovou.
--
-- POR ISSO a forma abaixo: derruba o select de TABELA e regrante o select nas
-- 13 colunas pré-existentes, nominalmente. Efeito líquido = exatamente as 3
-- colunas novas ficam invisíveis pro aluno; nada mais muda pra ele.
--
-- NENHUM CÓDIGO TYPESCRIPT PRECISA MUDAR — conferido, não presumido:
--   (a) `service_role` mantém o grant de tabela dele (linha própria na relacl
--       acima, intocada por este revoke), então getAdmin() lê as 3 colunas
--       normalmente;
--   (b) varredura no repo inteiro por `from("training_jobs")`: TODA leitura e
--       escrita passa por getAdmin()/`admin` (service_role) — start-training/
--       route.ts:279, onboarding/treino.ts:144, finalize-training.ts:210/297/
--       332, admin/metrics.ts:50-51 e as ferramentas de _Bugs//_frank/ (que
--       usam SUPABASE_SERVICE_ROLE_KEY via _comum.cjs). NÃO existe uma única
--       leitura de training_jobs com JWT de aluno no produto.
--
-- ⚠️ DOIS LIMITES DECLARADOS, pra não virarem surpresa depois:
--   1. `select=*` (o default do PostgREST) como anon/authenticated passa a dar
--      42501 permission denied em vez de devolver linhas, porque o * expande
--      pras colunas revogadas. Hoje ninguém faz isso (ver varredura acima), e
--      quando alguém fizer, falha ALTO e FECHADO — não vaza calado.
--   2. Daqui pra frente, coluna NOVA em training_jobs nasce invisível pra
--      anon/authenticated até receber `grant select (coluna)` explícito. É a
--      direção segura (fail-closed), mas tem que ser lembrada por quem
--      escrever a próxima migration desta tabela.
--
-- FORA DE ESCOPO, mas registrado porque apareceu na medição: training_jobs
-- .error_message continua legível pelo aluno e já carrega o erro CRU
-- (finalize-training.ts: `adminError = rawError.slice(0, 500)`, comentado
-- como "Admin vê o erro CRU"). Isso é anterior a esta migration e não é
-- alterado aqui. Fica a decisão pro Johnny, em outro card.
-- ============================================================================

alter table public.training_jobs
  add column if not exists trainer_returncode int,
  add column if not exists trainer_stderr     text,
  add column if not exists trainer_stdout     text;

-- ── Fecha o traceback pro aluno (ver bloco acima) ───────────────────────────
-- Tira só o SELECT de tabela; insert/update/delete de anon/authenticated ficam
-- como estavam (e seguem barrados pela RLS, que não tem policy de escrita aqui).
revoke select on public.training_jobs from anon, authenticated;

-- Devolve, nominalmente, as 13 colunas que já eram visíveis antes desta
-- migration. A lista veio do pg_attribute do banco vivo (attnum 1..13), não de
-- leitura do 01_schema.sql — migrations posteriores já tinham somado colunas
-- (useful_seconds). Ausentes de propósito: trainer_returncode, trainer_stderr,
-- trainer_stdout.
grant select (
  id, voice_id, user_id, runpod_job_id, status, steps, final_loss,
  elapsed_seconds, error_message, started_at, finished_at, created_at,
  useful_seconds
) on public.training_jobs to anon, authenticated;

comment on column public.training_jobs.trainer_returncode is
  'Codigo de saida do subprocess do trainer quando ele morre (1=excecao, 137=OOM-killer, 139=SIGSEGV). Nulo = treino que nao morreu no trainer ou anterior a mig 97. Incidente 11.';
comment on column public.training_jobs.trainer_stderr is
  'Ultimos 8000 chars do stderr do trainer (traceback). Unica copia que sobrevive: o RunPod purga o job (/status devolve 404 em poucas horas). Incidente 11.';
comment on column public.training_jobs.trainer_stdout is
  'Ultimos 8000 chars do stdout do trainer: o que o treino chegou a fazer antes de morrer (steps, loss, downloads). Incidente 11.';

-- Varredura típica ("os 'trainer failed' morrem todos do mesmo jeito, e em que
-- build?") — sem índice de propósito: training_jobs é pequena e a consulta é de
-- investigação, não de caminho quente.
--
--   select worker_image, trainer_returncode,
--          left(trainer_stderr, 200) as stderr_head, count(*)
--     from public.training_jobs
--    where trainer_returncode is not null and trainer_returncode <> 0
--    group by 1, 2, 3
--    order by 4 desc;

-- ── Reversão ────────────────────────────────────────────────────────────────
-- São DUAS coisas a desfazer, não uma: as colunas E o estreitamento do grant.
-- Reverter só as colunas deixaria training_jobs com ACL de coluna onde antes
-- havia ACL de tabela — invisível na prática hoje, mas é um estado diferente do
-- original e ele volta a morder na próxima coluna adicionada (ver limite 2).
--
-- O código que escreve as colunas é best-effort dentro de try/catch, então ele
-- continua funcionando (só volta a logar `trainer_failed_nao_persistido`) — não
-- é preciso fazer rollback do deploy pra rodar isto.
--
-- Ordem importa: devolver o grant de tabela ANTES de largar as colunas, senão o
-- `revoke select (...)` reclama de coluna inexistente.
--
--   -- 1. volta a ACL ao estado original (grant de tabela, sem ACL de coluna)
--   revoke select (
--     id, voice_id, user_id, runpod_job_id, status, steps, final_loss,
--     elapsed_seconds, error_message, started_at, finished_at, created_at,
--     useful_seconds
--   ) on public.training_jobs from anon, authenticated;
--   grant select on public.training_jobs to anon, authenticated;
--
--   -- 2. larga as colunas
--   alter table public.training_jobs
--     drop column if exists trainer_returncode,
--     drop column if exists trainer_stderr,
--     drop column if exists trainer_stdout;
--
-- Conferência depois de reverter (tem que voltar a ter 'r' pra anon e
-- authenticated, e attacl NULL em todas as colunas):
--   select relacl::text from pg_class
--    where relnamespace = 'public'::regnamespace and relname = 'training_jobs';
--   select attname, attacl::text from pg_attribute
--    where attrelid = 'public.training_jobs'::regclass and attnum > 0
--      and not attisdropped and attacl is not null;
