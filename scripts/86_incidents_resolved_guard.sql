-- 86: trava no banco — nenhum incidente entra ou permanece fechado
-- (status 'fixed'/'ignored') sem resolved_at/resolved_by preenchidos.
-- (Era 85; renumerada — o 85 já está reservado pela PR #18, trial-expiry-v2.)
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
--     data inventada é pior que campo vazio.
--   · reabertura (fixed/ignored → open/...) LIMPA resolved_at/resolved_by
--     (card 261b295b: o carimbo velho mente pra próxima medição do detector)
--     — MAS só quando o chamador não mexeu nos campos nesse mesmo update;
--     valor mandado explicitamente pelo chamador nunca é sobrescrito.
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
  elsif tg_op = 'UPDATE'
     and new.status not in ('fixed', 'ignored')
     and old.status in ('fixed', 'ignored') then
    -- Reabertura: limpa o carimbo do fechamento antigo, a menos que o
    -- chamador tenha mandado um valor próprio nesse mesmo update.
    if new.resolved_at is not distinct from old.resolved_at then
      new.resolved_at := null;
    end if;
    if new.resolved_by is not distinct from old.resolved_by then
      new.resolved_by := null;
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
