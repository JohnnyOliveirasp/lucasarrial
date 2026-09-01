# Rotina das Falhas — 27/08/2026, ronda das 21h UTC (Claude, dono da fila)

Método serial (regra 8, ordem de 21/08): um incidente por vez, até o fim.
Papéis (regra 14-A): o Vigia abre e anota; eu investigo, decido e fecho.
`git checkout main && git pull --ff-only origin main` → já estava em dia.
Índice de ordens lido antes de tocar em qualquer coisa. Ordem vigente:
`2026-08-27_vigia_so_erro_de_sistema.md` (14-C).

## Placar

| | |
|---|---|
| Abertos no início (sem `aguardando_aluno`) | **7** |
| Abertos no fim | **6** |
| **Fechados nesta ronda** | **1** (`#157`, com aluna respondida e produto conferido no código) |
| **Alunos que passaram a ter resposta** | **1** (Luziélia) |
| Alunos do `#153` que eu li e apurei | **4** (a lacuna que a ronda das 19h deixou escrita) |
| Incidentes anotados com medição nova | **2** (`#153`, `#158`) |
| PR aberto | **1** (`#74`, só texto do manual) |
| Afirmação de outra ronda derrubada por medição | **1** (a resposta pronta do `#157`) |
| Crédito / GPU / migration / merge / e-mail em massa | **nada tocado** |

---

## 1. Os dois mais velhos seguem travados em aval — reconferidos, não repetidos

**`#11`** (36,9 dias): `information_schema` devolve **zero** coluna `trainer%`
em `training_jobs`. A **migration `scripts/97` continua não aplicada**. Os 3
afetados já estão apurados (ronda das 18h) e nenhum espera. Único bloqueio: aval.

**`#99`** e **`#120`**: os dois alunos já foram respondidos hoje (17h20Z e
18h50Z/17h20Z) e o que falta nos dois é **decisão comercial do Lucas/Johnny** —
posicionamento do Luciano e reembolso do curso da Sandra (prazo dela: 30/08).
Não são silêncio por falta de dono; são decisão pendente. Segui pro próximo
(regra 8).

## 2. `#153` — peguei este, e fechei a lacuna que a ronda das 19h deixou escrita

A nota das 19h termina assim, com todas as letras: *"os outros 4 alunos
(Luciano `#82`, Sandra `#145`, Luzielia `#141`, Itamar `#130`) não foram lidos
por mim nesta ronda"*. Li os quatro. **Agora os 5 afetados estão atendidos.**

| aluno | situação |
|---|---|
| Cássio (`#126`) | respondido 18h50Z. Reconferido |
| Itamar (`#130`) | **já tinha sido atendido às 19h55Z** — depois que o relatório das 19h foi escrito. Conta conferida: acesso até 23/09, 197.605 cr, estornos do `#121`/`#131` creditados. Nada travado |
| Sandra (`#145`) | respondida 17h20Z. Desfecho é reembolso de **curso**, do Lucas/Johnny |
| Luciano (`#82`) | respondido várias vezes; falta o posicionamento comercial |
| Luziélia (`#141`) | **as duas pendências fechadas hoje**: OneDrive 19h48Z e a pergunta do chat **agora, 20h47Z** |

**O que isso prova e o que não prova:** prova que o passivo de gente esperando
neste chamado foi zerado. **Não** prova que a causa foi corrigida — a
assimetria segue no ar (`entregar.ts:73-118` fecha; `help/route.ts:151-158`
não fecha e reabre). **`#153` segue `investigating`**: o **PR #73** está aberto
e **não mergeado**, e mudar o comportamento de fila é decisão do Johnny.

### Achado que reforça a medição original do chamado

No `#157` a entrega ao time das 17h58Z **não saiu**: `avisar_grupo.cjs` só
funciona no servidor (WAHA em `127.0.0.1`), e o chamado foi fechado antes de
conferir o envio — o próprio autor percebeu e reabriu. Ou seja, além de
*"ninguém responde do lado humano"* (5 de 5 entregas do `#126` sem resposta),
existe o caso em que **a entrega nem chega** e o chamado quase fica fechado por
cima do vazio.

## 3. `#157` — FECHADO, e a resposta pronta que circulava estava incompleta

**A aluna:** Luziélia (`luzielisam@hotmail.com`; conta na plataforma é
`luzielisam@gmail.com` — a armadilha dos dois endereços, caso Cláudio Sityá,
ordem de 21/08. Respondi no `@hotmail`, que é **de onde ela escreve**).

Ela perguntou às 16h08Z no chat do app *"como faço para usar as cenas de um
vídeo já finalizado"* e ficou **4h39 sem resposta humana**.

### A resposta pronta estava incompleta, e eu não a repeti

Circulava desde as 16h25Z: *"não dá pra reaproveitar cena de projeto
finalizado — precisa montar projeto novo"*. Isso é verdade para **copiar cena
entre projetos**, mas **responde errado a pergunta dela**. Fui ao código:

- nenhuma rota de cena tem guarda de `status` — `images/[sceneId]/regenerate`,
  `videos/[sceneId]/regenerate` e `render/route.ts` (que só barra job
  `pending`/`processing` e exige `video_status` ready em todas);
- `video-wizard.tsx` renderiza `SceneStage`/`ImageStage`/`VideoStage` por
  `scene_count > 0`, **não** por status (`STEP_BY_STATUS.done = 5` só pinta os
  pills).

**Projeto finalizado CONTINUA EDITÁVEL**: editar o texto da cena à mão é
grátis, regerar imagem/clipe custa crédito, e dá pra montar o final de novo.
A resposta pronta mandava a aluna **recomeçar do zero sem precisar**.

### O achado que importa: o chat garantiu uma coisa falsa sobre perda de dado

Às 16h01Z o bot escreveu a ela: *"as imagens (as 16) já estão salvas no seu
histórico de imagens, elas ficam lá pra sempre"*. **É falso, medido:**

- as 16 cenas moram em `<user>/videos/b626e2cc/scenes/<xx>` (`video_scenes`);
- o histórico de Imagens dela é `image_generations`: **12 linhas, todas** em
  `/uploads/` ou `/images/<id>/result.png` — **nenhuma** é caminho de cena;
- o `DELETE` de cena chama `deleteKeys(imagesBucket(), [image_path,
  video_path])` **antes** de apagar a linha: destrói imagem e clipe de vez,
  **sem cópia e sem estorno**.

**O risco não se materializou:** `b626e2cc` segue `done`, com **16 linhas reais
em `video_scenes`** (contei as linhas, não o campo `scene_count`) e
`final_video_path` preenchido. Ela não apagou nada.

### O objetivo real dela, corrigido

Ela queria um **vídeo curto**. Apagar cenas do projeto de 16 não entrega isso:
a narração não encolhe e o vídeo fica mais curto que o áudio (a própria copy do
modal novo diz isso). O caminho certo é projeto novo com áudio menor — que é
**o que ela já tinha começado sozinha às 16h45Z** (`20e6344d`). Ela estava
certa, e eu disse isso a ela.

**E-mail enviado 20h47:57Z**, uid **212**, conferido na pasta Enviados **depois**
do envio. Não prometi data pro que não existe (duplicar projeto / copiar cena
entre projetos), e disse isso com essas palavras.

## 4. `#158` — anotado (fechado, não reabri): o fix deixou uma lacuna

O PR #71 proibiu a frase genérica *"você não perde nada"* (regra 7 do manual) e
entregou a lixeira por cena com o modal *"ação irreversível"* — está certo e
está em produção. Mas **não corrigiu o fato específico** que o bot afirmou.
Sem esse fato escrito, ele podia repetir a mesma garantia falsa com outras
palavras — e ela é **mais perigosa** que a frase genérica, porque soa concreta.

## 5. PR #74 — só texto do manual, aguardando aval

`fix/inc157-manual-cena-nao-esta-no-historico`, commit `7755355`. Três linhas
em `manual.ts`, todas conferidas no código: (1) a imagem da cena **não** está
no histórico de Imagens, com a frase proibida nominalmente; (2) projeto `done`
**continua editável**; (3) apagar cena **não** encurta a narração.

**Conferência, sem alegar mais do que medi:** `tsc --noEmit` exit 0;
`node --test` **143/145**. As **mesmas 2** falhas acontecem na `main` **sem** a
minha mudança — `_Bugs/_testes/`, fixture local `_stock_staging/pt/2961`
ausente e voz *"Pri"* inexistente. São pré-existentes e de ambiente, **não
estou alegando suíte limpa**.

**Não mergeei.** Código só entra em produção pela main, com aval.

## 6. Decisões que são do Johnny (a lista não mudou de dono)

1. **Migration `scripts/97`** — trava o `#11` há **36,9 dias**. Reconferida hoje:
   segue não aplicada.
2. **PR #73** (`#153`, detector enxergar o fechado em cima do disparo) — aberto,
   parado.
3. **PR #74** (`#157`, manual) — aberto hoje, só texto.
4. **`#161`** — backfill dos 189 cadastros + PR.
5. **`#153`**: o caminho de e-mail deve parar de re-fechar quando já houve
   entrega anterior? A 2ª entrega significa que a 1ª não funcionou.
6. **`avisar_grupo.cjs` não funciona fora do servidor** e falha **em silêncio**
   para quem roda a ronda daqui. Foi assim que o `#157` quase fechou por cima de
   uma entrega que não existiu.

## 7. Postado no grupo (regra 7, só fato consumado)

Mensagem 500: fechei o `#157`; escrevi pra aluna Luziélia; abri o PR #74.

## 8. O que eu NÃO fiz

Não apliquei migration — em particular **não apliquei a 97**. Não mergeei PR
nenhum. Não gastei GPU, não refiz áudio, não retreinei voz. Não toquei em
crédito, acesso, assinatura nem estorno de ninguém. Não apaguei cena nem
projeto. Não mandei e-mail em massa — só **um** e-mail individual, para a aluna
do caso que eu estava tratando (regra 8). Não li a caixa do suporte@ para
triagem: só `--enviados --para` nos dois endereços dela, para não duplicar
resposta. Não fechei `#153` (a causa não foi corrigida) nem `#11`/`#99`/`#120`
(travados em aval e em decisão comercial). Não reabri o `#158` — anotei.

## 9. Para a próxima ronda

1. **Conferir se a Luziélia respondeu** (perguntei se entendi certo o objetivo dela).
2. **`#160`** segue `open` e sem dono desde 18h41Z (Telma, pedido de produto:
   mais movimento no Vídeo Clone). É o próximo pela regra 8 entre os
   acionáveis — eu não o toquei.
3. **Conferir se Ronald, Cássio e Sandra responderam.**
4. **`#161`**: se o Johnny liberar, backfill + PR.
