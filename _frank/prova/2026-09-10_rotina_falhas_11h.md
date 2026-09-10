# Ronda das falhas — 10/09/2026, 11hZ (08h BRT)

Dono da fila (14-A). Backlog **serial**: peguei **um** caso e levei até onde dá.
Escolhi o `3528dd59` (**#331**) porque é aluno **pagante**, com pedido de
**reembolso** feito às 23:06 BRT e **~8h sem resposta humana** — prioridade
declarada ("aluno esperando vem ANTES da limpeza da fila").

Repo em `main`, `pull --ff-only`. Índice de ordens lido antes de tocar em nada.
Ordem de **29/08** respeitada: nada da planilha lido, escrito ou reprocessado.
Ordem de canal de **31/08**: o aviso desta ronda foi **no grupo**.

---

## O caso: o conselho estava certo, o aluno obedeceu, e a nossa caixa destruiu a prova

O Vigia (10hZ) mediu o loop de recusas e **não abriu chamado**, corretamente,
porque o conserto já existe em PR. Eu peguei o caso pelo outro lado: **o que o
aluno estava tentando dizer?**

### 1. A queixa dele nunca foi o anexo

Está no uid **545**, no meio da briga:

> *"No clone de 1:04 a movimentacao da boca esta robotica e nao condiz comigo"*

O anexo era só a **prova** que ele tentava entregar. A máquina discutiu o
envelope e nunca leu a carta.

### 2. Ele não estava travado — e isso muda o diagnóstico

`aluno.cjs` mostra que ele **continuou produzindo a noite toda, depois do pedido
de reembolso** (02:06Z): clones `ready` às 02:16, 02:55, 03:25 e 03:54Z, imagens
até 04:19Z. **7 `video_clones`, todos `ready`, nenhum `raw_error`.** Não é
apagão, não é GPU, não é crédito preso. É **qualidade**.

### 3. A causa da boca robótica, medida

Os 7 clones usaram como fonte **imagem gerada na própria plataforma**
(`<uid>/images/<id>/result.png`): cenas largas de estúdio/escritório, pessoa
sentada, microfone e cenário no quadro, **rosto ocupando por volta de 1/6 da
altura**.

Baixei **5 das 6** fontes distintas do R2 (`b832ef36` = `NoSuchKey`):

| criado | dur | créditos | fonte |
|---|---|---|---|
| 23:43Z | 84,92s | 6.800 | `b832ef36` |
| **00:59Z** | **66,60s** | **5.360** | `8f1e389c` ← o *"clone de 1:04"* |
| 01:23Z | 84,92s | 6.800 | `f3cd2b0e` |
| 02:16Z | 48,37s | 3.920 | `f3cd2b0e` |
| 02:55Z | 48,37s | 3.920 | `c72b6615` |
| 03:25Z | 48,37s | 3.920 | `4304d732` |
| 03:54Z | 49,08s | 4.000 | `ba81cc49` ← última tentativa, **ainda cena larga** |

**Hipótese descartada por medição:** as 5 fontes são **940–941 × 1672**, razão
**0,562 = 9:16 exato**. O `keep_proportion: "crop"` do template (`workflow.ts:12-23`)
**não tira nada** — não há perda de enquadramento por proporção. Testei e o
sinal é negativo; registro pra ninguém repetir a conta.

**Agravantes:** os 7 rodaram em `480p-v2` (**Turbo**, econômico e não
determinístico) e não no padrão `480p-v3`; e todos duram **48–85s**, acima dos
**~40s** que o próprio `config.ts:45` documenta como zona de degradação.

### 4. A foto que ele mandou 4 vezes está certa

Baixei o `01.png` do uid **546** (1290×1268) e **abri**: recorte cabeça-e-ombros,
frontal, boca visível, **rosto perto de metade da altura**. Ele fez
**exatamente** o que a Fast pediu no uid 1553 (*"vale recortar a foto mais de
perto — cabeça e ombros"*, limiar *"rosto ~1/3 da altura"*).

**E nunca usou esse recorte em clone nenhum.** Ele não estava pedindo ajuda: ele
estava pedindo **confirmação** de que tinha acertado. A mesma caixa que exigia a
foto recusava a foto.

> O conselho estava certo. O aluno obedeceu. O teto de anexo destruiu a
> confirmação. Ele gastou **~34.720 créditos** em material que o critério da
> própria casa previa que sairia ruim, e foi dormir às 23:16 pedindo reembolso.

Isso não é falha de atendimento nem de produto isoladamente. É a **junção** das
duas, e nenhuma das duas equipes veria sozinha.

---

## O defeito sistêmico que o caso revelou — **#335** (`81438b60`), aberto

`checkFrontalFace` (`face-gate.ts:28-73`), chamado em
`video-clone/route.ts:152-161` **antes de cobrar**, decide com **dois** campos:
`frontal` e `mouth_visible` (linha 65). **Não existe nenhuma condição sobre o
TAMANHO do rosto no quadro.**

A casa **tem** o critério e o **recita ao aluno** (uid 1553: *"quanto menor o
rosto no quadro, menos pixels sobram pra boca e a sincronia fica grosseira"*) —
mas só **depois** do prejuízo. Antes de cobrar, o gate deixa passar.

Correção proposta no chamado: acrescentar `face_height_pct` **na mesma chamada de
visão** (custo e latência zero a mais) e usá-lo como **aviso acionável, não
bloqueio** — o gate é `fail-open` de propósito (linha 70) e travar duro
arriscaria caso legítimo. **O limiar deve ser calibrado em amostra real, não
chutado**: o chamado afirma que hoje o número *não existe*, não que 25% seja o
número certo.

Contraponto que me impede de generalizar: **#216** (`aguardando_aluno`) é
*"insatisfeita com o realismo, **foto já bem enquadrada**"*. Enquadramento
**não** é causa única. O chamado diz o que mediu e para aí.

---

## ⚠️ PR #55 — não mergear (mesma classe do `onedrive-401`)

Aberto **25/08**, vivo, e é **tentativa concorrente do mesmo defeito por outro
caminho**: cria `frontend/src/lib/video/face-check.ts` (+93) e mexe em
`route.ts` (+23) — enquanto a `main` já roda
`frontend/src/lib/video-**clone**/face-gate.ts`, do #131. Se mergear, ficam
**duas checagens de visão** na mesma rota, com latência dobrada e veredito
possivelmente contraditório.

Mesmo risco já documentado no índice para `feat/onedrive-401` e
`feat/fix-image-upload-retry`. **Não mergeio PR (14-A)** — fica o aviso; se for
descartar de vez, apagar no origin.

---

## O que eu fiz

| | o quê |
|---|---|
| **e-mail** | `contato@mastroiannioliveira.com.br`, ~10:50Z. Cópia **CONFIRMADA** em Enviados, **uid 1579** (regra do #210). Assumi o número errado do anexo, **confirmei que o recorte dele está certo**, dei a causa real (rosto pequeno + Turbo + acima de 40s), e ofereci **refazer um teste por conta da casa se ele pedir**. Regra 8 (21/08): individual, caso que estou tratando, decido sozinho. |
| **abri** | **#335** (`81438b60`) — o gate cobra sem medir tamanho de rosto. Conferi antes que **não é duplicata** (19 chamados da família varridos; o mais próximo é o #131, `fixed`, que *criou* o gate). |
| **anotei** | **#331** (`3528dd59`) — diagnóstico completo, o que descartei e o que falta. `agent_notes` 5 → 6. **Não fechei.** |

**Por que #331 continua `investigating` e não `fixed`:** o aluno foi respondido,
mas **o reembolso depende do Johnny** e **o teto de anexo segue quebrado em
produção**. Fechar agora seria repetir exatamente o erro que o Vigia denunciou
hoje no `531b6529`: fechar pelo *caso* e deixar o *mecanismo* vivo. Regra 14
inteira.

---

## O que precisa de DECISÃO do Johnny

1. 🔴 **Reembolso do mastroianni.** Pagou **297 BRL** na avulsa *Fábrica de
   Conteúdo Invisível* (`HP3839091201`, 08/09); o acesso FastCloner até 15/09
   veio junto a **0 BRL**. Pedido em 09/09 23:06 BRT. **Não prometi e não
   desconversei** — disse que está registrado e escalado. Postado no grupo.
2. 🔴 **Os 4 PRs do teto de anexo** (**#41, #42, #187, #230**) seguem parados, o
   mais velho há **18 dias**, e são a causa viva deste pedido de reembolso.
   Item herdado do Vigia, agora com um custo nominal.
3. 🟡 **PR #55** — decidir se fecha/apaga, antes que alguém mergeie.
4. 🔴 Herdados sem mudança: decisão dos **15 vitalícios** (`#313`, ~38h) e o
   **Victor** (`#309`, ~40h) travado atrás dela; **DDL** `104_avisos_enviados.sql`
   sem aval (4º dia).

## Higiene

A árvore local segue com **8 arquivos modificados não commitados** e novos não
rastreados do `/sgp` (`retomada.ts`, `destino.ts`, rotas, `messages/*.json`) —
**não são meus e não toquei**. Commitei só o meu log e o script do #335.
