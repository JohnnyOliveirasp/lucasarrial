# Incidente 144 — OneDrive 401: caminho anônimo novo (badger + API v2.0), medido em 26/08

## O defeito
`linkDiretoOneDrive` convertia todo share em `https://api.onedrive.com/v1.0/shares/u!<b64>/root/content`
(API legada Vroom). Desde ~26/08 esse endpoint devolve **401 `unauthenticated` para TODO share pessoal**,
inclusive dois que baixaram arquivo de verdade em 22/08 (marlon, lazevedo). Baseline reproduzido hoje:

```
GET https://api.onedrive.com/v1.0/shares/u!aHR0cHM6...IY/root/content
→ HTTP 401 application/json (link do marlon, que funcionou em 22/08)
```

Causa consistente com a pista do incidente: as contas migraram pro SPO (`migratedtospo=true` no
redirect do 1drv.ms) e a Vroom não carrega mais o direito anônimo desses shares.

## O caminho que funciona HOJE (o do próprio web app anônimo do OneDrive)
1. `POST https://api-badgerp.svc.ms/v1.0/token` com `{"appId":"5cbed6ac-a083-4e14-b191-b4ba07653de2"}`
   (appId PÚBLICO da página anônima do OneDrive; endpoint responde sem login) → token "badger".
2. `GET https://my.microsoftpersonalcontent.com/_api/v2.0/shares/u!<b64url>/driveItem`
   com `Authorization: Badger <token>` + `Prefer: autoredeem` → JSON do item com `@content.downloadUrl`.
3. Pasta: mesmo GET com `?$expand=children` (arquivo REJEITA expand com `getChildrenOnNonFolder` —
   por isso o código pede o item primeiro e só expande se `folder`). Paginação via
   `children@odata.nextLink`.

## Medições cruas (26/08, links REAIS dos incidentes 144 e 140)
| Link | driveItem | Download |
|---|---|---|
| marlon `/u/` (controle ok=true 22/08) | 200, `Áudio.m4a`, 50 248 933 bytes | **HTTP 200 `audio/mp4` 50 248 933 bytes** (magic: ISO Media M4A) |
| lazevedo `/u/` áudio | 200, `Gravando (11).m4a` | HTTP 200 `audio/mp4` 46 127 898 bytes |
| lazevedo `/v/` vídeo | 200, `WIN_20260717_14_35_19_Pro.mp4` | HTTP 200 `video/mp4` 282 963 027 bytes (headers) |
| luzieli `/f/` PASTA imagens | 200, `Fotos IA`, 4 filhos com downloadUrl | filho baixado: HTTP 200 `image/jpeg` 175 603 bytes (magic: JPEG) |
| luzieli `/f/` PASTA áudios | 200, `Áudios IA`, 9 filhos com downloadUrl | — |

Nada de `text/html`: content-type e content-length são do ARQUIVO (armadilha do links.ts:173 conferida).

## Prova fim-a-fim pelo código de PRODUÇÃO (abrirLink, depois do fix)
```
✅ luzieli PASTA imagens: 4 arquivos (JPEG reais, 129–175 KB)
✅ luzieli PASTA áudios:  9 arquivos (M4A reais, 0,9–3,5 MB)
✅ marlon ARQUIVO:        Áudio.m4a 50 248 933 bytes
✅ lazevedo ARQUIVO:      Gravando (11).m4a 46 127 898 bytes
```
`file` confirma JPEG/ISO Media nos bytes baixados. Link de PASTA (item 3 do card) está RESOLVIDO:
a pasta é listada e cada filho passa pelo mesmo funil (sniff de HTML, teto, zip) do arquivo único.

## Limites honestos
- Subpasta dentro da pasta compartilhada é IGNORADA com aviso no log (recursão exigiria chamada sem
  caso real pra medir). Pasta sem arquivo solto falha com motivo legível.
- sharepoint.com de EMPRESA continua no `download=1` de 22/08 — sem caso medido quebrando.
- O appId badger é o da página pública; se a Microsoft o rotacionar, o erro cai na família NOSSO
  (`HTTP 4xx/5xx` no motivo) e o aluno não leva a culpa.

## Verificação
- `npx tsc --noEmit` limpo; `npx eslint links.ts links.test.ts` limpo.
- `node --test src/lib/**/*.test.ts`: **97/97 pass** (3 testes de links reescritos pro token novo).
- links.ts com 398 linhas (teto 400).
