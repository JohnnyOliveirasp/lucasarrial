# Fechamento de incidentes por scripts nossos — função única (20/08)

Card do Frank: fechar o lado NOSSO do buraco de `resolved_at`/`resolved_by`
(o lado do APP já foi fechado pelo Claude em 513f518 + 34b8e6a).

## Varredura (o que escreve em `incidents` fora do app)

- `_frank/ferramentas/`: **zero** escrita em incidents (as 3 que citam a tabela
  são read-only: `varredura_travados.cjs`, `2026-08-20_contagem_reincidencia.cjs`,
  `2026-08-20_fechados_que_disparam.cjs`).
- `_frank/rotinas/`: zero escrita em incidents.
- SQL cru (`UPDATE incidents` / `INSERT INTO incidents` em .sql/.sh): zero.
- `_Bugs/` (gitignored, one-offs): ~40 arquivos escrevem em incidents; a maioria
  só anota (`agent_notes`/`resolution_note`) ou abre (`insert status:open`) —
  não fecham, não são buraco.

### Fechadores com buraco (achados e corrigidos no disco)

| Script | Problema | Correção |
|---|---|---|
| `_Bugs/2026-08-19_rotina_falhas_noite/anotar.cjs` | fechava fixed/ignored com `resolved_at` mas SEM `resolved_by` | passa por `fechamento()` |
| `_Bugs/2026-08-19-rotina-falhas/anotar.cjs` | `--status fixed/ignored` sem NENHUM dos dois campos | passa por `fechamento()` |
| `_Bugs/2026-08-19-rotina-falhas/atualizar.cjs` | status livre sem nenhum dos dois campos | passa por `fechamento()` |
| `_Bugs/fecha_incidente_voz.cjs` | one-off JÁ executado; fechou 270a58bc como fixed sem `resolved_by` (é um dos 6 antigos) | corrigido caso seja copiado; sem backfill |

Fechadores que já gravavam os dois campos (sem mudança): `atualizar_incidente.cjs`,
`2026-08-19_rotina_falhas/fecha_incidente.cjs`, `fecha_josilene.cjs`,
`fechar_incidentes.cjs`, `upd.cjs`, `2026-08-19-rotina-falhas/set_commit.cjs`.

## A função única

`fechamento(patch, by)` em `_frank/ferramentas/_comum.cjs` (que TODO script já
importa). Regra: nunca montar patch de `status` na mão — passar por ela.

- `fixed`/`ignored`: obriga `resolved_at` + `resolved_by`; sem responsável dá
  throw (não grava capado).
- `open`/`investigating`: limpa os dois campos (espelha o app — reabertura não
  carrega data residual, caso ce6e157d).
- patch sem `status`: intocado (nota não mexe em fechamento).

## Teste de aceite (executado 20/08 ~21:39 UTC)

2 incidentes de TESTE inseridos (`test:fechamento-unico-frank:a/b`), e por CADA
uma das 3 ferramentas genéricas: fechado um como `fixed` e outro como `ignored`,
releitura independente confirmando `resolved_at` + `resolved_by` preenchidos
(inclusive com o default `frank/rotina-falhas` quando `--by` é omitido, e `vigia`
quando passado); reabertura limpando os dois campos; nota-sem-status não tocando
neles; `fechamento({status:"fixed"})` sem `by` dando throw. Ao final as 2 linhas
de teste foram DELETADAS e a releitura devolveu 0 linhas — nada de teste sobrou
no banco. Scripts do aceite: `_Bugs/2026-08-20_fechamento_unico/`.

## Medição (script persistido: `2026-08-20_medicao_fechados_resolved.cjs`)

68 incidentes na tabela, 63 fechados (fixed|ignored):

- fechados SEM `resolved_at`: **0** (Claude mediu 0 — bate)
- fechados COM `resolved_at` e SEM `resolved_by`: **6** (Claude mediu 6 — bate):
  aa08e67e, 270a58bc, 2f943a30, 353310e1, 0dc3e0fe, 4741710c

Os 6 ficam como estão por decisão: carimbar responsável retroativo é fabricar
auditoria. Vazio é honesto.
