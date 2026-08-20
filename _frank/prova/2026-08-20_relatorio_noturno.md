# Relatório noturno — fecho de 19/08 (escrito 20/08 ~01:30 UTC / 19/08 22:30 BRT)

Tudo abaixo foi **medido agora**, contra produção. Onde a medição contradisse
uma nota anterior, vale a medição. Nada foi marcado resolvido sem prova.

---

## 1. O incidente que fechou: `72a4c9db` — o e-mail que chamou cliente de estranho

**Fechado 20/08 01:09 UTC, commit `c5f67bd`, PR #13 (merge `18ef715`).**

`orphan-outreach.ts` decidia quem "comprou e nunca criou conta" com
`profiles.select("email")` **sem range**. O PostgREST corta em **1000 linhas em
silêncio** (sem erro) e `profiles` tem **1294**. Os ~294 de fora do Set viravam
"órfão" e recebiam *"seus créditos estão reservados, falta só criar sua conta"*.

**105 clientes ATIVOS** levaram esse e-mail entre 04 e 19/08 — **30 só em 19/08**.
Piorava sozinho: a base cresce, o teto não.

A mesma função tinha o mesmo bug em `payment_events` (1099 PURCHASE_APPROVED,
já estourado) na direção inversa: comprador de verdade sumia da varredura.

### Prova de que está valendo (conferida por mim, não aceita do worker)

- Deploy run `32319580920` = success; `BUILD_ID` **nB74MgIhm2EQASqjtFJ4S**,
  compilado **20/08 01:04:23 UTC**; `pm2 aiverse` reiniciado.
- Réplica read-only da lógica nova contra produção, **0 e-mail enviado**:
  órfãos **203 → 52**, **151 falsos positivos** eliminados, **0** caso na
  direção inversa (o fix não cria falso negativo).
- O cron `0 14 * * *` de hoje já roda com o código corrigido.

**O que isto NÃO resolve:** os 105 continuam com o e-mail errado na caixa.
Comunicação é decisão do Johnny — **não mandei nada**.

---

## 2. O caso do Luciano (`lucvila`) — diagnóstico fechado, resposta represada

Incidente `43f37482`, aberto 19/08 23:30 UTC.

Ele escreveu *"meus créditos não foram atualizados, conforme print abaixo"*.
Na rodada anterior eu **não respondi de propósito**: a mensagem tinha um print
e o `ler_caixa` não baixava anexo. Responder "seu saldo está certo" pra quem
mandou uma foto que eu não abri é a regra 11 na veia — foi o que fez uma aluna
explodir em 17/08.

Hoje a ferramenta ficou pronta (card `398c68e0`) e **eu abri o print**:

- o print mostra o dashboard dele com **13.409 créditos**, conta ativa,
  logado como `lucvila@gmail.com`. A conta está funcionando.
- `aluno.cjs`: conta desde 29/07, **acesso ATIVO até 30/08**, 1 compra
  (30/07), 1 voz `ready`, **Vídeo Clone quase diário** — último 19/08 17:04,
  gastando 6.160 créditos.
- extrato: os débitos são todos consumo dele (Vídeo Clone / Animar imagem).
  **Nada devido, nada travado.**

**Causa real:** ele recebeu em 18/08 o e-mail errado do item 1 — *"seus créditos
estão prontos, falta só criar sua conta"* — tendo conta ativa desde 29/07. Leu
aquilo, olhou o saldo e concluiu que faltava crédito. **A reclamação dele é
sintoma do bug do orphan-outreach, não de um problema de crédito.**

A resposta está pronta e não foi enviada: é pedido de desculpa por um e-mail que
atingiu **105 pessoas**, e o tom dessa comunicação é decisão do Johnny (item 1).

Prova do anexo, sem atropelar a Fast: `flags do uid 179 antes [\Seen] · depois
[\Seen] ✓` · `não-lidos no INBOX antes 0 · depois 0 ✓`.

---

## 3. Achado novo: a varredura é CEGA pro estado `awaiting_training`

`varredura_travados.cjs` imprimiu **"0 itens presos"** hoje. O zero é honesto
pro que ele olha — e **ele não olha esse estado**.

`ALVOS` (linhas 20-28) cobre `voices` em `uploading`, `validating` e `training`.
**Não cobre `awaiting_training`.** Medido agora em produção:

| | |
|---|---|
| vozes em `awaiting_training` | **27** |
| com mais de 24h | **23** |
| mais antigas | **36,9d** · 33,7d · 31,2d · 28,1d |

**Não é incêndio, e a diferença importa.** `awaiting_training` é estado
legítimo de espera: o treino só dispara quando o aluno aciona **e** tem crédito
(`onboarding/treino.ts:10`, `start-training/route.ts:93`). Voz de quem não pagou
fica ali de propósito.

**Conferi um a um:** todo usuário **ATIVO** com voz em `awaiting_training`
**já tem pelo menos 1 voz `ready`**. **Nenhum pagante está sem voz por causa
disso.** Os 14 sem acesso têm 0 crédito — é o funil, não é bug.

O problema é de **visibilidade**: se um pagante cair nesse estado, a varredura
diária **nunca vai mostrar**. É a mesma classe de zero silencioso que deixou 43
vozes paradas por semanas. Card aberto pro `coder` (listar em seção própria e
destacar só o recorte que caracteriza pagante parado: acesso ativo + crédito +
áudio no R2 + zero voz `ready`).

---

## 4. Produção — o que subiu e a prova no servidor

**19 deploys de frontend, 19 success, 0 falhos.**
`BUILD_ID` **nB74MgIhm2EQASqjtFJ4S** (20/08 01:04:23 UTC).

Método do playbook P: não basta commit nem Action verde — o marcador tem que
aparecer no bundle que está rodando. Marcador = texto de UI/chave i18n, nunca
comentário (essa armadilha custou um falso "não subiu" em 18/08).

| Marcador procurado | Arquivos no bundle |
|---|---|
| `Tentamos 3 vezes` (retry do upload R2) | 20 ✅ |
| `Nas extras` / `Adicionar como extra` | 20 ✅ |
| `Referência atual` / `Histórico de Imagens criadas` | 19 ✅ |
| `escolha lá a principal e as extras` | 19 ✅ |
| `Tente de novo em alguns minutos` (SupportError) | 21 ✅ |
| `Seguir sem narração` | 19 ✅ |
| `generation.audio.truncado` (áudio cortado recusa+estorna) | 2 ✅ |
| `heygen_accounts` (motor HeyGen no seletor) | 5 ✅ |
| `orphan_invites` | 1 ✅ |

### Migrations — conferidas uma a uma contra produção

As migrations de que os recursos de hoje dependem **estão aplicadas** (nenhum
recurso subiu apoiado em coluna inexistente):

| Migration | Estado |
|---|---|
| `82_video_projects_product_idea` | **APLICADA** |
| `83_video_scenes_image_started_at` | **APLICADA** |
| `84_video_projects_sem_narracao` | **APLICADA** |
| `82_generations_runpod_timing` | **FALTA** — aguarda aval |
| `85_support_mail_replies` | **FALTA** — proposta, branch não mergeada |

### Worker (RunPod) — deploy separado do frontend

- `d9a14c0` (QA não reprova número falado + markdown/emoji não vai pra GPU):
  build success, **vivo desde ~19:20 UTC**.
- `6af76ae` (QA de INTRUSÃO — palavra a mais/trocada regenera o chunk):
  build **AINDA RODANDO** (started 00:31 UTC, ~1h no passo *Build and push*).
  **NÃO está em produção.** Builds anteriores levaram 27m50s e 48min, então a
  duração ainda é plausível — mas afirmar que está no ar seria mentira.

---

## 5. Estado geral (medido agora)

| | ontem (18/08) | hoje (19/08) |
|---|---|---|
| entregas com sucesso | 406 | **506** |
| falhas | 7 | **12** (2,3% do movimento) |
| itens presos na varredura | 0 | **0** (com a ressalva do item 3) |
| pagantes trancados | 0 | **0** |
| incidentes abertos | 1 | **4** |

Entregas de hoje: **261 imagens · 113 áudios · 76 vídeos clone · 28 vozes ·
28 treinos**.

### As 12 falhas: ninguém no prejuízo

Todas as 12 têm estorno casado pelo `ref_id`, **soma zero** conferida uma a uma.
As 3 falhas de treino de voz batem exatamente com as 3 vozes `failed` (o
`training_job` é filho, a cobrança fica na voz).

⚠️ **Padrão a vigiar:** as 3 falhas de treino de voz têm **erro idêntico** —
`ffmpeg stereo 44k failed: Output file #0 does not contain any stream`, ou seja,
arquivo sem faixa de áudio. Foram estornadas sozinhas, mas os 3 alunos ficaram
sem a voz. É a mesma família do "áudio mudo" corrigido em 18/08 (`4181a14` /
`04c8831`). 3 casos em um dia merece olho, não conclusão — não abri incidente
porque ninguém está travado e o estorno funcionou.

### Incidentes abertos — 4, com idade

| ID | Caso | Idade | Estado |
|---|---|---|---|
| `d3d8d1b2` | tempo de execução estourado | **21 dias** | travado na migration 82 |
| `37bacb68` | qa_coverage: áudio não contém o texto completo | 7h | 9 ocorrências |
| `fb8d29b7` | QA não mede inserção/substituição | 6h | lista de estorno esperando decisão |
| `43f37482` | Luciano / créditos | 2h | diagnóstico fechado (item 2) |

**`d3d8d1b2` continua `investigating`, não `fixed`, pela regra 14:** a hipótese
viva não tem prova porque o status do job no RunPod expira em ~30min. É esse
buraco que a migration 82 fecha. Sem ela, esperar 470 gerações limpas mede o
caminho feliz e não diz nada sobre a causa.

---

## 6. O que eu não fiz

Não mandei e-mail pra aluno, não mexi em saldo, não gastei GPU, não apliquei
migration, não mergeei branch sem revisar, não fechei incidente sem prova.
Único toque em produção foi o PR #13, revisado antes do merge.

Oito branches seguem fora da `main` — entre elas
`feat/gravar-enviados-imap-append`, que **não mergeei de propósito**: ela abre
conexão IMAP com LOGIN a cada e-mail enviado, e a Fast lê essa mesma caixa de
5 em 5 min. Se esbarrar em limite de conexão numa rajada, o que quebra é o canal
de suporte inteiro — a mesma falha que deixou a Fast 2 dias muda em 08/08.
Merece deploy de dia com alguém olhando.
