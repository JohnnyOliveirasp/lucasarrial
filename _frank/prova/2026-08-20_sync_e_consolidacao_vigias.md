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

---

## CORREÇÃO (11:06 UTC, mesmo dia) — a régua mudou no meio da minha medição

Escrevi a seção acima sem saber que o Johnny tinha subido `aae3ba5`
*"fix(voz): parar de reprovar audio BOM — a régua passa a medir a FORMA do
buraco"* às **11:01 UTC**. Foi esse commit que fez meu push ser rejeitado; eu
rebaseei em cima dele e não olhei o que ele era. Erro meu.

**Todas as 5 falhas que eu tabelei são de ANTES das 11:01** (00:35, 02:58,
08:39, 10:09, e o `ready` das 10:15). Ou seja: **medi a régua velha e apresentei
como se fosse o estado atual.**

O que continua valendo, porque é observação e não inferência:

- os 2 alunos reais foram estornados e voltaram a gerar;
- o mesmo texto de 1080 chars falhou 2× e passou na 3ª — sob a régua velha o
  resultado era não-determinístico. Isso é fato medido.

O que **não** vale mais como conclusão: dizer que "sobra outro bicho" e que
falta re-medir. Não falta — o Johnny já atacou exatamente isso, e a régua nova
mede a FORMA do buraco em vez de exigir lista de exceção pra número, markdown e
rótulo de locutor.

### Sobre o deploy, que aqui é diferente do resto do repo

`runpod-worker/handler.py` **não** vai pro ar com push na main — mas neste repo
o caminho existe e é completo (`.github/workflows/runpod-worker.yml`): build →
GHCR com **tag imutável do sha** → `saveTemplate` apontando o template pra essa
imagem → recicla os workers 0→N, **sem recriar o endpoint** (lição InfiniteTalk
de 07/07 anotada no próprio workflow).

Então, ao contrário do app, aqui **Action verde é deploy de verdade**. A ressalva
some, mas a verificação não: o run de `aae3ba5` estava `in_progress` às 11:06.

**Próximo passo, e é medição, não opinião:** contar `qa_coverage` em
`generations` com `created_at > 11:01 UTC` depois que o run ficar verde. Antes
disso qualquer número é da régua velha. Nenhum aluno está travado no intervalo,
então dá pra esperar o dado em vez de chutar.

---

## SEGUNDA CORREÇÃO (11:25 UTC) — o 11,1% também estava errado

Virei a medição em ferramenta (`_frank/ferramentas/qa_coverage.cjs`) e ela
achou mais um erro meu, no mesmo relatório:

| dia | eu reportei | o número certo |
|---|---|---|
| 19/08 | 4,4% | **4,5%** (110 gerações de aluno, 5 falhas) |
| 20/08 | **11,1%** | **7,7%** (39 gerações de aluno, 3 falhas) |

Inflei o de hoje porque contei a conta do **próprio Johnny** como falha de
aluno. Conta de admin/sócio não debita crédito e não é indicador — é a regra do
`bypassesBilling`, que eu conheço e não apliquei. Errar pra mais custa o mesmo
que errar pra menos: 11% soa emergência, 7,7% soa acompanhar.

### E o defeito atinge mais gente do que eu disse

Falei em "2 alunos". São **6 alunos distintos** em dois dias:

```
19/08 18:11 | pestanatiago2008      |  464ch | 145s
19/08 18:14 | pestanatiago2008      |  464ch | 140s
19/08 18:47 | allysoncruz.nutri     | 1600ch | 153s
19/08 18:51 | estudioelianeguedes   |  414ch | 154s
19/08 19:05 | nucleartstudio        |  137ch |  39s
20/08 00:35 | dirceu.walber64       | 2000ch | 226s
20/08 08:39 | serescastro6          | 1080ch | 142s
20/08 10:09 | serescastro6          | 1080ch | 146s
```

**Mata de vez a minha teoria de "texto longo":** o `nucleartstudio` falhou com
**137 caracteres**. E nenhum `elapsed_seconds` é anormal (39s a 226s), então
nada disso é hang — é reprovação do QA mesmo, o que separa este caso do
incidente de timeout `d3d8d1b2`.

### Depois da régua nova: ainda não dá pra dizer

4 gerações desde as 11:01, 0 falhas. A ferramenta **se recusa a concluir** com
n abaixo de 20, e está certa: com n=4, uma falha a mais viraria 25%. Por isso
virou rotina diária (`7 11 * * *`) em vez de resposta de hoje.

### Lição que fica

Fiz três afirmações erradas sobre o mesmo assunto em uma manhã: régua velha,
taxa inflada e número de alunos subestimado. Todas por medir na mão, com
recorte improvisado, sob pressa. A correção não é "prestar mais atenção" — é a
ferramenta com as armadilhas escritas dentro dela, que foi o que fiz.
