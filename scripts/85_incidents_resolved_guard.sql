-- 85: trava no banco — nenhum incidente entra ou permanece fechado
-- (status 'fixed'/'ignored') sem resolved_at/resolved_by preenchidos.
--
-- POR QUE TRIGGER (e não default nem CHECK):
--   · default de coluna só age em INSERT sem o campo e não pode depender do
--     status — o caso dominante aqui é UPDATE de status.
--   · CHECK rejeitaria o write: o código HOJE em produção (aba Falhas ao
--     "ignorar", scripts ad-hoc de ronda) não manda resolved_at, então todo
--     fechamento passaria a dar erro 500 até o deploy. O trigger PREENCHE em
--     vez de recusar: pode ser aplicado antes do deploy, sem quebrar nada, e
--     cobre pra sempre o caminho que nenhum código do app cobre — os scripts
--     ad-hoc em _Bugs/ com service-role (origem dos fechamentos sem data de
--     18/08 e 20/08).
--
-- Comportamento — o carimbo acontece só na TRANSIÇÃO pra fechado (insert já
-- fechado, ou update saindo de aberto), porque só aí now() é a data VERDADEIRA
-- do fechamento:
--   · fecha sem resolved_at                       → resolved_at := now()
--   · fecha sem resolved_by                       → 'nao-informado (trigger)'
--     (marcador honesto e consultável; quem informa de verdade não é tocado)
--   · valores mandados pelo chamador NUNCA são sobrescritos
--   · update qualquer (bump de ocorrência, renota) numa linha JÁ fechada sem
--     data NÃO é carimbado — seria inventar data de um fechamento antigo, e
--     data inventada é pior que campo vazio (os 2 casos históricos de 21/07
--     ficam nulos de propósito, marcados como "data desconhecida").
--   · reabertura (fixed/ignored → open/...) não é tocada: resolved_at fica
--     como histórico do último fechamento (padrão já usado pelo detector).
--
-- NÃO APLICAR SEM AVAL DO JOHNNY (regra dura 21). Depois de aplicada,
-- registrar aqui a data, como nas migrations anteriores.

create or replace function public.incidents_resolved_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('fixed', 'ignored')
     and (tg_op = 'INSERT' or old.status not in ('fixed', 'ignored')) then
    if new.resolved_at is null then
      new.resolved_at := now();
    end if;
    if new.resolved_by is null or btrim(new.resolved_by) = '' then
      new.resolved_by := 'nao-informado (trigger)';
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
