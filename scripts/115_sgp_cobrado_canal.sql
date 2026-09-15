-- 115 — SGP: o "já cobrei" passa a registrar POR ONDE o time falou.
--
-- PEDIDO (Johnny, 15/09, corrigindo o escopo do recado 6): *"você não vai entrar
-- em contato com o aluno, minha equipe vai, só na tela que pedimos para whatsapp
-- e email, para que minha equipe tenha a visualização"*.
--
-- A tela passa a ter os dois links (wa.me e mailto) com o texto já escrito, e é
-- O CLIQUE NO LINK que registra a cobrança — hoje isso depende de alguém lembrar
-- de apertar "Já cobrei" DEPOIS de falar, e por isso só 3 dos 267 pedidos têm
-- `cobrado_em` (medido em 15/09 no banco vivo). Registrando no clique, o canal
-- deixa de ser adivinhação: o time sabe se aquele caso foi pro WhatsApp ou pro
-- e-mail sem ter que perguntar pra pessoa que clicou.
--
-- ⚠️ O QUE ESTA MIGRATION *NÃO* HABILITA: nada aqui envia mensagem. Não existe
-- disparo automático, cron, job de 48h/D+5/D+9, nem WAHA. O `wa.me` abre o
-- WhatsApp de QUEM CLICOU e quem aperta "enviar" é a pessoa. A regra permanente
-- de que a empresa nunca inicia WhatsApp por robô continua valendo inteira —
-- esta coluna é só o registro de que UM HUMANO falou, e por onde.
--
-- ---------------------------------------------------------------------------
-- 🚨 O PONTO QUE NÃO PODE PASSAR BATIDO — O GATILHO `sgp_pedidos_touch`
-- ---------------------------------------------------------------------------
-- É o mesmo perigo que a 106 e a 110 documentam, e ele volta inteiro aqui.
--
-- `sgp_pedidos_touch` preserva `atualizado_em` quando o UPDATE só toca ANOTAÇÃO
-- DO TIME. `atualizado_em` é de onde sai o "parado há" do painel. Se
-- `cobrado_canal` NÃO entrar no array `anotacoes`, todo clique em contato passa a
-- carimbar `now()` e a aluna parada há 5 dias vira "parado há 0min" — de vez,
-- porque o relógio real foi destruído no lugar. Ela sai do vermelho, do contador
-- e de qualquer alerta futuro, em silêncio.
--
-- Pior ainda: `lerCobranca` (lib/sgp/painel.ts) invalida a marca quando
-- `atualizado_em > cobrado_em`. Com a coluna criada e o gatilho velho, TODA
-- cobrança nasceria já inválida — o clique gravaria e a tela continuaria
-- gritando, sem ninguém entender por quê.
--
-- Por isso o `alter table` e o `create or replace function` estão NO MESMO
-- ARQUIVO e têm que ser aplicados JUNTOS. Aplicar só o primeiro é o pior dos
-- mundos, e é silencioso.
--
-- ESTADO MEDIDO EM 15/09, no banco vivo, antes de escrever esta migration:
--   · `cobrado_em`, `cobrado_por` (106) → EXISTEM;
--   · `erro_manual_*` (109) → EXISTEM;
--   · `concluido_*` (110) → EXISTEM;
--   · `cobrado_canal` → AUSENTE.
-- E a função viva hoje (lida de `pg_proc.prosrc`, não suposta) é EXATAMENTE a da
-- 110. Esta 115 é a MESMA função com UMA chave a mais no array — superconjunto
-- estrito, byte a byte conferido contra o que está no ar.
--
-- ⚠️ `responsavel` NÃO PODE SAIR DA LISTA, pelo mesmo motivo que a 109 e a 110
-- registraram: a coluna existe em produção e a função viva já a protege.
--
-- ⚠️ NÃO APLICADA por quem escreveu. Quem aplica é o Johnny, depois de auditar.
-- O código foi escrito pra funcionar com ou sem a coluna: sem ela o clique
-- continua registrando data e autor (106, já aplicada) e a tela só não mostra o
-- canal — ver o grupo `canalCobranca` em `lib/sgp/cobranca.ts`, que é SEPARADO
-- do grupo `cobranca` justamente pra que a ausência desta migration não desligue
-- o "já cobrei" que já funciona.

-- ---------------------------------------------------------------------------
-- 1) A coluna
-- ---------------------------------------------------------------------------
alter table public.sgp_pedidos
  add column if not exists cobrado_canal text;

comment on column public.sgp_pedidos.cobrado_canal is
  'Por onde o time falou com o aluno: ''whatsapp'' ou ''email''. Gravado no '
  'CLIQUE do link de contato em /admin/sgp (o link abre o app de quem clicou; '
  'o sistema não envia nada). NULL = cobrança registrada antes desta coluna '
  'existir, ou clique sem canal declarado — nunca presumir ''whatsapp''.';

-- Sem CHECK de propósito: a validação dos dois valores mora em
-- `lib/sgp/contato.ts › ehCanal`, na escrita E na leitura. Um CHECK aqui faria o
-- clique do atendente virar 500 no dia em que um terceiro canal nascesse, e o
-- preço de um valor inesperado é a tela dizer "não sabemos por onde" — que é o
-- que ela já faz com NULL.

-- ---------------------------------------------------------------------------
-- 2) O gatilho de `atualizado_em` — superconjunto estrito do da 110
-- ---------------------------------------------------------------------------
-- Nada aqui muda de comportamento em relação ao que está no ar: são as MESMAS
-- regras com UM nome a mais no array. Um UPDATE que toque qualquer coluna de
-- produto continua caindo no `now()`, byte a byte como hoje.
create or replace function public.sgp_pedidos_touch()
returns trigger language plpgsql as $$
declare
  -- `atualizado_em` entra na lista porque é o campo que estamos decidindo; as
  -- demais são as anotações do TIME. Chave que não existe na linha é ignorada
  -- pelo `-`, então esta função não exige nenhuma das migrations anteriores.
  --
  -- ⚠️ `responsavel` NÃO PODE SAIR DAQUI (ver cabeçalho e migrations 109/110).
  anotacoes text[] := array[
    'atualizado_em',
    'responsavel',
    'cobrado_em', 'cobrado_por', 'cobrado_canal',
    'erro_manual_em', 'erro_manual_por', 'erro_manual_motivo',
    'concluido_em', 'concluido_por', 'concluido_motivo'
  ];
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - anotacoes) = (to_jsonb(old) - anotacoes)
  then
    -- Anotação do TIME não é movimentação do PEDIDO. O relógio não anda.
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
-- Esta 115 SUBSTITUI o pedaço de gatilho da 106, da 109 e da 110 (é superconjunto
-- das três). NUNCA aplicar uma daquelas DEPOIS desta: qualquer uma recria a
-- função sem conhecer `cobrado_canal`, e a partir daí cada clique de contato
-- volta a zerar o "parado há" da linha — silenciosamente.
--
-- ANTES DE RODAR, conferir que a função viva é mesmo a da 110 (o banco já
-- divergiu do git uma vez, é o achado que a 109 registra):
--   select prosrc from pg_proc where proname = 'sgp_pedidos_touch';
-- Se aparecer alguma chave que não está no array acima, ACRESCENTE antes de
-- aplicar em vez de sobrescrever — uma proteção que some não avisa.
--
-- DEPOIS DE RODAR, conferir que a anotação não move o relógio (num pedido de
-- teste, não num aluno real):
--   select atualizado_em from public.sgp_pedidos where id = '<id>';
--   update public.sgp_pedidos set cobrado_canal = 'whatsapp' where id = '<id>';
--   select atualizado_em from public.sgp_pedidos where id = '<id>';  -- igual
--
-- ---------------------------------------------------------------------------
-- RISCO DE APLICAR
-- ---------------------------------------------------------------------------
-- Baixo, pelo mesmo motivo da 110: nada aqui reescreve dado existente.
--  · `add column if not exists` de UMA coluna nula — PG 11+ não reescreve a
--    tabela para coluna nullable sem default, e sgp_pedidos tem 267 linhas
--    (contadas em 15/09);
--  · a função é um `create or replace` cujo caminho padrão é o comportamento de
--    hoje, e cuja única diferença é proteger uma coluna a mais;
--  · nenhum UPDATE de dado, nenhum backfill, nenhum índice, nenhuma constraint.
--
-- ⚠️ O QUE ACONTECE COM AS 3 COBRANÇAS QUE JÁ EXISTEM: nada. Elas ficam com
-- `cobrado_canal` NULL, e a tela mostra "cobrado há Xh por fulano" sem canal,
-- exatamente como mostra hoje. Nenhum backfill: não temos como saber por onde
-- aquelas três foram feitas, e inventar o canal delas seria pior que não ter.
--
-- ---------------------------------------------------------------------------
-- REVERTER (se precisar)
-- ---------------------------------------------------------------------------
-- -- Volta a função EXATAMENTE à da migration 110 (a que está no ar hoje):
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
-- -- E, se quiser tirar a coluna (isto APAGA o canal registrado):
-- alter table public.sgp_pedidos drop column if exists cobrado_canal;
--
-- ⚠️ Reverter SÓ A FUNÇÃO com a coluna ainda de pé é o pior dos mundos: a tela
-- continua gravando `cobrado_canal` e cada clique passa a destruir o "parado há"
-- daquela linha. Se for pra reverter, reverta os dois ou nenhum.
