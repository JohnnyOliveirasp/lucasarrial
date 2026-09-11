# Ronda noturna 10/09/2026 — medições cruas

Relatório consolidado postado no GRUPO (notify-grupo.sh) em 11/09 ~01:10Z.
Este arquivo é a prova: números medidos, comando por comando.

## Produção — o que está REALMENTE no ar

`ssh root@91.99.15.213 'cat /mnt/volume/aiverse/frontend/.next/BUILD_ID'`
→ `4VLNHoIIn1_oABGr8jknO`, arquivo datado **2026-09-10 13:42:44Z**.
pm2 `aiverse`: online, 71 restarts acumulados, uptime 90m no momento da medição.

⚠️ `/mnt/volume/aiverse` **não é repositório git** — não dá pra conferir HEAD
por lá. A conferência foi feita por presença+mtime dos arquivos de cada PR:

| PR | commit | merge (UTC) | arquivo conferido no servidor | mtime |
|---|---|---|---|---|
| #229 | 3f25c18 | 10/09 00:51 | — (coberto pelo build de 13:42) | — |
| #231 | 9fe9330 | 10/09 01:53 | `src/lib/payments/aviso-orfao.ts` | 10/09 13:41 |
| #232 | a90e9b0 | 10/09 11:49 | `src/lib/agent/mail-charset.ts` | 10/09 13:41 |
| #228 | fdcba70 | 10/09 12:46 | `src/lib/credits/onboarding-cobranca.ts`, `src/lib/onboarding/treino.ts` | 10/09 13:41 |
| #215 | c99ffc7 | 10/09 13:40 | `src/lib/sgp/compradores.ts`, `src/app/api/v1/admin/sgp/compradores/route.ts` | 10/09 13:41 |
| #233 | 7d9b617 | 10/09 18:51 | só `_frank/ferramentas/` — NÃO vai pro servidor | n/a |

Conclusão: os 5 PRs de código de app entraram no build das 13:42. O #233 é
ferramenta local (não precisa de deploy). **Nenhum merge de hoje ficou fora do ar.**

⚠️ Método vale a pena registrar: `mtime` do arquivo + data do `BUILD_ID` é o que
existe aqui, já que não há git no servidor. Action verde não foi usada como prova.

## Incidentes

```sql
select count(*) filter (where created_at >= '2026-09-10T04:00:00Z') as abertos_hoje,
       count(*) filter (where created_at >= '2026-09-09T04:00:00Z'
                    and created_at <  '2026-09-10T04:00:00Z') as abertos_ontem,
       count(*) filter (where resolved_at >= '2026-09-09T04:00:00Z'
                    and resolved_at <  '2026-09-10T04:00:00Z') as fechados_ontem
from incidents;
```
→ **17 abertos hoje · 16 abertos ontem · 7 fechados ontem.**
Fechados hoje (`resolved_at >= 10/09 04:00Z`): **4** — #337 (a90e9b0), #342
(7d9b617), #345 e #346 (atendimento, sem commit).
Saldo do dia: **+13 na fila.** A fila está perdendo terreno; isso foi dito no
relatório com todas as letras em vez de ser diluído.

⚠️ `incidents` **não tem coluna `updated_at`** (tem `created_at`,
`last_seen_at`, `resolved_at`). Consulta com `updated_at` volta HTTP 400 —
conferir o erro, não o zero (armadilha 1 do `03_ROTINA.md`).

Estado no fim da ronda: **71 abertos · 12 aguardando aluno** (mais velho #172,
13 dias) **· 0 fechado sem retorno humano.**

## Caso resolvido com aluno: Igor (#345/#346)

`clonedoigor@gmail.com`, pagante do SGP, ~6h travado na tela 2.
Causa medida: `ehRepetida` (`impressao-foto.ts:82-88`), dHash 8x8 (64 bits) com
`DHASH_LIMITE=5`. Mesma imagem re-salva dá distância 0..1; fotos **diferentes**
da mesma pessoa dão 1..4 — **faixas sobrepostas, nenhum limiar separa em 8x8**.
Depois de anexar 2 fotos, todas as outras dele passavam a ser recusadas e
retentar nunca resolvia.
Desfecho: aluno destravado com as 4 fotos no pedido e avisado por e-mail
(Enviados uid 1671). #345 fechado como duplicata do #346.
**O conserto do código não está feito** — vive no #349 / PR #234 (aberto).

## Fila / travados

`node _frank/ferramentas/varredura_travados.cjs` → **2 itens presos**, ambos
inofensivos. Um é `training_jobs` job `ebf5cc56` → voz `f4b9b0f2` já `ready`
(escrituração pendente, ninguém esperando).

**Acesso vivo + crédito + nenhuma voz pronta: 2**
- `marcelopersonalthe32@gmail.com` — 298.950 cr, sem voz desde 10/08 (**32 dias**),
  acesso até 05/10. Voz `f6f82819` `failed`, e a nota diz que a falha **foi nossa**.
  Cruzado com `pagou_de_verdade.cjs`: **PAGOU** (assinatura + avulsa, 3 recorrências,
  R$ 368,64 avulsa 27/07).
- `hellengrasso@gmail.com` — 95.375 cr, 4 dias, voz `9bb9fccf`
  `rejected_too_short`: só 2 dos 7 arquivos chegaram.

`node _frank/ferramentas/pagante_trancado.cjs` → **0 pagante trancado · 0 na
fronteira · 0 sem prova** (191 suspeitos conferidos um a um na Hotmart).
Trancar está certo em 16 cancelados · 168 inadimplentes · 7 trials.

`_estornos`: 10 tipos, 3.080 linhas varridas, **nenhum tipo desconhecido** —
é o guarda do #342 (7d9b617) já rodando.

## 🔴 Achado da ronda: a fila de recados voltou a empilhar

```sql
select count(*) from agent_state where key like 'para\_frank\_%';  -- 64
select count(*) from agent_state where key like 'patch\_%';        -- 3
```
**64 recados**, o mais velho de **2026-09-01 18:25Z — 223 horas (9 dias)**, mais
**3 patches do Vigia sem revisão** (`patch_81438b60` de hoje 12:13Z,
`patch_7578c587` de hoje 00:13Z, e um terceiro).

É o mesmo buraco do `03_ROTINA.md` §1-B/§1-C: ninguém reclama de recado parado,
então silêncio parece saúde — foi assim que 43 vozes ficaram semanas paradas e
que 28 recados chegaram a ~70h. Agora são 64 e 223h, pior que o caso que gerou
a regra. Registrado no relatório como achado, não escondido.

**Próxima ronda começa por aqui**, antes de qualquer item novo: drenar
`para_frank_*` e revisar os 3 patches. Lembrete da regra: apagar com `DELETE`,
nunca `set_state` com value null (`agent_state.value` é NOT NULL → `23502`, a
chave fica).

## Aberto, esperando decisão do Johnny (as 3 perguntas do relatório)

1. **PR #234** (#349, dHash 8x8→16x16, limite 3) — aberto 10/09 22:02Z, sem
   merge. É o conserto do que travou o Igor. Mergear e subir?
2. **Devolução de 168.400 créditos** a 16 perfis do SGP (causa corrigida em
   fdcba70/#228; sobra a devolução). Mexe em crédito de 16 pessoas de uma vez.
3. **Reembolso na garantia**: Victor, Alana, Lucila (#350). O prazo do Victor
   **venceu 11/09 00:00Z enquanto ele esperava na fila**. Dinheiro → não decido
   sozinho (`06_RELATORIO_E_LIMITES.md`).

⚠️ O #350 é a classe, não o caso: `janelaGarantia` (`garantia.ts`) tem **um único
chamador**, `account.ts:174`, que só roda ao MONTAR RESPOSTA. Não existe varredura
que cruze pedido de reembolso ABERTO com `warranty_date`. O relógio corre dentro
da fila e ninguém vê.
