-- 108 — face_gate_recusas: o gate de rosto do Vídeo Clone deixa rastro (#372).
--
-- ✅ APLICADA em 13/09 no projeto yizerthyrgrajivlotcw, via Management API
--    (`_frank/ferramentas/sql.cjs`). O Lucas autorizou aplicar DDL por conta
--    em 10/09 pra ganhar velocidade. A conferência de pós-aplicação está no
--    fim deste arquivo, com a saída real colada.
--
-- Mesmo assim o código NÃO DEPENDE da tabela existir: `registrarFaceGate`
-- (lib/video-clone/registrar-face-gate.ts) engole o erro do insert e vira
-- console.error. Se um dia esta tabela sumir, o gate continua barrando e o
-- aluno continua recebendo a mesma resposta — a gente só volta a ficar cego.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUE EXISTE
--
-- Quando o gate barrava o aluno, o sistema gravava NADA. `route.ts:157` fazia
-- um `console.log` e devolvia `face_not_frontal`. Não nascia linha, não subia
-- contador, não havia assinatura. Uma consulta ao banco não respondia nem
-- "quantos alunos o gate barrou hoje" nem "quantas vezes o mesmo aluno bateu
-- na mesma parede".
--
-- Caso que motivou: Alice (#371) bateu SEIS vezes em SEIS horas na mesma
-- recusa — o gate dizia "a pessoa está olhando para baixo" numa foto em que o
-- olhar está na lente e o que existe é queixo recolhido. Ela corrigiu a coisa
-- errada seis vezes e desistiu. O único registro disso no mundo foi o chamado
-- que ELA abriu na mão, depois. Nada no banco.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUE NÃO É UMA LINHA EM `video_clones` (a sugestão original), medido:
--
--   select column_name, is_nullable from information_schema.columns
--    where table_schema='public' and table_name='video_clones' and is_nullable='NO';
--
-- devolve NOT NULL em `audio_path`, `duration_seconds`, `num_frames`, `tier` e
-- `credits_cost`. O gate roda ANTES de resolver o áudio: nesse ponto do código
-- esses cinco valores NÃO EXISTEM. Gravar ali exigiria inventar cinco valores
-- falsos ou afrouxar NOT NULL numa tabela viva de 3.109 linhas. As duas saídas
-- são piores que o problema que a gente veio resolver.
--
-- E tem o agravante que não é de esquema: mais de 12 lugares leem
-- `video_clones`, e um deles é o sweeper em `api/v1/agent/sweep-clones/route.ts:36`,
-- que SELECIONA linhas e as vira `generating`. Uma linha de auditoria com
-- status inventado ali dentro corre o risco de ser varrida e processada como
-- trabalho real. Rastro não pode ter efeito colateral em fluxo de produção.
--
-- ─────────────────────────────────────────────────────────────────────────
-- AS DUAS PONTAS DA CEGUEIRA (e por que `resultado` tem dois valores)
--
-- O gate é FAIL-OPEN de propósito — o produto não pode parar porque o detector
-- caiu. A consequência disso é desconfortável e vale escrever: AUSÊNCIA DE
-- RECUSA NÃO PROVA APROVAÇÃO. Uma imagem que ninguém olhou e uma imagem
-- aprovada são indistinguíveis hoje.
--
-- Se a tabela só guardasse recusa, a gente trocaria uma cegueira por outra:
-- saberíamos quantos foram barrados e continuaríamos sem saber quantos foram
-- COBRADOS sem nunca terem sido olhados. Por isso `avaliacao_impossivel` também
-- vira linha. São três portas de fail-open, e todas as três passam por aqui:
--   1. `sem_api_key`     — ANTHROPIC_API_KEY faltando (configuração, não escolha)
--   2. `falha_tecnica`   — HTTP/timeout/JSON torto na chamada de visão
--   3. `presign_falhou`  — a rota não gerou a URL assinada; a visão nem foi chamada
--
-- O que NÃO vira linha, de propósito:
--   · aprovação olhada — seria uma linha por clone, e isso `video_clones` já responde;
--   · `desligado` (VIDEO_CLONE_FACE_GATE=0) — escolha nossa e consciente; gravaria
--     uma linha por pedido e afogaria o sinal que a tabela existe pra dar.
--
-- ─────────────────────────────────────────────────────────────────────────
-- O QUE ESTA MIGRATION NÃO FAZ, DE PROPÓSITO: NÃO CRIA ALARME.
--
-- O pedido original era "2+ recusas do mesmo aluno em janela curta abre cartão
-- sozinha". NÃO foi implementado, e o motivo é um número: a Alice sozinha bateu
-- 6 vezes em 6 horas. Se esse for o comportamento NORMAL de quem está tentando
-- enquadrar a foto, um limiar de 2 inunda a fila de cartão e vira ruído que
-- ninguém lê. Primeiro grava; depois mede a taxa real por aluno e por dia; e SÓ
-- ENTÃO escolhe o limiar com número na mão. Esse é o próximo passo, e ele
-- precisa de uns dias de tabela cheia antes de existir.
--
-- Pelo mesmo motivo o cartão 243f4d4a não mexe em critério do gate enquanto
-- este rastro não estiver no ar: sem ele não dá pra saber quem um limiar novo
-- passaria a barrar.

create table if not exists public.face_gate_recusas (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  -- quem bateu na parede
  user_id     uuid not null,

  -- qual imagem — bucket + chave acham o arquivo no R2. Guardar os dois é o que
  -- permite ABRIR a foto depois e conferir se o gate tinha razão (foi assim que
  -- o #371 virou "o gate confunde queixo recolhido com olhar pra baixo", em vez
  -- de continuar sendo "o gate alucinou").
  bucket      text not null,
  image_key   text not null,

  -- 'recusa' = a visão olhou e reprovou.
  -- 'avaliacao_impossivel' = ninguém olhou e o fail-open deixou passar.
  resultado   text not null,

  -- O motivo CRU, como veio. Em 'recusa' é o texto que o modelo devolveu (o
  -- mesmo que virou a mensagem do aluno). Em 'avaliacao_impossivel' é a causa
  -- técnica. Cru de propósito: é lendo o texto repetido que se descobre o viés
  -- do modelo. Nullable porque texto de modelo pode vir vazio — e vazio vira
  -- null em vez de string vazia (o código corta em 500 chars).
  motivo      text
);

-- Vocabulário fechado. A tabela nasce vazia, então a validação é instantânea e
-- não há risco de falhar por dado antigo (diferente do caso do script 107).
-- ⚠️ O PREÇO, dito na cara: valor novo exige DUAS mudanças, nesta ordem — esta
-- constraint ANTES, o `ResultadoFaceGate` de registrar-face-gate.ts depois.
-- Quem esquecer vê `23514 violates check constraint` em produção. Aceito aqui
-- porque a alternativa é um typo silencioso ('recusaa') sumir de todo filtro,
-- que numa tabela de auditoria é a pior falha possível: ela mente pra baixo.
alter table public.face_gate_recusas
  drop constraint if exists face_gate_recusas_resultado_check;
alter table public.face_gate_recusas
  add constraint face_gate_recusas_resultado_check
  check (resultado in ('recusa', 'avaliacao_impossivel'));

-- "quantas vezes ESTE aluno bateu na mesma parede?" — a consulta do caso Alice,
-- e a que vai calibrar o limiar quando ele existir.
create index if not exists face_gate_recusas_user_idx
  on public.face_gate_recusas (user_id, created_at desc);
-- "quantos o gate barrou hoje?" — a consulta que hoje não tem resposta.
create index if not exists face_gate_recusas_resultado_idx
  on public.face_gate_recusas (resultado, created_at desc);
-- "quantos passaram sem ninguém olhar?" — parcial porque a expectativa é que
-- seja a minoria; se esta virar a maioria, o gate está fora do ar e não sabemos.
create index if not exists face_gate_recusas_cego_idx
  on public.face_gate_recusas (created_at desc)
  where resultado = 'avaliacao_impossivel';

comment on table public.face_gate_recusas is
  'Uma linha por veredito NÃO-APROVADOR do gate de rosto do Vídeo Clone: recusa (a visão reprovou) e avaliacao_impossivel (fail-open, ninguém olhou). Aprovação olhada não grava. Serve pra responder "quantos o gate barrou hoje" e "quantas vezes o mesmo aluno bateu na mesma parede" — #372.';
comment on column public.face_gate_recusas.motivo is
  'Texto cru do modelo (recusa) ou causa técnica (avaliacao_impossivel). Cru de propósito: é a repetição do texto que revela o viés do detector.';

-- Só o service_role escreve/lê (o código usa o admin client). Sem policy: a
-- tabela guarda chave de imagem de aluno e não tem por que ser lida do browser.
-- Mesma postura de `avisos_enviados` e `onboarding_runs`.
alter table public.face_gate_recusas enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- ANÁLISE DE RISCO
--
-- 1. ADITIVA E ISOLADA. Cria tabela nova; não altera, não lê e não referencia
--    NENHUMA tabela existente. Sem foreign key, sem trigger, sem mexer em RLS
--    de terceiros. Nenhum caminho de código atual depende dela.
--
-- 2. REVERSÍVEL. `drop table public.face_gate_recusas;` desfaz por completo —
--    nada mais no schema aponta pra cá. Perde-se só o histórico registrado, e
--    o código volta a degradar pra console.error sem quebrar.
--
-- 3. SEM FK EM user_id, DE PROPÓSITO. Uma FK pra profiles(id) faria o registro
--    FALHAR num aluno sem conta e, pior, apagaria a auditoria junto com a conta
--    num cascade. Registro de auditoria tem que SOBREVIVER ao apagamento do
--    sujeito. O custo é que user_id pode apontar pra conta que não existe mais;
--    aceitável, e é a mesma escolha de `avisos_enviados` (script 104).
--
-- 4. CRESCIMENTO. Uma linha por veredito não-aprovador do Vídeo Clone. Base
--    atual: 3.109 clones na vida inteira do produto. Ordem de grandeza de
--    dezenas por semana, não milhares por dia — não precisa de particionamento
--    nem de retenção agora. Se crescer, é seguro apagar por `created_at`: nada
--    referencia esta tabela.
--
-- 5. DADO PESSOAL. Guarda user_id e o caminho da imagem no R2 — NÃO guarda a
--    imagem. RLS ligada e sem policy = ninguém além do service_role enxerga.
--
-- 6. NÃO TOCA CRÉDITO. O gate roda ANTES da cobrança (route.ts, antes do
--    `debitCredits`). Nem a recusa nem o registro passam perto de saldo.
--
-- ─────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA PÓS-APLICAÇÃO (rodada em 13/09, saída real no corpo do PR):
--
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema='public' and table_name='face_gate_recusas'
--    order by ordinal_position;
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid='public.face_gate_recusas'::regclass;
--
--   select indexname from pg_indexes
--    where schemaname='public' and tablename='face_gate_recusas';
--
--   select relrowsecurity from pg_class where oid='public.face_gate_recusas'::regclass;
--
-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK (instantâneo, não quebra código nenhum — o insert volta a virar
-- console.error e o aluno recebe a recusa igual):
--
--   drop table if exists public.face_gate_recusas;
