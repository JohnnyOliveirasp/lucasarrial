# 02 — Acessos: onde está cada chave

⚠️ **Este arquivo vai pro GitHub. Ele diz ONDE as credenciais estão e COMO
usá-las — nunca os valores.** Se você precisar mostrar uma variável a alguém,
mostre o nome. Nunca cole o valor em log, relatório, commit ou Telegram.

## O cofre

**Tudo mora em um arquivo só: `frontend/.env.local`** (ignorado pelo git).
Ordem do Johnny em 18/08: *"todas as chaves passa para ele nos arquivos .env,
ele deverá acessar tudo por lá"*. Você não precisa pedir credencial a
ninguém — está tudo aí.

- Na sua máquina: `<raiz-do-projeto>/frontend/.env.local` — **52 variáveis**,
  conferidas em 18/08 (mesmos valores da máquina do Johnny + as 3 que só
  existiam no servidor: `SUPPORT_MAIL_PASSWORD`, `ONBOARDING_WEBHOOK_SECRET`,
  `SITE_URL`).
- Em produção: `/mnt/volume/aiverse/frontend/.env.local` (no Hetzner) — tem
  algumas a mais, todas de runtime do servidor.

⚠️ **`AGENT_MAIL_ENABLED` ficou de fora da sua cópia de propósito.** Ela é o
interruptor que faz a Fast responder a caixa do suporte. Se você ligar isso
numa segunda máquina, **dois agentes respondem o mesmo e-mail** e o aluno
recebe resposta duplicada. Pra falar com aluno use a ferramenta de e-mail
(abaixo), nunca subindo uma segunda instância do app.

Se algum dia faltar uma variável, copie do servidor — **nunca invente valor**.

Em script Node: `require("dotenv").config({ path: ".env.local" })` rodando de
dentro de `frontend/`.
Em shell no servidor: leia a linha do `.env.local` com `grep`/`cut`.
⚠️ Com `set -e`, um `grep` sem resultado **mata o script** — use `|| true`.

## Servidor (Hetzner) — onde o site roda

| O quê | Valor |
|---|---|
| Acesso | `ssh root@91.99.15.213` (chave `~/.ssh/id_ed25519`, sem senha) |
| Pasta do app | `/mnt/volume/aiverse/frontend` |
| Processo | pm2, nome **`aiverse`**, porta **3002** |
| Logs | `pm2 logs aiverse --lines 100` |
| Cuidado | A máquina roda **outros projetos** (n8n, ResumePro, Zayit). Portas 3000/3001/4017 são deles. Disco raiz quase cheio — grave sempre em `/mnt/volume`. |

Uso legítimo do SSH: ler log, rodar script operacional, disparar sweep, mandar
e-mail pelo SMTP. **Deploy nunca** (regra 2).

## GPU (RunPod) — voz e vídeo

Chave: `RUNPOD_API_KEY`. Endpoints (**nunca recriar**):

| Serviço | Variável | ID | Workers |
|---|---|---|---|
| Treino/geração de voz | `RUNPOD_ENDPOINT_TRAIN_ID` | `2jcta960kzc2m4` | máx 7 |
| Vídeo Clone / React | `RUNPOD_ENDPOINT_INFINITETALK_ID` | `9get7wv7trn3wg` | máx 6 |
| Treino VoxBR (2º) | — | `0qd28qwo9ptcp4` | máx 4 |

- Cota total da conta: **20 workers**. A API recusa aumento que estoure o
  total — pra subir um, baixe outro **antes**.
- Estado agora: `GET https://api.runpod.ai/v2/<id>/health` com
  `Authorization: Bearer <RUNPOD_API_KEY>`.
- Status de um job: `.../status/<jobId>` · cancelar: `POST .../cancel/<jobId>`.
- ⚠️ O status de um job **expira em ~30min** depois de terminar. Se precisar
  saber se um clone acabou, olhe se o arquivo chegou no R2.

## Banco (Supabase)

- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service role =
  ignora RLS; **só no servidor/script, nunca no navegador**).
- Em script: `createClient(url, serviceRoleKey)`.
- Dinheiro se mexe **por RPC**, nunca por UPDATE na mão:
  `debit_credits`, `add_extra_credits`, `grant_subscription_credits`.
- Tabelas que você mais vai usar: `profiles`, `voices`, `training_jobs`,
  `generations`, `image_generations`, `video_clones`, `react_jobs`,
  `incidents`, `credit_transactions`, `entitlements`.

## Armazenamento (Cloudflare R2)

- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (API S3).
- Buckets: `R2_BUCKET_VOICES` (áudio + imagens; permanente) e
  `R2_BUCKET_GENERATIONS` (saídas; TTL 30 dias).
- ⚠️ O worker de vídeo grava no bucket **`voices-clone-ai-verse`**, não no de
  generations. Procurar no bucket errado parece que o job falhou.
- URL assinada **expira** (1h a 24h). Nunca guarde URL viva em rascunho: quem
  for baixar depois deve **assinar de novo** na hora.

## E-mail

| Uso | Como |
|---|---|
| **Falar com aluno** | `ferramentas/enviar_email.cjs` — Node puro, roda **da sua máquina**, sem SSH. Usa SMTP `mail.privateemail.com:587` (STARTTLS) com `SUPPORT_MAIL_PASSWORD`. Testado 18/08. |
| Mesma coisa, pelo servidor | `ferramentas/enviar_email.sh` (bash+curl, roda no Hetzner) |
| Caixa de entrada | IMAP no mesmo host — a Fast lê sozinha a cada 5 min. **Não leia a caixa em paralelo com ela.** |
| Alertas internos | Resend (`RESEND_API_KEY`) — **só pra equipe**, nunca pra aluno |

A porta 465 está bloqueada no Hetzner; use sempre a 587.

## Onboarding pela planilha

`ONBOARDING_WEBHOOK_SECRET` — header `x-onboarding-secret` no
`POST /api/v1/onboarding/import`. É como se reprocessa a linha de um aluno
cujo material não veio (o import é idempotente: não duplica conta, foto nem
áudio). Precisa dos fileIds do Drive, que estão na planilha.

## Outros provedores

`KIE_API_KEY` (imagem/vídeo curto) · `GEMINI_API_KEY` (assiste vídeo no React)
· `OPENAI_API_KEY` (Whisper/transcrição) · `DEEPSEEK_API_KEY` (roteiro/ajuste)
· `HOTMART_*` (pagamento e webhook) · `STRIPE_*` (loja fechada por código)
· `HEYGEN_LUCAS_API_KEY` (**somente leitura**) · `API_Token` (Apify, virais).

## Token interno dos sweeps

`AGENT_MONITOR_TOKEN` — header `x-agent-token` nas rotas `/api/v1/agent/*`.
É assim que você dispara uma varredura na mão (ver `03_ROTINA.md`).
