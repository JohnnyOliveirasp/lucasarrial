# Prova — as 8 pagantes que pararam em julho: acesso MANTIDO (ordem do Johnny 20/08)

**Ordem executada:** "mantem o acesso, e acabou" + regra vigente "aluno pagou tem
creditos, parou de pagar nao tera mais creditos novos e usa os que tem ate acabar".

**Executor:** coder | **Data:** 2026-08-20 ~14:58–15:05 UTC | **Working copy:** main == origin/main (9f414ef)

## Veredito na primeira linha

**Nenhuma escrita no banco foi necessaria — e nenhuma foi feita.** As 8 ja estao
com o acesso funcional MANTIDO em producao: desde o commit `0b097be`
("fix(gates): Roteiro, Edicao e Settings passam a abrir por credito, nao por
assinatura", 18/08, na origin/main), nenhuma tela e nenhuma rota de API nega
nada por `access_until` vencido. O rotulo "trancada" vem da definicao de banco
da ferramenta de varredura (saldo > 0 + access_until vencido), que descreve o
CACHE de assinatura — nao o que o app deixa ou nao deixa fazer. Empurrar
`access_until` na mao seria a gambiarra que o card proibiu, e seria INUTIL:
nao mudaria nada do que as 8 conseguem fazer. Os 8 e-mails de aviso foram
enviados (8/8 aceitos no SMTP, bcc suporte@).

## Evidencia de codigo (main = producao)

Rastreei `hasActiveAccess`/`subscribed` ate o efeito final em TODOS os 31
call-sites (regra: import nao e portao; o que vale e o if/redirect/disabled):

| Onde | O que `subscribed` faz | O que TRAVA de verdade |
|---|---|---|
| `frontend/src/middleware.ts` | nada (nem importa) | so exige LOGIN (redirect pra /login) |
| `app/layout.tsx:58,71` | escolhe banner Pix pendente | nada |
| `roteiro/page.tsx:52-57` | "SO pra escolher o texto do aviso e o destino do CTA — nao tranca mais nada (ordem do Johnny 18/08)" (comentario no codigo) | `canGenerate = team \|\| creditsTotal >= ROTEIRO_COST` |
| `videos/edicao/page.tsx:39-44` | idem (mesmo comentario) | `unlocked = bypassesBilling \|\| creditsTotal > 0` |
| `videos/clone/page.tsx:44-47`, `voice-cloning/page.tsx:63-66` | texto de aviso | `creditsTotal >= custo` |
| APIs `video-clone`, `images/generate`, `voices/generate`, `voices/start-training`, `studio`, `studio/billing.ts`, `video/sales.ts` | so metadado `{subscribed}` DENTRO do erro 402 `insufficient_credits` | saldo de credito (`getBalance` >= custo) |
| `PaywallModal` (todos os usos) | prop de texto | abre por `noCredits` / 402 da API |

**Deploy:** workflow "Deploy Frontend (production)" verde em 2026-08-20T10:14:41Z
(run 32357974361), push na main — inclui 0b097be. `git log origin/main..HEAD`
vazio antes e depois.

**Limite honesto:** nao tenho as senhas das 8, entao a prova de "entra e gera" e
por leitura exaustiva de codigo + deploy verde, nao por login real. Se o Johnny
quiser prova empirica, um card pro `qa` com uma conta de teste com access_until
vencido + saldo > 0 fecha isso em minutos.

## Antes (baseline crua, 2026-08-20T14:58:44Z, leitura pura)

| email | saldo | access_until (profile) | plan | entitlement |
|---|---|---|---|---|
| beatrizsrl021@gmail.com | 100.000 | 2026-08-13 12:00Z (vencido) | pro | XQ55UVIL active, vencido |
| dinicleia.nascimento93@gmail.com | 100.000 | 2026-08-19 12:00Z (vencido) | pro | O79MCQT4 active, vencido |
| erwintst@gmail.com | 26.323 | NULL (cache recalculado) | free | 82O60D4N active, vencido 08/08 |
| lelequisdias@gmail.com | 76.058 | 2026-08-10 12:00Z (vencido) | pro | GNMOTJE6 active, vencido |
| maciel10anjos@gmail.com | 100.000 | 2026-08-20 12:00Z (vencido) | pro | Q598BW58 active, vencido |
| renildoe@yahoo.com.br | 115 (100% extra) | 2026-08-09 12:00Z (vencido) | pro | MBRGY4O0 active, vencido |
| talineschneider@gmail.com | 6.808 | 2026-08-08 12:00Z (vencido) | pro | D6S4QS7Z active, vencido |
| zecunha@hotmail.com | 100.000 | 2026-08-12 12:00Z (vencido) | pro | AN0379Z6 active, vencido |

Saida crua integral do script (JSON por aluna) no fim deste arquivo.

## Depois (re-leitura independente, ~15:03 UTC)

`diff` entre antes e depois (ignorando so a linha do relogio): **IDENTICO, byte a
byte**. Zero linhas alteradas em profiles e entitlements. Saldo de credito de
ninguem foi tocado; credito novo nao foi concedido; as 47 que nunca pagaram nao
foram tocadas (o script so le os 8 e-mails do card).

A regra do Johnny ja e exatamente o comportamento do sistema: credito novo NAO
entra sozinho (Hotmart nao manda webhook de renovacao pra rec#3 OVERDUE) e o
saldo pago se gasta ate acabar, com acesso mantido pra isso.

## O que seria a "mudanca estrutural" (relato pedido pelo card — NAO aplicada, NAO necessaria)

Se um dia se quiser que o BANCO reflita a regra (e nao so o codigo), o caminho
seria um status de entitlement tipo `credit_grace` ou um gate
`hasActiveAccess(email, accessUntil, creditsTotal)` que aceite saldo > 0 —
mudanca em `lib/credits/access.ts` + `recomputeProfileAccess`. Hoje isso nao
muda nada pro aluno; fica registrado so porque o card mandou relatar. Assunto
encerrado por ordem do Johnny; nada aqui propoe reabrir.

## E-mails (passo 6)

Ensaio `--dry-run` executado antes (corpo conferido). Envio real: **8/8 aceitos
no SMTP**, remetente `Fast - FastCloner <suporte@fastcloner.com>`, bcc
`suporte@fastcloner.com`, assunto "Seu acesso à FastCloner está liberado".
Corpo (integral): "Olá! Passando pra avisar: seu acesso à FastCloner está
liberado e os créditos que você já tem na sua conta continuam valendo. É só
entrar e usar normalmente, até eles acabarem. Entre por aqui: fastcloner.com.
Qualquer dúvida, é só responder este e-mail. Abraço, Equipe FastCloner."
Sem promessa de credito novo, sem explicacao de bug, sem desculpa longa.
(Ferramenta e SMTP puro — nao ha copia em "Enviados"; prova de entrega e o
aceite 250 + ausencia de bounce, a conferir na caixa suporte@.)

```
✅ beatrizsrl021@gmail.com          ✅ maciel10anjos@gmail.com
✅ dinicleia.nascimento93@gmail.com ✅ renildoe@yahoo.com.br
✅ erwintst@gmail.com               ✅ talineschneider@gmail.com
✅ lelequisdias@gmail.com           ✅ zecunha@hotmail.com
```

## Saida crua do baseline (antes)

```
AGORA (UTC): 2026-08-20T14:58:44.525Z

### beatrizsrl021@gmail.com
profile  : {"id":"3da86f5b-8c7c-4a8f-a7fb-e633a7b9143f","email":"beatrizsrl021@gmail.com","plan":"pro","access_source":"hotmart","access_until":"2026-08-13T12:00:00+00:00","credits_subscription":100000,"credits_extra":0,"pending_payment_at":"2026-08-13T14:41:06.438+00:00"}
entitls  : [{"provider":"hotmart","external_id":"XQ55UVIL","product_code":"7851642","status":"active","access_until":"2026-08-13T12:00:00+00:00","user_id":"3da86f5b-8c7c-4a8f-a7fb-e633a7b9143f","updated_at":"2026-07-28T08:35:15.165+00:00"}]
resumo   : saldo=100000 | access_until=2026-08-13T12:00:00+00:00 | vencido=true | plan=pro
gate hoje: middleware exige só LOGIN; telas e APIs travam por CRÉDITO (>0) — entra=true e gera=true

### dinicleia.nascimento93@gmail.com
profile  : {"id":"4283e759-c52e-412f-8764-0fe172011fa8","email":"dinicleia.nascimento93@gmail.com","plan":"pro","access_source":"hotmart","access_until":"2026-08-19T12:00:00+00:00","credits_subscription":100000,"credits_extra":0,"pending_payment_at":null}
entitls  : [{"provider":"hotmart","external_id":"O79MCQT4","product_code":"7851642","status":"active","access_until":"2026-08-19T12:00:00+00:00","user_id":"4283e759-c52e-412f-8764-0fe172011fa8","updated_at":"2026-08-03T08:43:33.756+00:00"}]
resumo   : saldo=100000 | access_until=2026-08-19T12:00:00+00:00 | vencido=true | plan=pro
gate hoje: middleware exige só LOGIN; telas e APIs travam por CRÉDITO (>0) — entra=true e gera=true

### erwintst@gmail.com
profile  : {"id":"8266ac17-fe36-4071-b836-f984b0912b7b","email":"erwintst@gmail.com","plan":"free","access_source":null,"access_until":null,"credits_subscription":26323,"credits_extra":0,"pending_payment_at":"2026-08-08T14:30:38.47+00:00"}
entitls  : [{"provider":"hotmart","external_id":"82O60D4N","product_code":"7851642","status":"active","access_until":"2026-08-08T12:00:00+00:00","user_id":"8266ac17-fe36-4071-b836-f984b0912b7b","updated_at":"2026-08-02T10:41:29.84+00:00"}]
resumo   : saldo=26323 | access_until=NULL | vencido=true | plan=free
gate hoje: middleware exige só LOGIN; telas e APIs travam por CRÉDITO (>0) — entra=true e gera=true

### lelequisdias@gmail.com
profile  : {"id":"c672dfa4-a456-4d40-8958-e2f308893c95","email":"lelequisdias@gmail.com","plan":"pro","access_source":"hotmart","access_until":"2026-08-10T12:00:00+00:00","credits_subscription":76058,"credits_extra":0,"pending_payment_at":null}
entitls  : [{"provider":"hotmart","external_id":"GNMOTJE6","product_code":"7851642","status":"active","access_until":"2026-08-10T12:00:00+00:00","user_id":"c672dfa4-a456-4d40-8958-e2f308893c95","updated_at":"2026-07-25T09:04:51.026+00:00"}]
resumo   : saldo=76058 | access_until=2026-08-10T12:00:00+00:00 | vencido=true | plan=pro
gate hoje: middleware exige só LOGIN; telas e APIs travam por CRÉDITO (>0) — entra=true e gera=true

### maciel10anjos@gmail.com
profile  : {"id":"dff9395e-9a13-440e-969e-0ed373869ee0","email":"maciel10anjos@gmail.com","plan":"pro","access_source":"hotmart","access_until":"2026-08-20T12:00:00+00:00","credits_subscription":100000,"credits_extra":0,"pending_payment_at":null}
entitls  : [{"provider":"hotmart","external_id":"Q598BW58","product_code":"7851642","status":"active","access_until":"2026-08-20T12:00:00+00:00","user_id":"dff9395e-9a13-440e-969e-0ed373869ee0","updated_at":"2026-08-04T08:38:23.468+00:00"}]
resumo   : saldo=100000 | access_until=2026-08-20T12:00:00+00:00 | vencido=true | plan=pro
gate hoje: middleware exige só LOGIN; telas e APIs travam por CRÉDITO (>0) — entra=true e gera=true

### renildoe@yahoo.com.br
profile  : {"id":"af0b6a18-0ebe-4b0d-b249-1fea9fbfeb16","email":"renildoe@yahoo.com.br","plan":"pro","access_source":"hotmart","access_until":"2026-08-09T12:00:00+00:00","credits_subscription":0,"credits_extra":115,"pending_payment_at":"2026-08-17T17:57:07.609+00:00"}
entitls  : [{"provider":"hotmart","external_id":"MBRGY4O0","product_code":"7851642","status":"active","access_until":"2026-08-09T12:00:00+00:00","user_id":"af0b6a18-0ebe-4b0d-b249-1fea9fbfeb16","updated_at":"2026-07-24T09:47:08.54+00:00"}]
resumo   : saldo=115 | access_until=2026-08-09T12:00:00+00:00 | vencido=true | plan=pro
gate hoje: middleware exige só LOGIN; telas e APIs travam por CRÉDITO (>0) — entra=true e gera=true

### talineschneider@gmail.com
profile  : {"id":"60641691-c641-4138-9f0e-89b6621a38bb","email":"talineschneider@gmail.com","plan":"pro","access_source":"hotmart","access_until":"2026-08-08T12:00:00+00:00","credits_subscription":6808,"credits_extra":0,"pending_payment_at":"2026-08-08T14:18:28.892+00:00"}
entitls  : [{"provider":"hotmart","external_id":"D6S4QS7Z","product_code":"7851642","status":"active","access_until":"2026-08-08T12:00:00+00:00","user_id":"60641691-c641-4138-9f0e-89b6621a38bb","updated_at":"2026-07-25T05:25:31.809+00:00"}]
resumo   : saldo=6808 | access_until=2026-08-08T12:00:00+00:00 | vencido=true | plan=pro
gate hoje: middleware exige só LOGIN; telas e APIs travam por CRÉDITO (>0) — entra=true e gera=true

### zecunha@hotmail.com
profile  : {"id":"ba96e45a-5597-4a83-8d81-f22b34910111","email":"zecunha@hotmail.com","plan":"pro","access_source":"hotmart","access_until":"2026-08-12T12:00:00+00:00","credits_subscription":100000,"credits_extra":0,"pending_payment_at":"2026-08-12T14:33:39.426+00:00"}
entitls  : [{"provider":"hotmart","external_id":"AN0379Z6","product_code":"7851642","status":"active","access_until":"2026-08-12T12:00:00+00:00","user_id":"ba96e45a-5597-4a83-8d81-f22b34910111","updated_at":"2026-08-03T12:29:21.283+00:00"}]
resumo   : saldo=100000 | access_until=2026-08-12T12:00:00+00:00 | vencido=true | plan=pro
gate hoje: middleware exige só LOGIN; telas e APIs travam por CRÉDITO (>0) — entra=true e gera=true
```
