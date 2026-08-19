# Relatório noturno — fecho de 18/08 (escrito 19/08 ~01:30 UTC)

Consolida o dia inteiro. Tudo abaixo foi **medido agora**, não herdado das
rodadas anteriores. Onde a medição contradisse uma nota antiga, vale a medição.

---

## 1. Produção: o que está no ar, provado no servidor

`BUILD_ID` = `ds91Z74JPRxg--Oeg3oM5`, compilado **19/08 01:14:27 UTC**.
`pm2 aiverse` **online**. Método do playbook P: não basta commit nem Action
verde — o marcador tem que aparecer no bundle compilado que está rodando.

| Commit | O que faz | Marcador procurado | No bundle |
|---|---|---|---|
| `8aa72d5` | Cancelamento Hotmart revogava no-op silencioso | `SUBSCRIPTION_CANCELLATION` | **4 arquivos** ✅ |
| `4181a14` | Áudio mudo não vai pra GPU nem é cobrado | `"sem som"` | **20 arquivos** ✅ |
| `04c8831` | Avisa áudio mudo na escolha do arquivo | `"sem som (mudo)"` + chave i18n | **19 arquivos + 1** ✅ |
| `b9c4c9c` | Botão Gerar explica o que falta | `"Escolha uma foto para continuar"` | **19 arquivos** ✅ |
| `1c09508` | `elapsed_seconds` na falha | `elapsed_seconds` | **7 arquivos** ✅ |
| `4418b0e` | `delayTime`/`executionTime` na falha | `delayTime` | **0 arquivos** ❌ |

### `4418b0e` NÃO está no ar — e está certo assim

- `src/lib/generations/runpod-timing.ts` **não existe** no servidor.
- `delayTime` = **0** ocorrências em todo o `.next/server`.
- As colunas `delay_time_ms` / `execution_time_ms` **não existem** em
  `generations` (só `duration_seconds` e `elapsed_seconds`).

Ele depende da **migration 82**, que não foi aplicada porque migration exige
aval do Johnny (`06_RELATORIO_E_LIMITES.md`). Código commitado, migration
escrita, nada aplicado. É a pergunta 2 do relatório.

### Armadilha em que quase caí

Grepei `"Array must not contain infs or NaNs"` para provar o `04c8831` e deu
**0**. Quase reportei "não subiu". A string só existe em **comentário** — o
minificador remove. Marcador de deploy tem que ser string que sobrevive ao
build: **texto de UI ou chave de tradução**, nunca comentário.

---

## 2. Incidentes

**Abertos agora: 1.**

| ID | Título | Status | Occ | Primeira vez | Idade | Última |
|---|---|---|---|---|---|---|
| `d3d8d1b2` | Geração de áudio: tempo de execução estourado | investigating | 13 | 30/07 13:01 | **19 dias** | 18/08 20:46 |

Continua `investigating` e não `fixed` pela regra 14: a hipótese viva (job que
nunca executou / cold start) **não tem prova**, porque o status do job no
RunPod expira em ~30min. É exatamente esse buraco que a migration 82 fecha.

**Fechados de 18/08 pra cá: 5.**

| Quando | Status | ID | Caso |
|---|---|---|---|
| 18/08 11:04 | fixed | `7ef161ee` | Aluno travado — Gerador de Imagem (ricardopereirawinckler) |
| 18/08 11:04 | fixed | `0fa1dacd` | Idem (registro duplicado do mesmo caso) |
| 18/08 13:04 | fixed | `270a58bc` | Treino de voz: erro desconhecido |
| 18/08 18:12 | fixed | `b7d31552` | Fast: aluna não gerava vídeo (botão Gerar mudo) |
| 19/08 00:12 | ignored | `2663506d` | Rajada Vídeo Clone fcdnanda — **áudio mudo, causa provada** |

### O `2663506d` derruba um pedido meu de horas antes

Na rodada das 23h eu pedi autorização pra **reproduzir o caso da fcdnanda por
conta da casa, gastando GPU**. Não precisa mais: a causa apareceu sem gastar
nada — os 3 jobs usaram o **mesmo arquivo de áudio, e ele estava mudo**. O
pedido está **retirado**, e a correção pra impedir a repetição já está no ar
(`4181a14` + `04c8831`).

---

## 3. Varredura e filas

`varredura_travados.cjs`: **0 itens presos** em 6 tabelas (`voices`,
`generations`, `image_generations`, `video_clones`, `react_jobs`,
`training_jobs`). O script imprime `⚠️ tabela: erro` quando a consulta falha e
não imprimiu nenhum — **o zero é dele, não meu**.

**Falhas nas últimas 24h: 7**, todas com estorno casado pelo `ref_id` do job
(soma zero, ninguém no prejuízo):

| Tabela | Falhas |
|---|---|
| `generations` | 2 |
| `video_clones` | 3 |
| `voices` | 1 |
| `training_jobs` | 1 |
| `image_generations` | 0 |

> `react_jobs` não pôde ser contada por data: **não tem coluna `created_at`**.
> A consulta **falhou alto** em vez de imprimir zero. Itens presos nela estão
> cobertos pela varredura (0), mas a contagem de falhas por período fica em
> aberto — não estou afirmando que é zero.

**Entregas com sucesso nas 24h: 406** — 122 áudios, 186 imagens, 98 vídeos.
A plataforma produziu o dia inteiro; as 7 falhas são 1,7% do movimento.

---

## 4. O zerador de crédito está desligado — provado no log, não na nota

A `expire_trial_credits` é chamada pelo sweep a cada 5 min **sem flag no
código**. Fui verificar se a afirmação "continua desligada" era real. É:

```
2026-08-19T01:20:03 [sweep-clones] expiração de trial FALHOU:
  {"ok":false,"error":"DESATIVADA MANUALMENTE 18/08: deteccao de pagante
   errada, zerou 14 pagantes. Nao reativar sem novo teste."}
```

A trava está **dentro da função no banco**, que é o lugar certo: mesmo que o
código chame, ela não executa. Confirmado também pelo efeito: **0 débitos
`trial_expirado` novos** desde os 13 de 18/08 18:45.

Bônus: o sweep está **vivo**, rodando de 5 em 5 minutos (último 01:20:03).
Isso responde o item 4 da rotina com prova.

### Achado novo: a trava certa está gritando errado

Essa linha entra no log como **`FALHOU`, a cada 5 minutos — ~288 vezes por
dia**. É a trava funcionando, mas registrada como falha. O manual avisa que
"cron que morre é silencioso"; o inverso também machuca: **alarme constante
que é normal treina a gente a ignorar o log**, e a falha de verdade vai passar
no meio dessas 288. Desligado de propósito devia logar como *desligado*, não
como *falhou*. Não mexi — não é urgente e é mudança de comportamento em
produção. Fica registrado.

---

## 5. Os 13 do saldo — decisão parada, dinheiro parado

Estado conferido conta por conta agora:

- **13/13 contas** localizadas.
- `credits_subscription` somados: **1.256.554** ← é isto que a regra manda zerar
- `credits_extra` somados: **284.005** ← a regra **nunca** toca nisto
- Total nas contas: 1.540.559
- **0 com acesso ativo**
- **0 marcados `ja_pagou = true`** (como esperado — nenhum pagou)

**Ninguém gastou nada.** As 26 movimentações desde 18/08 são exatamente 13
débitos `trial_expirado` (o zeramento das 18:45) e 13 estornos
`estorno_de_engano` (a devolução das 18:46). Filtrei por `amount < 0` e
confirmei o `ref_type` de cada um: **13 de 13 são `trial_expirado`, nenhum é
consumo**. Eu tinha rotulado esses débitos como "consumo real" no rascunho e
o rótulo estava errado — conferi antes de mandar.

Ou seja: o dinheiro está intacto e a janela de exposição continua sendo aquele
1min34s. A decisão pode esperar sem custo, mas não deve sumir do radar.

---

## 6. Backfill do `ja_pagou` nunca rodou

A migration 79 **está aplicada** (as 3 colunas existem em `profiles`), mas:

- `ja_pagou = true`: **0**
- `ja_pagou = false`: **1.244**
- nulos: 0 — de 1.244 perfis

O backfill era o segundo passo, separado de propósito, e não foi executado.
**Hoje isso é inerte:** grepei o código inteiro e **nenhum arquivo `.ts`/`.tsx`
lê `ja_pagou`** — só a própria migration menciona. Não existe caminho em que
esse `false` universal zere alguém.

O risco é **futuro e conhecido**: no dia em que alguém escrever a regra "zera
quem tem `ja_pagou = false`" antes de rodar o backfill, ela zera **as 1.244
pessoas**, inclusive quem pagou. O backfill tem que vir **antes** de qualquer
leitor dessa coluna. Registrado aqui pra não ser descoberto do jeito caro.

---

## 7. Nada foi feito sem aval

Nenhum crédito mexido, nenhuma GPU disparada, nenhuma migration aplicada,
nenhum e-mail enviado, nada apagado. As leituras acima são todas somente
leitura. Scripts em `/tmp/frank-rel/` (descartáveis; as consultas estão
transcritas neste documento).

## 8. Duas notas de método que valem pro próximo

1. **Marcador de deploy não pode ser comentário** (seção 1). Custou um falso
   "não subiu".
2. **Filtro em JS sobre coluna que não existe devolve zero calado.** Filtrei
   incidentes por `updated_at` — coluna que **não existe** na tabela (é
   `resolved_at`) — e recebi "0 fechados hoje", quando eram **5**. O Supabase
   não errou: eu li `undefined` em JavaScript e comparei string. A trava do
   `03_ROTINA.md` ("cheque o `error`") **não pega este caso**, porque não há
   erro nenhum. A defesa é conferir o nome da coluna na resposta antes de
   filtrar por ela.
