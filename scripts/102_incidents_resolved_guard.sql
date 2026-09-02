-- 102: trava NO BANCO pros campos de fechamento de incidente.
--
-- ⚠️ NÃO APLICADA. Precisa de aval do Johnny (regra dura: migration não sobe
-- sozinha). Depois de aplicada, registrar a data aqui embaixo, como nas
-- migrations anteriores.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUE UMA TRAVA NO BANCO, E NÃO O SÉTIMO CONSERTO NO CÓDIGO
--
-- Esta família de bug já foi consertada SEIS vezes (981f2fb, ce25390,
-- b06343c, 490690b, a função fechamento() das ferramentas, e agora a
-- reabertura automática do reportar.ts). Toda vez o conserto cobriu UM
-- caminho de escrita, e meses depois apareceu outro que ninguém lembrou.
--
-- A contagem medida em 02/09 explica por que a disciplina por chamador não
-- aguenta: 77 arquivos escrevem em `incidents`, sendo ~70 deles scripts
-- ad-hoc em _Bugs/ e _frank/ que falam com o banco por service-role e NUNCA
-- vão importar um helper de TypeScript. Trava por chamador só protege os 7
-- do app. O único ponto por onde os 77 passam é o banco.
--
-- Duas provas de que nem centralizar resolve sozinho:
--   · a cópia inline em entregar.ts saiu com 2 dos 3 campos (esqueceu
--     `resolved_commit`) e deixou 4 incidentes vivos se contradizendo;
--   · o helper da branch feat/incidents-resolved-at (nunca mergeada) também
--     só cobria 2 dos 3 campos.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUE TRIGGER, E NÃO CHECK NEM DEFAULT
--
--   · DEFAULT de coluna só age em INSERT sem o campo, e não pode depender do
--     status. Aqui o caso dominante é UPDATE de status.
--   · CHECK RECUSARIA a escrita. Os ~70 scripts ad-hoc não mandam
--     resolved_at; um CHECK transformaria todo fechamento feito por script de
--     ronda em erro, no meio da madrugada, sem ninguém pra ver. Pior: o
--     script morre calado e o incidente fica sem fechar.
--   · TRIGGER PREENCHE em vez de recusar. Pode ser aplicada ANTES do deploy
--     do código sem quebrar nada, e cobre para sempre quem nunca vai importar
--     helper nenhum.
--
-- ─────────────────────────────────────────────────────────────────────────
-- O QUE ELA FAZ (e, principalmente, o que ela NÃO faz)
--
--   FECHANDO (insert já fechado, ou update saindo de aberto → fechado):
--     · resolved_at nulo            → now()
--     · resolved_by nulo/vazio      → 'nao-informado (trigger)'
--     · resolved_commit             → NÃO É TOCADO (quem não informou commit
--                                     não tem commit; inventar seria pior)
--     · valor mandado pelo chamador NUNCA é sobrescrito
--
--   REABRINDO (update saindo de fechado → open/investigating/fixing/...):
--     · limpa os TRÊS campos — este é o buraco de hoje
--     · exceto o campo que o próprio chamador mexeu nesse mesmo update
--       (`is not distinct from old`), pra nunca brigar com quem sabe o que
--       está fazendo
--
--   UPDATE numa linha JÁ fechada que CONTINUA fechada (bump de ocorrência,
--   nota nova, troca de fixed→ignored):
--     · NÃO carimba nada. Carimbar aqui seria inventar a data de um
--       fechamento antigo — e data inventada é pior que campo vazio.
--       É por isso que os 6 fechamentos sem dono de 14–19/08 (anteriores ao
--       conserto ce25390) continuam nulos de propósito: "não sei quem fechou"
--       é a verdade, e a trava não vai fabricar um dono pra eles.
--
-- ─────────────────────────────────────────────────────────────────────────
-- MEDIÇÃO ANTES DE APLICAR (02/09, banco de produção)
--
--   total de incidentes ................................ 225
--   fechados ........................................... 204
--   fechados sem resolved_at ............................. 0   ← consertos 1-5 seguraram
--   fechados sem resolved_by ............................. 6   ← todos de 14–19/08, pré-ce25390
--   NÃO fechados carregando carimbo ...................... 4   ← #171, #192, #202, #226
--
-- A trigger NÃO age retroativamente: aplicar não muda nenhuma dessas linhas.
-- A limpeza das 4 está no backfill no fim deste arquivo, separado de
-- propósito, pra ser decidido à parte.
--
-- ─────────────────────────────────────────────────────────────────────────
-- RISCO (o que pode dar errado)
--
--  1. ALTO-FALANTE MUDO: a trigger preenche em silêncio. Um caminho que
--     esquece resolved_by passa a gravar 'nao-informado (trigger)' e ninguém
--     percebe que o código está errado — o sintoma some mas a causa fica.
--     MITIGAÇÃO: o marcador é literal e consultável de propósito. Vale uma
--     consulta na ronda:
--       select numero from incidents where resolved_by = 'nao-informado (trigger)';
--     Se aparecer linha nova, é código novo escrevendo errado, não histórico.
--
--  2. A REABERTURA APAGA HISTÓRICO. Hoje `resolved_commit` sobrevive à
--     reabertura em alguns caminhos e some em outros. Depois da trigger ele
--     some sempre. Se alguém HOJE usa esse campo pra saber "qual commit
--     tentou consertar isto da última vez", perde o dado.
--     MEDIÇÃO: os únicos leitores são a aba Falhas (page.tsx:252, só exibe) e
--     o health-report (só faz select). Nenhum decide nada em cima do campo em
--     linha reaberta. Risco considerado baixo — mas é uma PERDA, não um
--     detalhe, e por isso está escrito aqui.
--
--  3. BRIGA COM UPDATE PARCIAL. PostgREST manda a linha inteira no NEW, então
--     `new.x is not distinct from old.x` distingue "não mexeu" de "mandou o
--     mesmo valor" — se o chamador mandar explicitamente o MESMO valor que já
--     estava, a trigger vai tratar como "não mexeu" e limpar. É um empate
--     impossível de desfazer sem coluna de sentinela; na prática ninguém
--     reabre mandando o carimbo velho de novo.
--
--  4. fixed → ignored (fechado pra fechado) não recarimba. Se alguém esperava
--     que trocar o tipo de fechamento atualizasse a data, não atualiza. É
--     deliberado (ver acima), mas é uma diferença de comportamento.
--
--  5. Trigger BEFORE em tabela quente custa por linha. `incidents` tem 225
--     linhas e escrita esporádica: custo irrelevante aqui.
--
--  6. NÃO cobre DELETE, nem escrita que burle a trigger (COPY com
--     `session_replication_role = replica`, por exemplo). Ninguém faz isso
--     hoje, mas a trava não é mágica.
--
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.incidents_resolved_guard()
returns trigger
language plpgsql
as $$
begin
  -- ENTRANDO em fechado: carimba o que faltar, sem sobrescrever o que veio.
  if new.status in ('fixed', 'ignored')
     and (tg_op = 'INSERT' or old.status not in ('fixed', 'ignored')) then

    if new.resolved_at is null then
      new.resolved_at := now();
    end if;

    if new.resolved_by is null or btrim(new.resolved_by) = '' then
      new.resolved_by := 'nao-informado (trigger)';
    end if;

    -- resolved_commit fica como veio, inclusive nulo. Não se inventa commit.

  -- SAINDO de fechado (reabertura): limpa os três, menos o que o chamador
  -- mexeu neste mesmo update.
  elsif tg_op = 'UPDATE'
     and new.status not in ('fixed', 'ignored')
     and old.status in ('fixed', 'ignored') then

    if new.resolved_at is not distinct from old.resolved_at then
      new.resolved_at := null;
    end if;

    if new.resolved_by is not distinct from old.resolved_by then
      new.resolved_by := null;
    end if;

    if new.resolved_commit is not distinct from old.resolved_commit then
      new.resolved_commit := null;
    end if;

  end if;

  return new;
end
$$;

drop trigger if exists incidents_resolved_guard on public.incidents;
create trigger incidents_resolved_guard
  before insert or update on public.incidents
  for each row
  execute function public.incidents_resolved_guard();


-- ─────────────────────────────────────────────────────────────────────────
-- BACKFILL — SEPARADO DE PROPÓSITO, NÃO APLICADO.
--
-- A trigger não age retroativamente, então as 4 linhas contraditórias de hoje
-- continuam como estão até alguém rodar isto. São incidentes em
-- 'investigating' carregando `resolved_commit` de um fechamento que já foi
-- desfeito (rastro do entregar.ts, que limpava 2 dos 3 campos):
--
--   #171 c7e07ab · #192 01d9cb7 · #202 5b8afad · #226 e4cc692
--
-- NÃO mexe em resolved_at/resolved_by: nessas 4 os dois já estão nulos.
-- Confirmar que afetou exatamente 4 antes de dar commit na transação.
--
-- update public.incidents
--    set resolved_commit = null
--  where status not in ('fixed', 'ignored')
--    and resolved_commit is not null;
