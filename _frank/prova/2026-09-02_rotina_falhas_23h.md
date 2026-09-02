# Rotina das falhas — 02/09/2026, ~22:45Z

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, canal de 31/08 (tudo do
FastCloner vai no **grupo**), `2026-08-29_desligar_vigia_e_frank.md` (planilha desativada) e
`2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

## Placar

| | entrada | saída |
|---|---|---|
| abertos (`open`+`investigating`) | **7** | **4** |
| aguardando aluno | 10 | 10 |

⚠️ **CORRIJO O MEU PRÓPRIO PLACAR — a primeira versão deste registro dizia "7 → 8" e estava
errada.** Escrevi o número no meio da ronda e só fui conferir no banco depois de commitar. O que
aconteceu: às **22:44:43–22:44:59Z**, enquanto eu trabalhava, **outro agente assinando `frank`
fechou quatro chamados** — `#232`, `#235`, `#236` e `#238`. Somando a minha reabertura do `#226`,
a fila fecha a ronda em **4 abertos**: `#47`, `#226`, `#234`, `#237`.

O meu efeito sobre o placar foi **+1 (a reabertura)**, não a queda — a queda é trabalho de outro.
Registro a distinção porque um placar que cai sozinho, lido daqui a uma semana, viraria crédito
meu por serviço que não foi meu.

**A reabertura continua sendo a entrega desta ronda.** É um defeito de 148 alunos que estava
marcado como resolvido e seguia entregando; manter o placar menor exigiria deixar a mentira no
lugar.

## Ordem serial — por que o `#226`

Não é um dos 7 abertos: estava `fixed`. Peguei ele porque a própria ordem de 20/08 manda **checar
fechado com `last_seen_at` recente** ("classe fechada que segue disparando esconde bug nosso"), e
porque a prioridade é aluno afetado antes de limpeza de fila — este tem 148, contra 1 dos abertos
de aluno. Os outros: `#47` e `#235` estão com o aluno (a Alana marcou retorno dia 07); `#234` foi
trabalhado às 20h e depende de amostra maior + decisão do Johnny; `#232` depende da migration 102,
que não foi aplicada; `#237` é irrespondível (provado às 22h); `#238` já tem PR mergeado.

O `#236` era o outro candidato a fechar hoje — não fechei, e o motivo está no §4.

---

## §1 — `#226` (`702cc916`): o fechamento das 16:59Z era falso, e a decisão de reabrir é minha

O Vigia objetou **quatro rondas seguidas** (18h, 20h, 22h, mais a série desde 00h) sem ninguém
responder. Ele está certo em não reabrir — regra 14-A, ele anota e eu decido. **Responder é meu
trabalho, não dele.** Respondi.

Os três fatos, conferidos por mim no banco e no git, não herdados da nota dele:

| o que | estava |
|---|---|
| `resolution_note` | a frase inteira `"enviado email"` |
| `resolved_commit` | `e4cc692` — enquadramento de rosto no **clone de vídeo**, outro subsistema |
| código do QA | `git log runpod-worker/tts_qa/loop.py`: **nenhum** commit que segure a entrega |

O único commit do `#226` é o `d11394c` (01/09), que **grava o score** e não muda comportamento. O
ramo do esgotamento (hoje `loop.py:381-405`) segue com `break` entregando o `best_seg`. Chamado
técnico de uma classe com 148 alunos não fecha por e-mail a um aluno.

### O número que faltava, e que quebra o impasse de 8 rondas

O Vigia carregou 8 notas com a ressalva honesta: *"exhausted>0 NÃO prova que o áudio está
defeituoso; afirmar defeito exige OUVIR, e ouvir não é veredito meu"*. **Certo — mas não precisa
ouvir.** O próprio QA já mede a cobertura do áudio **entregue** e grava em `coverage_min_visto`.

Antes de usar o campo, li a semântica dele em `loop.py:104-160` (`registrar_cobertura`): é *"o elo
fraco do áudio que foi ENTREGUE"*, e o chamador foi movido de propósito em 26/08 justamente para
**não** registrar tomada descartada — a 1ª versão registrava o chunk jogado fora. O limite honesto
escrito no próprio docstring manda ler filtrando `status='ready'`, que foi o que fiz.

**Controle**, mesma janela (02/09 02:32Z–22:43Z, desde que o `d11394c` instrumentou), mesma
consulta, mesma régua (`coverage_min = 0,85`):

| grupo | entregas | alunos | abaixo da régua | pior cobertura |
|---|---|---|---|---|
| `exhausted = 0` | 20 | 14 | **0 (0,0%)** | 0,867 |
| `exhausted > 0` | 22 | 13 | **11 (50,0%)** | **0,571** |

Separação limpa. Metade das entregas com chunk esgotado saiu com o elo fraco **abaixo da nossa
própria régua**; o grupo de controle **nunca** cai abaixo dela. `exhausted` não é telemetria
decorativa — é previsor. E 0,571 significa que ~43% do texto daquele trecho não aparece na
transcrição do áudio que o aluno recebeu.

### Severidade: a hipótese benigna está refutada

A descrição do chamado pedia isso e ninguém tinha feito: *"NÃO gradue por severidade sem medir: eu
não medi caso a caso."* Agora está medido, pelas faixas que o próprio `d11394c` documenta
(`<50` ritmo · `50-99` intrusão · `>=100` cobertura ou fim abrupto):

**21 entregas graduadas, 13 alunos: 15 GRAVES (>=100) em 10 alunos**, 5 intrusão, 1 só ritmo.

~71% dos casos esgotados estão no patamar grave (falta texto ou corta no meio da palavra), **não**
no desvio de ritmo benigno que a ressalva admitia como possibilidade.

### Ainda entregando enquanto eu escrevia

`4f35bef3`, **22:43:07Z**, score 104, cobertura entregue 0,80 — abaixo da régua. 5h44 depois do
`fixed`.

### O aluno que conferi nome a nome

`adv.pmss@gmail.com` (PMS Advogados, `27c49318`). As 4 gerações entre 21:05 e 21:17Z saíram
**todas** com chunk esgotado e **todas graves** (172/100/155/151), cobertura entregue
0,625 / 0,846 / 0,792 / 0,833 — três das quatro abaixo da régua. 400 créditos cada.

⚠️ **Corrijo uma leitura minha antes que alguém repita.** Suspeitei do padrão Marcio ("regerou o
mesmo texto queimando crédito"). **Não é isso** — conferi o `md5(text_normalized)` e os 4 textos
são **diferentes** (431/437/357/377 chars, hashes distintos). O que houve é pior de descrever e
melhor de medir: não foi uma tentativa repetida dando errado, foram **quatro entregas distintas
seguidas**, todas com chunk que o QA desistiu de consertar. Ele não reclamou disso — a única
mensagem dele hoje (20:14Z) é sobre drift de rosto no vídeo, outro assunto.

### A pergunta que volta pro Johnny — agora com o número que faltava para respondê-la

Terceira ronda pedindo a mesma decisão: **quando o QA esgota, falhar sem cobrar ou entregar
avisando?** O argumento de que *"falhar derrubaria 44% das entregas"* vinha do `exhausted>0` cru.
Pela régua de cobertura o alvo é **11 de 42 (26%)** e, se o gate for só o patamar grave, menor
ainda. Falhar o que sai abaixo da própria régua não é derrubar metade da plataforma.

### Limites desta medição, ditos na cara

Janela instrumentada de **20h** e **42 entregas** `ready` com telemetria de cobertura (22 com
`exhausted`, 20 sem). A separação é limpa, mas **n = 42**. A série histórica do Vigia (324/728,
44,5%, 148 alunos) **não** tem `coverage_min_visto` na maior parte — o `d11394c` só instrumentou a
partir de 02/09 02:32Z, então **não dá para graduar retroativamente**. Não reproduzi nada em
runtime do worker: li o banco.

---

## §2 — Para reabrir direito, tive que consertar a ferramenta (PR #161)

O **PR #150** (`#232`) fez a reabertura limpar os **três** campos de fechamento — mas só no lado do
app (`lib/incidents/closure.ts:limparFechamento()`). O `anotar_incidente.cjs` **ficou de fora**, e
ele é o único caminho de reabertura que o dono da fila usa na mão.

Sem o conserto, reabrir o `#226` apagaria `resolved_at`/`resolved_by` e deixaria o **`e4cc692`
colado num chamado aberto** — quem lesse o card depois acreditaria que aquele commit resolveu o
caso. É o defeito que o próprio `closure.ts` já nomeia no cabeçalho (*"deixa `resolved_commit`
órfão"*).

Mudanças: a guarda passa a olhar os **três** campos (não só `resolved_at`, senão um
`resolved_commit` órfão com data já nula nunca é alcançado); `--commit` explícito continua vencendo
de propósito; e o **ensaio passa a imprimir a limpeza** — sem isso era efeito invisível no dry-run,
o oposto do que a ferramenta existe para garantir.

Branch `fix/anotar-incidente-limpa-resolved-commit`, commit `a014c3a`, **PR #161**.

**Confirmado pelo BANCO depois de gravar**, não pelo que o script pretendia fazer:

```
status = investigating · resolved_at = null · resolved_by = null · resolved_commit = null
agent_notes = 17 notas (array) · 1 linha afetada
```

Também **corrigi a `resolution_note`**: ela seguia dizendo `"enviado email"` num chamado aberto.
Concatenei (nunca sobrescrevi) a marcação de que aquilo não tem valor e que este chamado **não tem
resolução**. 13 → 567 chars, 1 linha afetada, conferido na releitura.

---

## §3 — `#236` (Animar Imagem com voz em inglês): eu não fechei, outro fechou, e eu concordo

⚠️ **Este parágrafo foi reescrito depois que o banco me contradisse.** Deixo o raciocínio original
abaixo porque ele ainda vale em parte — mas primeiro a correção, porque ela é contra mim.

Decidi **não** fechar o `#236` alegando que a 2ª metade (PR #158) ainda não estava no ar: às
**22:41Z** eu vi o deploy do `4782871` como `in_progress`. **Ele fechou verde às 22:43:46Z**, dois
minutos depois, e outro agente fechou o chamado às 22:44:44Z citando exatamente isso. **A
afirmação dele estava certa e a minha estava desatualizada** — conferi o run `33691576307` por
conta própria antes de escrever isto.

**Não reabri**, e o motivo importa para não virar zelo performático: a força da evidência aqui é
oposta à do `#226`. Lá o `resolved_commit` era de outro subsistema e o código nunca mudou. Aqui o
código é do subsistema certo, está na main, o deploy fechou verde e eu **conferi na máquina** a
dependência que poderia tornar tudo um no-op silencioso — `stripAudioTrack` tem falha segura e
devolve o vídeo **com** áudio se o ffmpeg faltar; entrei por ssh no servidor de produção e o
binário está instalado, versão **6.1.1**.

**O que continua sem prova, e deixei anotado no card com a receita:** **nenhum aluno animou imagem
desde o deploy.** `image_generations` com `video_path` não nulo e `created_at > 21:30Z` devolve
**zero** linhas; a última entrega `ready` é de 21:21:42Z, anterior às duas metades. O chamado está
fechado com **prova de deploy, não com prova de entrega** — que é a mesma distinção que produziu o
fechamento falso do `#226` às 16:59Z. A diferença é que aqui as outras evidências sustentam o
fechamento e lá não sustentavam nenhuma.

Receita anotada no `#236` para a próxima ronda (2 minutos, sem GPU e sem crédito): primeira linha
`ready` posterior a 22:01:24Z, baixar o objeto do R2, `ffprobe` nos streams, zero `codec_type=audio`
fecha a prova. Priorizando **tier Bronze** — Gold já saía mudo antes, então Gold mudo não prova nada.

### Raciocínio original (mantido para histórico)

Trabalhei, cheguei perto, e parei por falta de prova de produção. Registro onde parou:

- **1ª metade no ar**: PR #155 (`2f1e620`), deploy `Deploy Frontend (production)` **SUCCESS às
  22:01Z**. O corte é no arquivo (`lib/video/strip-audio.ts`, `ffmpeg -c copy -an`), entre o
  download do Kie e o `PutObject` do R2 — vendor-independent, com falha segura.
- **Pré-condição conferida por mim no servidor**, porque a falha segura devolve o vídeo **com**
  áudio em silêncio se o ffmpeg faltar: `ssh root@91.99.15.213` → `/usr/bin/ffmpeg`, **versão
  6.1.1**. Existe. O conserto não vai virar no-op silencioso por ambiente.
- **2ª metade ainda não**: PR #158 (`80b9289`, clipe de cena) entrou no deploy do `4782871`, que
  estava **`in_progress`** às 22:41Z.
- **O que falta para fechar**: não existe **nenhuma** geração de Animar Imagem posterior às 22:01Z.
  A mais recente `ready` é de **21:21Z**, anterior ao deploy. Ou seja: tenho código certo, deploy
  verde e ffmpeg no lugar, mas **zero amostra de produção**. Fechar agora seria repetir exatamente
  o erro que estou desfazendo no `#226` — carimbar `fixed` com prova de merge em vez de prova de
  entrega.

Para a próxima ronda: pegar a 1ª geração de imagem-vídeo criada depois de 22:01Z, baixar o objeto
do R2 e rodar `ffprobe`. Zero faixas de áudio = fecha. O aluno **já foi respondido e já foi
estornado** em 02/09 (uid 466), então não há ninguém esperando — falta só a prova.

---

## §4 — O que eu NÃO fiz, de propósito

- **Não estornei ninguém.** Não casei `ref_id`, e estorno sem prova já produziu os falsos `#100`,
  `#125` e `#152`. Se for estornar, é decisão com o dinheiro na mesa, não efeito colateral de uma
  reabertura.
- **Não escrevi para os 5 alunos** abaixo da régua. Avisar quem não reclamou sobre defeito que não
  notou é decisão de produto/marca e cai perto de comunicação em massa — precisa do "pode" do
  Johnny (regra 8).
- **Não virei chave nenhuma** no worker (`TTS_TAIL_QA_INTERNO_MODO` segue em sombra) e **não refiz
  áudio de ninguém** (gasta GPU sem o aluno pedir).
- **Não afirmo** que os áudios estão *audivelmente* defeituosos. Afirmo o medido: saíram abaixo da
  nossa própria régua de cobertura, metade das vezes, e o controle nunca sai.
- **Não fechei o `#236`** (motivo no §3) nem mergeei PR nenhum.
- **Não toquei** em crédito, migration nem status de compra. Nenhum e-mail saiu nesta ronda.
- **Não atuei** sobre `luanmarcal.com@gmail.com`, que a varredura acusa com import quebrado em
  29/08 por arquivo não público no **Drive**: é onboarding antigo/planilha, e a ordem de 29/08 me
  proíbe de ler, classificar, avisar ou reprocessar. Registro e não toco. (2ª ronda seguida.)

## Registro de rotina

- `#226` (`702cc916`): `fixed` → `investigating`, notas **16 → 17**, `resolution_note` **13 → 567**
  chars, os 3 carimbos de fechamento a `null`. **2 escritas, 1 linha afetada cada, ambas conferidas
  na releitura pelo banco.**
- **Nenhum incidente novo aberto.** O defeito do `#226` já tinha chamado; abrir outro seria
  duplicar. O buraco da ferramenta virou PR, não chamado (1 ocorrência, conserto no mesmo ato).
- **Nenhum e-mail** enviado (nem individual, nem em massa). **Nenhuma GPU, nenhum crédito, nenhuma
  migration, nenhum merge.**
- Nada da **planilha** foi lido, escrito, classificado, avisado ou reprocessado (ordem 29/08).
- Não li a caixa do `suporte@` nesta ronda — a fonte foi a fila de incidentes e o banco.
- Grupo: postado com `notify-grupo.sh`. **Nada foi para o privado do Johnny** (ordem 31/08).
- `_frank/ferramentas/assinatura_em_dobro.cjs` segue **untracked** — não é meu e não é desta ronda.
  **7ª ronda seguida** registrando em vez de commitar trabalho de outro agente em silêncio.

## Pendências que atravessam rondas (sem movimento hoje)

| item | rondas parado |
|---|---|
| PRs **#41/#42** (teto de 2MB) | 11º dia |
| **Migration 102** (`#232`) sem aplicar, aguarda Johnny | 8ª ronda |
| Decisão de produto do **`#226`** | 3ª ronda — **agora com o número para decidir** |
| Detector de "fechado que voltou a disparar" mente no `#226` (`last_seen` congelado em 01/09, `occurrences` 290 contra 324+ reais) | 5ª ronda |
