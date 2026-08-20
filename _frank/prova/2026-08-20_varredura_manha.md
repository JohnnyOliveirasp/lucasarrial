# 20/08 12:04 UTC — Varredura diária

Ordem do Johnny: rodar a varredura, conferir o `error` de cada consulta, medir
os "pagantes com crédito e sem acesso" (147 em 18/08), listar incidentes e
reportar mesmo se estiver tudo limpo.

**Resumo:** nada travado, nada aberto, ninguém que pagou está trancado e não há
dinheiro pendurado. Os dois números que pareciam ruins (68 e uma "falha sem
estorno") são **falsos alarmes de ferramenta**, e os dois estão provados abaixo.

---

## 1. Filas e incidentes — o zero é zero de verdade

`varredura_travados.cjs` → *"Nada preso, nada aberto"*.

Esse script **não checa o `error`** em duas das suas consultas (a de vozes com
áudio no R2 e a de incidentes): ele destrutura só `data`. É literalmente a
armadilha do playbook W. Reconferido com `_Bugs/2026-08-19_confere_zeros.cjs`,
que imprime o `error` de cada consulta:

```
=== RESUMO: 0 consulta(s) FALHARAM ===
✔ INCIDENTES ABERTOS (com idade) — consulta ok — 0 incidente(s)
✔ vozes uploading com áudio no R2 — consulta ok — 0
```

- **Incidentes abertos: 0.** Não há incidente para envelhecer — a lista de
  idades pedida na ordem sai vazia porque a fila está vazia, não porque a
  consulta falhou.
- Em andamento e **dentro do prazo**: 1 `generations` (0,03h) e 1 `video_clones`
  (0,17h). Nenhum passou do limite.

## 2. Os "68 pagantes trancados" — o número mede a coisa errada

`prova_raio.cjs` hoje → **68** (era 147 em 18/08). **Não reporto isso como
melhora, porque a métrica é inválida** — já estava documentado em
`_frank/prova/2026-08-19_os_147_nao_eram_pagantes.md`.

`prova_raio.cjs` olha só o nosso banco (`entitlements.status='active'` + saldo +
`access_until` vencido). Três motivos pelos quais mente:

1. `entitlements.status` é o estado da **linha**, não da assinatura — ninguém
   escreve `cancelled` ali quando a pessoa sai.
2. `raw_event` é uma **foto** do último webhook, não o estado de hoje.
3. O grosso é a **virada das 12:00 UTC**: `access_until` guarda a data da
   próxima cobrança, então todo dia um lote inteiro "vence" no mesmo segundo.

Ou seja: 147 e 68 mediam **o tamanho do lote do dia**, não o tamanho do
problema. A ferramenta certa (`pagante_trancado.cjs`, cruza com a Hotmart
assinante por assinante):

```
🔴 PAGANTE TRANCADO — pagou de verdade e está sem acesso: 0
🟡 NA FRONTEIRA — venceu na virada das 12:00: 20
⚪ 23 cancelaram · 24 inadimplentes · 0 trial que nunca virou pagamento
>>> 0 pagante(s) trancado(s) · 20 na fronteira · 0 sem prova
```

**0 sem prova** — todos os 67 foram classificados com resposta da Hotmart,
nenhum ficou no escuro.

### A previsão de ontem venceu hoje — e deu diferente

Ontem ficou escrito que, se o webhook não empurrasse o `access_until`, os 20 da
fronteira virariam 20 pagantes trancados hoje, com a **dinicleia** como vítima
confirmada (ela pagou R$ 97 na recorrência 2). Fui atrás dela na Hotmart:

```
#1 R$0  COMPLETE   (trial)
#2 R$97 COMPLETE   ← pagou de verdade
#3 R$97 OVERDUE    ← não pagou
status da assinatura hoje: DELAYED
```

**A previsão não se confirmou, mas não porque o bug foi corrigido:** ela parou
de pagar. Trancar está certo pela ordem de 13/08. Fica a pergunta do item 6.

## 3. Dinheiro pendurado — R$ 0, e um falso alarme

`_Bugs/2026-08-19_dinheiro_pendurado.cjs` acusou **3 falhas "SEM estorno
visível"**, entre elas a `estudioelianeguedes@` (aluna real). Fui conferir e o
alarme é **da ferramenta, não do dado**. Ela procura estorno com regex no JSON
inteiro da transação (`/estorn|refund|devolu/`) e **nunca casa o estorno com a
geração** — então erra nos dois sentidos: um estorno "cobre" três falhas na
tela, e uma nota sem essas palavras vira alarme falso.

Refeito casando `ref_type='generation_refund'` **com o `ref_id` da geração**
(`_frank/ferramentas/estorno_confere.cjs`, novo):

| falha | desfecho |
|---|---|
| 9 falhas de aluno real (18–20/08) | ✅ **todas com estorno casado** |
| `estudioelianeguedes@` 19/08 18:51 | ✅ **+414 estornados** — alarme era falso |
| `johnny.oliveirasp@` 20/08 02:58 | conta admin, não debita |
| `serescastro6@` 20/08 10:09 | **0 transações ligadas** — retry não debitou |

O retry do Seres eu **conferi em vez de assumir**: `credit_transactions` com
`ref_id` daquela geração devolve zero linhas. O ciclo dele fecha certo:
`-1080` às 08:39 → `+1080` às 08:41 → sucesso às 10:15 sem novo débito.

**Ninguém está devendo nem sendo devido.**

## 4. QA das vozes — a taxa sobe, mas a régua mudou no meio

`qa_coverage.cjs`:

| dia | gerações de aluno | falhas | taxa |
|---|---|---|---|
| 17/08 | 102 | 0 | 0,0% |
| 18/08 | 131 | 2 | 1,5% |
| 19/08 | 110 | 5 | 4,5% |
| 20/08 | 42 | 3 | **7,1%** |

Parece quatro dias de piora, mas **as 3 falhas de hoje (00:35, 08:39, 10:09) são
todas anteriores às 11:01 UTC**, quando entrou a régua nova (`aae3ba5`). Medi a
janela depois do deploy separado:

```
desde 2026-08-20T11:01Z — 7 gerações de aluno, 0 falhas
⚠️ n<20 — amostra pequena demais pra concluir
```

**Não afirmo que melhorou.** Com n=7, uma falha viraria 14%. O 7,1% é da régua
velha; o número da régua nova ainda não existe. Recheca amanhã com n maior.

As 2 falhas de 18/08 são `executionTimeout` (bicho diferente, é o `d3d8d1b2`);
as de 19–20/08 são reprovação do QA mesmo.

## 5. Infra

- **Sweeps vivos** — não confiei no `crontab -l` (cron que morre é silencioso):
  fui no syslog e eles rodaram **11:55 e 12:00 UTC**, minutos atrás.
- **Produção:** `fastcloner.com` HTTP 200, `/login` 200.
  ⚠️ `app.fastcloner.com` deu `HTTP 000`, mas **não é queda**: o subdomínio não
  existe no DNS (`curl` código 6). Conferido antes de virar alarme.
- **GPU:** `inQueue=0` nos 3 endpoints — **ninguém esperando**. `infinitetalk`
  com `throttled=5` e 0 workers prontos, `VoxBR` com `throttled=2` e 2
  inicializando. Throttle é falta de GPU no datacenter, nada a fazer no código;
  como a fila está zerada, não afeta aluno agora.

## 6. A pergunta pro Johnny (é decisão dele, não minha)

O caso da dinicleia expõe um buraco de política que vale para **47 pessoas**
(23 canceladas + 24 inadimplentes), todas com saldo e sem acesso:

> Ela pagou R$ 97 de verdade, tem **100.000 créditos** no bolso e está trancada
> por não ter pago a recorrência seguinte.

A regra 9 diz *"crédito PAGO é da pessoa; só se zera crédito que nunca foi
pago"* — mas ela fala de **zerar crédito**, e o que está acontecendo é
**trancar o acesso**, o que na prática impede de gastar crédito já pago. As
duas ordens (regra 9 e a de 13/08 "sem assinatura = trancado") se cruzam aqui e
eu não vou decidir sozinho porque **mexe em dinheiro de aluno**.

Binária: *quem parou de pagar mas tem crédito comprado com dinheiro real
continua podendo gastar esse crédito, ou o acesso trava junto?*

## 7. Ferramenta nova

`_frank/ferramentas/estorno_confere.cjs` — confere estorno casando `ref_id`,
com as duas armadilhas escritas dentro (nunca por `kind`; regex no JSON erra
nos dois sentidos). **Use no lugar do `_Bugs/2026-08-19_dinheiro_pendurado.cjs`
na rotina**, como o `pagante_trancado.cjs` substituiu o `prova_raio.cjs`.

## O que eu não medi

- Quantas regenerações o portão do QA tenta antes de desistir (é olhar o
  `handler.py`, não o banco).
- Se os 20 da fronteira renovaram — só dá pra saber depois da virada de hoje.
- Os 273 restarts do pm2 anotados em 19/08 (não reconferi hoje).
