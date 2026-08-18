# 05 — Mapa do código

Stack: **Next.js (App Router) + TypeScript + Supabase + Cloudflare R2**, com
GPU no RunPod. Quase tudo que interessa está em `frontend/src`.

## Por onde começar a procurar

| Se o problema é… | Olhe em |
|---|---|
| Voz (clonar, treinar, gerar áudio) | `lib/voices/`, `app/api/v1/voices/` |
| Vídeo Clone (lip-sync) | `lib/video-clone/`, `app/api/v1/video-clone/` |
| Vídeo React (reação a viral) | `lib/react/`, `app/api/v1/react/`, `components/react/` |
| Vídeos virais (acervo) | `lib/virais/`, `app/api/v1/virais/` |
| Imagem | `lib/kie/`, `lib/images/`, `app/api/v1/images/` |
| Créditos e cobrança | `lib/credits/` (`config.ts` = preços, `service.ts` = débito/crédito) |
| Pagamento | `lib/payments/`, `app/api/v1/webhooks/hotmart/` |
| Agente Fast (suporte) | `lib/agent/` (`brain.ts`, `manual.ts`, `mail-*.ts`) |
| Incidentes e alertas | `lib/incidents/`, `lib/support/failure-alert.ts` |
| Onboarding por planilha | `lib/onboarding/`, `app/api/v1/onboarding/` |
| Painel /admin | `app/[locale]/app/admin/`, `app/api/v1/admin/` |
| Varreduras automáticas | `app/api/v1/agent/sweep-clones/`, `.../mail-sweep/` |

## Padrões que se repetem (entenda um, entendeu todos)

**1. Trabalho pesado é assíncrono.** A rota cria a linha no banco com status
`pending`, dispara no provedor (RunPod/Kie) e responde na hora. O resultado
chega por **webhook** (`app/api/v1/webhooks/…`) **ou** por poll da tela. Quem
chegar primeiro finaliza — sempre com um **gate idempotente** pra não
finalizar duas vezes. Embaixo de tudo há um **sweep** de 5 min como rede de
segurança.

**2. Cobrança.** Confere saldo **antes** de despachar; **debita depois** que o
provedor aceitou; **estorna automático** se falhar. Equipe/admin não paga
(`bypassesBilling`). Todo dinheiro passa por RPC do banco.

**3. Arquivos.** Nada de arquivo grande no banco: tudo no R2, com chave
determinística (`<userId>/<recurso>/…`). O acesso é sempre por URL assinada
que **expira** — assine na hora de usar.

**4. Resposta de API.** As rotas devolvem o objeto direto (`{ generation }`,
`{ voices }`), sem envelope `data`. Ler `j.data.x` é erro silencioso que
aparece só como "está demorando demais".

## Onde ficam as decisões de negócio

- **Preços** — `lib/credits/config.ts` (treino 10.000; geração = nº de
  caracteres com piso de 400), `lib/kie/config.ts` (imagem por resolução),
  `lib/video-clone/config.ts` (clone por segundo), `lib/react/roteiro.ts`.
- **Quem tem acesso** — `lib/credits/access.ts`.
- **O que a Fast pode dizer** — `lib/agent/manual.ts`.

## Fora do `frontend/`

| Pasta | O que é |
|---|---|
| `comfyui-worker/` | Workflows do InfiniteTalk (vídeo). Fonte da verdade dos templates. |
| `runpod-worker/` | Worker de voz (treino/inferência). |
| `voxbr/` | Projeto do modelo de voz pt-BR (dataset/treino). Não mexe no site. |
| `deploy/`, `.github/workflows/` | Como o deploy acontece. |
| `docs/` | Documentos de decisão e TODOs. |
| `_Bugs/` | Scripts operacionais e investigações (**ignorado pelo git**). |
| `_frank/` | Este manual. |

## Ferramentas de investigação

- Banco: script Node com `@supabase/supabase-js` (exemplos em `ferramentas/`).
- Mídia: `ffprobe`/`ffmpeg` — funcionam direto numa URL assinada, sem baixar.
- Servidor: `pm2 logs aiverse`.
- Sempre **do mais antigo pro mais novo**: quem espera há mais tempo perde mais.
