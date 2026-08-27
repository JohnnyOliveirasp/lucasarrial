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
-- ============================================================================

alter table public.training_jobs
  add column if not exists trainer_returncode int,
  add column if not exists trainer_stderr     text,
  add column if not exists trainer_stdout     text;

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
-- Puramente aditiva: derrubar as 3 colunas devolve o schema ao estado anterior.
-- O código que as escreve é best-effort dentro de try/catch, então ele continua
-- funcionando (só volta a logar `trainer_failed_nao_persistido`) — não é preciso
-- fazer rollback do deploy pra rodar isto.
--
--   alter table public.training_jobs
--     drop column if exists trainer_returncode,
--     drop column if exists trainer_stderr,
--     drop column if exists trainer_stdout;
