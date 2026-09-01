# Fix incidente 144 — download de OneDrive via cadeia FedAuth (26/08)

## O defeito
`linkDiretoOneDrive` mandava todo link 1drv.ms pra API legada
`api.onedrive.com/v1.0/shares/u!<base64url>/root/content`. Depois da migração
das contas pro SharePoint Online, esse endpoint devolve **401 pra TODO link**
(medido 26/08 em /root, /root/children e /root/content). O grant anônimo do
share virou cookie **FedAuth**, emitido só pela cadeia de redirect do 1drv.ms.

## O fix (novo módulo `frontend/src/lib/onboarding/onedrive.ts`)
1. Segue a cadeia de redirect do 1drv.ms com cookie jar → FedAuth.
2. Extrai `cid`/`resid` da URL final (fallback: HTML da página).
3. `_api/v2.0/drives/<cid>/items/<resid>` (arquivo) ou `/children` (pasta,
   com paginação e 1 nível de subpasta) → `@content.downloadUrl`.
4. Baixa com o mesmo cookie, validando content-type ≠ HTML **e bytes baixados
   == size anunciado** (200/HTML nunca passa como sucesso).

Critério de culpa: **sem FedAuth** = o share não concede acesso anônimo →
mensagem pede link novo (aluno). **Com FedAuth e falha** = defeito NOSSO →
motivo carrega "não conseguimos baixar", que o route.ts traduz na orientação
honesta ("pode ser do nosso lado") — nunca mais o caso Luzielia (4 voltas).

De quebra: pasta (/f/) agora funciona — a API antiga nunca soube listar.

## Prova viva (links reais de onboarding_runs, rodado 26/08 com o código do branch)
`_Bugs/onedrive_144/teste_vivo_fix.mjs`:

```
[luzielia_imagens_pasta_f] ok=true arquivos=4
    20260825_023634379_iOS.jpg  bytes=175603  magic=ffd8ffe0 (JPEG)
    20260825_023705486_iOS.jpg  bytes=145845  magic=ffd8ffe0
    20260825_024312189_iOS.jpg  bytes=152306  magic=ffd8ffe0
    20260825_024325666_iOS.jpg  bytes=129790  magic=ffd8ffe0
[luzielia_audios_pasta_f] ok=true arquivos=9 (m4a, magic 6674797) — pasta resolvida
[lazevedo_audio_arquivo_u] ok=true arquivos=1
    Gravando (11).m4a  bytes=46127898  magic=667479706d703432 (MP4 v2)
[lazevedo_img_arquivo_v_SEM_FEDAUTH] ok=false dependeDoAluno=true
    motivo: o link do OneDrive não está aberto para "qualquer pessoa com o link" …
TODOS OS CASOS PASSARAM
```

Os bytes batem com os probes de 26/08 (175.603 e 46.127.898 = size anunciado).

## Verificações
- `node --test src/lib/**/*.test.ts` → 100/100 pass (6 do links.test.ts
  reescritos pro contrato novo + helpers do onedrive.ts).
- `tsc --noEmit` limpo; `eslint` limpo nos arquivos tocados.
- Nenhum aluno travado nisto agora (os 3 afetados já atendidos/estornados).
