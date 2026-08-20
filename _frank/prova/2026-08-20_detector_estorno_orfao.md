# Prova — detector canônico de estorno órfão (20/08)

Card: mesmo detector levantou o mesmo não-bug 3x (incidentes 902a1c85 e 88eef8aa).
Correção: ferramenta canônica `_frank/ferramentas/estorno_orfao.cjs` + Playbook U.

## Prova (a) — os 4 estornos órfãos de agosto NÃO saem mais como suspeita

```
janela desde 2026-08-01 | estornos generation_refund examinados: 32
refs distintos: 32 | existentes: 28 | ORFAOS: 4 | estorno sem ref_id nenhum: 0
  · PADRAO CONHECIDO: DELETE de historico, ledger reconcilia — NAO E ACHADO | 2026-08-19T18:15 paulogmarinho@gmail.com ref=5c1adcf6-2380-4660-83d0-469f550479b8 +1164 (ledger 55 tx reconcilia em 16964)
  · PADRAO CONHECIDO: DELETE de historico, ledger reconcilia — NAO E ACHADO | 2026-08-19T18:19 paulogmarinho@gmail.com ref=f44d84cd-a344-40e9-9553-ad08f1472406 +1164 (ledger 55 tx reconcilia em 16964)
  · PADRAO CONHECIDO: DELETE de historico, ledger reconcilia — NAO E ACHADO | 2026-08-19T18:22 paulogmarinho@gmail.com ref=dd794da4-599c-4444-a094-f2d73e23f451 +1159 (ledger 55 tx reconcilia em 16964)
  · PADRAO CONHECIDO: DELETE de historico, ledger reconcilia — NAO E ACHADO | 2026-08-20T00:11 robertocesarfernandes771@gmail.com ref=9f8af111-9030-421a-b97e-d71c6b481b9d +1508 (ledger 13 tx reconcilia em 82304)

>>> RESUMO: 32 estornos examinados | 4 orfaos | 4 padrao-conhecido (nao sao achado) | 0 ALARME(S)
>>> nenhum alarme — os orfaos encontrados sao todos DELETE de historico com ledger reconciliado.
exit=0
```

## Prova (b) — caso construído de ledger que NÃO reconcilia AINDA alarma

(injetado EM MEMÓRIA via --injetar-teste; nada foi gravado no banco)

```
janela desde 2026-08-01 | estornos generation_refund examinados: 32
(--injetar-teste: 1 orfao sintetico com ledger que NAO reconcilia foi injetado em memoria)
refs distintos: 32 | existentes: 28 | ORFAOS: 5 | estorno sem ref_id nenhum: 0
  · PADRAO CONHECIDO: DELETE de historico, ledger reconcilia — NAO E ACHADO | 2026-08-19T18:15 paulogmarinho@gmail.com ref=5c1adcf6-2380-4660-83d0-469f550479b8 +1164 (ledger 55 tx reconcilia em 16964)
  · PADRAO CONHECIDO: DELETE de historico, ledger reconcilia — NAO E ACHADO | 2026-08-19T18:19 paulogmarinho@gmail.com ref=f44d84cd-a344-40e9-9553-ad08f1472406 +1164 (ledger 55 tx reconcilia em 16964)
  · PADRAO CONHECIDO: DELETE de historico, ledger reconcilia — NAO E ACHADO | 2026-08-19T18:22 paulogmarinho@gmail.com ref=dd794da4-599c-4444-a094-f2d73e23f451 +1159 (ledger 55 tx reconcilia em 16964)
  · PADRAO CONHECIDO: DELETE de historico, ledger reconcilia — NAO E ACHADO | 2026-08-20T00:11 robertocesarfernandes771@gmail.com ref=9f8af111-9030-421a-b97e-d71c6b481b9d +1508 (ledger 13 tx reconcilia em 82304)

🔴 ALARME: ref orfao com ledger que NAO reconcilia
   2026-01-01T00:00 CASO-CONSTRUIDO@teste.local ref=99999999-9999-4999-8999-000000000042 +999
   motivo: SEM debito casado (estorno sem cobranca correspondente)
   motivo: soma das tx (5000) != saldo do profile (4001), dif -999
   motivo: cadeia balance_after com 1 quebra(s)
   (ledger: 3 tx, soma 5000, saldo 4001, quebras 1)

>>> RESUMO: 32 estornos examinados | 5 orfaos | 4 padrao-conhecido (nao sao achado) | 1 ALARME(S)
exit=2
```

## Selftest do classificador (4 casos, sem banco)

```
=== SELFTEST do classificador (4 casos construidos, sem banco) ===
  OK   padrao conhecido NAO alarma
  OK   soma != saldo ALARMA
  OK   estorno sem debito casado ALARMA
  OK   cadeia balance_after quebrada ALARMA
selftest: 4/4 passaram
exit=0
```
