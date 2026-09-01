-- 92 · Um problema = UM chamado. (chamado #110)
--
-- O que aconteceu: 6 rows nasceram com a MESMA signature em 140 ms (chamados
-- 102 a 107). O quadro de abertos saltou de 8 para 17 sem existirem 9
-- problemas novos, e o mesmo aluno apareceu 6 vezes sem nenhuma das 6 ser a
-- dona do caso.
--
-- Por que: `incidents_signature_idx` NÃO era UNIQUE. A deduplicação vivia só
-- na aplicação, em read-then-write (SELECT por signature → UPDATE ou INSERT).
-- Sob concorrência os 6 SELECT não acham nada e os 6 INSERT passam. Nenhum
-- código consegue ser atômico sozinho: quem garante isso é o banco.
--
-- PARCIAL de propósito: a trava vale só para chamados EM ABERTO. Um problema
-- que voltou meses depois de resolvido pode existir de novo como registro
-- histórico — o que não pode é haver dois abertos disputando o mesmo dono.

create unique index if not exists incidents_signature_aberta_uniq
  on incidents (signature)
  where status not in ('fixed', 'ignored');

comment on index incidents_signature_aberta_uniq is
  'Um chamado ABERTO por signature. A dedup na aplicação é read-then-write e perde a corrida (chamado #110): a garantia tem que ser do banco.';
