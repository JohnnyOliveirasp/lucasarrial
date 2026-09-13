-- ============================================================================
-- 108 — registro do que a casa ENVIOU por e-mail, e do que VOLTOU (bounce)
--
-- ⚠️ NÃO APLICADA. Quem aplica é o Johnny (mesma regra das 85, 104 e 107).
--     O código que usa esta tabela JÁ ESTÁ PRONTO e degrada sozinho: enquanto
--     ela não existir, o insert falha, vira UMA linha de log, e nenhum e-mail
--     deixa de sair nem nenhuma varredura quebra. Mas o laço só fecha DE
--     VERDADE depois de aplicada — sem ela a consulta lá embaixo não tem o que
--     ler. Ler o parágrafo "o que isto resolve" antes de decidir.
--
-- O QUE ISTO RESOLVE (#201, e os quatro casos de 12–13/09: Sheila #374,
-- Rodrigo #378, Lucas #379, Priscyla). A casa manda e-mail, o SMTP responde
-- 250, e o fluxo dá o aluno por avisado. O 250 só quer dizer "aceitei pra
-- entrega": a recusa vem DEPOIS, por bounce, e cai na caixa do suporte@ sem
-- voltar pra lugar nenhum. O chamado continua parecendo atendido e o aluno
-- fica em silêncio sem saber.
--
-- O `mail-bounce.ts` já sabe classificar o que voltou, e o relatório de
-- entrega TRAZ o Message-ID do envio original — medido em 13/09 na caixa:
-- 45 de 45 relatórios de falha dos últimos 30 dias têm o cabeçalho, nenhum
-- sem. Faltava o outro lado do casamento: o `sendSupportMail` gerava o
-- Message-ID inline, mandava e jogava fora. Nenhuma tabela guardava o envio,
-- então não havia como responder "quais alunos a gente acha que avisou e na
-- verdade não avisou" — não existia o registro do "acha que avisou".
--
-- A CONSULTA QUE ESTA TABELA EXISTE PRA PERMITIR:
--
--   select to_email, assunto, origem, enviado_em, bounce_classe, bounce_diagnostico
--     from public.emails_enviados
--    where bounce_em is not null
--    order by bounce_em desc;
--
-- ⚠️ NÃO EXISTE COLUNA `entregue`, DE PROPÓSITO. A casa nunca recebe
-- confirmação de entrega nem de leitura. O máximo que o processo sabe é "o
-- relay aceitou" (que já mentiu — é a origem do problema) e "voltou bounce"
-- (que é prova). Uma coluna tri-estado convidaria alguém a ler NULL como
-- "entregue", que é exatamente a suposição errada que este trabalho conserta.
-- Então só o fato NEGATIVO é gravado: `bounce_em is not null` = provado que
-- não chegou. Ausência de bounce é ausência de notícia, não prova de entrega.
--
-- Volume esperado: baixo. Medido em 13/09 na caixa do suporte@, 30 dias:
-- 51 relatórios de entrega, 45 de falha. Os ENVIOS são mais numerosos que os
-- bounces, mas continuam na casa de dezenas/centenas por semana — nada que
-- peça particionamento.
-- ============================================================================

create table if not exists public.emails_enviados (
  id uuid primary key default gen_random_uuid(),
  enviado_em timestamptz not null default now(),

  -- A CHAVE DO CASAMENTO com o bounce. Guardada normalizada (minúscula, sempre
  -- entre <>) porque os dois lados escrevem diferente: a gente gera com os
  -- sinais, o `In-Reply-To` de alguns relatórios vem sem, e comparação de
  -- string crua falharia EM SILÊNCIO — o pior desfecho aqui, porque o laço
  -- pareceria fechado sem estar. UNIQUE: um Message-ID é um envio.
  message_id text not null unique,

  -- Para quem a casa escreveu. Não é chave de casamento (o mesmo aluno recebe
  -- vários e-mails e o mesmo assunto vai pra vários alunos) — é o que a
  -- consulta devolve pro humano.
  to_email text not null,
  assunto text,

  -- Qual fluxo escreveu: fast-resposta, sgp-codigo, onboarding-aviso, winback,
  -- orfao-convite... Sem isto a tabela sabe que o aluno não recebeu, mas não
  -- sabe O QUE ele deixou de receber — e é a origem que diz qual fluxo está
  -- perdendo gente. Sem CHECK de propósito: a lista vive no TypeScript
  -- (`OrigemEnvio`) e um CHECK aqui viraria deploy travado a cada origem nova.
  origem text not null default 'desconhecida',

  -- Conta do aluno quando o chamador sabe qual é. Muito comprador de curso não
  -- tem conta na plataforma (medido em 03/09: 27,1% tinham), então é nullable
  -- de propósito — exigir user_id aqui obrigaria a inventar dado.
  user_id uuid references auth.users(id) on delete set null,

  -- ---- o que voltou. NULL = sem notícia, que NÃO é prova de entrega. ----
  -- Carimbado uma vez só: guarda DESDE QUANDO a casa sabe que não chegou, que
  -- é o número que mostra há quanto tempo o aluno está em silêncio.
  bounce_em timestamptz,
  -- Classe do `mail-bounce.ts`: spam-saida, bloqueio-destino, inexistente,
  -- caixa-cheia, temporaria, desconhecida. Sem CHECK/enum pelo mesmo motivo
  -- da origem: a regra viva é o TypeScript, e duas cópias divergem em silêncio.
  bounce_classe text,
  -- Texto cru do servidor remoto: a PROVA, sem interpretação nossa.
  bounce_diagnostico text
);

-- A consulta que motivou a tabela: "quem a gente acha que avisou e não avisou".
-- Índice PARCIAL porque a esmagadora maioria das linhas nunca quica — indexar
-- todas custaria escrita em todo envio pra acelerar uma consulta que só olha a
-- minoria.
create index if not exists emails_enviados_nao_chegou_idx
  on public.emails_enviados (bounce_em desc)
  where bounce_em is not null;

-- "O que a casa já mandou pra esta pessoa?" — a pergunta do atendimento.
create index if not exists emails_enviados_aluno_idx
  on public.emails_enviados (to_email, enviado_em desc);

alter table public.emails_enviados enable row level security;
-- Sem policies: acesso só via service role, igual ao resto das tabelas de admin.

comment on table public.emails_enviados is
  'Todo e-mail que a casa enviou pelo suporte@ (via sendSupportMail), com o Message-ID que casa com o bounce se ele voltar. NAO tem coluna "entregue" de proposito: a casa nunca sabe que chegou, so sabe quando NAO chegou. bounce_em not null = provado que nao chegou.';
comment on column public.emails_enviados.message_id is
  'Chave do casamento com o bounce (mail-bounce.ts -> messageIdOriginal). Normalizado: minusculo e sempre entre <>.';
comment on column public.emails_enviados.bounce_em is
  'Quando a casa DESCOBRIU que nao chegou. NULL = sem noticia, que nao e prova de entrega.';
