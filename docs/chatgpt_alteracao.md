# Alteracoes ChatGPT - Deploy Aiverse

Data: 2026-05-26
Projeto: PlatformLucasArrial / Aiverse
Dominio: https://aiverse.jcsolutionsus.com
Servidor: Hetzner root@91.99.15.213
Deploy path: /mnt/volume/aiverse/frontend

## Estado final validado

- Site em producao respondendo em HTTPS.
- Raiz default PT-BR: `https://aiverse.jcsolutionsus.com/` retorna `200 OK`.
- Ingles: `https://aiverse.jcsolutionsus.com/en` retorna `200 OK`.
- Espanhol: `https://aiverse.jcsolutionsus.com/es` retorna `200 OK`.
- Caso que quebrava foi corrigido:
  - Antes: request com `Accept-Language: en-US,en;q=0.9` redirecionava para `https://aiverse.jcsolutionsus.com:3002/en`.
  - Depois: redireciona para `https://aiverse.jcsolutionsus.com/en`, sem a porta interna.

## Alteracoes feitas no codigo

Commits ja enviados para `main`:

- `b8290ed fix(deploy): estabiliza build e runtime de producao`
- `b53a5d8 fix(deploy): nao exigir secrets R2 no build`

Resumo:

- `frontend/package.json`
  - Build mudou de `next build --turbopack` para `next build`.
- `frontend/next.config.ts`
  - Substituido por `frontend/next.config.mjs`, para o runtime de producao nao precisar carregar TypeScript depois de `npm ci --omit=dev`.
- `frontend/src/app/[locale]/layout.tsx`
  - Removido uso de `next/font/google` no layout para evitar falha de build por busca externa de fontes.
  - Removido logger server-side do layout.
- `frontend/src/app/globals.css`
  - Adicionadas fontes fallback via CSS variables.
- `frontend/src/instrumentation.ts`
  - Removido logger server-side da inicializacao.
- `frontend/src/lib/logger/server.ts`
  - Ajustados imports Node de `node:fs`/`node:path` para `fs`/`path`.
- `frontend/src/lib/r2/client.ts`
  - Removido `throw` em import-time quando variaveis `R2_*` nao existem.
  - Build nao quebra mais se o GitHub Actions nao tiver secrets privados do R2; em runtime o servidor usa `.env.local`.

## Build/deploy manual feito no servidor

O projeto foi enviado para o segundo disco, conforme pedido:

- `/mnt/volume/aiverse/frontend`

Foi preservado o `.env.local` do servidor.

Build que funcionou no servidor:

```bash
cd /mnt/volume/aiverse/frontend
npm ci
npm install --no-save @tailwindcss/oxide-linux-arm64-gnu@4.2.4 lightningcss-linux-arm64-gnu@1.32.0
npm run build
npm ci --omit=dev
pm2 reload aiverse --update-env || pm2 start ecosystem.config.cjs
pm2 save
```

Validacoes feitas:

```bash
curl -I http://127.0.0.1:3002
curl -I https://aiverse.jcsolutionsus.com
```

Ambos retornaram `200 OK`.

## Problema do loop / porta 3002

Sintoma reportado:

- Abria `https://aiverse.jcsolutionsus.com/`
- Depois o navegador mudava para `https://aiverse.jcsolutionsus.com:3002/en`
- Essa URL nao funciona porque a porta `3002` roda o Next.js interno em HTTP atras do nginx, nao HTTPS publico.

Reproducao confirmada:

```bash
curl -I -H "Accept-Language: en-US,en;q=0.9" https://aiverse.jcsolutionsus.com/
```

Antes da correcao retornava:

```text
location: https://aiverse.jcsolutionsus.com:3002/en
```

Causa:

- O nginx fazia proxy para `127.0.0.1:3002`.
- O Next/next-intl reconstruia a URL absoluta do redirect usando a porta interna quando detectava locale `en`.
- Faltavam headers explicitos para informar host/porta publica.

## Alteracao feita no nginx

Arquivo alterado no servidor:

```text
/etc/nginx/sites-enabled/aiverse.jcsolutionsus.com.conf
```

Dentro do bloco `location /`, foram adicionadas estas linhas:

```nginx
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port 443;
```

O bloco ficou assim:

```nginx
location / {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port 443;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 120s;
}
```

Cuidados:

- A alteracao foi feita somente no arquivo do dominio `aiverse.jcsolutionsus.com`.
- Nao foi alterada configuracao de outros sites.
- Um backup do arquivo anterior foi salvo fora de `sites-enabled`:

```text
/root/aiverse.jcsolutionsus.com.conf.bak-20260526-before-forwarded-port
```

Observacao importante:

- Um backup criado inicialmente dentro de `sites-enabled` causou erro de `duplicate listen options`, porque nginx carrega arquivos `.conf` nesse diretorio.
- Esse backup foi movido para `/root` e o `nginx -t` voltou a passar.

Comandos finais executados:

```bash
nginx -t
systemctl reload nginx
```

Resultado:

```text
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

Avisos existentes:

- O nginx ainda mostra warnings antigos sobre conflito em `n8n.jcsolutionsus.com`.
- Esses warnings nao foram causados pela alteracao do Aiverse e nao foram mexidos.

## Validacao final do redirect

Depois da correcao:

```bash
curl -I -H "Accept-Language: en-US,en;q=0.9" https://aiverse.jcsolutionsus.com/
```

Retornou:

```text
HTTP/1.1 307 Temporary Redirect
location: https://aiverse.jcsolutionsus.com/en
```

Sem `:3002`.

Tambem validado:

```bash
curl -I https://aiverse.jcsolutionsus.com/
curl -I https://aiverse.jcsolutionsus.com/en
curl -I https://aiverse.jcsolutionsus.com/es
```

Resultados:

- `/` -> `200 OK`, cookie `NEXT_LOCALE=pt-BR`
- `/en` -> `200 OK`, cookie `NEXT_LOCALE=en`
- `/es` -> `200 OK`, cookie `NEXT_LOCALE=es`

## Pendencias recomendadas

- Ajustar o GitHub Actions para reproduzir exatamente o deploy que funcionou no servidor:
  - rsync para `/mnt/volume/aiverse/frontend`
  - preservar `.env.local`
  - rodar `npm ci`
  - instalar bindings ARM de Tailwind/Lightning CSS
  - rodar `npm run build` no proprio servidor
  - rodar `npm ci --omit=dev`
  - reload PM2
- Atualizar Node do servidor de 18 para 20+ em janela controlada, porque Supabase/Tailwind avisam que Node 18 esta deprecated/fora do engine esperado.
