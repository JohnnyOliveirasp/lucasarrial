-- 119 — SGP: marcar a conclusão que fechou SOZINHA (7 dias após a ENTREGA).
--
-- PEDIDO (Johnny, recado 6 de 15/09, requisito 5): *"'Concluir atendimento'
-- automático 7 dias após ENTREGUE sem reclamação."*
--
-- ⚠️ NUMERAÇÃO — e a lição de por que ela mudou sozinha.
--
-- Este arquivo nasceu em 16/09 como **118**, com esta justificativa escrita:
-- *"o cartão pediu 117+; a 117 (`117_sgp_fracassos.sql`) JÁ EXISTE na main —
-- conferido em `ls scripts/*.sql` antes de escrever, não suposto."*
--
-- A conferência estava CERTA no dia e ficou ERRADA sem ninguém tocar no PR:
-- enquanto ele esperava merge (8 dias), entraram na main DUAS migrations 118 —
-- `118_virais_do_aluno.sql` e `118_voices_speech_rate.sql`. Mergear como 118
-- criaria a TERCEIRA.
--
-- Renumerado para **119** na ronda de 25/09 ~00hZ. É seguro porque este DDL
-- **nunca foi aplicado**: renumerar arquivo já aplicado seria apagar o rastro
-- do que rodou, e aí não se faz.
--
-- A lição, que vale pro próximo: **o número não é identificador, é um palpite
-- sobre o que os outros ainda não mergearam.** Git não acusa a colisão (os
-- nomes de arquivo diferem, não há conflito), então ela entra CLEAN. Conferir
-- na hora de ESCREVER não protege; conferir na hora de MERGEAR, sim. Medido em
-- 25/09: a main já tinha 3 números colididos (82 com três arquivos, 100 e 118
-- com dois cada) — `_frank/ferramentas/2026-09-25_migration_numero_colidido.cjs`.
--
-- ---------------------------------------------------------------------------
-- POR QUE UMA COLUNA, se `concluido_por` já diria quem fechou
-- ---------------------------------------------------------------------------
-- O código GRAVA um sentinela em `concluido_por`
-- ("o sistema (fechamento automático)", a constante SGP_CONCLUSAO_AUTOMATICA_AUTOR
-- em lib/sgp/painel.ts) e a TELA já lê aquilo por igualdade exata. Ou seja: a
-- tela fica honesta com ou sem esta migration, e o recurso NÃO depende dela.
--
-- Esta coluna existe por uma razão só, e é de AUDITORIA: a pergunta "quantos
-- atendimentos o relógio fechou no mês, e quantos uma pessoa fechou?" tem que
-- ser uma consulta, e não um `like` em texto livre. Casar status por pedaço de
-- string é armadilha conhecida desta casa (foi assim que assinatura PAST_DUE
-- virou cancelamento); num campo que qualquer atendente preenche, é pior.
--
-- Então: NÃO é urgente, NÃO destrava nada, e pode ficar parada sem prejuízo.
-- Se um dia entrar, a varredura passa a preenchê-la sozinha — sem deploy, pelo
-- mesmo fallback por GRUPO de lib/sgp/cobranca.ts que as 106/109/110/116 usam.
--
-- ---------------------------------------------------------------------------
-- 🚨 O PONTO QUE NÃO PODE PASSAR BATIDO — O GATILHO `sgp_pedidos_touch`
-- ---------------------------------------------------------------------------
-- É a MESMA armadilha que a 110 documenta, e é por isso que esta migration não
-- é só um `alter table`.
--
-- `sgp_pedidos_touch` carimba `atualizado_em = now()` em todo UPDATE que mexa em
-- coluna que não esteja na lista de ANOTAÇÕES. E `atualizado_em` é exatamente o
-- relógio do "parado há" do painel (`lib/sgp/painel.ts › montarLinha`).
--
-- Se `concluido_automatico` ficasse de FORA da lista, o UPDATE da varredura
-- (que muda false → true) cairia no `now()` e ZERARIA o "parado há" de cada
-- linha que ela fechasse — silenciosamente, e em lote. Seria a varredura
-- destruindo justamente o dado que a tela usa pra saber quem está esperando.
--
-- Por isso a coluna e o gatilho entram JUNTOS, nesta mesma migration: não existe
-- janela em que a coluna exista e a função não a conheça.
--
-- ⚠️ A função abaixo é um SUPERCONJUNTO ESTRITO da 110 — as mesmas chaves mais
-- uma. `responsavel` continua na lista (ver 109 e 110: a coluna existe em
-- produção e tirá-la seria uma regressão silenciosa).
--
-- ⚠️ NÃO APLICADA por quem escreveu. Quem aplica é o Johnny, depois de auditar.

-- ---------------------------------------------------------------------------
-- 1) A coluna
-- ---------------------------------------------------------------------------
alter table public.sgp_pedidos
  add column if not exists concluido_automatico boolean not null default false;

comment on column public.sgp_pedidos.concluido_automatico is
  'true = este atendimento fechou SOZINHO (7 dias após a entrega, sem '
  'reclamação registrada; ver lib/sgp/conclusao-sweep.ts). false = alguém do '
  'time clicou em "Concluir atendimento". Campo ESTRUTURADO de auditoria: '
  'existe pra a pergunta "quantos o relógio fechou?" ser uma consulta em vez de '
  'um like em concluido_por. NÃO é o que a tela usa pra decidir o texto — ela '
  'lê isto OU a igualdade exata de concluido_por com o sentinela, porque esta '
  'coluna pode não estar aplicada.';

-- ---------------------------------------------------------------------------
-- 2) O gatilho de `atualizado_em` — superconjunto estrito do da 110
-- ---------------------------------------------------------------------------
create or replace function public.sgp_pedidos_touch()
returns trigger language plpgsql as $$
declare
  -- `atualizado_em` entra na lista porque é o campo que estamos decidindo; as
  -- demais são as anotações do TIME (e, agora, a do relógio). Chave que não
  -- existe na linha é ignorada pelo `-`, então esta função não exige nenhuma
  -- das migrations anteriores.
  --
  -- ⚠️ `responsavel` NÃO PODE SAIR DAQUI (ver migrations 109 e 110).
  anotacoes text[] := array[
    'atualizado_em',
    'responsavel',
    'cobrado_em', 'cobrado_por',
    'erro_manual_em', 'erro_manual_por', 'erro_manual_motivo',
    'concluido_em', 'concluido_por', 'concluido_motivo',
    'concluido_automatico'
  ];
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - anotacoes) = (to_jsonb(old) - anotacoes)
  then
    -- Anotação do TIME (ou do relógio) não é movimentação do PEDIDO.
    new.atualizado_em = old.atualizado_em;
    return new;
  end if;

  new.atualizado_em = now();
  return new;
end $$;

-- O gatilho em si não muda (segue `before update ... for each row`), só o corpo
-- da função. Recriado abaixo por idempotência, igual à 100, 106, 109 e 110.
drop trigger if exists sgp_pedidos_touch on public.sgp_pedidos;
create trigger sgp_pedidos_touch before update on public.sgp_pedidos
  for each row execute function public.sgp_pedidos_touch();

-- ---------------------------------------------------------------------------
-- ⚠️ ORDEM DE APLICAÇÃO
-- ---------------------------------------------------------------------------
-- Esta 119 SUBSTITUI o pedaço de gatilho da 106, da 109 e da 110 (é
-- superconjunto das três). NUNCA aplicar 106/109/110 DEPOIS desta: qualquer uma
-- recria a função sem conhecer `concluido_automatico`, e a partir daí cada
-- conclusão automática passa a zerar o "parado há" daquela linha — sem avisar.
--
-- ANTES DE RODAR, conferir que a função viva é mesmo a esperada (o banco já
-- divergiu do git uma vez — é o achado que a 109 registra):
--   select prosrc from pg_proc where proname = 'sgp_pedidos_touch';
-- Se aparecer alguma chave que não está no array acima, ACRESCENTE antes de
-- aplicar em vez de sobrescrever — uma proteção que some não avisa.
--
-- E, se a 110 ainda NÃO tiver sido aplicada: aplique a 110 PRIMEIRO. Esta
-- migration não cria `concluido_em`/`concluido_por`/`concluido_motivo`, e sem
-- elas a varredura fica inerte de propósito (ela detecta e relata o motivo).
--
-- ---------------------------------------------------------------------------
-- RISCO DE APLICAR
-- ---------------------------------------------------------------------------
-- Baixo, com UMA ressalva honesta que a 110 não tinha:
--  · a coluna é `not null default false`, e coluna com DEFAULT NÃO-VOLÁTIL não
--    reescreve a tabela no PG 11+ (o default fica no catálogo). Ainda assim,
--    `sgp_pedidos` tem ~270 linhas: mesmo um rewrite seria instantâneo;
--  · a função é um `create or replace` cujo caminho padrão é o comportamento de
--    hoje, e cuja única diferença é proteger uma coluna a mais;
--  · nenhum UPDATE de dado, nenhum backfill, nenhum índice, nenhuma constraint.
--
-- ⚠️ O BACKFILL QUE ESTA MIGRATION **NÃO** FAZ, de propósito: conclusões que a
-- varredura já tenha gravado ANTES desta migration ficam com
-- `concluido_automatico = false` e só se identificam pelo sentinela em
-- `concluido_por`. Marcá-las aqui seria um UPDATE em massa baseado em casamento
-- de texto — exatamente o que esta coluna existe pra evitar. Se um dia for
-- preciso, o comando é este, e é uma decisão separada:
--   -- update public.sgp_pedidos set concluido_automatico = true
--   --  where concluido_por = 'o sistema (fechamento automático)';
--
-- ---------------------------------------------------------------------------
-- REVERTER (se precisar)
-- ---------------------------------------------------------------------------
-- -- Volta a função EXATAMENTE à da migration 110:
-- create or replace function public.sgp_pedidos_touch()
-- returns trigger language plpgsql as $$
-- declare
--   anotacoes text[] := array[
--     'atualizado_em',
--     'responsavel',
--     'cobrado_em', 'cobrado_por',
--     'erro_manual_em', 'erro_manual_por', 'erro_manual_motivo',
--     'concluido_em', 'concluido_por', 'concluido_motivo'
--   ];
-- begin
--   if tg_op = 'UPDATE'
--      and (to_jsonb(new) - anotacoes) = (to_jsonb(old) - anotacoes)
--   then
--     new.atualizado_em = old.atualizado_em;
--     return new;
--   end if;
--   new.atualizado_em = now();
--   return new;
-- end $$;
-- -- E só então tirar a coluna:
-- alter table public.sgp_pedidos drop column if exists concluido_automatico;
--
-- ⚠️ Reverter SÓ A FUNÇÃO com a coluna ainda de pé é o pior dos mundos: a
-- varredura continua escrevendo naquela coluna e cada escrita passa a destruir
-- o "parado há" da linha. Se for pra reverter, reverta os dois, nesta ordem.
