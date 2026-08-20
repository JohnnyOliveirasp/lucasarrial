# 20/08 — Sincronização, consolidação dos vigias e re-medição do qa_coverage

Ronda fora de horário, disparada pelo Johnny. Três ordens dele + o que a
verificação encontrou depois.

---

## 1. Sincronização (o que estava errado)

Minha cópia estava na branch `feat/teto-1000-admin` e **4 commits não estavam
na main**: o fix do teto de 1000 e **3 logs de ronda** (vigia 02h, 03h, 04h).

Consequência medida, não hipótese: às 03h o vigia reabriu o incidente do
**lucvila** dizendo "aluno sem resposta". O e-mail já tinha sido enviado horas
antes. Ele não tinha como saber — o registro que diria isso estava numa branch
que ninguém lê.

**Feito:**
- `main` atualizada (estava 4 commits atrás de `origin/main`).
- Os 3 commits de ronda + o rascunho do Paulo foram para a main (`c05e5f9`).
- A branch foi rebaseada; a **PR #14 agora tem só o código** (7 arquivos,
  nenhum log de ronda duplicado).
- Conferido na fonte viva: `git log --oneline origin/main..HEAD` **vazio**.

## 2. Dois vigias rodando, um deles cego

Achado que ninguém tinha visto: existiam **duas** rotinas de vigia ativas.

| cron | horário | estado |
|---|---|---|
| `468391a7` | a cada 2h | versão corrigida (conta sem filtro) |
| `ebf0d94f` | **de hora em hora** | **versão velha, filtrava `fast-email:%`** |

A `ebf0d94f` era a versão que a `468391a7` tinha sido criada pra substituir em
19/08 — e eu nunca apaguei a antiga. Ela rodou às 06:27 de hoje e reportou
*"Frente 1: zero, nenhum incidente `fast-email:` aberto"*. É o filtro cego,
literalmente o bug que a correção de 19/08 documenta em caixa alta.

As duas rodando em cima da mesma fila também explicam o trabalho duplicado da
madrugada (02h, 03h, 04h).

**Feito** — consolidado em duas rotinas com papéis separados (regra 14-A):

- `6fac6221` **VIGIA (SENSOR)**, a cada 2h às :10 — varre, ABRE e ANOTA.
  Proibido reabrir fechado, escrever pra aluno ou fechar incidente.
- `19f30ec8` **ROTINA DAS FALHAS (DONO)**, de hora em hora às :40, 8h–22h —
  investiga, decide, conserta, FECHA.

Nas duas entrou: `git checkout main && git pull` antes de começar, o log da
ronda vai **commitado na main**, e as 3 armadilhas medidas ontem (estorno por
`ref_type` e nunca por `kind`; débito órfão é normal; treino que falha começa
listando `raw_audio_paths`).

## 3. Fila: zerada, confirmado no banco

`open` + `investigating`, **sem filtro de signature**: **0**, com `error: null`
impresso junto (a consulta que devolve zero silencioso já me pegou antes).

## 4. O que a varredura de fechados encontrou

Dois incidentes marcados `fixed` dispararam **hoje**: `37bacb68` (10:09) e
`c4b892e9` (10:04). Fui atrás — é o padrão do `8d370ef5`.

### Falhas por dia (fonte: `generations`, paginado)

| dia | gerações | falhas | qa_coverage | taxa |
|---|---|---|---|---|
| 19/08 | 113 | 5 | 5 | 4,4% |
| 20/08 | 36 | 4 | 4 | **11,1%** |

Subiu. Mas o número bruto engana — abrindo caso a caso:

| hora | quem | chars | desfecho | estorno (`ref_type`) |
|---|---|---|---|---|
| 00:35 | dirceu.walber64 | **2000** | falhou | ✅ 2000 devolvidos |
| 02:58 | **johnny.oliveirasp** | 522 | falhou | — (conta admin, não debita) |
| 08:39 | serescastro6 | 1080 | falhou | ✅ 1080 devolvidos |
| 10:09 | serescastro6 | 1080 | falhou | — (retry não debita) |
| 10:15 | serescastro6 | 1080 | **ready** | — |

**Nenhum aluno está travado agora.** São 2 alunos reais (a terceira conta é a
do Johnny), os dois estornados, e os dois voltaram a gerar com sucesso. Dirceu
tem 3 gerações `ready` na mesma madrugada; Seres passou na 3ª tentativa.

### O que isso diz sobre a causa

O Seres falhou **duas vezes e passou na terceira com o texto idêntico**, mesma
voz, 6 minutos depois. Então:

- **Não é o texto.** O fix `d9a14c0` (dígito×extenso, markdown/emoji) ataca
  defeito determinístico de conteúdo. Um texto que falha-falha-passa não é isso.
- **É variância do modelo em texto longo.** As falhas estão em 2000 (o teto),
  1080, 1080. Um de 1495 passou. O portão está pegando por sorte do sorteio.

Consequência prática: o `37bacb68` não deve voltar a `open` — ele está
corrigido pra causa que descrevia. O que sobra é outro bicho, e é exatamente o
item 3 da ordem de hoje (re-medir com a régua corrigida). Deixo anotado aqui em
vez de reabrir, porque reabrir incidente fechado é o erro que a regra 14-A
existe pra impedir.

**O que não foi medido e eu não vou fingir que foi:** quantas regenerações o
portão tenta antes de desistir, e se aumentar esse número resolveria sozinho.
Isso é olhar o handler, não o banco.
