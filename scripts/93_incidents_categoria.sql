-- 93 · Duas filas: TÉCNICO (a gente executa) e ATENDIMENTO (pessoa fala).
--
-- Pedido do Johnny (24/08): *"o que é chamado de e-mail vai pra atendimento
-- humano; se for erro de código que precisa da gente, vai pra outra aba,
-- chamados técnicos — senão fica na tela um monte de chamado aberto e fica
-- difícil saber o que é o quê"*. E o critério, refinado por ele logo depois:
--
--   TÉCNICO     = tem uma AÇÃO NOSSA que resolve e nós conseguimos fazer:
--                 retreinar a voz, refazer/ajustar a imagem, reprocessar o
--                 material, corrigir o dado, corrigir o bug.
--   ATENDIMENTO = reclamação do produto, dúvida, pré-venda, ou espera de
--                 resposta do aluno. Precisa de PESSOA falando com ele.
--
-- ⚠️ O critério NÃO é "quem abriu o chamado". A Fast abre os dois tipos: o
-- aluno que manda o link do áudio corrigido gera trabalho NOSSO (reprocessar),
-- e o aluno que reclama do lip-sync gera conversa. Classificar por remetente
-- jogaria todo trabalho técnico vindo de e-mail na aba errada.
--
-- Medido no dia: dos 13 abertos, misturados numa lista só, a fila técnica
-- parecia ter 13 itens — e ninguém sabia por onde começar.

alter table incidents
  add column if not exists categoria text not null default 'tecnico';

alter table incidents drop constraint if exists incidents_categoria_check;
alter table incidents add constraint incidents_categoria_check
  check (categoria in ('tecnico', 'atendimento'));

-- Backfill conservador: só o que é INEQUIVOCAMENTE conversa vira atendimento.
-- Falha de sistema (training, generation, image, burst-rule) fica técnica.
-- Os casos de fronteira foram classificados um a um depois — lista fixa aqui
-- erraria justamente nos que importam.
update incidents
   set categoria = 'atendimento'
 where categoria = 'tecnico'
   and kind = 'reported'
   and reported_by in ('fast', 'carol-grupo', 'carol-zap');

create index if not exists incidents_categoria_status_idx
  on incidents (categoria, status, last_seen_at desc);

comment on column incidents.categoria is
  'tecnico = existe acao NOSSA que resolve (retreinar voz, refazer imagem, reprocessar, corrigir bug) · atendimento = reclamacao, duvida, pre-venda ou espera de resposta do aluno. Pedido do Johnny 24/08.';
