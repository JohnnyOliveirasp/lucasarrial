# Medição do fluxo de suporte — 20/08/2026 (~15:00 UTC)

Pedido do Johnny: "se chegar emails novos a Fast responde e manda para quem, o
sentinela avisa quem, quem olha as falhas... precisamos medir tudo isto."

Método: leitura pura. Nenhum e-mail de teste, nenhum incidente de teste, nenhuma
escrita em produção. Cada afirmação vem com a prova colada ao lado; o que não
consegui provar está marcado como tal. Horários em UTC salvo indicação.

---

## HOP 1 — E-MAIL (a Fast no suporte@fastcloner.com)

### O cron existe e roda de 5 em 5 minutos
- **Prova (crontab do Hetzner, `crontab -l` em root@91.99.15.213, linha 6):**
  `*/5 * * * * /mnt/volume/aiverse/sweep_mail.sh`
- O script faz `curl -m 280 -X POST https://fastcloner.com/api/v1/agent/mail-sweep`
  com `x-agent-token` e grava data + resumo em `/mnt/volume/aiverse/logs/sweep-mail.log`.
- **Última execução real: 2026-08-20T15:00:03Z** — última linha do sweep-mail.log.
  **181 linhas hoje** (`grep -c "2026-08-20"`), cadência de 5min sem furo.
  O log existe desde 04/08 (primeira linha: `2026-08-04T01:00:04+00:00 curl: (22)
  ... error: 500` — nasceu registrando um erro).

### Chega e-mail novo: ela responde sozinha? SIM
- **Prova (respostas reais de hoje, `/mnt/volume/aiverse/logs/pm2-out-3.log`):**
  ```
  2026-08-20T05:55:12: [agent/mail] respondido uid=182 para=katiasalvador32@gmail.com
  2026-08-20T10:10:16: [agent/mail] respondido uid=183 para=personaltrainer.nelsonlopes@gmail.com
  2026-08-20T13:30:16: [agent/mail] respondido uid=184 para=katiasalvador32@gmail.com
  ```
- As mesmas três execuções aparecem no sweep-mail.log com `"replied":1`
  (05:55:12, 10:10:16, 13:30:16). Todas as outras 178 linhas de hoje: `"scanned":0`.

### Manda cópia pra quem?
- **BCC fixo e único: johnny.oliveirasp@gmail.com.** Configurado em CÓDIGO, não em env:
  `frontend/src/lib/agent/mail-respond.ts:202` — `adminBccList()` retorna
  `["johnny.oliveirasp@gmail.com"]` hardcoded (comentário no código: pedido do
  Johnny 05/08; antes ia pra admin_emails inteira). O BCC entra como `RCPT TO`
  real no SMTP (`mail-smtp.ts:138`: `const rcpts = [args.to, ...(args.bcc ?? [])]`).
- **NÃO CONSEGUI PROVAR** a chegada do BCC na caixa do Johnny (não tenho acesso ao
  Gmail dele). O que está provado é que o endereço vai no envelope SMTP.

### O que fica gravado, e onde?
- **A resposta enviada NÃO fica gravada em lugar nenhum sob nosso controle.**
  `sendSupportMail` (`mail-smtp.ts`) é SMTP puro: sem IMAP APPEND (grep por
  `append|insert|agent_messages` no arquivo: zero ocorrências), sem escrita em
  tabela. Não existe cópia em "Enviados" do suporte@ — isso é esperado, não é falha.
- Rastros que existem: (1) o BCC no Gmail do Johnny; (2) a linha
  `[agent/mail] respondido uid=... para=...` no pm2 (rotativo — o processo
  aiverse tem 291 restarts, uptime atual 4h); (3) a linha-resumo no
  sweep-mail.log (sem destinatário).
- O que VAI pro banco: só a escalação, na tabela `incidents`
  (`openIncidentForSentinela`, `mail-respond.ts:181`, signature
  `fast-email:tec:<email>` ou `fast-email:atend:<email>`), com dedupe por
  signature e reabertura se estava fixed/ignored (`mail-respond.ts:167`).

### Quando ela NÃO sabe responder: o que acontece?
- **Desde 19/08 TODA escalação vira incidente** — técnica ou não. O código em
  `mail-respond.ts` (~linha 377) tem o comentário documentando: antes era
  `reason && technical`, e escalação de atendimento (cobrança, cancelamento,
  reembolso) virava só um console.log — o caso Viviana. Corrigido: `if (reason)`.
- **Exemplos reais AUTOMÁTICOS (código rodou em produção), com o par
  sweep-log ↔ incidente batendo no segundo:**
  - sweep `2026-08-19T11:30:23Z {"escalated":1}` → incidente `5bb774b8`
    (valterpjunior@gmail.com, erro no upload de fotos), `first_seen_at`
    `2026-08-19T11:30:21.449Z`, **`reported_by='fast'`**. Fechado 18:14 do mesmo dia.
  - sweep `2026-08-19T12:10:20Z {"escalated":1}` → incidente `ce6e157d`
    (`fast-email:tec:katiasalvador32@gmail.com`, áudios com letras cortadas),
    `first_seen_at` `2026-08-19T12:10:18.961Z`, **`reported_by='fast'`**. Fechado 18:14.
- Nos ÚLTIMOS ~29h nenhuma escalação automática (todas as linhas de 20/08 têm
  `"escalated":0`; grep por "INCIDENTE" no pm2-out-3.log: zero). Os incidentes
  fast-email:* mais recentes (c31012f9 Nelson, 43f37482 lucvila) têm
  `reported_by='frank'` — foram abertos pelo VIGIA na mesma convenção de
  assinatura, não pelo código da Fast.
- **O e-mail não some sem rastro** (vira linha em `incidents`) — mas ver o
  buraco D: a linha não chama ninguém.

---

## HOP 2 — SENTINELA/VIGIA

Há dois níveis, e a resposta é diferente pra cada um:

### (a) Detectores de produção (sweep-clones 5min, failure-alert)
- **Só gravam a linha e esperam alguém passar.** Grep por
  `notify|telegram|whatsapp|sendEmail|sendSupportMail` em
  `app/api/v1/agent/sweep-clones/route.ts` e `lib/incidents/*.ts`: **zero**.
  Abrem/atualizam `incidents` e nada mais.
- Exceção parcial: `lib/support/failure-alert.ts` (falha técnica de TTS/clone)
  estorna o débito E manda e-mail na hora pra `suporte@fastcloner.com` — mas ver
  o buraco G sobre quem lê esse e-mail.
- No CHAT (WhatsApp) a escalação avisa ativamente: `respond.ts:315` chama
  `notifyTeamEscalation` → WhatsApp pros jids da equipe + e-mail
  (`escalate.ts:68`; técnico → só suporte@, não-técnico → teamEmails()).
  **No E-MAIL não existe chamada equivalente** — `mail-respond.ts` importa só
  `extractEscalation`, nunca `notifyTeamEscalation` (grep confirmado hoje).

### (b) VIGIA do FrankClaw (rotina 6fac6221, cron `10 */2 * * *`)
- Criado 20/08 11:01:02Z (consolidação dos 2 vigias — commit `417e847`).
  Papel (prompt, regra 14-A): SENSOR — varre, ABRE e ANOTA; não fecha, não
  escreve pra aluno.
- **Avisa ativamente SIM: o relatório da ronda sai como mensagem no Telegram do
  Johnny.** O scheduler roda a tarefa dentro da sessão do chat
  (`ALLOWED_CHAT_ID`) e o texto vai pro Johnny; o prompt manda "relatorio
  SEMPRE, inclusive quando nao tem nada novo".
  **Prova de uma ronda real:** `conversation_log` do FrankClaw
  (`store/claudeclaw.db`), `role='assistant'`, `source='telegram'`,
  `2026-08-20 12:18:36Z`: "...0 abertos confirmado (61 linhas, erro `null` de
  verdade). Mas tem coisa fechada disparando agora...".
- **Campo que prova execução:** `scheduled_tasks.last_run` — carimbado só
  quando a ronda CONCLUI. Estado agora (consulta direta ao claudeclaw.db):
  `last_run=2026-08-20 12:18:36Z`, `next_run=16:10:00Z`, `started_at=NULL`.
- **Sobre o furo 12:18→16:10 (o que o card pediu pra não refazer):** cito a
  conclusão do card `0669a83d`, verificada pelo gerente contra o journal — o
  disparo das 14:10Z ACONTECEU (`Firing task` 14:10:13Z) e foi MORTO pelo
  restart do serviço 14:14:23Z; `resetStuckTasks` limpou o status no boot sem
  re-disparar. Ou seja: nem (a) "não disparou" nem (b) "rodou sem gravar" —
  disparou e morreu no meio. Conclusão herdada: **last_run/next_run sozinhos
  não servem de heartbeat**; heartbeat confiável precisa comparar last_run com
  a ocorrência ANTERIOR do cron.

---

## HOP 3 — ROTINA DAS FALHAS (e02748b8, cron `40 * * * *`)

### Estado da rotina
- Recriada HOJE 14:42:18Z (id novo `e02748b8`; a antiga `19f30ec8`, cron
  `40 8-22`, foi apagada na mesma ação — schedule-cli não tem update; prompt
  preservado byte a byte, sha256 conferido na troca).
- **`last_run` do id novo: NULL.** Primeiro disparo agendado: 15:40:00Z (ainda
  no futuro no momento desta medição). Consulta direta ao claudeclaw.db.

### Qual seria a prova da ronda das 03h? Ela existe?
- A prova canônica é o log `_frank/prova/2026-08-20_rotina_falhas_<HH>h.md`
  commitado na main. **Pra 03h NÃO EXISTE** — e nem poderia: o cron antigo era
  `40 8-22` (hora local), então madrugada não rodava POR DESENHO.
- Artefatos de rotina_falhas que existem hoje (hora do commit ao lado):
  ```
  rotina_falhas_00h.md  commit 71c6567  2026-08-20T00:09Z (na hora)
  rotina_falhas_01h.md  commit fa3de02  2026-08-20T01:13Z (na hora)
  rotina_falhas_02h.md  commit 7d06827  2026-08-20T10:59Z (4h+ DE ATRASO)
  ```
  Depois de 02h: **nenhum artefato `rotina_falhas_*` até agora (15:0x Z)**.
- Os disparos de 12:40Z/13:40Z/14:40Z (08:40/09:40/10:40 local — DENTRO da
  janela 8-22 do cron antigo) não deixaram artefato nem rastro no
  conversation_log (conferi 12:38–14:50Z: só trabalho interativo do Johnny e o
  relatório diário das 13:12Z). **NÃO CONSEGUI PROVAR o porquê** — a linha da
  tarefa antiga foi apagada na troca de id, levando junto last_run/last_status.
- A fila NÃO ficou descoberta nesse meio tempo — cobriram rondas com outros
  nomes: `417e847` (ronda 11:04Z), `c3888bf` (varredura 12:06Z), `37ebca1`
  (fila_incidentes 14:39Z, "1 aberto: aabfa1e5"). Mas a SÉRIE nominal
  `rotina_falhas_HHh` tem furo de 02h até 15h40, e é ela que serve de heartbeat.
- **Fila agora: 0 incidentes abertos** (consulta direta, count=0, 15:0x Z).

### Incidente fechado: quem fica sabendo além da linha no banco?
- **Automaticamente, NINGUÉM.** Os dois caminhos de fechamento no código —
  `app/api/v1/admin/incidents/[id]/route.ts:33` e
  `app/api/v1/agent/actions/route.ts:59` — só setam `status`/`resolved_at`.
  Nenhuma chamada de notify/e-mail/Telegram (grep: zero).
- **Caso real de hoje (aabfa1e5, fechado 14:45:03.136Z):** os 2 alunos souberam
  porque o EXECUTOR do card mandou e-mail NA MÃO via enviar_email.cjs — a
  resolution_note (lida direto do banco) registra: ms.sobadjian@gmail.com e
  celsopinto@gmail.com, SMTP aceito, bcc suporte@lucasarrial.com. E o Johnny
  soube pelo relatório do card no Telegram. Sem essas duas ações manuais, o
  fechamento seria invisível fora do banco.

---

## BURACOS — onde um item cai sem ninguém perceber

Os dois já conhecidos:
- **A.** Decisão do Johnny parada sem cobrador.
- **B.** O Claude do grupo sem sessão aberta.

Os que esta medição encontrou (cada um com a evidência acima):

- **C. A resposta da Fast por e-mail é inauditável a médio prazo.** Não persiste
  em tabela nem em "Enviados" (SMTP puro, sem APPEND). Os rastros são o BCC no
  Gmail pessoal do Johnny e logs rotativos de pm2 (291 restarts no processo).
  Pergunta que hoje não tem resposta possível: "o que exatamente a Fast
  escreveu pro aluno X três semanas atrás?"
- **D. Escalação por E-MAIL abre incidente mas não chama ninguém** — assimetria
  com o chat (que dispara WhatsApp+e-mail via notifyTeamEscalation). O
  incidente espera o vigia passar, e o vigia roda de 2 em 2 horas E pode morrer
  em restart (buraco E). Pior caso composto REAL: escalação logo após uma ronda
  + ronda seguinte morta = ~4h de aluno esperando "a equipe vai verificar" sem
  ninguém saber. (Achado de 19/08 confirmado ainda presente no código hoje; a
  metade "incidente sempre abre" foi corrigida, a metade "ninguém é chamado" não.)
- **E. Ronda em voo morre em restart e ninguém é avisado de que morreu.** Caso
  de hoje: vigia 6fac6221, disparo 14:10Z morto pelo deploy 14:14Z, furo de
  sensor 12:18→16:10Z. Não existe alarme de "a ronda que devia ter concluído
  não concluiu" (conclusão do card 0669a83d; o `last_run` isolado não detecta).
- **F. Nenhum watchdog cobre o cron do Hetzner.** Se o crontab parar, o
  sweep-mail.log simplesmente para de crescer e nada alarma — nenhum script no
  servidor referencia o log de outro (grep no /mnt/volume/aiverse e /etc/cron*:
  zero), e nenhum detector nosso mede a idade da última linha. O mesmo vale pros
  outros 4 sweeps (clones, social, winback, orphans).
- **G. Alertas técnicos por e-mail pro suporte@ são pulados pela própria Fast.**
  `failure-alert.ts` manda e-mail de falha pro suporte@, mas o `SKIP_FROM`
  (`mail-respond.ts:94`) inclui `@fastcloner.com` e `resend.com` — a Fast marca
  como lido e pula ("remetente de sistema"). Ninguém do time é obrigado a ler.
  RESSALVA de severidade: a detecção não se perde, porque failure-alert também
  grava em `incidents` (linhas 206/246) — o e-mail é canal redundante que virou
  peso morto, não um furo de detecção.
- **H. Artefato de ronda commitado com horas de atraso não serve de heartbeat.**
  `rotina_falhas_02h.md` foi commitado 10:59Z — 4h+ depois da ronda, num lote
  com outros 3 logs no mesmo minuto. O carimbo do commit prova que a ronda
  aconteceu ATÉ ali, não QUANDO. Se o log é a prova de vida, ele tem que ser
  commitado na hora.

### O que NÃO consegui provar
- A chegada física do BCC na caixa do Johnny (sem acesso ao Gmail dele).
- Por que os disparos 12:40/13:40/14:40Z da rotina antiga não deixaram rastro
  (a linha foi apagada na troca de id às 14:42Z, levando o last_status junto).
- O conteúdo dos e-mails respondidos hoje (o corpo não é persistido — buraco C).
