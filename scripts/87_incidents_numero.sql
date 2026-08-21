-- 87 — NÚMERO CURTO PARA CADA CHAMADO
--
-- POR QUE (pedido do Johnny, 21/08): hoje um chamado se chama
-- `2c5bab42-9e79-4ed5-9975-fbcb5f4a99df`. Ninguém lê isso no telefone, ninguém
-- digita isso num grupo, e nas conversas do dia todo mundo acaba usando os 8
-- primeiros caracteres — que é um apelido sem garantia de ser único. Chamado
-- precisa de número: "o #42" se fala, se procura e não se confunde.
--
-- O UUID CONTINUA SENDO A CHAVE. O número é só o nome de chamar: é único,
-- nunca muda, nunca é reaproveitado. Toda ferramenta que hoje busca por `id`
-- continua funcionando sem tocar em nada.
--
-- ⚠️ ESTE ARQUIVO É O 87 E NÃO O 85/86 DE PROPÓSITO: o 85 está reclamado por
-- DUAS branches ao mesmo tempo (feat/incidents-resolved-guard e o PR #18) e o
-- 86 está reservado para o QA de voz. Já existem DOIS `82_` em produção desde
-- 18/08 porque ninguém conferiu antes de numerar — conferi `ls scripts/` e as
-- branches do origin antes de escolher.

-- 1. A coluna. BIGINT porque não custa nada e evita a conversa daqui a anos.
alter table public.incidents
  add column if not exists numero bigint;

-- 2. Numeração dos que JÁ existem, na ordem em que apareceram — assim o número
--    conta a história certa: #1 é o mais antigo. Só roda uma vez (o `where
--    numero is null` protege contra reexecução).
with ordenados as (
  select id, row_number() over (order by created_at, id) as n
  from public.incidents
  where numero is null
)
update public.incidents i
set numero = o.n
from ordenados o
where i.id = o.id;

-- 3. A sequência começa depois do último usado. `setval(..., true)` significa
--    "este valor JÁ foi usado", então o próximo `nextval` devolve o seguinte.
--    O `coalesce` cobre o banco vazio (dev/staging): começa do 1.
create sequence if not exists public.incidents_numero_seq as bigint;
select setval(
  'public.incidents_numero_seq',
  coalesce((select max(numero) from public.incidents), 0) + 1,
  false
);

-- 4. Quem escreve o número é o BANCO, não a aplicação.
--    ⚠️ Isto é de propósito e não é preciosismo: o incidente nasce em CINCO
--    lugares diferentes (ingest de falha, Fast por e-mail, Fast pelo WhatsApp,
--    Vigia e reporte manual do admin). Se o número fosse responsabilidade de
--    quem insere, bastava um caminho esquecer — e aí existiria chamado sem
--    número, que é justamente o problema que este arquivo veio resolver.
alter table public.incidents
  alter column numero set default nextval('public.incidents_numero_seq');

alter sequence public.incidents_numero_seq owned by public.incidents.numero;

-- 5. Único e obrigatório, nesta ordem: primeiro garante que não há repetido,
--    depois trava. Se o passo 2 tivesse deixado buraco, o índice falha aqui e
--    a migration para — melhor barulhento do que um banco com dois #42.
create unique index if not exists incidents_numero_key
  on public.incidents (numero);

alter table public.incidents
  alter column numero set not null;

-- 6. Busca pelo número (o `/admin` e as ferramentas do Frank procuram por ele).
comment on column public.incidents.numero is
  'Número curto do chamado (#1, #2, ...). Nome de chamar; a chave continua sendo o id. Atribuído pelo banco no insert — nenhuma aplicação escreve nele.';
