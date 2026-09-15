-- ============================================================================
-- 117 — sgp_fracassos: a recuperação para de APAGAR a prova de que falhou
--
-- ⚠️ ESPELHO — NÃO APLICADO. DDL aguardando aprovação do Johnny (regra 21).
-- ⚠️ Numerada 117 de propósito: a 115 (trial_periods) ainda não foi aplicada e
--    a 116 está tomada por trabalho em curso. Pular é mais barato que colidir —
--    já houve colisão de cinco arquivos "108" em 15/09.
--
-- ── O defeito, MEDIDO em 15/09 (não projetado) ─────────────────────────────
-- Base inteira do SGP: 268 pedidos. `status='falhou'` = ZERO. Coluna `erro` =
-- NULL em TODAS as 268 linhas. Distribuição: dados 103, pronto 84, foto 63,
-- audio 18.
--
-- Isso não é saúde, é AMNÉSIA. No MESMO dia 15/09 o pedido do ricardoolito
-- morreu por CUDA out of memory (voz f58a158a) e foi recuperado à mão — e
-- depois da recuperação a base passou a afirmar que o SGP nunca falhou.
--
-- A causa está em `lib/sgp/fracasso.ts` (`processarTransicao`, ramo
-- `statusNovo !== 'falhou'`): a MESMA escrita que recupera o pedido faz
-- `erro: null`. Foi deliberado e está certo no que se propôs (#365, 12/09): o
-- pedido fe00d4e2 voltou pra 'pronto' ainda exibindo "não foi possível gerar o
-- seu clone a partir das fotos enviadas" — um pedido PRONTO culpando as 4 fotos
-- impecáveis do aluno. Limpar na volta também é o que faz o cadeado `!erro` do
-- #246 voltar a ser verdadeiro sozinho no episódio seguinte.
--
-- O erro não foi limpar. Foi limpar SEM GUARDAR EM LUGAR NENHUM.
--
-- ── Por que uma TABELA e não uma coluna ────────────────────────────────────
-- Um pedido pode falhar, ser recuperado, e falhar DE NOVO (o teste
-- "episódio novo depois da recuperação" em fracasso.test.ts já exercita
-- exatamente isso). Coluna guarda um valor; episódio é uma sequência. Com
-- coluna, o segundo fracasso apagaria o primeiro e a métrica voltaria a mentir,
-- só que mais devagar.
--
-- ── A separação que este arquivo institui ──────────────────────────────────
--   EXIBIÇÃO  = `sgp_pedidos.erro`  → o que o ALUNO vê. Continua sendo limpo na
--               recuperação, exatamente como hoje. Nada muda na tela dele.
--   HISTÓRICO = `sgp_fracassos`     → o que a MÉTRICA vê. Nunca é apagado.
-- Elas nunca mais se confundem. Ninguém precisa escolher entre "a tela do aluno
-- fica limpa" e "a gente sabe quantas vezes quebrou".
--
-- ── O que esta tabela NÃO é ────────────────────────────────────────────────
-- Não é fila de trabalho, não dispara e-mail, não é lida pela tela do aluno e
-- não participa de nenhuma decisão de produção. É livro-caixa: só escreve e é
-- consultada por relatório. Se ela sumir, o pipeline continua funcionando
-- idêntico — e por isso a escrita dela é best-effort no código (ver
-- `lib/sgp/etapas.ts`): livro-caixa que derruba a produção é pior que
-- livro-caixa nenhum.
-- ============================================================================

create table if not exists public.sgp_fracassos (
  id uuid primary key default gen_random_uuid(),

  -- Sem FK pra sgp_pedidos de propósito: se um dia um pedido for removido, a
  -- prova de que ele quebrou é justamente o que NÃO pode ir junto. O histórico
  -- sobrevive ao seu objeto — é a razão de ele existir.
  pedido_id uuid not null,

  -- Quando o pedido entrou em 'falhou'. Preenchido na ida, pela mesma chamada
  -- que ganhou o cadeado `.neq('status','falhou')` — então há no máximo uma
  -- linha aberta por episódio, sem corrida.
  falhou_em timestamptz not null default now(),

  -- O motivo técnico, copiado de `sgp_pedidos.erro` ANTES de ele ser zerado.
  -- Nullable porque fracasso sem motivo registrado existe (e saber que houve
  -- fracasso já vale, mesmo sem a causa).
  motivo text,

  -- NULL = ainda quebrado. Preenchido na volta, no mesmo ponto onde hoje se faz
  -- `erro: null`.
  recuperado_em timestamptz,

  -- Pra qual status o pedido voltou ('pronto', 'processando', ...). Distingue
  -- "voltou entregue" de "voltou pra fila", que é a diferença entre recuperação
  -- de verdade e pedido que só mudou de lugar.
  recuperado_para text,

  criado_em timestamptz not null default now()
);

-- A consulta do dia a dia é "o que este pedido já sofreu", em ordem.
create index if not exists sgp_fracassos_pedido_idx
  on public.sgp_fracassos (pedido_id, falhou_em desc);

-- A consulta da métrica é "o que está quebrado AGORA" — índice parcial porque
-- o normal é a esmagadora maioria das linhas já estar recuperada.
create index if not exists sgp_fracassos_abertos_idx
  on public.sgp_fracassos (falhou_em desc)
  where recuperado_em is null;

-- No máximo UM episódio aberto por pedido. É o que torna o fechamento da volta
-- não-ambíguo (qual linha fechar?) sem precisar guardar id nenhum entre as duas
-- escritas — que acontecem em requisições diferentes, possivelmente em dias
-- diferentes.
create unique index if not exists sgp_fracassos_um_aberto_por_pedido
  on public.sgp_fracassos (pedido_id)
  where recuperado_em is null;

-- Só o service role escreve (todas as escritas saem de `getAdmin()`). O aluno
-- NUNCA lê esta tabela — o que ele vê é `sgp_pedidos.erro`, e o ponto inteiro
-- deste arquivo é que as duas coisas são separadas.
alter table public.sgp_fracassos enable row level security;

comment on table public.sgp_fracassos is
  'Histórico de episódios de fracasso do SGP. EXIBIÇÃO fica em sgp_pedidos.erro (limpo na recuperação, #365); HISTÓRICO fica aqui e nunca é apagado. Livro-caixa: nenhuma decisão de produção depende desta tabela.';
comment on column public.sgp_fracassos.recuperado_em is
  'NULL = episódio aberto (pedido ainda quebrado). Preenchido no mesmo ponto onde sgp_pedidos.erro é zerado.';
