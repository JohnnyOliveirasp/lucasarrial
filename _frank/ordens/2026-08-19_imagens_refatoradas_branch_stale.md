# AVISO: image-studio refatorado hoje + branch stale que NÃO pode ser mergeada

Data: 19/08/2026 ~17h UTC · De: agente da sessão do Johnny (desktop)

## 1. O que mudou na main hoje (4 commits meus, tudo em prod)

`fcf1b31` → `6041c10` → `1cfd388` → `2daa682` — o fluxo de referência de
imagem foi REDESENHADO a pedido do Johnny:

- Upload em lote vai **SÓ pro banco** (`{user}/refs/`, aba "Imagens de
  Referência"). Nunca preenche o quadro (nem principal, nem extras).
- A pessoa escolhe DO BANCO quem é a principal e quem é extra.
  Exclusividade: a mesma foto nunca é as duas coisas.
- Apagar do banco é sempre permitido; o quadro sincroniza via
  `onDeleted → removeRequest`.
- `generate` e `ref-url` agora aceitam chaves `{user}/refs/` (antes SÓ
  `{user}/images/` — gerar com referência adotada dava
  "Imagem de referência inválida").
- Limite subiu pra 15 fotos (gpt-image-2 aceita 16; Seedream corta em 10
  sozinho e a fixa vai primeiro).

Arquivos centrais: `frontend/src/components/image/image-studio.tsx`
(refatorado — `uploadOne` MORREU, virou `uploadToBank`),
`image-workspace.tsx`, `referencias-salvas.tsx`,
`api/v1/images/{generate,ref-url,refs}/route.ts`, `lib/images/refs.ts`.

## 2. ⛔ Branch `feat/fix-image-upload-retry` (4562f42) está STALE — não mergear

O CONTEÚDO dela (retry com backoff no PUT, erro com nome do arquivo,
extras sequenciais) **já está na main** — entrou pelo PR #7
(`feat/upload-retry-main`, merge `d1f687d`). O patch-id difere porque foi
retrabalhado, então `git cherry` engana (mostra `+`).

Se ela for mergeada agora, ressuscita o `handleFiles`/`uploadOne` antigos
POR CIMA do redesenho de hoje (upload voltaria a preencher o quadro).
Recomendação: **apagar a branch remota** ou marcar o card dela como
superado pelo PR #7.

## 3. Suas outras 5 branches: sem conflito comigo

`estorno-zera-credito`, `persistir-respostas-fast-v2`,
`trial-expiry-cobranca-em-voo`, `tts-coverage-qa`, `vigia-noturno` —
conferi: nenhuma toca os arquivos de imagem acima. Teu merge do QA de
completude (`6b6f29a`, runpod-worker) também não cruza com nada meu; o
Build RunPod Worker estava rodando às 17h40 UTC.

Regra de sempre: antes de mergear card que toca
`frontend/src/components/image/`, dar rebase na main do dia e rodar
`npx tsc --noEmit` de dentro de `frontend/`.
