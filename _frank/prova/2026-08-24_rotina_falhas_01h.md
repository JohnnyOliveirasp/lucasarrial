# 24/08 ~01h UTC — Rotina das Falhas (dono da fila, regra 14-A)

`git checkout main && git pull --ff-only origin main` → atualizado, nada preso.
Índice de ordens lido. Valem a `2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐), a
`2026-08-20_REGRA_FINAL_CREDITO.md` e a `2026-08-21_passagem_incidentes_para_claude.md`.

⚠️ **A 9-B entrou em vigor hoje** ("a partir de 24/08"): o Johnny está dirigindo e
sem condição de aprovar. Isso muda o turno — ver §4.

---

## Placar

| | |
|---|---|
| Incidentes abertos no início | **13** (5 `open`, 8 `investigating`) |
| Peguei | **1** — `111` / `a9de22d5` |
| Fechei | **0** — motivo no §3 |
| Fix subido pra produção | **1** — PR #43, merge `9680b35` |
| Bug de código achado | **1** — flag `--geracao` nunca funcionou |
| Aluno avisado | **0** — não há aluno reclamando no `111` |
| Crédito que eu mexi | **nenhum** |
| GPU que eu gastei | **nenhuma** |
| Arquivo de aluno que eu reescrevi | **nenhum** (tudo em ENSAIO) |

---

## 1. Por que peguei o `111` e não outro

A regra 8 manda pegar o mais antigo com aluno afetado. O topo da fila está
**travado em decisão do dono**, não em trabalho meu:

| # | quem | por que não anda |
|---|---|---|
| `15` | 12 alunos | `ignored` por decisão do Johnny (aceite de risco). Dormente desde 18/08 — **não voltou**, então não reabri |
| `79` | Rafael | 24.360 cr > teto de 20.000 da 9-B → "para e chama". Escalado 15h (`message_id 314`), **10h sem resposta** |
| `82`/`95` | Luciano | pergunta **comercial** (o que o pacote incluía). Escalado 17h (`message_id 317`) |
| `90` | Kessuly | promessa comercial sem dono, mesma classe |

Sobrou o bloco de 23/08 **20:54 → 22:52**: `101`, `102`, `108`, `109`, `111`.
Estão todos dentro de ~2h — empate prático. O desempate da regra 8 é **"o que tem
mais gente sofrendo"**, e o `111` dizia **2.625** contra 1–5 dos outros. Peguei ele.

Registro honesto: **peso também que o `111` era o único cujo conserto já estava
construído e não dependia de ninguém** (ferramenta commitada, sem GPU, sem crédito,
sem migration). Não foi só a antiguidade que decidiu.

## 2. O que eu medi (e o que a medição derrubou)

### 2.1 O deploy nunca tinha sido verificado em produção — agora foi

A nota anterior registrava que até 23:05Z **nenhuma geração nova tinha nascido
depois do merge do PR #38**, então o efeito em produção *"AINDA NAO FOI OBSERVADO"*.
Era o item 1 do "o que falta" e ninguém tinha feito.

25 gerações `ready` nasceram entre **22:51Z e 01:31Z**. Amostrei 9. As de áudio VBR
(25,8s a 57,0s) nascem **todas com `Xing=sim`** e header batendo com o real
(perda de −0,026s a −0,047s). **O fix está de pé em produção.**

### 2.2 O número 2.625 não se sustenta

`2.625` é o **universo** de gerações antigas com mp3, não a contagem de quebradas.

**(a)** Amostra determinística de 80 antigas (1 a cada 32, cobrindo 17/07→23/08):
49 com Xing, **31 sem Xing = 38,8%**. Projeção ~1.017 — já não é 2.625.

**(b)** Mas *sem Xing não é o defeito*. O critério da própria ferramenta é
`perda > 0,05s`, com **`perda = real − header`** — só dói quando o áudio real é
**maior** que o anunciado, porque aí o player corta o fim.

Medi **14 das 31**, uma a uma, espalhadas de 07/08 a 20/08:

| perda medida | quantas |
|---|---|
| negativa (header anuncia **a mais** — não corta nada) | 12 |
| ≈ zero (+0,010s, +0,037s) | 2 |
| **acima do critério de cura** | **0** |

**Zero das 14 seriam curadas.** Arquivo sem Xing é comum e quase sempre
**inofensivo**: é CBR, onde a duração sai exata de tamanho/bitrate e o Xing nem é
necessário. Os 3 arquivos da Kátia curados em 23/08 tinham perda **positiva** —
são reais, mas **não representam a frota**.

### 2.3 Consequência pra decisão que está com o Johnny

O que foi escalado foi *"pode reescrever 2.625 arquivos de aluno?"*, com o medo de
**dobrar os objetos do bucket**. A ferramenta é **idempotente e pula arquivo sadio**,
então um `--todos` só gravaria backup do que realmente curar — população
demonstravelmente muito menor que 2.625 e possivelmente perto de zero.
**O risco da operação é muito menor do que o pedido fazia parecer.**

**Não rodei nada em massa.** Continua sendo decisão do dono; medir o número não me
dá o "pode".

## 3. Por que NÃO marquei `fixed`

Porque não resolvi: falta a decisão do dono sobre o `--todos`, e a taxa real de
perda positiva ainda não está fechada (medi 14 das 31 da amostra). Ficou
`investigating` **com nota do que já descartei** — que é o que a regra manda quando
não se sabe. Fechar aqui seria trocar "medi bem" por "resolvi", e não é a mesma coisa.

## 4. O aviso que importa mais que este incidente

A **9-B entrou em vigor hoje** e diz que o Johnny está dirigindo, sem condição de
aprovar merge, ouvir áudio ou olhar código. Só que **4 dos 13 incidentes abertos —
e os 4 mais antigos com aluno esperando — estão parados exatamente em decisão dele**,
dois deles com relógio:

- **Rafael** (`79`): 24.360 cr acima do teto, 10h sem resposta.
- **Luciano** (`82`/`95`): acesso vence **26/08** — 2 dias.

A 9-B abriu o lado que *devolve*, mas essas quatro são pergunta **comercial** ou
valor **acima do teto**, que ela manda parar. Enquanto ele estiver na estrada, a
fila não anda por cima — ela anda por baixo, nos itens técnicos. **Estou dizendo
isto agora, não no relatório**, porque o do Luciano vence sozinho.

## 5. Bug de código achado e corrigido

A flag `--geracao` da `curar_mp3_xing.cjs` **nunca funcionou**: `.like()` em coluna
uuid devolve `42883 operator does not exist: uuid ~~ unknown`, com id completo **ou**
prefixo. Está documentada no README desde que a ferramenta nasceu. A cura da Kátia
em 23/08 só saiu porque usou `--aluno`.

Sem essa flag não havia como medir geração a geração — **foi consertar ela que
permitiu a medição do §2.2**. Corrigido, revisado e **mergeado na main** (9-B:
"corrigir bug de código → você revisa e mergeia"): **PR #43**, merge `9680b35`.
Conferido nos dois caminhos em ENSAIO.

## 6. O que eu NÃO fiz

- Não gastei GPU, não mexi em crédito, não rodei migration.
- Não reescrevi **nenhum** arquivo de aluno — tudo em ENSAIO.
- Não avisei aluno: não há aluno reclamando no `111`.
- Não reabri o `15` (não voltou a disparar) nem toquei nos que estão com o Johnny.
- Não medi as 17 sem-Xing restantes da amostra. A taxa real de perda positiva
  segue **não fechada** — e é por isso que o `111` não fechou.

## 7. Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` → **vazio**.
O meu trabalho não ficou preso: `feat/curar-mp3-geracao-por-id` foi mergeada e
deletada, e o log desta ronda está na `main`.

## 8. ⚠️ O passo obrigatório achou coisa — e não é minha

O `git branch` + `git rev-list main..<branch>` que a ordem manda rodar existe por
causa do fix que ficou **9h preso** em 19/08. Rodei e ele acusou: **28 branches com
commit fora da `main`**, e só **18 têm PR aberto**. Sobram **~11 sem PR nenhum** —
não é fila de review, é trabalho **invisível**, que ninguém vai revisar porque
ninguém sabe que existe.

Duas são fix de aluno e **não estão em produção** (só a `main` deploya):

| branch (sem PR) | o que o commit diz | por que importa |
|---|---|---|
| `fix/trava-foto-nova-8379549c` | *"trava bloqueante quando foto nova do banco ficou fora da geracao"* | é o fix do incidente `8379549c` — **6 alunos**, a foto enviada não entra na geração **e cobra igual** |
| `feat/valida-conteudo-audio-ingestao` | *"HTML de login do OneDrive nao vira mais .mp3 no R2 — conteudo decide, nao o rotulo"* | é a classe do **Cláudio Sityá**: arquivo que não é áudio entra em `raw_audio_paths` e o treino falha **culpando o aluno** |

E duas são **registro** preso em branch, exatamente o que a ordem proíbe:
`prova/2026-08-20-pagante-trancado` e `rescue/relatorio-noturno-7e02e90`.

**NÃO mergeei nenhuma.** É código de outro agente, sem review, às 2h — e a ordem de
19/08 já avisa que pelo menos uma branch dessas (`feat/fix-image-upload-retry`) está
**STALE e não deve ser mergeada**. Mergear 11 no escuro trocaria um problema
conhecido por um desconhecido. Fica **medido e nomeado** para a próxima ronda decidir
uma a uma, começando pelas duas de aluno.

Registro o que isso significa sem suavizar: enquanto essas duas ficarem fora da
`main`, os 6 alunos do `8379549c` seguem tendo foto ignorada e sendo cobrados, e a
ingestão segue aceitando arquivo que não é áudio. O código existe. Só não está onde
serve.
