# 27/08/2026 — Relatório noturno (consolidado do dia)

Fecho às 22h BRT. Este arquivo é o detalhe técnico; a mensagem do Telegram só
aponta pra cá.

---

## 1. Produção: o que está NO AR, provado pelo build

⚠️ Critério: **BUILD_ID no servidor + o código minificado dentro do `.next`**.
Action verde não é prova (regra do 06).

| | |
|---|---|
| `BUILD_ID` | `bYHJe4dXudqtk8VwC88Gu` |
| Build gerado em | 27/08 **16:04 BRT** (19:04 UTC) |
| Processo `aiverse` (pm2) | reiniciado ~**17:00 BRT**, depois do build → serve este build |
| Último merge de CÓDIGO do dia | `6e3f981` (#161), **15:01 BRT** — antes do build |

**Prova de que o #161 está mesmo compilado** (não inferido por horário) —
trecho minificado em `.next/server/app/api/v1/webhooks/hotmart/route.js`:

```
).status;return"string"==typeof b?b.toUpperCase():""}(b),h="";
("CANCELED"===d||"CANCELLED"===d||"EXPIRED"===d||"INACTIVE"===d)&&
(await (0,x.NE)({provider:H,externalId:e,status:"EXPIRED"===d?"expired":"canceled
```

É exatamente o `subscriptionIsDead` do commit. Como esse foi o **último**
código do dia e ele está no build, tudo que foi mergeado antes também está.

Os dois merges depois do build (18:24 `5d1b8ea` ordem, 18:37 `383cacc`
ferramenta `telegram_video.cjs`) **não são código do app** — são documento e
ferramenta local. Nada de app esperando deploy.

### Código que subiu hoje

| Commit | Merge | O que corrige |
|---|---|---|
| `d066590` + `64be104` | `c50b60c` 07:43 | #11 — stderr do trainer para de morrer na porta |
| (PR #66) | `fde46b2` 07:51 | #147 — cena não morre por config |
| `7d030db` | `965557a` 14:56 | #52 — chunk alucinado para de repetir; resgate nível 2 |
| `8ad218d` | `dd1aab4` 14:56 | #158 — lixeira por cena existe; manual para de inventar |
| (PR #64) | `1c27bd2` 14:56 | onboarding não repete veredito velho |
| `6e3f981` | `69d9278` 15:01 | #161 — PURCHASE_COMPLETE com assinatura CANCELED não regrava `active` |

---

## 2. O muro: 3 migrations declaradas no git e AUSENTES no banco

Conferido por mim com `ddl_aplicado.cjs` (93 colunas, 49 scripts, 16 tabelas).
**Não** aceitei o "conferido" da ronda anterior — rodei de novo:

```
❌ 9 coluna(s) que o git manda existir e o banco NÃO tem:
   82_generations_runpod_timing.sql        generations.delay_seconds, execution_seconds
   96_training_jobs_cura_transcricao.sql   training_jobs.reference_cura_ramo,
                                           reference_cura_texto_antes,
                                           reference_cura_erro, worker_image
   97_training_jobs_trainer_stderr.sql     training_jobs.trainer_returncode,
                                           trainer_stderr, trainer_stdout
```

**Por que isso importa e é honestidade dura:** o código do #11 subiu hoje
(`c50b60c`), mas quem escreve nessas colunas é *best-effort* e cai no `catch`
em silêncio. Ou seja: **a telemetria parece ligada e não está medindo nada.**
Por isso eu NÃO estou contando o #11 como resolvido — ele segue aberto, hoje
com **37,1 dias**, que é o incidente mais velho da casa.

`98_entitlements_subscription_canceled_backfill.sql` também está escrito e não
aplicado (de propósito: mexe em 189 linhas de tabela de pagamento, precisa de
aval). Ele só muda `status`; não toca `access_until`, crédito nem `profiles`,
e grava a lista antes em `_backfill_161_entitlements`.

---

## 3. Um registro estava se perdendo (achado desta rodada)

O commit `c03832c` — a ronda das falhas de 28/08 01h, com a **causa provada do
#108** — estava só na minha máquina, em cima da branch
`fix/inc108-cura-transcript-gate`, **fora da main e fora de qualquer remoto**.

```
git branch -r --contains c03832c   →   (vazio)
```

É exatamente o modo de falha que o `03_ROTINA.md` descreve para as branches
perdidas do Vigia: trabalho feito que morre por não ter sido publicado. Trouxe
pra main junto com este relatório.

### O que aquela ronda provou (#108)

Não é a seleção do trecho, é a **cura**: `train_reference.py:149` faz
`texto = real or texto_previsto` sem conferência. O whisper alucina no silêncio
de cauda, então a cura escrita em 24/08 pra *apagar* cauda fantasma passou a
**escrevê-la**.

Prova com áudio — voz `a12d737d`, de aluno pagante, treinada 27/08 19:51,
**depois** de todos os fixes do dia:

```
banco:  "...dos sintomas Obrigado por assistir."
áudio:  "...dos sintomas."
```

PR #78 aberto e **não mergeado**: reduz a classe, não fecha. Alucinação por
apêndice tem cobertura 1,0 e só a lista fechada pega — limitação travada em
teste, não escondida.

---

## 4. Números do dia

| | Ontem (26/08 22h) | Hoje (27/08 22h) |
|---|---|---|
| Incidentes abertos | 6 | **7** |
| Fechados no dia | — | **19** |
| Aguardando aluno (fora da contagem) | 6 | **8** |
| Pagante trancado de verdade | 0 | **0** |
| PRs abertos | — | **23** |

Fechar 19 e terminar com 7 abertos (era 6) significa que **nasceram ~20 no
dia**. O saldo não piorou; o volume é que foi alto.

### Incidentes abertos, por idade

| Idade | Incidente |
|---|---|
| **37,1d** | `9ac03612` Treino de voz: trainer failed *(travado nas migrations 96/97)* |
| 4,1d | `73b9f772` Fix da referência (PR #16) não cura voz já treinada: falta backfill |
| 3,6d | `6e94acc6` Pré-venda sem dono: Sandra Diniz, 7 perguntas sobre Termos EM RASCUNHO |
| 0,5d | `f7600aba` Aluna pagante esperando "cura da voz" que ninguém sabe que foi pedida — acesso vence **31/08** |
| 0,5d | `be0e3ed4` E-mail do aluno abre e fecha o chamado no mesmo segundo (5 casos; Cássio na 6ª cobrança) |
| 0,1d | `1c56eb7a` O botão que treina voz se chama "Gerar Nova Voz" — 25 alunos pararam nessa tela |
| 0,1d | `8347af4b` `speech_rate_wps` lida em 3 pontos, escrita em zero — 1.010/1.012 vozes NULL |

### Varredura

- **1** linha obsoleta em `training_jobs` (job `ebf5cc56` → voz `f4b9b0f2` já
  `ready`): escrituração pendente, **ninguém esperando**.
- **3** com acesso vivo + crédito e nenhuma voz pronta — e nenhum é silêncio
  nosso, os três têm motivo gravado e resposta:
  - `leandro.fitoway@gmail.com` — 28d — recusa por envio incompleto (6 de 14
    arquivos chegaram). Classe do #72.
  - `marcelopersonalthe32@gmail.com` — 18d — áudio com mais de uma pessoa
    falando (gravação de entrevista).
  - `kelinnavelar@icloud.com` — 15d — 19min < mínimo de 20min. **Avisada hoje**
    (`772bb29`).
- **0** pagante trancado, conferido na Hotmart viva (93 suspeitos checados um a
  um; 6 cancelaram, 75 inadimplentes, 12 trial que nunca virou pagamento —
  trancar está certo nos três casos).

---

## 5. O que eu decidi sozinho hoje (e por quê podia)

Pela lista do `06_RELATORIO_E_LIMITES.md` ("decida sozinho"): fechar incidente,
responder aluno, refazer por conta da casa, estornar falha nossa.

- #162 — áudio refeito **por conta da casa**, aluno pagante respondido após
  4h30 sem ninguém ter escrito.
- 14.400 créditos estornados + "falha técnica" pra 3 alunos (cenas de 13–19/08).
- #153 — 5 alunos atendidos. #160, #157 — alunas respondidas.
- Publiquei `c03832c` na main (documento; resgate de trabalho que se perderia).

Nada irreversível. Nada que gaste dinheiro novo. Nada de migration.
