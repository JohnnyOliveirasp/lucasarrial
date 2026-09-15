# Deploy — AI-Verse (produção)

Domínio: **https://aiverse.jcsolutionsus.com** · Servidor: Hetzner `91.99.15.213` (ARM, Ubuntu 24.04)
App em `/mnt/volume/aiverse/frontend` · PM2 `aiverse` na porta **3002** · nginx + certbot.

## Como funciona
`push`/merge em **`main`** (mexendo em `frontend/**`) dispara `.github/workflows/deploy.yml`:
1. Actions builda o Next (`npm ci` + `npm run build`) com os `NEXT_PUBLIC_*` dos secrets.
2. `rsync` do `frontend/` (com o `.next` pronto) pro servidor — **a máquina não builda**.
3. No servidor: `npm ci --omit=dev` (deps nativas ARM) + `pm2 reload aiverse`.

Runtime secrets ficam em `/mnt/volume/aiverse/frontend/.env.local` (NÃO versionado).
`next start` carrega esse arquivo sozinho.

## GitHub Secrets necessários (Settings → Secrets and variables → Actions)
| Secret | Valor |
|---|---|
| `DEPLOY_SSH_KEY` | chave **privada** do par de deploy (ver arquivo gerado no setup) |
| `NEXT_PUBLIC_SUPABASE_URL` | mesma do `frontend/.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | mesma do `frontend/.env.local` (anon = pública por design) |
| `NEXT_PUBLIC_SITE_URL` | `https://aiverse.jcsolutionsus.com` |
| `NEXT_PUBLIC_ADMIN_EMAILS` | mesma do `frontend/.env.local` |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | opcional (source maps) |

## Setup único do servidor (bootstrap)
```bash
ssh root@91.99.15.213
mkdir -p /mnt/volume/aiverse/frontend /mnt/volume/aiverse/logs
# .env.local de runtime é copiado do ambiente local (scp) com NEXT_PUBLIC_SITE_URL/SITE_URL de prod.
# Chave de deploy do CI: o pubkey vai em /root/.ssh/authorized_keys.
```
nginx:
```bash
cp deploy/nginx/aiverse.jcsolutionsus.com.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/aiverse.jcsolutionsus.com.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d aiverse.jcsolutionsus.com   # SÓ depois do DNS apontar
```

## Passos manuais (fora do servidor)
1. **DNS:** A record `aiverse.jcsolutionsus.com` → `91.99.15.213`.
2. **Supabase** (dashboard → Authentication → URL Configuration): adicionar
   `https://aiverse.jcsolutionsus.com` em **Site URL** e **Redirect URLs**.
3. **Google OAuth** (console.cloud.google.com): adicionar
   `https://aiverse.jcsolutionsus.com` em **Authorized JavaScript origins**.
   (O redirect URI continua sendo o callback do Supabase — não muda.)
4. **GitHub Secrets:** adicionar os da tabela acima.

## Envs OPCIONAIS de runtime (ficam no `.env.local` do servidor, não no CI)

| Env | Pra que serve | Sem ela |
|---|---|---|
| `FASE_TELEMETRIA_SECRET` | Liga a telemetria de fase do worker de voz (incidente `d3d8d1b2`, chamado **#15**). Com ela, uma geração que estoura o `executionTimeout` grava em `generations.qa.fase_corrente` **qual fase pendurou** (download da referência? whisper do QA? geração do chunk?) e o `error_message` vira `executionTimeout exceeded [fase: ... running_s=...]`. É a única forma de achar a causa raiz de um job SIGKILLado: o log do worker vive no console da RunPod e expira antes de qualquer investigação. | A feature fica **desligada**. O código está no ar desde 25/08 (`b9bc646`, `1c72d77`) e **nunca produziu um único dado** por falta desta env — medido em 28/08: `qa.fase_corrente` em **0 de 322** gerações de 3 dias. Desde 28/08 o app pelo menos **avisa no log** (`fase_telemetria.desligada`) em vez de ficar mudo. |

Como ligar (1 linha + reload, **não** precisa de migration nem de deploy):
```bash
ssh root@91.99.15.213
# valor livre, >= 16 chars; só o app usa (o worker recebe o HMAC por job, nunca o segredo)
echo "FASE_TELEMETRIA_SECRET=$(openssl rand -hex 32)" >> /mnt/volume/aiverse/frontend/.env.local
pm2 reload aiverse
```
Conferir que pegou, na geração seguinte que estourar timeout:
```sql
select id, error_message, qa -> 'fase_corrente'
  from generations where status='failed' order by created_at desc limit 5;
```
⚠️ Requer também que a imagem do `runpod-worker` em produção seja **>= `b9bc646`**
(é o commit que ensinou o heartbeat a postar). Imagem mais velha ignora as chaves
em silêncio — e o worker descarta a config se a URL não for `https://`
(`worker_log.py:_fase_cfg_from_input`), então uma base `http://` dá zero fase
pelo mesmo sintoma e por outro motivo.

## Operação
```bash
pm2 status aiverse
pm2 logs aiverse
pm2 reload aiverse
```
