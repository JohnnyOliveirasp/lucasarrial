-- 104 — avisos_enviados: prova de que o aluno FOI avisado.
--
-- ⚠️ NÃO APLICADA. A aplicação é decisão do Johnny. O código que escreve nesta
-- tabela (lib/onboarding/registrar-aviso.ts) já trata a ausência dela: o insert
-- falha, vira console.error e o e-mail sai do mesmo jeito. Merge deste PR sem
-- rodar este SQL NÃO quebra nada — só continua sem a prova.
--
-- POR QUE EXISTE
-- 03/09, o Lucas perguntou se o sistema manda e-mail quando o clone fica
-- pronto. Manda (verificarOnboardingPronto, lib/onboarding/pronto.ts), mas não
-- havia como PROVAR: sendSupportMail não grava nada, e a única pista era um
-- console.log de servidor que o FrontendServer.log do Hetzner nem captura (ele
-- só guarda evento de navegador, scope:client). Quando um aluno diz "nunca me
-- avisaram", hoje a resposta honesta é "não sei".
--
-- Caso real: Celso Slompo — voz e 5 avatares `ready` desde 29/08, sem
-- assinatura, logo deveria ter recebido o avisoOkMasAssine naquele dia. Em
-- 02/09 perguntou "qual a data para receber o clone pronto?". Não recebeu?
-- Caiu no spam? Não entendeu? Não dá pra saber.
--
-- Uma linha por TENTATIVA de envio — inclusive as que falharam (é justamente a
-- falha que a gente nunca enxergou).

create table if not exists public.avisos_enviados (
  id          uuid primary key default gen_random_uuid(),
  criado_em   timestamptz not null default now(),

  -- pra quem foi
  email       text not null,
  user_id     uuid,                  -- conta do aluno, quando o caller sabe

  -- o que foi
  aviso       text not null,         -- chave estável: 'sgp_foto_pronta',
                                     -- 'onboarding_ok_mas_assine', ...
  assunto     text not null,         -- o assunto que o aluno viu na caixa dele

  -- por que saiu agora
  referencia  text,                  -- o gatilho: 'webhook kie',
                                     -- 'etapa foto do pedido <id>', ...

  -- deu certo?
  ok          boolean not null default false,
  erro        text                   -- mensagem quando ok = false
);

-- "este aluno foi avisado?" — a consulta que motivou a tabela.
create index if not exists avisos_enviados_email_idx
  on public.avisos_enviados (lower(email), criado_em desc);
-- "quantos avisos de voz pronta saíram esta semana?"
create index if not exists avisos_enviados_aviso_idx
  on public.avisos_enviados (aviso, criado_em desc);
-- "o que está falhando?" — parcial, a tabela é majoritariamente ok = true.
create index if not exists avisos_enviados_falha_idx
  on public.avisos_enviados (criado_em desc) where ok = false;
create index if not exists avisos_enviados_user_idx
  on public.avisos_enviados (user_id, criado_em desc) where user_id is not null;

comment on table public.avisos_enviados is
  'Uma linha por tentativa de envio de e-mail de aviso do onboarding/SGP. Serve pra responder "este aluno foi avisado?" sem depender da pasta Sent nem de log de servidor.';

-- Só o service_role escreve/lê (o código usa o admin client). Sem acesso de
-- aluno: a tabela guarda e-mail de terceiro. Mesma postura de onboarding_runs.
alter table public.avisos_enviados enable row level security;

-- ── ANÁLISE DE RISCO ───────────────────────────────────────────────────────
--
-- 1. ADITIVA E ISOLADA. Cria tabela nova; não altera nem lê nenhuma tabela
--    existente, não tem foreign key, não tem trigger, não toca RLS de terceiros.
--    Nenhum caminho de código atual depende dela.
--
-- 2. REVERSÍVEL. `drop table public.avisos_enviados;` desfaz por completo —
--    nada mais no schema aponta pra cá. Perde-se só o histórico registrado.
--
-- 3. SEM user_id COMO FOREIGN KEY, DE PROPÓSITO. Uma FK pra profiles(id)
--    faria o registro FALHAR quando o aluno não tem conta (SGP sem conta,
--    script 101) — e é exatamente o caso em que mais se precisa da prova.
--    O custo é que user_id pode apontar pra conta apagada; aceitável num
--    registro de auditoria, que deve sobreviver ao apagamento.
--
-- 4. CRESCIMENTO. Poucas linhas por aluno (a régua tem ~7 avisos no total do
--    ciclo). Volume atual do onboarding/SGP é de dezenas por semana, não
--    milhares por dia: não precisa de particionamento nem de retenção agora.
--    Se um dia crescer, é seguro apagar por `criado_em` — nada referencia.
--
-- 5. DADO PESSOAL. Guarda e-mail de aluno e o assunto do que foi enviado, o
--    mesmo que onboarding_runs já guarda. NÃO guarda o corpo do e-mail (que
--    pode ter dado do aluno) — só assunto e chave. RLS ligada e sem policy =
--    ninguém além do service_role enxerga.
--
-- 6. RISCO DE NÃO APLICAR: nenhum técnico. O código degrada pra console.error.
--    O custo é operacional — segue impossível provar que um aluno foi avisado,
--    que é o problema que este arquivo existe pra resolver.
