-- 118 — Vídeos Virais 1.0: o acervo que os ALUNOS alimentam.
--
-- POR QUE EXISTE
-- Pedido do Johnny 21/09: hoje o acervo de virais vem do garimpo da casa
-- (560 vídeos, tela de pré-produção, só admin). O produto novo inverte isso:
-- o aluno acha um viral no Instagram ou no TikTok, cola o LINK, marca um
-- consentimento e o vídeo entra numa base COMUM, visível pra todos — e segue
-- aparecendo na galeria pessoal de quem enviou.
--
-- POR QUE NÃO É TABELA NOVA
-- `viral_videos` já tem plataforma, url, autor, números, legenda, hashtags,
-- thumb no R2 e o caminho de download por yt-dlp. Duplicar isso numa tabela
-- paralela significaria manter dois acervos, duas listagens e dois downloads.
-- O que falta é só dizer QUEM mandou, SE pode aparecer pra todos, e COMO tirar
-- do ar — que é o que estas colunas fazem.
--
-- COMO AS DUAS TELAS SE SEPARAM DEPOIS DESTA MIGRATION
--   • pré-produção (garimpo, admin): lê tudo, como hoje;
--   • Virais do aluno (todo mundo): lê só `enviado_por is not null`
--     + `publico` + `removido_em is null`.
-- Sem isto, abrir a galeria pro aluno mostraria junto os 560 do garimpo.
--
-- SEM MODERAÇÃO, DE PROPÓSITO (decisão do Johnny 21/09): "o problema é do
-- aluno... ele se responsabiliza; depois podemos colocar um robô". Por isso o
-- texto do consentimento é GRAVADO na linha: se um dia chegar reclamação de
-- direito autoral, a casa mostra o que a pessoa aceitou, com data e hora.

alter table public.viral_videos
  -- Quem enviou. NULL = veio do garimpo da casa (as 560 linhas antigas).
  add column if not exists enviado_por          uuid references auth.users(id) on delete set null,
  add column if not exists enviado_em           timestamptz,
  -- O TEXTO exato aceito no envio, não um booleano: a frase muda com o tempo,
  -- e "ele marcou o checkbox" não diz o que estava escrito naquele dia.
  add column if not exists consentimento_texto  text,
  -- Aparece pra todo mundo? Só vira true com o consentimento marcado.
  add column if not exists publico              boolean not null default false,
  -- Remoção é o único freio (não há fila de aprovação): admin tira do ar.
  add column if not exists removido_em          timestamptz,
  add column if not exists removido_por         text,
  add column if not exists removido_motivo      text;

-- A listagem do aluno é sempre "os públicos, do mais novo pro mais velho".
create index if not exists viral_videos_publicos_idx
  on public.viral_videos (enviado_em desc)
  where publico and removido_em is null;

-- "Meus Virais": o que ESTE aluno enviou.
create index if not exists viral_videos_enviado_por_idx
  on public.viral_videos (enviado_por, enviado_em desc)
  where enviado_por is not null;

comment on column public.viral_videos.enviado_por is
  'Aluno que enviou o viral pelo link. NULL = garimpo da casa (Apify/scraper).';
comment on column public.viral_videos.consentimento_texto is
  'Texto EXATO do consentimento aceito no envio. Prova de direito autoral: guarda a frase, não só o "sim".';
comment on column public.viral_videos.publico is
  'true = aparece no acervo de TODOS os alunos. Só nasce true com consentimento marcado.';
comment on column public.viral_videos.removido_em is
  'Admin tirou do ar. A linha NUNCA é apagada: quem enviou e o que ele aceitou continuam registrados.';
