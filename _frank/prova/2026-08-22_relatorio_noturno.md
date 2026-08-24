# 22/08 — Relatório noturno (consolidado do dia)

Fechado ~01h UTC de 23/08. Este arquivo é a prova técnica; o Telegram levou só
o resumo e o caminho daqui.

---

## 1. Produção — o que está NO AR agora (verificado, não deduzido)

| | |
|---|---|
| Commit no ar | **`acc2459`** (= `main`) |
| BUILD_ID no servidor | `XZlhHVgCRbNhFkel1ZUL1` |
| Build feito em | 2026-08-23 **00:56:09 UTC** (merge do `acc2459` foi 00:54 UTC) |
| pm2 `aiverse` | **online**, uptime 5min na hora da medição |
| Commits no dia | **30** (sem contar merges), **4 PRs** mergeados |

**Como confirmei — e por que isso importa.** O servidor
(`/mnt/volume/aiverse/frontend`) **não é um checkout git**: `git rev-parse` lá
devolve `fatal: not a git repository`. Então "o commit X está no ar" não pode
ser lido do servidor e **Action verde não prova deploy**. Comparei **md5 dos
arquivos-fonte** entre a `main` local e o servidor:

| arquivo | local (`acc2459`) | servidor | bate? |
|---|---|---|---|
| `src/lib/images/sweep-stuck.ts` | `9600f7d1…` | `9600f7d1…` | ✅ |
| `src/lib/images/sweep-stuck-core.ts` | `fd699418…` | `fd699418…` | ✅ |
| `src/lib/onboarding/audio-tipo.ts` | `ecb59b40…` | `ecb59b40…` | ✅ |
| `src/lib/onboarding/import.ts` | `6d3fea99…` | `6d3fea99…` | ✅ |

**Isso fecha um buraco aberto há 4 rondas.** As rondas das 21h, 22h, 23h e a do
vigia das 00h registraram, todas, *"continuo não tendo confirmado se os commits
`74ae65a`/`1e5a893` estão em produção"*. **Estão** — `audio-tipo.ts` (o arquivo
que esses dois commits criaram/alteraram) bate byte a byte com a `main`.

Consequência prática: a leitura do `acf8acd6` (fechado que ainda dispara) pode
finalmente ser feita, porque agora se sabe que a correção está no ar. O contador
dele está parado há ~5h — mas **metade dessa janela foi o apagão**, então o
número ainda está contaminado. Quem decide é a próxima ronda com tráfego normal.

---

## 2. O apagão (`ca8edb0b`) — resolvido, causa intacta

Produção fora do ar **~1h24**: Supabase devolvendo `402 exceed_egress_quota` em
`/rest`, `/auth` e `/storage` — a base inteira. Johnny assinou o plano, serviço
voltou. Vigia reconferiu na mão: `auth/v1/health` 200, `storage/v1/bucket` 200,
`rest/v1` 401 (esperado com chave anon). **De pé de verdade.**

O que **não** foi tocado:

- **A causa.** O gasto é **quantidade de requisição**, não tamanho:
  `claim_render_job` 1,55M · `UPDATE profiles.last_seen_at` 1,8M · polling de
  `video_clones` 1,4M ≈ **7,5M requisições em 98 dias**, com banco de **8MB** e
  **zero** objetos em storage. O plano novo levanta o teto; o polling que encheu
  o teto segue igual. **A data do próximo 402 é aritmética, não azar.**
- **Não existe monitor de cota.** O detector de "produção fora do ar" hoje é o
  e-mail do aluno: caiu ~22:47, o Daniel avisou 23:36 — **~49 minutos de
  plataforma morta sem ninguém do nosso lado saber.**
- Não sei quanto de folga o plano novo comprou (não tenho teto nem consumo
  atual). **Não meço, então não afirmo que está confortável.**

---

## 3. Michell (`e3c5e445`, #92) — o caso mais grave do dia, FECHADO

Pagante de **hoje** (assinou 21:25, R$97/100.000 créditos), primeira ação na
plataforma, subiu 19 áudios (~27min), clicou treinar e caiu no 402. Quando o
vigia abriu, **não existia row de voz nenhuma** e a suspeita real era que os 27
minutos de áudio tivessem se perdido.

Desfecho medido row a row: **nada se perdeu e não houve cobrança indevida.**
Com o serviço de volta ele reenviou 18 arquivos, a voz `6b335305` ficou
**READY às 00:19 com 23min32**, e ele já gerou dois áudios (00:24 e 00:40).
Saldo **89.600 = 100.000 − 10.000 − 400**, conferido **por `ref_type`**, nunca
por `kind` (armadilha da ordem de 20/08). Aluno avisado por e-mail.

Sem conserto de código: a causa era o apagão, tratado no `ca8edb0b`.

---

## 4. Daniel (`85ffef6b`, #93) — medido hoje, hipótese principal REFUTADA

O vigia abriu com 3 hipóteses e sinalizou que, na hipótese 1, **haveria dinheiro
do aluno parado sem contrapartida**.

Conferi na **Hotmart** (`pagou_de_verdade.cjs`):

```
danielltozello@gmail.com
  NUNCA PAGOU | assinaturas: 0 | PURCHASE_APPROVED>0 no nosso banco: 0
```

**Hipótese 1 está refutada: não há dinheiro dele parado.** Sobram a 2 e a 3 —
comprou o **curso** e entende que isso dá acesso à plataforma, ou tentou pagar e
falhou sem perceber. Conta criada 22/08 21:10 UTC (~1h37 **antes** do apagão),
sem acesso, 0 créditos, 0 transações, 0 vozes.

**Não respondi o aluno.** Dizer a quem se diz pagante que ele não tem assinatura
é chamada **comercial**, não técnica. Anotado no chamado (`agent_notes`, gravação
conferida na releitura: 1 linha afetada) e subido pro Johnny.

---

## 5. O padrão que apareceu hoje

**Os 3 chamados que sobraram abertos não são bug — são expectativa de produto.**

| quem | o que pede | natureza |
|---|---|---|
| Kessuly (`7963388e`) | estorno de 9.240 créditos de vídeo **entregue** porém ruim | comercial |
| Daniel (`85ffef6b`) | acesso "como cliente pagante" sem nunca ter pago | comercial |
| Luciano (`07af5758`, fechado) | clone feito pela equipe + vídeo de 45min que o Reel promete | comercial |

O Luciano aponta (uid 242, sem resposta até agora) que **o marketing promete
enviar vídeo de 45min+ pra treinar o clone e não existe onde enviar vídeo na
plataforma**. Daniel e Luciano são a mesma confusão vista duas vezes no mesmo
dia. Isso não se resolve no plano técnico e por isso **não virou chamado
técnico** — mascararia a natureza.

**Kessuly, o número:** extrato conferido por `ref_type`. Débito de **−9.240**
(`ref_type=video_clone`) em 19/08 18:43. **Não existe nenhum
`video_clone_refund` pra ela — os 9.240 não voltaram.** Ela já foi estornada
antes (`+10.000 voice_train_refund`, 19/08 18:00), então sabe como e em quanto
tempo o crédito costuma voltar. Perguntou **duas vezes** (uid 249) e a pergunta
do crédito segue **sem resposta nenhuma**. Não mexi em crédito e não sugiro
valor: estornar trabalho entregue-porém-ruim é chamada de dono.

---

## 6. Estado da fila

| | |
|---|---|
| Total na tabela | **93** incidentes |
| `fixed` | 73 · `ignored` 17 |
| **Abertos agora** | **2 open + 1 investigating** |
| Abertos hoje | 14 |
| Fechados hoje | **12** |

Abertos, com idade (medida ~01h UTC 23/08):

1. `85ffef6b` (#93) **Daniel** — `open`, ~46min. Comercial (acima).
2. `7963388e` **Kessuly promessa sem dono** — `open`, ~2h50. Comercial (acima).
3. `69f0aec5` **imagem presa pra sempre** — `investigating`, ~2h55. **Código já
   subiu** (`6e89d95`/`acc2459`, sweep de `pending`/`generating`); fica em
   investigating até a próxima ronda provar que o sweep pega sozinho.

---

## 7. Varredura — 6 tabelas, nada preso

| tabela | erro | presos agora |
|---|---|---|
| `voices` (uploading/validating/training) | none | 0 |
| `training_jobs` (queued/running) | none | 0 |
| `generations` (pending/processing) | none | 0 |
| `image_generations` (pending/generating) | none | **0** (era 1 de manhã) |
| `video_clones` (pending/generating) | none | 0 |
| `react_jobs` (fila/baixando/clonando/montando) | none | 0 |

**Nenhuma consulta falhou** — conferido imprimindo o `error` cru de cada uma,
porque zero silencioso de coluna inexistente já cravou causa errada antes. Eu
mesmo bati nessa armadilha nesta ronda: pedi `incidents.notes`, que **não
existe** (HTTP 400). Se eu não imprimisse o erro, teria virado "sem notas".

**Nada preso nem depois do apagão** — 1h24 de banco fora do ar com aluno no meio
de geração era a suspeita principal e **não se confirmou**.

---

## 8. Pagantes

- **Pagante trancado: 0.** 86 contas suspeitas conferidas **uma a uma na
  Hotmart**. Ninguém que pagou está sem acesso. 0 na fronteira, 0 sem prova.
- Trancado corretamente (ordem de 13/08): 31 cancelaram · 46 inadimplentes ·
  9 trial que nunca virou pagamento.
- **Pagante com crédito e sem nenhuma voz pronta: 4** — este é o número que
  não melhorou hoje:

| aluno | créditos | parado desde | idade | último erro |
|---|---|---|---|---|
| `jrfengenhariadf@` | 100.000 | 25/07 | **28d** | `rejected_too_short` — 4 de 7 arquivos chegaram |
| `leandro.fitoway@` | 97.620 | 30/07 | **23d** | `rejected_too_short` — 6 de 14 arquivos chegaram |
| `ivanildezuca@` | 200.000 | 08/08 | **14d** | `failed` — ~6min úteis, mínimo 10min |
| `marcelopersonalthe32@` | 198.950 | 10/08 | **13d** | `failed` — problema técnico nosso |

Os dois primeiros são **arquivo que não chegou** (3 de 7, 8 de 14) — é
exatamente a família de defeito que a onda de correções de onboarding de hoje
ataca. Nenhum dos 4 foi reprocessado depois das correções. **Isso é trabalho
concreto pra próxima ronda**, não um número pra contemplar.

---

## 9. Números que mudaram de ontem pra hoje

| | 21/08 | 22/08 |
|---|---|---|
| Vozes criadas | 15 | **42** |
| Vozes `ready` | 15 | **37** (5 não) |

Quase **3× o volume** de ontem. Não atribuo causa: parte pode ser a onda de
correções de onboarding, parte movimento de lançamento. **Não medi qual**, então
não afirmo.

---

## 10. O que NÃO foi verificado (não conte como saúde)

- **Quanto de folga o plano novo do Supabase comprou.** Não sei o teto nem o
  consumo. Toda tranquilidade sobre "não cai de novo" é suposição.
- **GPU e sweep por SSH** — não olhei o estado da GPU. É a **quinta ronda
  seguida** com esse buraco.
- **Se Katia e Kessuly foram respondidas.** A pasta `Sent` **não é registro do
  que sai** (a Fast envia por SMTP/API sem gravar lá) — `--enviados --para`
  devolve vazio pra *qualquer* aluno, inclusive os comprovadamente respondidos.
  **Zero ali não prova nada.**
- **Se os 5 `voices` não-`ready` de hoje são falha nossa** — vi o número, não
  abri um a um.
- **Quem tentou usar durante o apagão e desistiu sem escrever.** Os dois que
  apareceram escreveram; os silenciosos não têm como ser vistos.

---

## 11. Higiene do repositório

Continuam **não commitados** na `main`, de rondas anteriores (não são meus):

- `_frank/prova/lgpd/` — untracked, decisão consciente da rotina das 22h (dado
  pessoal de aluna).
- modificados: `_frank/ferramentas/resgatar_voz.cjs`,
  `_frank/ferramentas/2026-08-21_medir_8379549c.cjs`.

Commitei **apenas este arquivo**, por caminho explícito.
