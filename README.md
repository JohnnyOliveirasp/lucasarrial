# PlatformLucasArrial

Plataforma de ferramentas IA — MVP focado em **clonagem de voz**, com arquitetura preparada para crescer em direção a um catálogo completo (estilo Viver de IA).

> Status: **Fase 1 — Landing pronta**, auditada via Playwright (0 issues).

## Stack

**Frontend** (`frontend/`)
- Next.js 15.5.18 App Router + TypeScript 5.9
- Tailwind CSS 4.2 + tokens editorial-brutalist (preto / branco / laranja)
- `next-intl` 4.11 — pt-BR (default), en, es
- `motion` 12, GSAP 3.15, Lenis 1.3
- Three.js + React Three Fiber para hero 3D futurista
- Auditoria automatizada: Playwright 1.59

**Backend** (`backend/` — em construção)
- FastAPI + Celery + Redis
- Supabase Pro (Postgres + Auth + Storage)
- RunPod Serverless para inferência GPU (VoxCPM)

**Infra prevista**
- Hetzner Cloud (LB + 3-5× CCX23) para frontend/backend HTTP
- Supabase Pro com pooling Supavisor
- RunPod Serverless autoscalado

## Setup rápido

```bash
# Frontend
cd frontend
npm ci
cp ../.env.example .env.local   # editar com keys
npm run dev                     # http://localhost:3000
```

## Comandos úteis

```bash
npm run dev              # Next.js dev server (Turbopack)
npm run build            # Build produção
npm run lint             # ESLint
npm run audit:landing    # Audit Playwright (3 locales × 4 breakpoints)
```

## Estrutura

```
PlatformLucasArrial/
├── frontend/                  # Next.js app
│   ├── src/
│   │   ├── app/[locale]/      # Rotas por idioma
│   │   ├── components/
│   │   │   ├── sections/      # Hero, Problema, Solução, etc.
│   │   │   └── ui/            # Button etc.
│   │   ├── i18n/              # next-intl config
│   │   └── lib/
│   ├── messages/              # pt-BR.json / en.json / es.json
│   ├── public/assets/         # Hero.mp4, LucasFundo3.png
│   └── scripts/               # audit-landing.mjs
├── backend/                   # FastAPI (em breve)
├── docs/                      # Arquitetura, audits
└── .env.example               # Template de variáveis
```

## Workflow git

Três branches:

- `dev` — trabalho ativo, feature branches abrem PR aqui
- `main` — staging, merge de `dev` quando estável
- `master` — produção / releases, merge de `main`

## Identidade visual

Editorial-Brutalist:
- Display: **Anton** (uppercase, condensed)
- Body: **Inter Tight**
- Mono: **JetBrains Mono**
- Accent: **laranja** `#FF5A1F` (light) / `#FF6B2C` (dark)

## Licença

Privado. © 2026 Johnny Oliveira / Lucas Arrial.
