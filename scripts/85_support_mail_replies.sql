-- ============================================================================
-- 85 — registro do que a Fast RESPONDE por e-mail (vigia de 19/08)
--
-- Duas vezes no mesmo dia precisamos saber O QUE a Fast respondeu a um aluno
-- e não havia como: uid 171 (aluno pediu link de pagamento por PIX) e uid 173
-- (aluna com áudio comprovadamente incompleto). O IMAP do suporte@ NÃO tem
-- caixa de enviados (SELECT INBOX.Sent → "Mailbox doesn't exist") e o corpo
-- enviado não era gravado em tabela nenhuma — o único rastro era uma linha de
-- console no pm2 ('[agent/mail] respondido uid=... para=...'), que roda em
-- ~22h. A Fast fala com aluno sobre cobrança, cancelamento e reembolso; sem
-- isto o time não audita nada e não sabe o que já foi prometido.
--
-- Esta tabela guarda TODA resposta enviada pela Fast por e-mail (inclusive o
-- aviso de "anexo grande demais"), com o texto integral, e também o texto
-- RECEBIDO que originou a resposta — hoje ele só existe dentro da caixa IMAP.
-- Só registro: nenhuma regra de resposta/escalação muda.
--
-- O código (mail-respond.ts) grava DEPOIS do envio, em try/catch: se esta
-- migration ainda não tiver sido aplicada, o insert falha sozinho, vira uma
-- linha de erro no log e o e-mail ao aluno segue intacto (sem duplicar).
--
-- ⚠️ ESPELHO — NÃO APLICADO. DDL aguardando aprovação do Johnny.
-- ============================================================================

create table if not exists public.support_mail_replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- De onde veio: uid da mensagem na caixa IMAP do suporte@ (INBOX). O uid é
  -- estável dentro da caixa enquanto ela não for recriada — junto com
  -- received_message_id dá pra achar o e-mail original.
  imap_uid integer not null,
  to_email text not null,
  subject text,

  -- O que a Fast ENVIOU, na íntegra (depois dos marcadores removidos — é o
  -- texto que o aluno leu).
  body text not null,

  -- 'resposta' = resposta normal do cérebro; 'anexo_grande' = aviso automático
  -- de que a caixa não abre anexo daquele tamanho.
  kind text not null default 'resposta',

  -- O que o aluno ESCREVEU (texto extraído do MIME, mesmo recorte que foi pro
  -- modelo). Null quando a mensagem era grande demais e só os cabeçalhos foram
  -- baixados.
  received_body text,
  received_message_id text,

  -- Escalação: a Fast prometeu que "a equipe vai verificar"?
  escalated boolean not null default false,
  escalation_reason text,
  -- true = [ESCALAR-TECNICO], false = [ESCALAR] (atendimento), null = não escalou.
  escalation_technical boolean,
  -- Incidente aberto por esta resposta (quando a abertura falhou, fica null e
  -- o erro vai pro log).
  incident_id uuid references public.incidents(id) on delete set null,

  -- Modelo que gerou o texto (AGENT_MODEL do brain). Null no aviso automático
  -- de anexo grande, que é texto fixo.
  model text
);

-- Auditoria por aluno: "o que a Fast já disse pra essa pessoa?"
create index if not exists support_mail_replies_aluno_idx
  on public.support_mail_replies (to_email, created_at desc);
-- Achar a resposta de um e-mail específico da caixa.
create index if not exists support_mail_replies_uid_idx
  on public.support_mail_replies (imap_uid);

alter table public.support_mail_replies enable row level security;
-- Sem policies: acesso só via service role, igual ao resto das tabelas de admin.

comment on table public.support_mail_replies is
  'Toda resposta que a Fast enviou por e-mail (suporte@), com corpo integral enviado e recebido. Só registro/auditoria — criada em 19/08 porque a caixa IMAP não tem enviados e o pm2 roda o log em ~22h.';
