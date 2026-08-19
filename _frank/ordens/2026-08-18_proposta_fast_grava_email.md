# PROPOSTA — a Fast passa a GRAVAR o que responde por e-mail

Status: **AGUARDANDO AVAL DO JOHNNY** (mexe em schema — nada foi aplicado).
Autor: coder (card do Frank, 18/08). Complementa a ordem
`2026-08-19_ler_caixa.md` (a ferramenta de leitura já está pronta e testada:
`_frank/ferramentas/ler_caixa.cjs`).

---

## 1. O que a investigação encontrou (piora o diagnóstico da ordem)

A ordem dizia que a pasta de Enviados guardava "o que ela respondeu". **Não
guarda.** Verificado hoje nos dois lados:

- **No código**: `mail-smtp.ts` fala SMTP puro e não tem nenhum `APPEND` IMAP —
  enviar por SMTP **não** deixa cópia em Enviados (isso é um passo separado que
  nunca existiu).
- **No servidor**: `ler_caixa.cjs --caixas` → `Sent: 0 mensagens`. Zero, desde
  sempre.

Ou seja: hoje **não existe rastro nenhum** do que a Fast respondeu por e-mail,
nem na caixa. O único vestígio é a citação (`> Oi, Fabio!...`) dentro da
resposta do aluno, quando ele responde. A auditoria via IMAP que a ordem
imaginava nunca foi possível — o que torna esta gravação no banco a **única**
solução real, não a "melhor".

## 2. Decisão de desenho: tabela própria, NÃO reusar `agent_messages`

O card pedia pra avaliar as duas. Avaliei; recomendo **tabela própria**:

- `agent_messages.chat_id` é `NOT NULL` → referencia `agent_chats`, que é
  chaveada por `wa_jid NOT NULL UNIQUE` (formato `55...@s.whatsapp.net`).
  Reusar exigiria inventar JID falso (`email:aluno@x.com`) ou afrouxar duas
  tabelas com 284 registros em produção — e todo consumidor delas (admin,
  histórico do cérebro) assume WhatsApp.
- E-mail tem campos que chat não tem (assunto, Message-ID, uid IMAP, anexos,
  desfecho da varredura) — no reuso virariam colunas nulas pra 100% das linhas
  atuais.
- O próprio adendo da ordem já apontava: "Tabela nova (é migration)".

## 3. DDL proposto — `scripts/84_agent_mail_log.sql`

(83 já existe; há dois arquivos "82_", então o próximo livre é 84.)

```sql
-- 84: Fast no e-mail — registro de TUDO que ela processa na caixa do
-- suporte@ (pedido Johnny 18/08, ordem 2026-08-19_ler_caixa.md, adendo).
-- Hoje a resposta dela por e-mail não deixa rastro em lugar NENHUM
-- (SMTP não salva em Enviados; só vira incidente quando ela desiste).
-- Acesso só via service role (RLS ligada sem policies — padrão admin).
create table public.agent_mail_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mail_uid integer,                     -- UID IMAP no INBOX (dedupe/diagnóstico)
  message_id text,                      -- Message-ID do e-mail do aluno
  from_email text not null,             -- quem escreveu
  subject text,
  student_text text,                    -- o que o aluno disse (mesmo recorte que vai pro modelo, 4000 chars)
  reply_text text,                      -- o que a Fast respondeu (null = não respondeu)
  outcome text not null check (outcome in ('replied','skipped','escalated','oversized')),
  skip_reason text,                     -- por que pulou (remetente de sistema, bulk, PULAR...)
  escalation_reason text,               -- resumo do [ESCALAR]/[ESCALAR-TECNICO]
  escalation_technical boolean,         -- true = virou incidente pro Sentinela
  attachments jsonb,                    -- [{"name":"x.png","bytes":123}] — SÓ nome e tamanho, nunca conteúdo
  profile_id uuid references public.profiles(id) on delete set null
);

create index agent_mail_log_from_created_idx
  on public.agent_mail_log (from_email, created_at desc);
create index agent_mail_log_created_idx
  on public.agent_mail_log (created_at desc);
-- Retry da varredura não duplica o registro do mesmo e-mail respondido:
create unique index agent_mail_log_msgid_uq
  on public.agent_mail_log (message_id) where message_id is not null;

alter table public.agent_mail_log enable row level security;
```

## 4. Onde grava (dentro do fluxo que já existe — sem segunda leitura da caixa)

Um helper `logMail(entry)` em `mail-respond.ts`, **best-effort**: `try/catch`
em volta do insert, falhou → `console.error` e a vida segue. O aluno é
primário, o registro é secundário — **nenhum caminho de resposta passa a
depender do banco**. Nota: o Supabase já está no caminho crítico desse fluxo
(lookup de `profiles`), então não entra dependência nova; e insert não chama
serviço externo tipo RunPod, então não se aplica o risco de travamento sem
timeout (lição do commit 4418b0e) — ainda assim vai embrulhado.

Chamadas (4 pontos em `respondOne` + 1 em `responderAnexoGrande`):

| Ponto | outcome | o que entra |
|---|---|---|
| depois do `sendSupportMail` OK, antes do `markSeen` | `replied` / `escalated` | texto do aluno, resposta visível (pós-winback), escalação se houver |
| skip por filtro (`shouldSkip` / texto < 5) | `skipped` | `skip_reason`, sem corpo de resposta |
| modelo devolveu PULAR | `skipped` | `skip_reason='PULAR'` |
| anexo grande (`responderAnexoGrande`) | `oversized` | resposta padrão enviada + `attachments` (nome/MB) |

Gravar **depois** do envio (o que se registra é o que de fato saiu) e **antes**
do `markSeen` (se o processo cair no meio, a varredura seguinte reprocessa e o
índice único por `message_id` segura a duplicata).

## 5. Privacidade e limites

- É dado de aluno: **nada disso sai em relatório público nem em e-mail**.
- Anexo: só nome e tamanho (a coluna é jsonb de metadados, conteúdo nunca).
- RLS ligada sem policies = só service role lê (mesmo padrão das tabelas admin).

## 6. O que isso destrava

- "Me mostra o que a Fast respondeu pra fulano" vira `select` (ou uma flag nova
  no `aluno.cjs`), sem IMAP e sem risco de atropelar a fila dela.
- A rotina diária de auditar as respostas do dia (furo da Claudia e da aluna de
  17/08) vira consulta de 1 linha; o vigia noturno ganha onde olhar.
- O `ler_caixa.cjs` continua valendo pro **histórico** anterior à migration e
  pra ver o lado do aluno.

## 7. Fora do escopo (de propósito)

- **APPEND da resposta em Enviados via IMAP**: deixaria a caixa "completa", mas
  é operação de escrita nova no caminho crítico do envio, com superfície de
  falha própria, e o banco já cobre a necessidade. Só se o Johnny quiser a
  caixa espelhada também.
- Backfill do histórico: impossível — as respostas antigas não existem em lugar
  nenhum (item 1).

## Próximo passo

Johnny aprova → eu crio `scripts/84_agent_mail_log.sql`, aplico a migration,
**confiro a tabela consultando o banco** (DDL commitado não é DDL aplicado),
implemento o `logMail` + 5 chamadas em `mail-respond.ts`, `tsc` + build, e
provo com um e-mail de teste pro suporte@ aparecendo na tabela.
