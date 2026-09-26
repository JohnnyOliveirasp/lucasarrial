# Ronda das falhas — 26/09/2026, ~12hZ (rodou 11:40–12:0xZ)

> Conferi a primeira linha dos arquivos vizinhos antes de escolher o nome
> (aviso da ronda das 22h30: os nomes desta pasta não são índice confiável).
> `10h` é do Vigia, `11h` é a ronda anterior; este é o `12h`.

**Método: serial (regra 8).** Um caso levado até o fim do que eu posso fazer
sozinho: o **`#594`**, que era a pendência nomeada da ronda das 11hZ ("vídeo
não gerando — prometi olhar em separado"). O título estava errado: não é vídeo,
é **áudio**, e é da mesma aluna do relógio das 12:00Z.

**Esta ronda achou a causa de um defeito real e confirmou por dois
instrumentos independentes.** Não fechou incidente, e explico por quê: o que
falta não é investigação, são **duas decisões de dono**.

**Produção tocada:** nenhuma. Zero GPU, zero migration, zero DDL, zero crédito
movido, zero código alterado. As escritas foram: **1 carta** (uid 3491) e
**1 nota** em cartão existente (`#594`, `open` → `investigating`).

**Ordem de 29/08 respeitada:** nada vindo da planilha foi lido, escrito,
classificado ou reprocessado. **Canal (ordem de 31/08):** os três avisos
saíram **no grupo**, nada no privado do Johnny.

---

## Passo fixo 1 — reconciliar os envios (ordem de 18/09)

```
1322  lidas da pasta "Sent"      (11hZ: 1321 — +1 no intervalo)
1245    já tinham linha
   0    repetidas · 77 fora da janela (--corte) · 0 recusadas
   0    DENTRO DA JANELA — escrituráveis
✔ 1322 = 1322 · 🕳️ cartas sem linha dentro da janela: 0
```

Irmão de leitura independente (`2026-09-18_enviados_x_tabela.cjs`): **0 carta
depois do corte**. Veredito: buraco **PASSIVO**. Os dois instrumentos batem.

> A carta desta ronda saiu **depois** da medição: uid **3491**, linha gravada
> em `emails_enviados` (origem `ronda-manual`), cópia confirmada na pasta na 1ª
> tentativa. O controle compensatório do `#101` pegou a carta desta ronda.

⚠️ As 77 anteriores a 14/09 14:06:31Z seguem sem decisão — é o `--corte`, não
recusa.

## Passo fixo 2 — percepção travada (ordem de 17/09)

```
controle positivo OK (#310) · controle negativo OK (#518 descontado)
579 incidentes varridos
👁 SO PARAM POR FALTA DE VER/OUVIR/ASSISTIR: 0 · mais velho 0d
```

⚠️ Limite mantido do `#585`: este detector lê `agent_notes[-1]` cru e é **cego
em 13% da frota**. O `0` está certo **pelo conteúdo que ele enxerga**, não pelo
alcance. **Não leia como saúde.**

## Passo fixo 3 — estado da fila

```
início:  579 = 336 fixed + 119 investigating + 67 ignored + 37 aguard. + 20 open
fim:     579 = 336 fixed + 120 investigating + 67 ignored + 37 aguard. + 19 open
```

A única diferença é minha: movi o `#594` de `open` para `investigating`.
**Nada mais entrou nem saiu** no intervalo de ~20 min.

---

## O caso serial: `#594` — "meu áudio saiu estranho"

Cartão aberto pela Fast em **26/09 02:09Z** (chat de ajuda dentro do app),
`0 notas` até esta ronda. Aluna: **`gtfinger@proton.me`** (Graziela) — a mesma
do relógio de acesso. Geração **`399014a3`**, 01:57Z, 37,3s, **719 cr
debitados**, status `ready`.

### A causa, por dois instrumentos que não se falam

**1) Telemetria da própria casa** (o `qa` da geração, lido no banco):

```
tail_interno_entregue    = 3
tail_interno_entregue_n  = 6      (+1 sem veredito = 7 pedaços entregues)
tail_interno_entregue_pos_s = [6.08, 22.161, 28.229]
tail_interno_pos_crossfade_ms = 60
```

Pela docstring de `registrar_tail_interno` (`tts_qa/loop.py:162`) o numerador
conta **pedaços entregues com a fronteira interna REPROVADA**. Ou seja: metade
dos pedaços julgados que viraram áudio dela saiu com a fronteira decepada. É a
pergunta que aquele campo existe pra responder — *"o #234 ainda chega no
aluno?"* — e a resposta aqui é **sim**.

**2) Envelope acústico** (`cauda_decepada.cjs`). Rodei o **`--ensaio` antes**,
como o próprio cabeçalho manda: a régua reproduziu os 3 casos classificados à
mão pelo Johnny em 02/09. Só então apontei pra ela:

| t | release | platô | veredito |
|---|---|---|---|
| 16,076s | 205 ms | −42,9 dB | limpa |
| **22,301s** | **5 ms** | **−24,6 dB** | **DECAPITADA** |
| 31,677s | 45 ms | −33 dB | *não classificada* (release > 35 não bate a regra, mas platô alto — quase-caso, registro em vez de omitir) |
| 37,301s | 120 ms | −58 dB | limpa |

O positivo em **22,301s é mais extremo que o positivo conhecido da Katia**
(`81d4f3f4`: 10 ms / −27,9 dB) e cai **em cima** do 22,161s que a telemetria
já tinha gravado sozinha. Duas réguas diferentes, mesmo ponto do arquivo.

### Alcance honesto — o que eu NÃO provei

As outras duas fronteiras da telemetria (**6,08s** e **28,23s**) o
`cauda_decepada` **não vê**: ele só mede fronteira com corrida de silêncio
≥120 ms, e esses dois pontos caem dentro de trecho de **fala contínua**
(`silencedetect −45dB`: 3,94→7,14s e 25,11→29,31s sem pausa nenhuma). Ausência
de fronteira ali é **cegueira do instrumento, não prova de que está limpo**.

**Confirmado 1 de 3 pelo som. Os outros 2 seguem só na telemetria.** Não vou
somar os três e reportar "3 defeitos medidos", que seria inflar a régua.

### Dois erros meus que a medição pegou antes de virarem conclusão

Registro porque o barato aqui é errar contra o instrumento, não contra o aluno.

1. **Declarei "zero pausas em 37s" e estava errado.** Rodei `silencedetect` a
   **−35 dB** num áudio cujo `mean_volume` é **−25,5 dB** — limiar acima do
   piso de ruído, então ele devolveu vazio. Li o zero do instrumento cego como
   propriedade do mundo, que é exatamente a família do `#226`. A −45 dB as
   pausas aparecem. **Corrigido dentro da própria ronda.**
2. **Quase abri chamado de cura que não existe.** `tail_cura_tentada = 0` com
   os cinco `tail_cura_bail_*` zerados parece cura que nunca foi chamada. Fui
   ao código: `inference.py` (docstring do resgate, ~l.712) diz que
   `_curar_fim_abrupto` **não se aplica a fronteira interna de propósito** —
   a cura regenera o chunk inteiro e trocaria fim decepado por texto faltando.
   A cura só cobre o fim do **arquivo** (`tail_checked = 1`). **Não é bug.**

Também descartei a pista mais chamativa: os `raw_audio_paths` da voz têm
**dois pares com o mesmo nome de origem** (`AUDIO-...20-03-40`,
`...20-03-57`). É a família do `2026-09-20_audio_duplicado_infla_a_regua.cjs`,
mas aquele instrumento é de `sgp_pedidos`, não de `voices`, e **nome igual é
pista, não prova** (ordem de 27/08 §3 — só ETag/ContentLength do R2 fecham).
**Não medi, então não afirmo.** Fica como ponta solta nomeada abaixo, e não
entrou na causa.

### O portão existe e está desligado de propósito

`TTS_TAIL_QA_INTERNO_MODO` faz **default `"sombra"`**
(`jobs/tts_settings.py:264`). Em sombra ele **anota e deixa passar** — daí o
`tail_interno_sombra = 4`. Virar pra `"reprovando"` é **chave de ambiente, sem
deploy** (`tts_settings.py:167`), mas custa regens = **GPU**.

Então **não há conserto de código pra eu subir.** O sistema fez o que a casa
mandou ele fazer. O que falta é decidir se a casa continua mandando isso.

### Por que eu NÃO estornei os 719 cr

Conferi que **não existe estorno casado** — por `ref_type` + `ref_id`, **nunca
por `kind`** (a armadilha que quase pagou em dobro pra 13 alunos). Só o débito
de −719.

Mas a régua de estorno da casa
(`2026-09-23_estornar_audio_entregue_com_defeito.cjs`) exige que a entrega
tenha ficado **abaixo do piso de cobertura da própria casa**. O dela **não
ficou**:

```
coverage_medio 0.9901  contra piso 0.85    faltantes_total 1 ('se')
grafia 1 ('escrevo>escrevi')
```

O defeito dela é **decapitação**, e a casa hoje **declara decapitação interna
como tolerada** (o portão em sombra). Estornar aqui não seria *aplicar* o
critério vigente — seria **mudar** o critério. Isso é decisão de dono, e eu
não faço na surdina um dia depois de ter perguntado. **Os 719 cr seguem
debitados, e eu disse isso a ela com todas as letras.**

### O que eu fiz

1. **Escrevi pra ela** (uid 3491, registrada em `emails_enviados`): que ela
   está certa, o que está **medido** (22s) e o que está **só indicado** (6s e
   28s), que a falha é nossa, que **os 719 cr continuam debitados** e que a
   devolução **não é decisão minha**. Ofereci **refazer sem custo se ela
   pedir** — não disparei, porque é GPU sem o aluno ter pedido.
2. **Anotei o `#594`** com a medição inteira, o alcance, os dois erros meus e
   os caminhos de código.
3. **Mantive `investigating`, não `aguardando_aluno`:** quem trava é a **casa**
   (portão + estorno), não a resposta dela — 2ª correção de 21/09.

---

## O relógio da Graziela: o que aconteceu, sem enfeite

Cheguei 11:40Z com o corte marcado pras **12:00Z** e o aviso da ronda anterior
já dado às 10h4xZ. Conferi no banco: `access_until` em 12:00Z, `updated_at`
**congelado em 04:25Z**. **Ninguém tinha tocado em nada.**

Avisei o grupo **três vezes** (11h42Z com a pergunta binária, 11h52Z como
último aviso antes do corte, e no post do `#594`). Ofereci a alternativa barata
e reversível: **esticar `access_until` em 7 dias** — não gasta GPU, não gasta
crédito, não mexe em dinheiro, desfaz-se numa linha.

**Não recebi resposta e não agi sozinho.** Não reativei na Hotmart (ação
externa em plataforma de pagamento, é do dono) e **não estiquei o
`access_until` por conta própria** — fazer isso 10 minutos depois de ter feito
a pergunta seria transformar o pedido de autorização em teatro.

Estado no fim da ronda (12:0xZ): a decisão **não foi tomada**. Se ela caiu,
caiu por um cancelamento que a **casa** fez (`CANCELLED_BY_SELLER`), não por
inadimplência, tendo ela pago **R$ 2.913,24** e usado o produto às 04:25Z de
hoje.

**Isto fica registrado como decisão não tomada, não como acidente.** O estrago
é reversível — os 97.581 créditos, a voz e os vídeos continuam lá, e reativar
devolve o acesso. Avisei ela disso na carta pra não ser pega de surpresa.

---

## Outros achados da ronda

**`olho` falhou no despacho de percepção.** Criei o card `05c59ff0` pra ele
ouvir o mp3 e ele voltou `failed`, sem saída — provavelmente não alcança
arquivo local por caminho. **Não fingi que houve veredito de ouvido**: troquei
de rota e fui pelo envelope acústico, que é instrumento e não opinião. Lição
bancada (`remember` #2044).

⚠️ E o `cauda_decepada.cjs` me salvou de um erro pior: eu ia **transcrever** o
áudio como prova. O cabeçalho dele avisa que **transcrição é régua cega pra
este defeito** — o whisper devolve a palavra inteira mesmo com o áudio
decepado, por prior de linguagem. Teria medido 100% de cobertura e concluído
que estava tudo bem.

**Fechados que seguem disparando** (`2026-08-20_fechados_que_disparam.cjs`):
17 fechados com sinal de vida, **0 vivos nas últimas 48h**, mas **8
reincidentes com aluno** — `#154, #130, #82, #167, #126, #141, #375, #407`.
O script não tem opinião sobre os **217 cegos**. Não investiguei nesta ronda;
fica nomeado.

**A ponta solta da ronda anterior (`fixed` 337→336) não é reconstituível.**
Nenhum cartão tem `resolved_at` preenchido com status fora de
`fixed`/`ignored`, então não foi reabertura simples. Sem um snapshot da lista
anterior isso não se responde retroativamente — e a ronda das 11hZ registrou o
número, não a lista. **Recomendação:** a ronda passar a gravar a lista de ids
`fixed`, não só a contagem. Enquanto não gravar, essa diferença é
irrastreável. **Não inventei causa.**

---

## Pendências nomeadas (com dono e passo exato)

| # | o que falta | dono |
|---|---|---|
| `#551` | reativar o FastCloner dela (relógio das 12:00Z **venceu sem decisão**) | **Johnny** |
| `#551` | decidir reembolso da Comunidade (R$ 1.803,60) — **prometido a ela** | **Johnny / Lucas** |
| `#594` | ligar ou não `TTS_TAIL_QA_INTERNO_MODO=reprovando` (chave de ambiente, sem deploy, custa GPU) | **Johnny** |
| `#594` | devolver ou não os 719 cr (muda critério, não aplica critério) | **Johnny / Lucas** |
| `#594` | refazer a geração — **só se ela pedir** | Frank, ao responder |
| `#590` | teto do PM2: subir ou não | **Johnny** |
| — | os 2 pares de `raw_audio_paths` com nome de origem igual: medir ETag/ContentLength no R2 | Frank (próxima ronda) |
| — | 8 reincidentes com aluno em cartão fechado | Frank (próxima ronda) |

**Não estou travado nelas:** todas têm dono nomeado e a pergunta está feita.

## Limite desta ronda, dito na cara

Eu **achei e provei a causa** do `#594`, mas **não consertei nada** — porque
não há código quebrado pra consertar, e as duas alavancas que existem (o portão
e o estorno) são do dono. Um cartão com causa achada e dono nomeado é melhor
que ontem, mas **não é um cartão fechado**, e eu não vou carimbar `fixed` em
cima disso (regra 14).

E a aluna terminou a ronda com **os 719 cr ainda debitados** e possivelmente
**sem acesso**. Eu fiz o que estava na minha alçada — medir, escrever pra ela
dizendo a verdade, escalar três vezes com relógio — e parei onde começa a
alçada do dono.

---

## Passo fixo de fim de ronda — nada preso em branch

```
git fetch origin && git log --oneline origin/main..HEAD   →  (conferido abaixo)
```

Esta ronda **não criou branch nenhuma** — não toquei em código, só em 1 carta
e 1 nota. O log vai direto na `main`, como manda a ordem.

⚠️ Mesmo limite registrado pela ronda das 11hZ: a varredura de branches cobre
a **janela de 48h**, não as ~300 branches locais do repositório. As STALE já
documentadas no índice de ordens (`feat/onedrive-401`,
`fix/trava-foto-nova-8379549c`, `fix/ritmo-da-referencia-porta-73a60bb`,
`fix/estorno-treino-por-saldo-pendente`, as 2 da cura de referência) seguem
**não-mergeáveis**. Auditar as ~300 é tarefa própria, não passo de ronda.
