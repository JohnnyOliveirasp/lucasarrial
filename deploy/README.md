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

## Operação
```bash
pm2 status aiverse
pm2 logs aiverse
pm2 reload aiverse
```
